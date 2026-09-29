import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { DailySchedule, Personnel, DutyAssignment, ShiftSlotAssignment, SignatureSlot, formatGreekDate, formatLocalDate, normalizeGreek } from '../../models/shift.model';
import { DEFAULT_EMBLEM_BASE64 } from '../../data/default-emblem';

export interface PrintableSlotItem {
  index: number;
  dutyName: string;
  person: Personnel | undefined;
  slot: ShiftSlotAssignment;
}

@Component({
  selector: 'app-print-view',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './print-view.html',
  styleUrl: './print-view.css'
})
export class PrintViewComponent {
  storage = inject(StorageService);
  excelService = inject(ExcelExportService);
  route = inject(ActivatedRoute);

  readonly defaultEmblem = DEFAULT_EMBLEM_BASE64;
  readonly formatGreekDate = formatGreekDate;
  readonly higherPersonnel = this.storage.higherPersonnel;

  date = signal<string>(formatLocalDate(new Date()));
  schedule = signal<DailySchedule | null>(null);
  signatures = signal<SignatureSlot[]>([]);
  inkSaver = signal<boolean>(false);

  readonly unit = this.storage.unitInfo;

  /** Convert date to short Greek format D/M/YYYY without leading zeros (e.g. 18/9/2026) */
  formatShortDate(dStr: string): string {
    if (!dStr) return '';
    const trimmed = dStr.trim();
    const partsSlash = trimmed.split('/');
    if (partsSlash.length === 3) {
      const d = parseInt(partsSlash[0], 10);
      const m = parseInt(partsSlash[1], 10);
      const y = partsSlash[2];
      return `${d}/${m}/${y}`;
    }
    const partsDash = trimmed.split('-');
    if (partsDash.length === 3) {
      const d = parseInt(partsDash[2], 10);
      const m = parseInt(partsDash[1], 10);
      const y = partsDash[0];
      return `${d}/${m}/${y}`;
    }
    return formatGreekDate(trimmed);
  }

  readonly date1Formatted = computed(() => {
    return this.formatShortDate(this.date());
  });

  readonly date2Formatted = computed(() => {
    const d = this.date();
    if (!d) return '';
    const parts = d.split('-').map(Number);
    const next = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return this.formatShortDate(`${year}-${month}-${day}`);
  });

  getDutyAssignment(keyword: string): DutyAssignment | undefined {
    const s = this.schedule();
    if (!s) return undefined;
    const normKw = normalizeGreek(keyword);
    return s.duties.find(d => {
      const normName = normalizeGreek(d.dutyName || '');
      const normId = normalizeGreek(d.dutyTypeId || '');
      const normShort = normalizeGreek(d.shortName || '');
      return normName.includes(normKw) || normId.includes(normKw) || normShort.includes(normKw);
    });
  }

  findArtoklivanosDuty(): DutyAssignment | undefined {
    const s = this.schedule();
    if (!s) return undefined;
    return s.duties.find(d => {
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
  }

  /**
   * Formats soldier name according to Greek Army Excel duty roster standards:
   * SURNAME (ROOM.BED) [DUTY_CODE] e.g. "ΒΟΠΑΖΟΣ (2.1) ΘΦ" or "ΗΛΙΑΔΗΣ Χ. (2.1)"
   */
  formatSoldierDisplay(personId: string | null | undefined, personNameFallback?: string, suffix?: string): string {
    if (!personId && !personNameFallback) return '---';
    const p = personId ? this.getPerson(personId) : null;
    const fullName = p ? p.fullName : (personNameFallback || '---');

    const tokens = fullName.trim().split(/\s+/);
    let displayName = tokens[0] || fullName;

    // Always append the first letter of first name with '.' (e.g. ΚΑΡΑΓΙΑΝΝΗΣ Γ.)
    if (tokens.length > 1 && tokens[1]) {
      const initial = tokens[1].replace(/[^A-Za-zΑ-Ωα-ωΆ-Ώά-ώ]/g, '').charAt(0).toUpperCase();
      if (initial) {
        displayName = `${displayName} ${initial}.`;
      }
    }

    // Extract room & bed e.g. (2.1)
    let roomBed = '';
    if (p) {
      if (p.barracksRoom || p.bedNumber) {
        const roomDigits = (p.barracksRoom || '').replace(/[^0-9.]/g, '');
        const bedDigits = (p.bedNumber || '').replace(/[^0-9]/g, '');
        if (roomDigits.includes('.')) {
          roomBed = `(${roomDigits})`;
        } else if (roomDigits && bedDigits) {
          roomBed = `(${roomDigits}.${bedDigits})`;
        } else if (roomDigits) {
          roomBed = `(${roomDigits})`;
        } else if (bedDigits) {
          roomBed = `(${bedDigits})`;
        }
      }
    }

    const parts = [displayName];
    if (roomBed) parts.push(roomBed);
    if (suffix) parts.push(suffix);
    return parts.join(' ');
  }

  /** All active soldiers grouped by special role */
  readonly specialRolePersonnel = computed(() => {
    const all = this.storage.personnel().filter(p => p.active !== false && p.specialRole && p.specialRole.trim().length > 0);
    
    // 1. Permanent Restaurant (Μόνιμοι Εστιατόρια)
    const monimoiEst = all.filter(p => {
      const r = p.specialRole!.toUpperCase();
      return r.includes('ΜΟΝΙΜΟΣ ΕΣΤ') || r.includes('ΜΟΝΙΜΟΙ ΕΣΤ') || (r.includes('ΕΣΤΙΑΤΟΡ') && !r.includes('ΥΠΕΥΘΥΝΟΣ'));
    });

    // 2. Permanent KSYM (Μόνιμοι ΚΨΜ)
    const monimoiKpsm = all.filter(p => {
      const r = p.specialRole!.toUpperCase();
      return r.includes('ΚΨΜ') || r.includes('ΚΑΨΙΜ');
    });

    // 3. Grafeis (Γραφείς)
    const grafeis = all.filter(p => {
      const r = p.specialRole!.toUpperCase();
      return r.includes('ΓΡΑΦ');
    });

    // 4. Cleaning Material Supervisor (Υπεύθυνος Υλικού Καθαριότητας)
    const cleaningSupervisor = all.find(p => {
      const r = p.specialRole!.toUpperCase();
      return r.includes('ΥΛΙΚ') || (r.includes('ΥΠΕΥΘΥΝΟΣ') && r.includes('ΚΑΘΑΡ'));
    });

    // 5. Bakery / Artoklivanos (Αρτοκλίβανος / Αρτοποιός)
    const artoklivanos = all.find(p => {
      const r = normalizeGreek(p.specialRole);
      return r.includes('αρτοκλιβ') || r.includes('αρτοποι') || r.includes('φουρν');
    });

    // 6. Any other roles (e.g. Οδηγός, Σιτιστής, etc.)
    const others = all.filter(p => {
      const r = normalizeGreek(p.specialRole);
      return !r.includes('εστιατορ') && !r.includes('κψμ') && !r.includes('καψιμ') && !r.includes('γραφ') && !r.includes('υλικ') && !r.includes('αρτοκλιβ') && !r.includes('αρτοποι') && !r.includes('φουρν');
    });

    return {
      monimoiEst,
      monimoiKpsm,
      grafeis,
      cleaningSupervisor,
      artoklivanos,
      others
    };
  });

  /** Additional guard duties (e.g. Πύλη, Σκοπιά, Περίπολος) beyond Thalamofylakas and Oplofylakas */
  readonly extraGuardDuties = computed(() => {
    const s = this.schedule();
    if (!s) return [];
    return s.duties.filter(d => {
      const name = d.dutyName.toLowerCase();
      const code = d.dutyTypeId.toLowerCase();
      const isTh = name.includes('θαλαμ') || code.includes('θαλαμ');
      const isOp = name.includes('οπλοφ') || code.includes('οπλοφ');
      const isGuard = name.includes('πυλ') || name.includes('σκοπ') || name.includes('περίπολ');
      return !isTh && !isOp && isGuard;
    });
  });

  readonly guardGroups = computed(() => {
    const thDuty = this.getDutyAssignment('θαλαμ');
    const opDuty = this.getDutyAssignment('οπλοφ');

    const thSlots = thDuty ? thDuty.slots : [];
    const opSlots = opDuty ? opDuty.slots : [];

    const d1 = this.date1Formatted();
    const d2 = this.date2Formatted();

    const timeDefs = [
      [
        { date: d1, time: '14:00 - 16:00' },
        { date: d1, time: '22:00 - 00:00' },
        { date: d2, time: '06:00 - 08:00' }
      ],
      [
        { date: d1, time: '16:00 - 18:00' },
        { date: d2, time: '00:00 - 02:00' },
        { date: d2, time: '08:00 - 10:00' }
      ],
      [
        { date: d1, time: '18:00 - 20:00' },
        { date: d2, time: '02:00 - 04:00' },
        { date: d2, time: '10:00 - 12:00' }
      ],
      [
        { date: d1, time: '20:00 - 22:00' },
        { date: d2, time: '04:00 - 06:00' },
        { date: d2, time: '12:00 - 14:00' }
      ]
    ];

    return timeDefs.map((times, idx) => {
      const gIndex = idx + 1;
      let th = thSlots.filter(s => s.groupIndex === gIndex);
      if (th.length === 0) {
        th = thSlots.slice(idx * 2, idx * 2 + 2);
      }
      let op = opSlots.filter(s => s.groupIndex === gIndex);
      if (op.length === 0) {
        op = opSlots.slice(idx, idx + 1);
      }

      const others = this.extraGuardDuties().map(gd => {
        const slotsForGroup = gd.slots.filter(s => s.groupIndex === gIndex);
        return {
          dutyName: gd.dutyName,
          shortName: gd.shortName || gd.dutyName,
          slots: slotsForGroup.length > 0 ? slotsForGroup : gd.slots.slice(idx, idx + 1)
        };
      }).filter(item => item.slots.length > 0);

      return {
        groupIndex: gIndex,
        times,
        thalamofylakes: th,
        oplofylakes: op,
        otherGuards: others
      };
    });
  });

  readonly extraGuards = computed(() => {
    const thDuty = this.getDutyAssignment('θαλαμ');
    const opDuty = this.getDutyAssignment('οπλοφ');
    const thExtra = (thDuty?.slots || []).slice(8);
    const opExtra = (opDuty?.slots || []).slice(4);
    return {
      thalamofylakes: thExtra,
      oplofylakes: opExtra,
      hasExtra: thExtra.length > 0 || opExtra.length > 0
    };
  });

  readonly cleaningSections = computed(() => {
    const kathDuty = this.getDutyAssignment('καθαρι');
    const slots = kathDuty ? kathDuty.slots : [];

    const d1 = this.date1Formatted();
    const d2 = this.date2Formatted();

    const standardTimes = [
      { date: d1, time: '14:00 - 15:00' },
      { date: d1, time: '20:00 - 21:00' },
      { date: d2, time: '07:00 - 07:30' }
    ];

    const defs = [
      { title: 'ΤΟΥΑΛΕΤΕΣ', slotIdx: 0, kw: 'τουαλ' },
      { title: 'ΛΟΥΤΡΑ / ΝΙΠΤΗΡΕΣ', slotIdx: 1, kw: 'λουτρ' },
      { title: 'ΣΚΑΛΕΣ / ΠΡΟΘΑΛΑΜΟΣ ΘΑΛΑΜΟΙ / ΔΙΑΔΡΟΜΟΣ', slotIdx: 2, kw: 'σκαλ' },
      { title: 'ΠΡΟΑΥΛΙΟΣ ΧΩΡΟΣ ΕΞΩΤΕΡΙΚΕΣ ΣΚΑΛΕΣ', slotIdx: 3, kw: 'προαυλ' }
    ];

    const kathType = this.storage.dutyTypes().find(dt => dt.id === kathDuty?.dutyTypeId || dt.name.toLowerCase().includes('καθαρι'));

    const sections = defs.map((d, idx) => {
      let matchedSlots = slots.filter(s => {
        const slotDef = kathType?.slotDefinitions?.find(sd => sd.slotIndex === s.slotIndex);
        const lbl = `${slotDef?.groupName || ''} ${slotDef?.label || ''} ${s.hoursNote || ''}`.toLowerCase();
        return lbl.includes(d.kw);
      });

      if (matchedSlots.length === 0) {
        if (slots[d.slotIdx]) {
          matchedSlots = [slots[d.slotIdx]];
        }
      }

      return {
        title: d.title,
        times: standardTimes,
        slots: matchedSlots
      };
    });

    // Check special role first, then fallback to slot definition or 5th slot
    const specialSup = this.specialRolePersonnel().cleaningSupervisor;
    const supervisor = specialSup ? {
      personId: specialSup.id,
      personName: specialSup.fullName
    } : (slots.find(s => {
      const slotDef = kathType?.slotDefinitions?.find(sd => sd.slotIndex === s.slotIndex);
      const lbl = `${slotDef?.groupName || ''} ${slotDef?.label || ''} ${s.hoursNote || ''}`.toLowerCase();
      return lbl.includes('υπευθυν') || lbl.includes('υλικ');
    }) || (slots[4] ? { personId: slots[4].personId, personName: slots[4].personName } : null));

    return {
      sections,
      supervisor
    };
  });

  /** Additional dynamic duties in schedule that are not standard guards/cleaning/restaurant/bakery/standby */
  readonly additionalDuties = computed(() => {
    const s = this.schedule();
    if (!s) return [];
    return s.duties.filter(d => {
      const dtDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      if (dtDef?.timePresetType === 'STANDBY') return false;
      const name = normalizeGreek(d.dutyName || '');
      const code = normalizeGreek(d.dutyTypeId || '');
      const short = normalizeGreek(d.shortName || '');
      const dtName = normalizeGreek(dtDef?.name || '');
      if (name.includes('θαλαμ') || code.includes('θαλαμ') || code.includes('thalam')) return false;
      if (name.includes('οπλοφ') || code.includes('οπλοφ') || code.includes('oplof')) return false;
      if (name.includes('καθαρι') || code.includes('καθαρι') || code.includes('kathar')) return false;
      if (name.includes('εστιατορ') || code.includes('εστιατορ') || code.includes('estiat') || dtDef?.timePresetType === 'RESTAURANT_CYCLE') return false;
      if (name.includes('αρτοκλιβ') || name.includes('αρτοποι') || name.includes('φουρν') || code.includes('artokliv') || code.includes('bakery') || short === 'αρτ' || dtName.includes('αρτοκλιβ')) return false;
      if (name.includes('επιφυλακ') || code.includes('επιφυλακ') || code.includes('epifylak')) return false;
      if (name.includes('κψμ') || name.includes('καψιμ') || code.includes('kpsm') || code.includes('ksym')) return false;
      if (name.includes('πυλ') || name.includes('σκοπ') || name.includes('περιπολ')) return false;
      return true;
    }).map(d => {
      const dtDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      return {
        dutyName: d.dutyName,
        shortName: d.shortName || d.dutyName,
        shiftHours: dtDef?.shiftHours || (d.slots[0]?.hoursNote || ''),
        slots: d.slots
      };
    });
  });

  readonly col3Data = computed(() => {
    const d1 = this.date1Formatted();
    const d2 = this.date2Formatted();

    // Find all restaurant duties (excluding permanent / monimoi)
    const estDuties = (this.schedule()?.duties || []).filter(d => {
      const dtDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      const name = (d.dutyName || '').toLowerCase();
      const code = (d.dutyTypeId || '').toLowerCase();
      const short = (d.shortName || '').toLowerCase();
      const isMonimoi = name.includes('μονιμ') || code.includes('monim');
      if (isMonimoi) return false;
      if (dtDef?.timePresetType === 'RESTAURANT_CYCLE') return true;
      return code === 'duty-estiatoria' || 
             name.includes('εστιατορ') || 
             code.includes('estiator') || 
             code.includes('restaurant') ||
             short === 'εστ' ||
             name.includes('τραπεζοκομ') ||
             name.includes('μαγειρει') ||
             name.includes('συσσιτι');
    });
    const estSlots = estDuties.flatMap(d => d.slots);
    const estTimes = [
      { date: d1, time: '16:00 - 22:00' },
      { date: d2, time: '05:20 - 16:00' }
    ];

    const artDuty = this.findArtoklivanosDuty();
    let artSlots = artDuty ? artDuty.slots : [];
    // If no slots in artDuty or if no person is assigned in artDuty slots, fallback to soldier with specialRole 'ΑΡΤΟΚΛΙΒΑΝΟΣ'
    const hasAssignedArtSlot = artSlots.some(s => !!(s.personId || s.personName));
    if (!hasAssignedArtSlot && this.specialRolePersonnel().artoklivanos) {
      const artP = this.specialRolePersonnel().artoklivanos!;
      artSlots = [{
        slotIndex: 1,
        personId: artP.id,
        personName: artP.fullName
      }];
    }
    const artTimes = [
      { date: d2, time: '06:50 - 14:00' }
    ];

    const epifDuty = this.schedule()?.duties.find(d => {
      const dtDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      if (dtDef?.timePresetType === 'STANDBY') return true;
      const name = (d.dutyName || '').toLowerCase();
      const code = (d.dutyTypeId || '').toLowerCase();
      return name.includes('επιφυλακ') || code.includes('επιφυλακ');
    });
    const epifSlots = epifDuty ? epifDuty.slots : [];

    // Permanent Restaurant: prioritize soldiers with special role, fallback to duty slots
    const permEstFromRoles = this.specialRolePersonnel().monimoiEst.map(p => ({
      personId: p.id,
      personName: p.fullName
    }));
    const monimoiEstDuty = this.schedule()?.duties.find(d => {
      const name = (d.dutyName || '').toLowerCase();
      const code = (d.dutyTypeId || '').toLowerCase();
      return (name.includes('μονιμ') && name.includes('εστ')) || (code.includes('μονιμ') && code.includes('εστ'));
    });
    const permEstSlots = permEstFromRoles.length > 0 ? permEstFromRoles : (monimoiEstDuty?.slots || []);

    // Permanent KPSM: prioritize soldiers with special role, fallback to duty slots
    const permKpsmFromRoles = this.specialRolePersonnel().monimoiKpsm.map(p => ({
      personId: p.id,
      personName: p.fullName
    }));
    const kpsmDuty = this.schedule()?.duties.find(d => {
      const name = (d.dutyName || '').toLowerCase();
      const code = (d.dutyTypeId || '').toLowerCase();
      return name.includes('κψμ') || name.includes('καψιμ') || code.includes('κψμ') || code.includes('καψιμ');
    });
    const permKpsmSlots = permKpsmFromRoles.length > 0 ? permKpsmFromRoles : (kpsmDuty?.slots || []);

    // Grafeis (from soldiers with specialRole)
    const grafeisSlots = this.specialRolePersonnel().grafeis.map(p => ({
      personId: p.id,
      personName: p.fullName
    }));

    return {
      restaurant: {
        times: estTimes,
        slots: estSlots
      },
      permanentEst: {
        slots: permEstSlots
      },
      permanentKpsm: {
        slots: permKpsmSlots
      },
      grafeis: {
        slots: grafeisSlots
      },
      standby: {
        slots: epifSlots
      },
      bakery: {
        times: artTimes,
        slots: artSlots
      },
      additionalDuties: this.additionalDuties(),
      otherSpecialRoles: this.specialRolePersonnel().others
    };
  });

  toggleInkSaver() {
    this.inkSaver.update(v => !v);
  }

  constructor() {
    this.route.params.subscribe(params => {
      if (params['date']) {
        this.date.set(params['date']);
        this.loadSchedule(params['date']);
      }
    });
  }

  loadSchedule(dateStr: string) {
    const s = this.storage.getScheduleForDate(dateStr);
    if (s) {
      this.schedule.set(s);
      if (s.signatures && s.signatures.length > 0) {
        this.signatures.set(s.signatures);
      } else {
        this.initDefaultSignatures();
      }
    } else {
      this.initDefaultSignatures();
      this.storage.notify(`Δεν βρέθηκε αποθηκευμένη διαταγή για την ημερομηνία ${dateStr}.`, 'warning');
    }
  }

  initDefaultSignatures() {
    const hp = this.higherPersonnel();
    if (hp && hp.length > 0) {
      const defaultSlots: SignatureSlot[] = hp.slice(0, 3).map(p => ({
        roleTitle: p.roleTitle,
        fullName: p.fullName,
        rank: p.rank,
        higherPersonnelId: p.id
      }));
      this.signatures.set(defaultSlots);
    } else {
      this.signatures.set([
        { roleTitle: 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ', fullName: 'ΖΑΒΙΤΣΑΝΟΣ ΔΗΜΗΤΡΙΟΣ', rank: 'ΑΝΧΗΣ (ΠΒ)' },
        { roleTitle: 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ', fullName: 'ΛΙΝΑΡΔΟΣ ΜΑΡΙΟΣ', rank: 'ΥΠΛΓΟΣ (ΠΖ)' },
        { roleTitle: 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ', fullName: 'ΤΕΡΖΟΓΛΟΥ ΕΥΜΟΡΦΙΑ', rank: 'ΑΝΘΛΓΟΣ (ΠΒ)' }
      ]);
    }
  }

  onSelectSigner(slotIndex: number, higherPersonnelId: string) {
    const hp = this.higherPersonnel().find(p => p.id === higherPersonnelId);
    if (hp) {
      this.signatures.update(sigs => {
        const copy = [...sigs];
        copy[slotIndex] = {
          roleTitle: hp.roleTitle,
          fullName: hp.fullName,
          rank: hp.rank,
          higherPersonnelId: hp.id
        };
        return copy;
      });
      this.persistSignatures();
    }
  }

  addSignatureSlot() {
    const hpList = this.higherPersonnel();
    const existingIds = new Set(this.signatures().map(s => s.higherPersonnelId));
    const nextAvailable = hpList.find(p => !existingIds.has(p.id)) || hpList[0];
    const newSlot: SignatureSlot = nextAvailable ? {
      roleTitle: nextAvailable.roleTitle,
      fullName: nextAvailable.fullName,
      rank: nextAvailable.rank,
      higherPersonnelId: nextAvailable.id
    } : {
      roleTitle: 'ΑΞΙΩΜΑΤΙΚΟΣ ΥΠΗΡΕΣΙΑΣ',
      fullName: '',
      rank: ''
    };
    this.signatures.update(sigs => [...sigs, newSlot]);
    this.persistSignatures();
  }

  removeSignatureSlot(slotIndex: number) {
    if (this.signatures().length <= 1) {
      this.storage.notify('Απαιτείται τουλάχιστον μία υπογραφή στο έγγραφο.', 'warning');
      return;
    }
    this.signatures.update(sigs => sigs.filter((_, idx) => idx !== slotIndex));
    this.persistSignatures();
  }

  moveSignature(slotIndex: number, direction: 'left' | 'right') {
    const targetIdx = direction === 'left' ? slotIndex - 1 : slotIndex + 1;
    if (targetIdx < 0 || targetIdx >= this.signatures().length) return;
    this.signatures.update(sigs => {
      const copy = [...sigs];
      const temp = copy[slotIndex];
      copy[slotIndex] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    this.persistSignatures();
  }

  resetDefaultSignatures() {
    this.initDefaultSignatures();
    this.persistSignatures();
    this.storage.notify('Επαναφέρθηκαν οι προεπιλεγμένες υπογραφές', 'info');
  }

  persistSignatures() {
    const d = this.date();
    if (d) {
      this.storage.saveScheduleSignatures(d, this.signatures());
    }
  }

  getPerson(id: string | null): Personnel | undefined {
    if (!id) return undefined;
    return this.storage.personnel().find(p => p.id === id);
  }

  getLeavesOnDate() {
    const d = this.date();
    return this.storage.leaves().filter(l => 
      l.startDate <= d && d <= l.endDate && l.status !== 'Ακυρωμένη'
    );
  }

  getAssignedCount(): number {
    const s = this.schedule();
    if (!s) return 0;
    let count = 0;
    for (const d of s.duties) {
      for (const slot of d.slots) {
        if (slot.personId) count++;
      }
    }
    return count;
  }

  print() {
    if (this.storage.isElectron() && window.electronAPI) {
      window.electronAPI.printWindow();
    } else {
      window.print();
    }
  }

  exportExcel() {
    const s = this.schedule();
    if (s) {
      this.excelService.exportScheduleToExcel(s, {
        schedule: s,
        date1Formatted: this.date1Formatted(),
        date2Formatted: this.date2Formatted(),
        guardGroups: this.guardGroups(),
        cleaningSections: this.cleaningSections(),
        col3Data: this.col3Data(),
        extraGuards: this.extraGuards(),
        signatures: this.signatures(),
        formatSoldierFn: (personId, personNameFallback, suffix) => 
          this.formatSoldierDisplay(personId, personNameFallback, suffix)
      });
    }
  }
}
