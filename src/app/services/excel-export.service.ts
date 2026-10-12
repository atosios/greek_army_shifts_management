import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { StorageService } from './storage.service';
import { DailySchedule, Personnel, SignatureSlot, DailyExodouchoiPlan, DailyExodouchoiSoldier, formatGreekDate, formatRecordPersonName, getCorpsShort, normalizeGreek } from '../models/shift.model';

export interface MilitaryPrintExportData {
  schedule: DailySchedule;
  date1Formatted: string;
  date2Formatted: string;
  guardGroups?: any[];
  cleaningSections?: any;
  col3Data?: any;
  extraGuards?: any;
  signatures?: SignatureSlot[];
  leftColumnShifts?: any[];
  middleColumnData?: any;
  rightColumnData?: any;
  printSignatures?: any;
  formatSoldierFn?: (personId: string | null | undefined, personNameFallback?: string, suffix?: string) => string;
  unitTitle?: string;
  divisionTitle?: string;
  dateTitle?: string;
  subTitle?: string;
  subRule1?: string;
  subRule2?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {
  private storage = inject(StorageService);

  /**
   * Exports the schedule to Excel matching the exact Greek Army landscape duty paper layout (3-column board).
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
      const parts = [displayName];
      if (suffix) parts.push(suffix);
      return parts.join(' ');
    });

    // If customData was not passed (e.g. called from Dashboard), compute the default sections
    const data = customData || this.buildDefaultPrintData(schedule, personnelMap);

    const rows: (string | number)[][] = [];
    const merges: XLSX.Range[] = [];
    let currentRow = 0;

    // 1. Official Header (Merged across 7 columns)
    const mainTitle = data.dateTitle || `ΥΠΗΡΕΣΙΕΣ ΣΤ' ΚΤΗΡΙΟΥ Γ' ΠΥΡΧΙΑΣ ΤΗΣ ${data.date1Formatted}`;
    rows.push([mainTitle]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    const subRule1 = data.subRule1 || 'ΟΙ ΠΑΡΑΚΑΤΩ ΥΠΗΡΕΣΙΕΣ ΙΣΧΥΟΥΝ ΑΠΟ ΣΗΜΕΡΑ ΣΤΙΣ 14:00 ΕΩΣ ΤΙΣ 14:00 ΤΗΣ ΕΠΟΜΕΝΗΣ ΜΕΡΑΣ';
    rows.push([subRule1]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    const subRule2 = data.subRule2 || 'ΚΑΘΑΡΙΟΤΗΤΕΣ [14:00-15:00 & 20:00-21:00 & 06:30-07:30]';
    rows.push([subRule2]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    const unitTitle = (data.unitTitle || unit.name || 'ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)') + 
      (data.divisionTitle ? ` - ${data.divisionTitle}` : (unit.division ? ` - ${unit.division}` : ''));
    rows.push([unitTitle]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    // Blank separator row before main board
    rows.push([]);
    currentRow++;

    // 2. Build the 3 Board Columns
    const leftColRows: [string, string][] = [];
    const middleColRows: [string, string][] = [];
    const rightColRows: [string, string, string][] = [];
    const rightMergesLocal: { sR: number; sC: number; eR: number; eC: number }[] = [];

    // --- Column 1 (Left): 4 Shifts of ΟΠΛΟΦΥΛΑΚΑΣ & ΘΑΛΑΜΟΦΥΛΑΚΕΣ ---
    const leftShifts = data.leftColumnShifts || [];
    leftShifts.forEach((shift: any, sIdx: number) => {
      leftColRows.push(['ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ', 'ΟΠΛΟΦΥΛΑΚΑΣ & ΘΑΛΑΜΟΦΥΛΑΚΕΣ']);
      
      const t0 = shift.times?.[0] ? `${shift.times[0].date}  ${shift.times[0].time}` : '';
      const opName = fmt(shift.oplofylakas?.personId, shift.oplofylakas?.personName, '(ΟΦ)');
      leftColRows.push([t0, opName]);

      const t1 = shift.times?.[1] ? `${shift.times[1].date}  ${shift.times[1].time}` : '';
      const th1Name = fmt(shift.thalamofylakes?.[0]?.personId, shift.thalamofylakes?.[0]?.personName);
      leftColRows.push([t1, th1Name]);

      const t2 = shift.times?.[2] ? `${shift.times[2].date}  ${shift.times[2].time}` : '';
      const th2Name = fmt(shift.thalamofylakes?.[1]?.personId, shift.thalamofylakes?.[1]?.personName);
      leftColRows.push([t2, th2Name]);

      if (sIdx < leftShifts.length - 1) {
        leftColRows.push(['', '']);
      }
    });

    // --- Column 2 (Middle): ΣΚΟΠΙΑ, ΔΕΚΑΝΕΙΣ, ΥΠΑΡΧΙΦΥΛΑΚΑΣ, ΑΜ ---
    const midData = data.middleColumnData || {};

    // Table 1: Σκοπιά
    const skopia = midData.skopia || {};
    middleColRows.push(['ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ', skopia.title || 'ΣΚΟΠΙΑ ΚΕΝΤΡΙΚΗ ΠΥΛΗ']);
    (skopia.shifts || []).forEach((sh: any) => {
      const t0 = sh.times?.[0] ? `${sh.times[0].date}  ${sh.times[0].time}` : '';
      const g0 = fmt(sh.guards?.[0]?.personId, sh.guards?.[0]?.personName);
      middleColRows.push([t0, g0]);

      const t1 = sh.times?.[1] ? `${sh.times[1].date}  ${sh.times[1].time}` : '';
      const g1 = fmt(sh.guards?.[1]?.personId, sh.guards?.[1]?.personName);
      middleColRows.push([t1, g1]);

      const t2 = sh.times?.[2] ? `${sh.times[2].date}  ${sh.times[2].time}` : '';
      middleColRows.push([t2, '']);
    });
    middleColRows.push(['', '']);

    // Table 2: Δεκανείς
    const dek = midData.dekaneis || {};
    middleColRows.push(['ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ', dek.title || 'ΔΕΚΑΝΕΙΣ ΑΛΛΑΓΗΣ']);
    (dek.shifts || []).forEach((sh: any) => {
      const t0 = sh.times?.[0] ? `${sh.times[0].date}  ${sh.times[0].time}` : '';
      const g0 = fmt(sh.guard?.personId, sh.guard?.personName);
      middleColRows.push([t0, g0]);
    });
    middleColRows.push(['', '']);

    // Table 3: Υπαρχιφύλακας
    const yparch = midData.yparchifylakas || {};
    middleColRows.push(['ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ', yparch.title || 'ΥΠΑΡΧΙΦΥΛΑΚΑΣ']);
    const yt0 = yparch.shift?.times?.[0] ? `${yparch.shift.times[0].date}  ${yparch.shift.times[0].time}` : '';
    const yg0 = fmt(yparch.shift?.guard?.personId, yparch.shift?.guard?.personName);
    middleColRows.push([yt0, yg0]);
    middleColRows.push(['', '']);

    // Table 4: ΑΜ
    const am = midData.am || {};
    middleColRows.push(['ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ', am.title || 'ΑΜ']);
    (am.shifts || []).forEach((sh: any) => {
      const t0 = sh.times?.[0] ? `${sh.times[0].date}  ${sh.times[0].time}` : '';
      const g0 = fmt(sh.guards?.[0]?.personId, sh.guards?.[0]?.personName);
      middleColRows.push([t0, g0]);
      if (sh.guards?.length > 1) {
        for (let gIdx = 1; gIdx < sh.guards.length; gIdx++) {
          middleColRows.push(['', fmt(sh.guards[gIdx]?.personId, sh.guards[gIdx]?.personName)]);
        }
      }
    });

    // --- Column 3 (Right): ΕΣΤΙΑΤΟΡΙΑ, ΑΡΤΟΚΛΙΒΑΝΟΣ, ΕΠΙΦΥΛΑΚΗ, ΞΕΝΟΚΡΑΤΗΣ, ΚΑΘΑΡΙΟΤΗΤΕΣ ---
    const rightData = data.rightColumnData || {};

    // 1. Εστιατόρια
    const est = rightData.estiatoria || {};
    let rIdx = rightColRows.length;
    rightColRows.push(['ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ', est.title || 'ΕΣΤΙΑΤΟΡΙΑ (15:00-16:00)', '']);
    rightMergesLocal.push({ sR: rIdx, sC: 1, eR: rIdx, eC: 2 });

    rIdx = rightColRows.length;
    rightColRows.push([est.note || 'ΟΙ ΠΑΡΑΚΑΤΩ ΜΕΤΑΒΑΙΝΟΥΝ ΝΩΡΙΤΕΡΑ ΜΕ ΟΡΙΣΜΕΝΟ ΒΑΓΟΝΙ', '', '']);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 2 });

    const estTimes = est.times || [];
    const estGuards = est.guards || [];
    for (let i = 0; i < 5; i++) {
      const tStr = estTimes[i] ? `${estTimes[i].date}  ${estTimes[i].time}` : '';
      const g1 = estGuards[i] ? `${i + 1}. ${fmt(estGuards[i].personId, estGuards[i].personName)}` : '-';
      const g2 = estGuards[i + 5] ? `${i + 6}. ${fmt(estGuards[i + 5].personId, estGuards[i + 5].personName)}` : '-';
      rightColRows.push([tStr, g1, g2]);
    }
    rightColRows.push(['', '', '']);

    // 2. Αρτοκλίβανος
    const art = rightData.artoklivanos || {};
    rIdx = rightColRows.length;
    rightColRows.push([art.title || 'ΑΡΤΟΚΛΙΒΑΝΟΣ (06:50-14:00)', '', '']);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 2 });

    const artGuards = art.guards || [];
    rIdx = rightColRows.length;
    rightColRows.push([
      artGuards[0] ? `1. ${fmt(artGuards[0].personId, artGuards[0].personName)}` : '-',
      '',
      artGuards[1] ? `2. ${fmt(artGuards[1].personId, artGuards[1].personName)}` : '-'
    ]);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });

    rIdx = rightColRows.length;
    rightColRows.push([
      artGuards[2] ? `3. ${fmt(artGuards[2].personId, artGuards[2].personName)}` : '-',
      '',
      artGuards[3] ? `4. ${fmt(artGuards[3].personId, artGuards[3].personName)}` : '-'
    ]);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });
    rightColRows.push(['', '', '']);

    // 3. Επιφυλακή
    const epif = rightData.epifylaki || {};
    rIdx = rightColRows.length;
    rightColRows.push([epif.title || 'ΕΠΙΦΥΛΑΚΗ', '', '']);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 2 });

    const epifGuards = epif.guards || [];
    for (let i = 0; i < 3; i++) {
      rIdx = rightColRows.length;
      const g1 = epifGuards[i] ? `${i + 1}. ${fmt(epifGuards[i].personId, epifGuards[i].personName)}` : '-';
      const g2 = epifGuards[i + 3] ? `${i + 4}. ${fmt(epifGuards[i + 3].personId, epifGuards[i + 3].personName)}` : '-';
      rightColRows.push([g1, '', g2]);
      rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });
    }
    rightColRows.push(['', '', '']);

    // 4. Ξενοκράτης
    const xen = rightData.xenokratis || {};
    rIdx = rightColRows.length;
    rightColRows.push([xen.title || 'ΞΕΝΟΚΡΑΤΗΣ', '', '']);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 2 });

    const xenGuards = xen.guards || [];
    for (let i = 0; i < 3; i++) {
      rIdx = rightColRows.length;
      const g1 = xenGuards[i] ? `${i + 1}. ${fmt(xenGuards[i].personId, xenGuards[i].personName)}` : '-';
      const g2 = xenGuards[i + 3] ? `${i + 4}. ${fmt(xenGuards[i + 3].personId, xenGuards[i + 3].personName)}` : '-';
      rightColRows.push([g1, '', g2]);
      rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });
    }
    rightColRows.push(['', '', '']);

    // 5. Καθαριότητες
    const kath = rightData.kathariotites || {};
    rIdx = rightColRows.length;
    rightColRows.push([kath.title ? `${kath.title} [14:00-15:00 & 20:00-21:00 & 06:30-07:30]` : 'ΚΑΘΑΡΙΟΤΗΤΕΣ', '', '']);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 2 });

    const kathSecs = kath.sections || [];
    rIdx = rightColRows.length;
    rightColRows.push([kathSecs[0]?.title || 'ΤΟΥΑΛΕΤΕΣ', '', kathSecs[1]?.title || 'ΛΟΥΤΡΑ / ΝΙΠΤΗΡΕΣ']);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });

    for (let i = 0; i < 2; i++) {
      rIdx = rightColRows.length;
      const g1 = kathSecs[0]?.guards?.[i] ? fmt(kathSecs[0].guards[i].personId, kathSecs[0].guards[i].personName) : '-';
      const g2 = kathSecs[1]?.guards?.[i] ? fmt(kathSecs[1].guards[i].personId, kathSecs[1].guards[i].personName) : '-';
      rightColRows.push([g1, '', g2]);
      rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });
    }

    rIdx = rightColRows.length;
    rightColRows.push([kathSecs[2]?.title || 'ΣΚΑΛΕΣ / ΠΡΟΘΑΛΑΜΟΣ / ΘΑΛΑΜΟΙ', '', kathSecs[3]?.title || 'ΠΡΟΑΥΛΙΟΣ ΧΩΡΟΣ / ΕΞΩΤ. ΣΚΑΛΕΣ']);
    rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });

    for (let i = 0; i < 2; i++) {
      rIdx = rightColRows.length;
      const g1 = kathSecs[2]?.guards?.[i] ? fmt(kathSecs[2].guards[i].personId, kathSecs[2].guards[i].personName) : '-';
      const g2 = kathSecs[3]?.guards?.[i] ? fmt(kathSecs[3].guards[i].personId, kathSecs[3].guards[i].personName) : '-';
      rightColRows.push([g1, '', g2]);
      rightMergesLocal.push({ sR: rIdx, sC: 0, eR: rIdx, eC: 1 });
    }

    // --- Combine the 3 Board Columns into the Sheet ---
    const maxBoardRows = Math.max(leftColRows.length, middleColRows.length, rightColRows.length);
    const boardStartRow = currentRow;

    for (let r = 0; r < maxBoardRows; r++) {
      const left = leftColRows[r] || ['', ''];
      const mid = middleColRows[r] || ['', ''];
      const right = rightColRows[r] || ['', '', ''];
      rows.push([...left, ...mid, ...right]);
      currentRow++;
    }

    // Apply right column merges with row offset and column offset (Cols E..G = 4..6)
    rightMergesLocal.forEach(m => {
      merges.push({
        s: { r: boardStartRow + m.sR, c: 4 + m.sC },
        e: { r: boardStartRow + m.eR, c: 4 + m.eC }
      });
    });

    // --- 3. Official Signatures Block (Bottom) ---
    rows.push([]);
    currentRow++;

    const sigs = data.printSignatures || {
      left: { roleTitle: 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ', fullName: '', rank: '' },
      center: { roleTitle: 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ', fullName: '', rank: '' },
      right: { roleTitle: 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ', fullName: '', rank: '' }
    };

    // Row: ΘΕΩΡΗΘΗΚΕ
    rows.push(['ΘΕΩΡΗΘΗΚΕ', '', '', '', '', '', '']);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    // Row: -Ο-
    rows.push(['-Ο-', '', '-Ο-', '', '-Ο-', '', '']);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    // Row: Role Titles
    rows.push([
      sigs.left?.roleTitle || 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ', '',
      sigs.center?.roleTitle || 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ', '',
      sigs.right?.roleTitle || 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ', '', ''
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    // Rows: Blank Signature space
    rows.push([]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    rows.push([]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    // Row: Officer Names
    rows.push([
      sigs.left?.fullName || '', '',
      sigs.center?.fullName || '', '',
      sigs.right?.fullName || '', '', ''
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    // Row: Officer Ranks
    rows.push([
      sigs.left?.rank || '', '',
      sigs.center?.rank || '', '',
      sigs.right?.rank || '', '', ''
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } });
    merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
    merges.push({ s: { r: currentRow, c: 4 }, e: { r: currentRow, c: 6 } });
    currentRow++;

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set Column Widths (matching 7-column landscape military board)
    ws['!cols'] = [
      { wch: 18 }, // Col A: Col 1 Time (14:00 - 16:00, etc.)
      { wch: 28 }, // Col B: Col 1 Duty (Οπλοφύλακας & Θαλαμοφύλακες)
      { wch: 18 }, // Col C: Col 2 Time
      { wch: 28 }, // Col D: Col 2 Duty (Σκοπιά, Δεκανείς, Υπαρχ, ΑΜ)
      { wch: 18 }, // Col E: Col 3 Time / Quadrant 1
      { wch: 24 }, // Col F: Col 3 Names 1
      { wch: 24 }  // Col G: Col 3 Names 2
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
    const unit = this.storage.unitInfo();

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
    const skopiaDuty = findDuty('σκοπ') || findDuty('πυλ');
    const dekDuty = findDuty('δεκαν');
    const yparchDuty = findDuty('υπαρχ');
    const amDuty = schedule.duties.find(d => {
      const id = (d.dutyTypeId || '').toLowerCase();
      const n = normalizeGreek(d.dutyName || '');
      const s = normalizeGreek(d.shortName || '');
      return id === 'duty-am' || n === 'αμ' || s === 'αμ';
    });
    const xenDuty = findDuty('ξενοκρατ');

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

    const shiftTimes = [
      [{ date: d1, time: '14:00 - 16:00' }, { date: d1, time: '22:00 - 00:00' }, { date: d2, time: '06:00 - 08:00' }],
      [{ date: d1, time: '16:00 - 18:00' }, { date: d2, time: '00:00 - 02:00' }, { date: d2, time: '08:00 - 10:00' }],
      [{ date: d1, time: '18:00 - 20:00' }, { date: d2, time: '02:00 - 04:00' }, { date: d2, time: '10:00 - 12:00' }],
      [{ date: d1, time: '20:00 - 22:00' }, { date: d2, time: '04:00 - 06:00' }, { date: d2, time: '12:00 - 14:00' }]
    ];

    const opSlots = opDuty?.slots || [];
    const thSlots = thDuty?.slots || [];

    const leftColumnShifts = shiftTimes.map((times, idx) => {
      const gIndex = idx + 1;
      const op = opSlots.find(s => s.groupIndex === gIndex) || opSlots[idx];
      const thGrp = thSlots.filter(s => s.groupIndex === gIndex);
      const th1 = thGrp[0] || thSlots[idx * 2];
      const th2 = thGrp[1] || thSlots[idx * 2 + 1];
      return {
        shiftIndex: gIndex,
        times,
        oplofylakas: op,
        thalamofylakes: [th1, th2].filter(Boolean)
      };
    });

    const skopiaSlots = skopiaDuty?.slots || [];
    const skopiaShifts = shiftTimes.map((times, idx) => {
      const gIndex = idx + 1;
      const grp = skopiaSlots.filter(s => s.groupIndex === gIndex);
      const s1 = grp[0] || skopiaSlots[idx * 2];
      const s2 = grp[1] || skopiaSlots[idx * 2 + 1];
      return {
        shiftIndex: gIndex,
        times,
        guards: [s1, s2].filter(Boolean)
      };
    });

    const dekSlots = dekDuty?.slots || [];
    const dekShifts = [
      { times: [{ date: d1, time: '14:00 - 00:00' }], guard: dekSlots[0] },
      { times: [{ date: d2, time: '00:00 - 14:00' }], guard: dekSlots[1] }
    ];

    const yparchSlots = yparchDuty?.slots || [];
    const yparchShift = {
      times: [{ date: d1, time: '14:00 - 06:00' }],
      guard: yparchSlots[0]
    };

    const amSlots = amDuty?.slots || [];
    const amShifts = [
      { times: [{ date: d1, time: '14:00 - 22:00' }], guards: [amSlots[0]].filter(Boolean) },
      { times: [{ date: d2, time: '06:00 - 14:00' }], guards: [amSlots[1], amSlots[2]].filter(Boolean) }
    ];

    const middleColumnData = {
      skopia: { title: 'ΣΚΟΠΙΑ ΚΕΝΤΡΙΚΗ ΠΥΛΗ', shifts: skopiaShifts },
      dekaneis: { title: 'ΔΕΚΑΝΕΙΣ ΑΛΛΑΓΗΣ', shifts: dekShifts },
      yparchifylakas: { title: 'ΥΠΑΡΧΙΦΥΛΑΚΑΣ', shift: yparchShift },
      am: { title: 'ΑΜ', shifts: amShifts }
    };

    const estTimes = [
      { date: d1, time: '16:00 - 22:00' },
      { date: d2, time: '05:20 - 16:00' }
    ];
    const estGuards = Array.from({ length: 10 }, (_, i) => estSlots[i] || null);
    const artGuards = Array.from({ length: 4 }, (_, i) => finalArtSlots[i] || null);
    const epifGuards = Array.from({ length: 5 }, (_, i) => epifDuty?.slots[i] || null);
    const xenGuards = Array.from({ length: 5 }, (_, i) => xenDuty?.slots[i] || null);

    const kathSlots = kathDuty?.slots || [];
    const getSlotsForKeyword = (kw: string, fallbackIdxs: [number, number]) => {
      const matched = kathSlots.filter(s => {
        const lbl = normalizeGreek(s.hoursNote || '') + ' ' + normalizeGreek(s.groupTag || '');
        return lbl.includes(kw);
      });
      if (matched.length >= 2) return [matched[0], matched[1]];
      if (matched.length === 1) return [matched[0], kathSlots[fallbackIdxs[1]] || null];
      return [kathSlots[fallbackIdxs[0]] || null, kathSlots[fallbackIdxs[1]] || null];
    };

    const kathSections = [
      { title: 'ΤΟΥΑΛΕΤΕΣ', guards: getSlotsForKeyword('τουαλ', [0, 1]) },
      { title: 'ΛΟΥΤΡΑ / ΝΙΠΤΗΡΕΣ', guards: getSlotsForKeyword('λουτρ', [2, 3]) },
      { title: 'ΣΚΑΛΕΣ/ ΠΡΟΘΑΛΑΜΟΣ/ ΘΑΛΑΜΟΙ/ ΔΙΑΔΡΟΜΟΣ', guards: getSlotsForKeyword('σκαλ', [4, 5]) },
      { title: 'ΠΡΟΑΥΛΙΟΣ ΧΩΡΟΣ / ΕΞΩΤΕΡΙΚΕΣ ΣΚΑΛΕΣ', guards: getSlotsForKeyword('προαυλ', [6, 7]) }
    ];

    const rightColumnData = {
      estiatoria: {
        title: 'ΕΣΤΙΑΤΟΡΙΑ (15:00-16:00)',
        note: 'ΟΙ ΠΑΡΑΚΑΤΩ ΜΕΤΑΒΑΙΝΟΥΝ ΝΩΡΙΤΕΡΑ ΜΕ ΟΡΙΣΜΕΝΟ ΒΑΓΟΝΙ',
        times: estTimes,
        guards: estGuards
      },
      artoklivanos: {
        title: 'ΑΡΤΟΚΛΙΒΑΝΟΣ (06:50-14:00)',
        guards: artGuards
      },
      epifylaki: {
        title: 'ΕΠΙΦΥΛΑΚΗ',
        guards: epifGuards
      },
      xenokratis: {
        title: 'ΞΕΝΟΚΡΑΤΗΣ',
        guards: xenGuards
      },
      kathariotites: {
        title: 'ΚΑΘΑΡΙΟΤΗΤΕΣ',
        sections: kathSections
      }
    };

    const hpList = this.storage.higherPersonnel();
    const printSignatures = {
      left: {
        roleTitle: hpList[0]?.roleTitle || 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ',
        fullName: hpList[0]?.fullName || 'ΖΑΒΙΤΣΑΝΟΣ ΔΗΜΗΤΡΙΟΣ',
        rank: hpList[0]?.rank || 'ΑΝΧΗΣ (ΠΒ)'
      },
      center: {
        roleTitle: hpList[1]?.roleTitle || 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ',
        fullName: hpList[1]?.fullName || 'ΛΙΝΑΡΔΟΣ ΜΑΡΙΟΣ',
        rank: hpList[1]?.rank || 'ΥΠΛΓΟΣ (ΠΖ)'
      },
      right: {
        roleTitle: hpList[2]?.roleTitle || 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ',
        fullName: hpList[2]?.fullName || 'ΤΕΡΖΟΓΛΟΥ ΕΥΜΟΡΦΙΑ',
        rank: hpList[2]?.rank || 'ΑΝΘΛΓΟΣ (ΠΒ)'
      }
    };

    return {
      schedule,
      date1Formatted: d1,
      date2Formatted: d2,
      leftColumnShifts,
      middleColumnData,
      rightColumnData,
      printSignatures,
      dateTitle: `ΥΠΗΡΕΣΙΕΣ ΣΤ' ΚΤΗΡΙΟΥ Γ' ΠΥΡΧΙΑΣ ΤΗΣ ${d1}`,
      subRule1: 'ΟΙ ΠΑΡΑΚΑΤΩ ΥΠΗΡΕΣΙΕΣ ΙΣΧΥΟΥΝ ΑΠΟ ΣΗΜΕΡΑ ΣΤΙΣ 14:00 ΕΩΣ ΤΙΣ 14:00 ΤΗΣ ΕΠΟΜΕΝΗΣ ΜΕΡΑΣ',
      subRule2: 'ΚΑΘΑΡΙΟΤΗΤΕΣ [14:00-15:00 & 20:00-21:00 & 06:30-07:30]',
      unitTitle: unit.name || 'ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)',
      divisionTitle: unit.division || '2ο ΜΕΛ/Σ'
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
    return this.saveWorkbook(wb, filename);
  }

  private async saveWorkbook(wb: XLSX.WorkBook, filename: string): Promise<boolean> {
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

  /**
   * Exports punishments to Excel with:
   * 1. Name of punished soldier
   * 2. Punishment days and type in ONE column (e.g. "2 ΣΤ ΕΞΟΔΟΥ", "3 Κ", "5 Φ")
   * 3. Counter (e.g. 1/3, 0/3)
   * 4. Date, Reason, Notes, Status
   */
  async exportPenaltiesToExcel(
    records?: import('../models/shift.model').SoldierRecord[],
    asOfDateStr?: string
  ): Promise<boolean> {
    const unit = this.storage.unitInfo();
    const targetDate = asOfDateStr || new Date().toISOString().slice(0, 10);
    const sourceRecords = records || this.storage.soldierRecords();
    const penaltyRecords = sourceRecords.filter(r => r.type === 'ΠΟΙΝΗ');

    const rows: (string | number)[][] = [
      ['ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ'],
      ['ΥΠΟΥΡΓΕΙΟ ΕΘΝΙΚΗΣ ΑΜΥΝΑΣ'],
      [`ΜΟΝΑΔΑ: ${unit.name} - ${unit.location}`],
      ['ΠΙΝΑΚΑΣ ΠΕΙΘΑΡΧΙΚΩΝ ΠΟΙΝΩΝ & ΕΚΤΙΣΗΣ'],
      [`Ημερομηνία Αναφοράς: ${formatGreekDate(targetDate)}`],
      [],
      [
        'Α/Α',
        'Ονοματεπώνυμο Οπλίτη',
        'Ποινή & Διάρκεια',
        'Έκτιση',
        'Ημερομηνία Επιβολής',
        'Αιτιολογία',
        'Παρατηρήσεις',
        'Κατάσταση'
      ]
    ];

    if (penaltyRecords.length === 0) {
      rows.push(['-', 'Δεν υπάρχουν καταχωρημένες ποινές', '-', '-', '-', '-', '-', '-']);
    } else {
      penaltyRecords.forEach((r, idx) => {
        const prog = this.storage.calculatePenaltyProgress(r, targetDate);
        const penaltyTypeStr = (r.penaltyType || prog.penaltyType || 'ΣΤ ΕΞΟΔΟΥ').trim();
        const totalDays = prog.totalDays || r.totalDays || 1;
        // e.g. "2 ΣΤ ΕΞΟΔΟΥ", "3 Κ", "5 Φ"
        const typeAndDays = `${totalDays} ${penaltyTypeStr}`;
        // e.g. "1/3", "0/3"
        const counterStr = `${prog.servedDays}/${totalDays}`;

        rows.push([
          idx + 1,
          formatRecordPersonName(r.personName),
          typeAndDays,
          counterStr,
          formatGreekDate(r.date),
          r.reason || '-',
          r.notes || '-',
          r.status || 'Εκκρεμεί'
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 20 },
      { wch: 38 },
      { wch: 28 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ποινές');
    const filename = `Ποινές_${unit.name.replace(/[\/\s]/g, '_')}_${targetDate}.xlsx`;
    return this.saveWorkbook(wb, filename);
  }

  /**
   * Exports HKAP (Daily Orders: Requests & Penalties) to Excel matching the printable sheets.
   */
  async exportHkapToExcel(data: {
    date: string;
    headerLines: string[];
    requests: any[];
    penalties: any[];
    signatures?: SignatureSlot[];
  }): Promise<boolean> {
    const unit = this.storage.unitInfo();
    const wb = XLSX.utils.book_new();

    // Sheet 1: Αιτήματα
    const reqRows: (string | number)[][] = [
      ...(data.headerLines.map(line => [line])),
      [],
      ['ΠΙΝΑΚΑΣ ΑΙΤΗΣΕΩΝ – ΑΝΑΦΟΡΩΝ ΟΠΛΙΤΩΝ'],
      [`Ημερομηνία: ${formatGreekDate(data.date)}`],
      [],
      ['Α/Α', 'Ονοματεπώνυμο', 'Αίτημα - Αναφορά', 'Παρατηρήσεις']
    ];

    if (!data.requests || data.requests.length === 0 || data.requests.every(r => r.isEmpty)) {
      reqRows.push(['0', '-', '-', '-']);
    } else {
      data.requests.filter(r => !r.isEmpty).forEach((r, idx) => {
        reqRows.push([
          r.numberText || String(idx + 1),
          r.soldierName || '-',
          r.content || '-',
          r.notes || '-'
        ]);
      });
    }

    // Add signatures at bottom
    if (data.signatures && data.signatures.length > 0) {
      reqRows.push([]);
      reqRows.push([]);
      reqRows.push(['', '', ...data.signatures.map(s => s.roleTitle)]);
      reqRows.push(['', '', ...data.signatures.map(s => s.fullName)]);
    }

    const wsReq = XLSX.utils.aoa_to_sheet(reqRows);
    wsReq['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 45 },
      { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, wsReq, 'Αιτήματα');

    // Sheet 2: Ποινές
    const penRows: (string | number)[][] = [
      ...(data.headerLines.map(line => [line])),
      [],
      ['ΠΙΝΑΚΑΣ ΠΟΙΝΩΝ ΟΠΛΙΤΩΝ'],
      [`Ημερομηνία: ${formatGreekDate(data.date)}`],
      [],
      ['Α/Α', 'Ονοματεπώνυμο', 'Αιτιολογικό - Ποινή', 'Παρατηρήσεις']
    ];

    if (!data.penalties || data.penalties.length === 0 || data.penalties.every(r => r.isEmpty)) {
      penRows.push(['0', '-', '-', '-']);
    } else {
      data.penalties.filter(r => !r.isEmpty).forEach((r, idx) => {
        penRows.push([
          r.numberText || String(idx + 1),
          r.soldierName || '-',
          r.content || '-',
          r.notes || '-'
        ]);
      });
    }

    if (data.signatures && data.signatures.length > 0) {
      penRows.push([]);
      penRows.push([]);
      penRows.push(['', '', ...data.signatures.map(s => s.roleTitle)]);
      penRows.push(['', '', ...data.signatures.map(s => s.fullName)]);
    }

    const wsPen = XLSX.utils.aoa_to_sheet(penRows);
    wsPen['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 45 },
      { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPen, 'Ποινές');

    const filename = `ΗΚΑΠ_${unit.name.replace(/[\/\s]/g, '_')}_${data.date}.xlsx`;
    return this.saveWorkbook(wb, filename);
  }

  /**
   * Generates CSV content formatted for Greek Windows Excel (UTF-8 BOM, semicolon separated).
   */
  generateExodouchoiCsv(plan: DailyExodouchoiPlan, onlyGoingOut = false): string {
    const unit = this.storage.unitInfo();
    const list = onlyGoingOut ? plan.soldiers.filter(s => s.isGoingOut) : plan.soldiers;

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '';
      const s = String(str).trim();
      if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines: string[] = [];
    const BOM = '\uFEFF';

    lines.push(escapeCsv(`${unit.name} - ${unit.division}`));
    lines.push(escapeCsv(`ΚΑΤΑΣΤΑΣΗ ΕΞΟΔΟΥΧΩΝ — ${formatGreekDate(plan.date)}`));
    lines.push(escapeCsv(onlyGoingOut ? 'ΦΙΛΤΡΟ: ΜΟΝΟ ΕΞΟΔΟΥΧΟΙ' : 'ΦΙΛΤΡΟ: ΟΛΗ Η ΔΥΝΑΜΗ'));
    lines.push('');

    const headers = [
      'Α/Α',
      'ΒΑΘΜΟΣ',
      'ΟΝΟΜΑΤΕΠΩΝΥΜΟ',
      'ΑΣΜ',
      'ΕΙΔΙΚΟΤΗΤΑ',
      'ΛΟΧΟΣ',
      'ΘΑΛΑΜΟΣ',
      'ΚΡΕΒΑΤΙ',
      'ΚΑΤΑΣΤΑΣΗ',
      'ΥΠΗΡΕΣΙΑ / ΑΙΤΙΟΛΟΓΙΑ',
      'ΤΗΛΕΦΩΝΟ',
      'ΠΑΡΑΤΗΡΗΣΕΙΣ'
    ];
    lines.push(headers.join(';'));

    list.forEach((s, idx) => {
      const row = [
        idx + 1,
        s.rankShort,
        s.fullName,
        s.asm,
        s.specialty,
        s.company || '-',
        s.barracksRoom || '-',
        s.bedNumber || '-',
        s.isGoingOut ? 'ΕΞΟΔΟΥΧΟΣ' : 'ΜΕΣΑ',
        s.dutyStatusText || '-',
        s.phone || '-',
        s.notes || '-'
      ];
      lines.push(row.map(escapeCsv).join(';'));
    });

    return BOM + lines.join('\r\n');
  }

  /**
   * Exports Exodouchoi list to CSV file.
   */
  async exportExodouchoiToCsv(plan: DailyExodouchoiPlan, onlyGoingOut = false): Promise<boolean> {
    const unit = this.storage.unitInfo();
    const content = this.generateExodouchoiCsv(plan, onlyGoingOut);
    const suffix = onlyGoingOut ? 'ΕΞΟΔΟΥΧΟΙ' : 'ΟΛΗ_Η_ΔΥΝΑΜΗ';
    const filename = `Κατάσταση_Εξοδούχων_${unit.name.replace(/[\/\s]/g, '_')}_${plan.date}_${suffix}.csv`;
    return this.storage.downloadCsvFile(content, filename);
  }

  /**
   * Exports Exodouchoi list to Excel (.xlsx) workbook.
   */
  async exportExodouchoiToExcel(plan: DailyExodouchoiPlan, onlyGoingOut = false): Promise<boolean> {
    const unit = this.storage.unitInfo();
    const list = onlyGoingOut ? plan.soldiers.filter(s => s.isGoingOut) : plan.soldiers;
    const wb = XLSX.utils.book_new();

    const rows: (string | number)[][] = [
      [`${unit.name} - ${unit.division}`],
      [`ΚΑΤΑΣΤΑΣΗ ΕΞΟΔΟΥΧΩΝ — ${formatGreekDate(plan.date)}`],
      [onlyGoingOut ? 'ΜΟΝΟ ΕΞΟΔΟΥΧΟΙ' : 'ΟΛΗ Η ΔΥΝΑΜΗ ΜΟΝΑΔΑΣ'],
      [],
      [
        'Α/Α',
        'Βαθμός',
        'Ονοματεπώνυμο',
        'ΑΣΜ',
        'Ειδικότητα',
        'Λόχος',
        'Θάλαμος',
        'Κρεβάτι',
        'Κατάσταση',
        'Υπηρεσία / Αιτιολογία',
        'Τηλέφωνο',
        'Παρατηρήσεις'
      ]
    ];

    list.forEach((s, idx) => {
      rows.push([
        idx + 1,
        s.rankShort,
        s.fullName,
        s.asm,
        s.specialty,
        s.company || '-',
        s.barracksRoom || '-',
        s.bedNumber || '-',
        s.isGoingOut ? 'ΕΞΟΔΟΥΧΟΣ' : 'ΜΕΣΑ',
        s.dutyStatusText || '-',
        s.phone || '-',
        s.notes || '-'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 10 },
      { wch: 30 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 35 },
      { wch: 15 },
      { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Εξοδούχοι');
    const suffix = onlyGoingOut ? 'ΕΞΟΔΟΥΧΟΙ' : 'ΟΛΟΙ';
    const filename = `Εξοδούχοι_${unit.name.replace(/[\/\s]/g, '_')}_${plan.date}_${suffix}.xlsx`;
    return this.saveWorkbook(wb, filename);
  }
}
