import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { StorageService } from './storage.service';
import { DailySchedule, Personnel, SignatureSlot, formatGreekDate, getCorpsShort, normalizeGreek } from '../models/shift.model';

export interface MilitaryPrintExportData {
  schedule: DailySchedule;
  date1Formatted: string;
  date2Formatted: string;
  guardGroups: any[];
  cleaningSections: any;
  col3Data: any;
  extraGuards: any;
  signatures: SignatureSlot[];
  formatSoldierFn?: (personId: string | null | undefined, personNameFallback?: string, suffix?: string) => string;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {
  private storage = inject(StorageService);

  /**
   * Exports the schedule to Excel matching the exact Greek Army landscape duty paper layout.
   */
  async exportScheduleToExcel(schedule: DailySchedule, customData?: MilitaryPrintExportData): Promise<boolean> {
    const unit = this.storage.unitInfo();
    const personnelMap = new Map<string, Personnel>();
    this.storage.personnel().forEach(p => personnelMap.set(p.id, p));

    const fmt = customData?.formatSoldierFn || ((personId: string | null | undefined, personNameFallback?: string, suffix?: string) => {
      if (!personId && !personNameFallback) return '---';
      const p = personId ? personnelMap.get(personId) : null;
      const fullName = p ? p.fullName : (personNameFallback || '---');
      const tokens = fullName.trim().split(/\s+/);
      let displayName = tokens[0] || fullName;
      if (tokens.length > 1 && tokens[1]) {
        const initial = tokens[1].replace(/[^A-Za-zΑ-Ωα-ωΆ-Ώά-ώ]/g, '').charAt(0).toUpperCase();
        if (initial) {
          displayName = `${displayName} ${initial}.`;
        }
      }
      let roomBed = '';
      if (p && (p.barracksRoom || p.bedNumber)) {
        const r = (p.barracksRoom || '').replace(/[^0-9.]/g, '');
        const b = (p.bedNumber || '').replace(/[^0-9]/g, '');
        if (r.includes('.')) roomBed = `(${r})`;
        else if (r && b) roomBed = `(${r}.${b})`;
        else if (r) roomBed = `(${r})`;
        else if (b) roomBed = `(${b})`;
      }
      const parts = [displayName];
      if (roomBed) parts.push(roomBed);
      if (suffix) parts.push(suffix);
      return parts.join(' ');
    });

    // If customData was not passed (e.g. called from Dashboard), compute the default sections
    const data = customData || this.buildDefaultPrintData(schedule, personnelMap);

    const rows: (string | number)[][] = [];
    const merges: XLSX.Range[] = [];
    let currentRow = 0;

    // 1. Official Header
    const unitTitle = unit.name || 'ΜΟΝΑΔΑ';
    rows.push([unitTitle]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
    currentRow++;

    rows.push([unit.division || '']);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
    currentRow++;

    rows.push([formatGreekDate(schedule.date)]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
    currentRow++;

    rows.push(['ΥΠΗΡΕΣΙΕΣ ΟΠΛΙΤΩΝ']);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
    currentRow++;

    // Blank separator
    rows.push([]);
    currentRow++;

    // --- Helper to extract guard column lines ---
    const getGuardLines = (gIdx: number) => {
      const g = data.guardGroups[gIdx];
      const times = (g?.times || []).map((t: any) => `${t.date} ${t.time}`);
      const soldiers: string[] = [];
      (g?.thalamofylakes || []).forEach((s: any) => soldiers.push(fmt(s.personId, s.personName, 'ΘΦ')));
      (g?.oplofylakes || []).forEach((s: any) => soldiers.push(fmt(s.personId, s.personName, 'ΟΦ')));
      (g?.otherGuards || []).forEach((og: any) => {
        (og.slots || []).forEach((s: any) => soldiers.push(fmt(s.personId, s.personName, og.shortName)));
      });
      return { times, soldiers };
    };

    // --- SECTION 1: Shift 1 / Τουαλέτες / Εστιατόρια ---
    rows.push([
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      'ΘΑΛΑΜΟΦΥΛΑΚΕΣ / ΟΠΛΟΦΥΛΑΚΑΣ',
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      data.cleaningSections?.sections[0]?.title || 'ΤΟΥΑΛΕΤΕΣ',
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      'ΕΣΤΙΑΤΟΡΙΑ'
    ]);
    currentRow++;

    const g1 = getGuardLines(0);
    const c1Times = (data.cleaningSections?.sections[0]?.times || []).map((t: any) => `${t.date} ${t.time}`);
    const c1Soldiers = (data.cleaningSections?.sections[0]?.slots || []).map((s: any) => fmt(s.personId, s.personName));
    const rTimes = (data.col3Data?.restaurant?.times || []).map((t: any) => `${t.date} ${t.time}`);
    const rSoldiers = (data.col3Data?.restaurant?.slots || []).map((s: any) => fmt(s.personId, s.personName));

    const sec1Max = Math.max(g1.times.length, g1.soldiers.length, c1Times.length, c1Soldiers.length, rTimes.length, rSoldiers.length, 3);
    for (let i = 0; i < sec1Max; i++) {
      rows.push([
        g1.times[i] || '',
        g1.soldiers[i] || '',
        c1Times[i] || '',
        c1Soldiers[i] || '',
        rTimes[i] || '',
        rSoldiers[i] || ''
      ]);
      currentRow++;
    }

    // --- SECTION 2: Shift 2 / Λουτρά / Μόνιμοι Εστιατόρια & ΚΨΜ ---
    rows.push([
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      'ΘΑΛΑΜΟΦΥΛΑΚΕΣ / ΟΠΛΟΦΥΛΑΚΑΣ',
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      data.cleaningSections?.sections[1]?.title || 'ΛΟΥΤΡΑ / ΝΙΠΤΗΡΕΣ',
      'ΜΟΝΙΜΟΙ ΕΣΤΙΑΤΟΡΙΑ',
      'ΜΟΝΙΜΟΙ ΚΨΜ'
    ]);
    currentRow++;

    const g2 = getGuardLines(1);
    const c2Times = (data.cleaningSections?.sections[1]?.times || []).map((t: any) => `${t.date} ${t.time}`);
    const c2Soldiers = (data.cleaningSections?.sections[1]?.slots || []).map((s: any) => fmt(s.personId, s.personName));
    const permEstSoldiers = (data.col3Data?.permanentEst?.slots || []).map((s: any) => fmt(s.personId, s.personName));
    const permKpsmSoldiers = (data.col3Data?.permanentKpsm?.slots || []).map((s: any) => fmt(s.personId, s.personName));

    const sec2Max = Math.max(g2.times.length, g2.soldiers.length, c2Times.length, c2Soldiers.length, permEstSoldiers.length, permKpsmSoldiers.length, 3);
    for (let i = 0; i < sec2Max; i++) {
      rows.push([
        g2.times[i] || '',
        g2.soldiers[i] || '',
        c2Times[i] || '',
        c2Soldiers[i] || '',
        permEstSoldiers[i] || '',
        permKpsmSoldiers[i] || ''
      ]);
      currentRow++;
    }

    // --- SECTION 3: Shift 3 / Σκάλες-Διάδρομοι / Επιφυλακές & Γραφείς ---
    rows.push([
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      'ΘΑΛΑΜΟΦΥΛΑΚΕΣ / ΟΠΛΟΦΥΛΑΚΑΣ',
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      data.cleaningSections?.sections[2]?.title || 'ΣΚΑΛΕΣ / ΔΙΑΔΡΟΜΟΙ',
      'ΕΠΙΦΥΛΑΚΕΣ',
      'ΓΡΑΦΕΙΣ'
    ]);
    currentRow++;

    const g3 = getGuardLines(2);
    const c3Times = (data.cleaningSections?.sections[2]?.times || []).map((t: any) => `${t.date} ${t.time}`);
    const c3Soldiers = (data.cleaningSections?.sections[2]?.slots || []).map((s: any) => fmt(s.personId, s.personName));
    const epifSoldiers = (data.col3Data?.standby?.slots || []).map((s: any) => fmt(s.personId, s.personName));
    const grafeisSoldiers = (data.col3Data?.grafeis?.slots || []).map((s: any) => fmt(s.personId, s.personName));

    const sec3Max = Math.max(g3.times.length, g3.soldiers.length, c3Times.length, c3Soldiers.length, epifSoldiers.length, grafeisSoldiers.length, 3);
    for (let i = 0; i < sec3Max; i++) {
      rows.push([
        g3.times[i] || '',
        g3.soldiers[i] || '',
        c3Times[i] || '',
        c3Soldiers[i] || '',
        epifSoldiers[i] || '',
        grafeisSoldiers[i] || ''
      ]);
      currentRow++;
    }

    // --- SECTION 4: Shift 4 / Προαύλιος Χώρος ---
    rows.push([
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      'ΘΑΛΑΜΟΦΥΛΑΚΕΣ / ΟΠΛΟΦΥΛΑΚΑΣ',
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      data.cleaningSections?.sections[3]?.title || 'ΠΡΟΑΥΛΙΟΣ ΧΩΡΟΣ',
      'ΕΠΙΦΥΛΑΚΕΣ (συνέχεια)',
      'ΛΟΙΠΟΙ'
    ]);
    currentRow++;

    const g4 = getGuardLines(3);
    const c4Times = (data.cleaningSections?.sections[3]?.times || []).map((t: any) => `${t.date} ${t.time}`);
    const c4Soldiers = (data.cleaningSections?.sections[3]?.slots || []).map((s: any) => fmt(s.personId, s.personName));
    const remainingEpif = epifSoldiers.slice(sec3Max);
    const remainingGrafeis = grafeisSoldiers.slice(sec3Max);

    const sec4Max = Math.max(g4.times.length, g4.soldiers.length, c4Times.length, c4Soldiers.length, remainingEpif.length, remainingGrafeis.length, 3);
    for (let i = 0; i < sec4Max; i++) {
      rows.push([
        g4.times[i] || '',
        g4.soldiers[i] || '',
        c4Times[i] || '',
        c4Soldiers[i] || '',
        remainingEpif[i] || '',
        remainingGrafeis[i] || ''
      ]);
      currentRow++;
    }

    // --- SECTION 5: Επιπρόσθετοι Φύλακες / Υπεύθυνος Υλικού / Αρτοκλίβανος ---
    rows.push([
      data.extraGuards?.hasExtra ? 'ΕΠΙΠΡΟΣΘΕΤΟΙ ΦΥΛΑΚΕΣ' : 'ΕΙΔΙΚΕΣ ΠΑΡΑΤΗΡΗΣΕΙΣ',
      '',
      'ΥΠΕΥΘΥΝΟΣ ΥΛΙΚΟΥ ΚΑΘΑΡΙΟΤΗΤΑΣ',
      '',
      'ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ',
      'ΑΡΤΟΚΛΙΒΑΝΟΣ'
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    currentRow++;

    const extraGuardsSoldiers: string[] = [];
    if (data.extraGuards?.hasExtra) {
      (data.extraGuards?.thalamofylakes || []).forEach((s: any) => extraGuardsSoldiers.push(fmt(s.personId, s.personName, 'ΘΦ')));
      (data.extraGuards?.oplofylakes || []).forEach((s: any) => extraGuardsSoldiers.push(fmt(s.personId, s.personName, 'ΟΦ')));
    } else {
      extraGuardsSoldiers.push('-');
    }

    const supSoldier = data.cleaningSections?.supervisor
      ? fmt(data.cleaningSections.supervisor.personId, data.cleaningSections.supervisor.personName)
      : '---';

    const bTimes = (data.col3Data?.bakery?.times || []).map((t: any) => `${t.date} ${t.time}`);
    const bSoldiers = (data.col3Data?.bakery?.slots || []).map((s: any) => fmt(s.personId, s.personName));

    const sec5Max = Math.max(extraGuardsSoldiers.length, 1, bTimes.length, bSoldiers.length, 2);
    for (let i = 0; i < sec5Max; i++) {
      rows.push([
        extraGuardsSoldiers[i] || '',
        '',
        i === 0 ? supSoldier : '',
        '',
        bTimes[i] || '',
        bSoldiers[i] || ''
      ]);
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
      merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
      currentRow++;
    }

    // --- 3. DYNAMIC SIGNATURES BLOCK ---
    rows.push([]);
    currentRow++;

    const sigs: SignatureSlot[] = data.signatures || [];
    const rowDash = ['', '', '', '', '', ''];
    const rowTitle = ['', '', '', '', '', ''];
    const rowName = ['', '', '', '', '', ''];
    const rowRank = ['', '', '', '', '', ''];

    if (sigs.length === 1) {
      rowDash[2] = '-Ο-';
      rowTitle[2] = sigs[0].roleTitle;
      rowName[2] = sigs[0].fullName;
      rowRank[2] = sigs[0].rank || '';
      merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
      merges.push({ s: { r: currentRow + 1, c: 2 }, e: { r: currentRow + 1, c: 3 } });
      merges.push({ s: { r: currentRow + 4, c: 2 }, e: { r: currentRow + 4, c: 3 } });
      merges.push({ s: { r: currentRow + 5, c: 2 }, e: { r: currentRow + 5, c: 3 } });
    } else if (sigs.length === 2) {
      rowDash[0] = '-Ο-';
      rowTitle[0] = sigs[0].roleTitle;
      rowName[0] = sigs[0].fullName;
      rowRank[0] = sigs[0].rank || '';
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } });
      merges.push({ s: { r: currentRow + 1, c: 0 }, e: { r: currentRow + 1, c: 2 } });
      merges.push({ s: { r: currentRow + 4, c: 0 }, e: { r: currentRow + 4, c: 2 } });
      merges.push({ s: { r: currentRow + 5, c: 0 }, e: { r: currentRow + 5, c: 2 } });

      rowDash[3] = '-Ο-';
      rowTitle[3] = sigs[1].roleTitle;
      rowName[3] = sigs[1].fullName;
      rowRank[3] = sigs[1].rank || '';
      merges.push({ s: { r: currentRow, c: 3 }, e: { r: currentRow, c: 5 } });
      merges.push({ s: { r: currentRow + 1, c: 3 }, e: { r: currentRow + 1, c: 5 } });
      merges.push({ s: { r: currentRow + 4, c: 3 }, e: { r: currentRow + 4, c: 5 } });
      merges.push({ s: { r: currentRow + 5, c: 3 }, e: { r: currentRow + 5, c: 5 } });
    } else {
      // 3 or more: Col 0-1, Col 2-3, Col 4-5
      for (let sIdx = 0; sIdx < Math.min(sigs.length, 3); sIdx++) {
        const colStart = sIdx * 2;
        rowDash[colStart] = '-Ο-';
        rowTitle[colStart] = sigs[sIdx].roleTitle;
        rowName[colStart] = sigs[sIdx].fullName;
        rowRank[colStart] = sigs[sIdx].rank || '';
        merges.push({ s: { r: currentRow, c: colStart }, e: { r: currentRow, c: colStart + 1 } });
        merges.push({ s: { r: currentRow + 1, c: colStart }, e: { r: currentRow + 1, c: colStart + 1 } });
        merges.push({ s: { r: currentRow + 4, c: colStart }, e: { r: currentRow + 4, c: colStart + 1 } });
        merges.push({ s: { r: currentRow + 5, c: colStart }, e: { r: currentRow + 5, c: colStart + 1 } });
      }
    }

    rows.push(rowDash);
    currentRow++;
    rows.push(rowTitle);
    currentRow++;
    // Blank rows for signature ink
    rows.push([]);
    currentRow++;
    rows.push([]);
    currentRow++;
    rows.push(rowName);
    currentRow++;
    rows.push(rowRank);
    currentRow++;

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set Column Widths (matching 6-column landscape paper)
    ws['!cols'] = [
      { wch: 18 }, // Col A: Date & Time
      { wch: 30 }, // Col B: Guards & Duties
      { wch: 18 }, // Col C: Cleaning Times
      { wch: 28 }, // Col D: Cleaning Personnel
      { wch: 18 }, // Col E: Times / Roles
      { wch: 30 }  // Col F: Service Personnel
    ];
    ws['!merges'] = merges;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    const sheetName = `Διαταγή_${schedule.date.slice(5)}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const filename = `Ημερήσια_Διαταγή_Υπηρεσίας_${unit.name.replace(/[\/\s]/g, '_')}_${schedule.date}.xlsx`;

    // Save using Electron or Web download
    if (this.storage.isElectron() && window.electronAPI) {
      try {
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const res = await window.electronAPI.saveExcelFile(buffer, filename);
        if (res.success && res.filePath) {
          this.storage.notify(`Το αρχείο Excel εξήχθη επιτυχώς: ${res.filePath}`, 'success');
          return true;
        } else if (res.canceled) {
          return false;
        } else {
          this.storage.notify(`Σφάλμα εξαγωγής: ${res.error}`, 'error');
          return false;
        }
      } catch (err: any) {
        this.storage.notify(`Σφάλμα: ${err.message}`, 'error');
        return false;
      }
    } else {
      XLSX.writeFile(wb, filename);
      this.storage.notify('Το αρχείο Excel λήφθηκε επιτυχώς!', 'success');
      return true;
    }
  }

  /**
   * Builds default data matching the print view when called from non-print components
   */
  private buildDefaultPrintData(schedule: DailySchedule, personnelMap: Map<string, Personnel>): MilitaryPrintExportData {
    const dStr = schedule.date;
    const parts = dStr.split('-').map(Number);
    const d1 = `${parts[2]}/${parts[1]}/${parts[0]}`;
    const next = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const d2 = `${next.getDate()}/${next.getMonth() + 1}/${next.getFullYear()}`;

    const findDuty = (kw: string) => {
      const normKw = normalizeGreek(kw);
      return schedule.duties.find(d => {
        const normName = normalizeGreek(d.dutyName || '');
        const normId = normalizeGreek(d.dutyTypeId || '');
        const normShort = normalizeGreek(d.shortName || '');
        return normName.includes(normKw) || normId.includes(normKw) || normShort.includes(normKw);
      });
    };

    const thDuty = findDuty('θαλαμ');
    const opDuty = findDuty('οπλοφ');
    const kathDuty = findDuty('καθαρι');
    const estDuties = schedule.duties.filter(d => {
      const dtDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      const name = (d.dutyName || '').toLowerCase();
      const code = (d.dutyTypeId || '').toLowerCase();
      const isMonimoi = name.includes('μονιμ') || code.includes('monim');
      if (isMonimoi) return false;
      if (dtDef?.timePresetType === 'RESTAURANT_CYCLE') return true;
      return code === 'duty-estiatoria' || name.includes('εστιατορ') || code.includes('estiator');
    });
    const estSlots = estDuties.flatMap(d => d.slots);
    
    const artDuty = schedule.duties.find(d => {
      const id = (d.dutyTypeId || '').toLowerCase();
      const normName = normalizeGreek(d.dutyName || '');
      const normShort = normalizeGreek(d.shortName || '');
      const dtDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      const dtNormName = normalizeGreek(dtDef?.name || '');
      const dtNormShort = normalizeGreek(dtDef?.shortName || '');

      return id === 'duty-artoklivanos' ||
             id.includes('artokliv') ||
             id.includes('bakery') ||
             normName.includes('αρτοκλιβ') ||
             normName.includes('αρτοποι') ||
             normName.includes('φουρν') ||
             normShort === 'αρτ' ||
             normShort.includes('αρτοκλ') ||
             dtNormName.includes('αρτοκλιβ') ||
             dtNormName.includes('αρτοποι') ||
             dtNormShort === 'αρτ';
    });

    // Fallback to soldier with special role if no assigned slot
    let finalArtSlots = artDuty?.slots || [];
    const hasAssignedArt = finalArtSlots.some(s => !!(s.personId || s.personName));
    if (!hasAssignedArt) {
      const artSoldierRole = this.storage.personnel().find(p => {
        if (p.active === false || !p.specialRole) return false;
        const r = normalizeGreek(p.specialRole);
        return r.includes('αρτοκλιβ') || r.includes('αρτοποι') || r.includes('φουρν');
      });
      if (artSoldierRole) {
        finalArtSlots = [{
          slotIndex: 1,
          personId: artSoldierRole.id,
          personName: artSoldierRole.fullName
        }];
      }
    }

    const epifDuty = schedule.duties.find(d => {
      const normName = normalizeGreek(d.dutyName || '');
      const normCode = normalizeGreek(d.dutyTypeId || '');
      return normName.includes('επιφυλακ') || normCode.includes('επιφυλακ');
    });

    const timeDefs = [
      [{ date: d1, time: '14:00 - 16:00' }, { date: d1, time: '22:00 - 00:00' }, { date: d2, time: '06:00 - 08:00' }],
      [{ date: d1, time: '16:00 - 18:00' }, { date: d2, time: '00:00 - 02:00' }, { date: d2, time: '08:00 - 10:00' }],
      [{ date: d1, time: '18:00 - 20:00' }, { date: d2, time: '02:00 - 04:00' }, { date: d2, time: '10:00 - 12:00' }],
      [{ date: d1, time: '20:00 - 22:00' }, { date: d2, time: '04:00 - 06:00' }, { date: d2, time: '12:00 - 14:00' }]
    ];

    const guardGroups = timeDefs.map((times, idx) => {
      const gIndex = idx + 1;
      const th = (thDuty?.slots || []).filter(s => s.groupIndex === gIndex || (!s.groupIndex && (s.slotIndex === gIndex * 2 - 1 || s.slotIndex === gIndex * 2)));
      const op = (opDuty?.slots || []).filter(s => s.groupIndex === gIndex || (!s.groupIndex && s.slotIndex === gIndex));
      return { groupIndex: gIndex, times, thalamofylakes: th, oplofylakes: op, otherGuards: [] };
    });

    const standardTimes = [
      { date: d1, time: '14:00 - 15:00' },
      { date: d1, time: '20:00 - 21:00' },
      { date: d2, time: '07:00 - 07:30' }
    ];

    const cleaningSections = {
      sections: [
        { title: 'ΤΟΥΑΛΕΤΕΣ', times: standardTimes, slots: kathDuty?.slots.slice(0, 1) || [] },
        { title: 'ΛΟΥΤΡΑ / ΝΙΠΤΗΡΕΣ', times: standardTimes, slots: kathDuty?.slots.slice(1, 2) || [] },
        { title: 'ΣΚΑΛΕΣ / ΔΙΑΔΡΟΜΟΙ', times: standardTimes, slots: kathDuty?.slots.slice(2, 3) || [] },
        { title: 'ΠΡΟΑΥΛΙΟΣ ΧΩΡΟΣ', times: standardTimes, slots: kathDuty?.slots.slice(3, 4) || [] }
      ],
      supervisor: kathDuty?.slots[4] ? { personId: kathDuty.slots[4].personId, personName: kathDuty.slots[4].personName } : null
    };

    const col3Data = {
      restaurant: { times: [{ date: d1, time: '16:00 - 22:00' }, { date: d2, time: '05:20 - 16:00' }], slots: estSlots || [] },
      bakery: { times: [{ date: d2, time: '06:50 - 14:00' }], slots: finalArtSlots },
      standby: { slots: epifDuty?.slots || [] },
      permanentEst: { slots: [] },
      permanentKpsm: { slots: [] },
      grafeis: { slots: [] }
    };

    const hpList = this.storage.higherPersonnel();
    const defaultSigs: SignatureSlot[] = hpList.length > 0 ? hpList.slice(0, 3).map(hp => ({
      roleTitle: hp.roleTitle,
      fullName: hp.fullName,
      rank: hp.rank,
      higherPersonnelId: hp.id
    })) : [
      { roleTitle: 'ΑΞΙΩΜΑΤΙΚΟΣ ΥΠΗΡΕΣΙΑΣ', fullName: '', rank: '' },
      { roleTitle: 'Ο ΔΙΟΙΚΗΤΗΣ', fullName: '', rank: '' }
    ];

    return {
      schedule,
      date1Formatted: d1,
      date2Formatted: d2,
      guardGroups,
      cleaningSections,
      col3Data,
      extraGuards: { hasExtra: false, thalamofylakes: [], oplofylakes: [] },
      signatures: defaultSigs
    };
  }

  // Export full personnel roster to Excel
  async exportPersonnelRosterToExcel(): Promise<boolean> {
    const personnel = this.storage.personnel();
    const unit = this.storage.unitInfo();

    const rows: (string | number)[][] = [
      ['ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ'],
      ['ΥΠΟΥΡΓΕΙΟ ΕΘΝΙΚΗΣ ΑΜΥΝΑΣ'],
      [`ΜΟΝΑΔΑ: ${unit.name} - ${unit.location}`],
      ['ΕΠΙΣΗΜΗ ΚΑΤΑΣΤΑΣΗ ΔΥΝΑΜΕΩΣ & ΜΗΤΡΩΟΥ ΥΠΗΡΕΣΙΩΝ'],
      [`Ημερομηνία Εξαγωγής: ${new Date().toLocaleDateString('el-GR')}`],
      [],
      [
        'Α/Α',
        'Βαθμός',
        'Ονοματεπώνυμο',
        'Α.Σ.Μ.',
        'Τηλέφωνο',
        'ΟΠΛΟ',
        'Ικανότητα',
        'Οπλισμός',
        'Θάλαμος',
        'Κρεβάτι',
        'Υπηρεσίες',
        'Τελευταία Υπηρεσία',
        'Ενεργός'
      ]
    ];

    personnel.forEach((p, idx) => {
      rows.push([
        idx + 1,
        p.rankShort || 'ΣΤΡ',
        p.fullName,
        p.asm || '-',
        p.phone || '-',
        getCorpsShort(p.specialty),
        p.fitnessProfile || (p.status === 'Άοπλος' ? 'Ι3' : 'Ι1'),
        p.status,
        p.barracksRoom || '-',
        p.bedNumber || '-',
        p.dutyScore,
        p.lastDutyDate ? formatGreekDate(p.lastDutyDate) : 'Καμία',
        p.active ? 'ΝΑΙ' : 'ΟΧΙ'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 10 },
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Δύναμη_Προσωπικού');
    const filename = `Δύναμη_Προσωπικού_${unit.name.replace(/[\/\s]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    if (this.storage.isElectron() && window.electronAPI) {
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const res = await window.electronAPI.saveExcelFile(buffer, filename);
      if (res.success && res.filePath) {
        this.storage.notify(`Το αρχείο Excel δημιουργήθηκε: ${res.filePath}`, 'success');
        return true;
      }
      return false;
    } else {
      XLSX.writeFile(wb, filename);
      this.storage.notify('Το αρχείο Excel λήφθηκε επιτυχώς!', 'success');
      return true;
    }
  }
}
