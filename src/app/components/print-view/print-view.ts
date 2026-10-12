import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { DailySchedule, Personnel, DutyAssignment, ShiftSlotAssignment, SignatureSlot, TimeInterval, formatGreekDate, formatLocalDate, normalizeGreek } from '../../models/shift.model';

export interface PrintableSlotItem {
  index: number;
  dutyName: string;
  person: Personnel | undefined;
  slot: ShiftSlotAssignment;
}

export interface PrintDisplaySettings {
  density: 'normal' | 'compact' | 'ultra-compact' | 'spacious';
  showEmblems: boolean;
  showDivision: boolean;
  showSignatures: boolean;
  showExtraGuardsRow: boolean;
  showSupervisorCell: boolean;
  columnLayout: 'balanced' | 'guards-wide' | 'restaurant-wide';
  showRoomBed?: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintDisplaySettings = {
  density: 'normal',
  showEmblems: true,
  showDivision: true,
  showSignatures: true,
  showExtraGuardsRow: true,
  showSupervisorCell: true,
  columnLayout: 'balanced',
  showRoomBed: false
};

const STANDARD_GUARD_INTERVALS: TimeInterval[][] = [
  [
    { from: '14:00', to: '16:00' },
    { from: '22:00', to: '00:00' },
    { from: '06:00', to: '08:00' }
  ],
  [
    { from: '16:00', to: '18:00' },
    { from: '00:00', to: '02:00' },
    { from: '08:00', to: '10:00' }
  ],
  [
    { from: '18:00', to: '20:00' },
    { from: '02:00', to: '04:00' },
    { from: '10:00', to: '12:00' }
  ],
  [
    { from: '20:00', to: '22:00' },
    { from: '04:00', to: '06:00' },
    { from: '12:00', to: '14:00' }
  ]
];

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

  readonly formatGreekDate = formatGreekDate;
  readonly higherPersonnel = this.storage.higherPersonnel;

  date = signal<string>(formatLocalDate(new Date()));
  schedule = signal<DailySchedule | null>(null);
  signatures = signal<SignatureSlot[]>([]);
  inkSaver = signal<boolean>(false);

  // Print Display Settings
  displaySettings = signal<PrintDisplaySettings>(this.loadDisplaySettings());
  isDisplaySettingsOpen = signal<boolean>(false);

  // Manual In-place Text Overrides for Preview
  isEditModeActive = signal<boolean>(false);
  textOverrides = signal<Record<string, string>>({});
  readonly overrideCount = computed(() => Object.keys(this.textOverrides()).length);

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
    const fallbackName = personNameFallback?.trim();
    const p = personId ? this.getPerson(personId) : null;
    const fullName = (p?.fullName || fallbackName || '').trim();
    const normalizedName = normalizeGreek(fullName);
    const compactName = normalizedName.replace(/\s+/g, '');
    const emptySlotNames = ['', '-', '---', 'κ.', 'κενη θεση'];
    if (emptySlotNames.includes(normalizedName) || /^-+κ\.$/u.test(compactName)) return '-';

    const tokens = fullName.trim().split(/\s+/);
    let displayName = tokens[0] || fullName;

    // Always append the first letter of first name with '.' (e.g. ΚΑΡΑΓΙΑΝΝΙΔΗΣ Α.)
    if (tokens.length > 1 && tokens[1]) {
      const initial = tokens[1].replace(/[^A-Za-zΑ-Ωα-ωΆ-Ώά-ώ]/g, '').charAt(0).toUpperCase();
      if (initial) {
        displayName = `${displayName} ${initial}.`;
      }
    }

    // Extract room & bed e.g. (2.1) - only if explicitly enabled in settings
    let roomBed = '';
    if (this.displaySettings().showRoomBed && p) {
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

  readonly printSignatures = computed(() => {
    const sigs = this.signatures();
    if (sigs && sigs.length >= 3) {
      return {
        left: sigs[0],
        center: sigs[1],
        right: sigs[2]
      };
    }
    const hp = this.higherPersonnel();
    return {
      left: sigs[0] || {
        roleTitle: hp[0]?.roleTitle || 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ',
        fullName: hp[0]?.fullName || 'ΖΑΒΙΤΣΑΝΟΣ ΔΗΜΗΤΡΙΟΣ',
        rank: hp[0]?.rank || 'ΑΝΧΗΣ (ΠΒ)'
      },
      center: sigs[1] || {
        roleTitle: hp[1]?.roleTitle || 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ',
        fullName: hp[1]?.fullName || 'ΛΙΝΑΡΔΟΣ ΜΑΡΙΟΣ',
        rank: hp[1]?.rank || 'ΥΠΛΓΟΣ (ΠΖ)'
      },
      right: sigs[2] || {
        roleTitle: hp[2]?.roleTitle || 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ',
        fullName: hp[2]?.fullName || 'ΤΕΡΖΟΓΛΟΥ ΕΥΜΟΡΦΙΑ',
        rank: hp[2]?.rank || 'ΑΝΘΛΓΟΣ (ΠΒ)'
      }
    };
  });

  readonly leftColumnShifts = computed(() => {
    const d1 = this.date1Formatted();
    const d2 = this.date2Formatted();
    const thDuty = this.getDutyAssignment('θαλαμ');
    const opDuty = this.getDutyAssignment('οπλοφ');

    const thSlots = thDuty ? thDuty.slots : [];
    const opSlots = opDuty ? opDuty.slots : [];

    const shiftTimes = [
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

    return shiftTimes.map((times, idx) => {
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
  });

  readonly middleColumnData = computed(() => {
    const d1 = this.date1Formatted();
    const d2 = this.date2Formatted();

    // 1. Skopia Kentriki Pyli
    const skopiaDuty = this.getDutyAssignment('σκοπ') || this.getDutyAssignment('πυλ');
    const skopiaSlots = skopiaDuty ? skopiaDuty.slots : [];
    const skopiaTimes = [
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
    const skopiaShifts = skopiaTimes.map((times, idx) => {
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

    // 2. Dekaneis Allagis
    const dekDuty = this.getDutyAssignment('δεκαν');
    const dekSlots = dekDuty ? dekDuty.slots : [];
    const dekaneisShifts = [
      {
        times: [{ date: d1, time: '14:00 - 00:00' }],
        guard: dekSlots[0]
      },
      {
        times: [{ date: d2, time: '00:00 - 14:00' }],
        guard: dekSlots[1]
      }
    ];

    // 3. Yparchifylakas
    const yparchDuty = this.getDutyAssignment('υπαρχ');
    const yparchSlots = yparchDuty ? yparchDuty.slots : [];
    const yparchShift = {
      times: [{ date: d1, time: '14:00 - 06:00' }],
      guard: yparchSlots[0]
    };

    // 4. AM
    const amDuty = this.schedule()?.duties.find(d => {
      const code = (d.dutyTypeId || '').toLowerCase();
      const name = normalizeGreek(d.dutyName || '');
      const short = normalizeGreek(d.shortName || '');
      return code === 'duty-am' || name === 'αμ' || short === 'αμ';
    });
    const amSlots = amDuty ? amDuty.slots : [];
    const amShifts = [
      {
        times: [{ date: d1, time: '14:00 - 22:00' }],
        guards: [amSlots[0]].filter(Boolean)
      },
      {
        times: [{ date: d2, time: '06:00 - 14:00' }],
        guards: [amSlots[1], amSlots[2]].filter(Boolean)
      }
    ];

    return {
      skopia: {
        title: 'ΣΚΟΠΙΑ ΚΕΝΤΡΙΚΗ ΠΥΛΗ',
        shifts: skopiaShifts
      },
      dekaneis: {
        title: 'ΔΕΚΑΝΕΙΣ ΑΛΛΑΓΗΣ',
        shifts: dekaneisShifts
      },
      yparchifylakas: {
        title: 'ΥΠΑΡΧΙΦΥΛΑΚΑΣ',
        shift: yparchShift
      },
      am: {
        title: 'ΑΜ',
        shifts: amShifts
      }
    };
  });

  readonly rightColumnData = computed(() => {
    const d1 = this.date1Formatted();
    const d2 = this.date2Formatted();

    // 1. Estiatoria
    const estDuty = this.getDutyAssignment('εστιατορ') || this.getDutyAssignment('εστ');
    const estSlots = estDuty ? estDuty.slots : [];
    const estTimes = [
      { date: d1, time: '16:00 - 22:00' },
      { date: d2, time: '05:20 - 16:00' }
    ];
    const estGuards = Array.from({ length: 10 }, (_, i) => estSlots[i] || null);

    // 2. Artoklivanos
    const artDuty = this.findArtoklivanosDuty();
    const artSlots = artDuty ? artDuty.slots : [];
    const artGuards = Array.from({ length: 4 }, (_, i) => artSlots[i] || null);

    // 3. Epifylaki
    const epifDuty = this.getDutyAssignment('επιφυλακ') || this.getDutyAssignment('επιφ');
    const epifSlots = epifDuty ? epifDuty.slots : [];
    const epifGuards = Array.from({ length: 5 }, (_, i) => epifSlots[i] || null);

    // 4. Xenokratis
    const xenDuty = this.getDutyAssignment('ξενοκρατ');
    const xenSlots = xenDuty ? xenDuty.slots : [];
    const xenGuards = Array.from({ length: 5 }, (_, i) => xenSlots[i] || null);

    // 5. Kathariotites
    const kathDuty = this.getDutyAssignment('καθαρι');
    const kathSlots = kathDuty ? kathDuty.slots : [];

    const getSlotsForKeyword = (kw: string, fallbackIdxs: [number, number]): (ShiftSlotAssignment | null)[] => {
      const matched = kathSlots.filter(s => {
        const lbl = normalizeGreek(s.hoursNote || '') + ' ' + normalizeGreek(s.groupTag || '');
        return lbl.includes(kw);
      });
      if (matched.length >= 2) return [matched[0], matched[1]];
      if (matched.length === 1) return [matched[0], kathSlots[fallbackIdxs[1]] || null];
      return [kathSlots[fallbackIdxs[0]] || null, kathSlots[fallbackIdxs[1]] || null];
    };

    const kathSections = [
      {
        title: 'ΤΟΥΑΛΕΤΕΣ',
        guards: getSlotsForKeyword('τουαλ', [0, 1])
      },
      {
        title: 'ΛΟΥΤΡΑ / ΝΙΠΤΗΡΕΣ',
        guards: getSlotsForKeyword('λουτρ', [2, 3])
      },
      {
        title: 'ΣΚΑΛΕΣ/ ΠΡΟΘΑΛΑΜΟΣ/ ΘΑΛΑΜΟΙ/ ΔΙΑΔΡΟΜΟΣ',
        guards: getSlotsForKeyword('σκαλ', [4, 5])
      },
      {
        title: 'ΠΡΟΑΥΛΙΟΣ ΧΩΡΟΣ / ΕΞΩΤΕΡΙΚΕΣ ΣΚΑΛΕΣ',
        guards: getSlotsForKeyword('προαυλ', [6, 7])
      }
    ];

    return {
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
        timesSubtitle: '14:00-15:00 & 20:00-21:00 & 06:30-07:30',
        sections: kathSections
      }
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
      return !isTh && !isOp && this.isGuardDuty(d) && this.hasStandardGuardHours(d);
    });
  });

  readonly guardGroups = computed(() => {
    const thDuty = this.getDutyAssignment('θαλαμ');
    const opDuty = this.getDutyAssignment('οπλοφ');

    const thSlots = thDuty ? thDuty.slots : [];
    const opSlots = opDuty ? opDuty.slots : [];

    const timeDefs = STANDARD_GUARD_INTERVALS.map(intervals => this.formatDutyIntervals(intervals));

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
      { title: 'ΤΟΥΑΛΕΤΕΣ', slotIdx: 0 },
      { title: 'ΛΟΥΤΡΑ / ΝΙΠΤΗΡΕΣ', slotIdx: 1 },
      { title: 'ΣΚΑΛΕΣ / ΠΡΟΘΑΛΑΜΟΣ ΘΑΛΑΜΟΙ / ΔΙΑΔΡΟΜΟΣ', slotIdx: 2 },
      { title: 'ΠΡΟΑΥΛΙΟΣ ΧΩΡΟΣ ΕΞΩΤΕΡΙΚΕΣ ΣΚΑΛΕΣ', slotIdx: 3 }
    ];

    const kathType = this.storage.dutyTypes().find(dt => dt.id === kathDuty?.dutyTypeId || dt.name.toLowerCase().includes('καθαρι'));

    // Map each slot uniquely and mutually exclusively to its cleaning section (or supervisor)
    // to strictly prevent one section taking slots from another section.
    const sectionSlots: ShiftSlotAssignment[][] = [[], [], [], []];
    let supervisorSlotFromDuty: any = null;

    slots.forEach((s, sIdx) => {
      const slotDef = kathType?.slotDefinitions?.find(sd => sd.slotIndex === s.slotIndex);
      const lbl = `${slotDef?.groupName || ''} ${slotDef?.label || ''} ${s.hoursNote || ''}`.toLowerCase();

      // Check if slot is explicitly marked for supervisor (Υπεύθυνος Υλικού)
      if (lbl.includes('υπευθυν') || lbl.includes('υλικ')) {
        if (!supervisorSlotFromDuty) supervisorSlotFromDuty = s;
        return;
      }

      // Check specific cleaning areas
      // Crucial: Check προαυλ BEFORE σκαλ so that "Εξωτερικές Σκάλες / Προαύλιος" goes to section 3, not section 2!
      if (lbl.includes('τουαλ')) {
        sectionSlots[0].push(s);
      } else if (lbl.includes('λουτρ') || lbl.includes('νιπτ')) {
        sectionSlots[1].push(s);
      } else if (lbl.includes('προαυλ')) {
        sectionSlots[3].push(s);
      } else if (lbl.includes('σκαλ') || lbl.includes('διαδρομ') || lbl.includes('θαλαμ')) {
        sectionSlots[2].push(s);
      } else if (s.slotIndex >= 1 && s.slotIndex <= 4) {
        // Fallback by 1-based slotIndex
        sectionSlots[s.slotIndex - 1].push(s);
      } else if (s.slotIndex === 5) {
        if (!supervisorSlotFromDuty) supervisorSlotFromDuty = s;
      } else if (sIdx < 4) {
        // Fallback by sequential slot index
        sectionSlots[sIdx].push(s);
      } else if (sIdx === 4) {
        if (!supervisorSlotFromDuty) supervisorSlotFromDuty = s;
      } else {
        sectionSlots[sIdx % 4].push(s);
      }
    });

    const sections = defs.map((d, idx) => ({
      title: d.title,
      times: standardTimes,
      slots: sectionSlots[idx]
    }));

    // Supervisor (Υπεύθυνος Υλικού Καθαριότητας):
    // 1. If assigned in duty slots, use that slot
    // 2. Otherwise check special role soldier, but ONLY if they are not already assigned to another duty today
    let supervisor: { personId: string; personName: string } | null = null;
    const supSlot: ShiftSlotAssignment | null = supervisorSlotFromDuty;
    if (supSlot && (supSlot.personId || supSlot.personName)) {
      supervisor = {
        personId: supSlot.personId || '',
        personName: supSlot.personName || ''
      };
    } else {
      const specialSup = this.specialRolePersonnel().cleaningSupervisor;
      if (specialSup) {
        const isAssignedElsewhere = this.schedule()?.duties.some(d => 
          d.slots.some(s => s.personId === specialSup.id)
        );
        if (!isAssignedElsewhere) {
          supervisor = {
            personId: specialSup.id,
            personName: specialSup.fullName
          };
        }
      }
    }

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
      if (code === 'duty-skopia' || name.includes('σκοπ') || code.includes('skopia') || name.includes('πυλη')) return false;
      if (code === 'duty-dekaneis' || name.includes('δεκαν') || code.includes('dekan')) return false;
      if (code === 'duty-yparchifylakas' || name.includes('υπαρχ') || code.includes('yparch')) return false;
      if (code === 'duty-am' || name === 'αμ' || short === 'αμ') return false;
      if (name.includes('καθαρι') || code.includes('καθαρι') || code.includes('kathar')) return false;
      if (name.includes('εστιατορ') || code.includes('εστιατορ') || code.includes('estiat') || dtDef?.timePresetType === 'RESTAURANT_CYCLE') return false;
      if (name.includes('αρτοκλιβ') || name.includes('αρτοποι') || name.includes('φουρν') || code.includes('artokliv') || code.includes('bakery') || short === 'αρτ' || dtName.includes('αρτοκλιβ')) return false;
      if (name.includes('επιφυλακ') || code.includes('επιφυλακ') || code.includes('epifylak')) return false;
      if (code === 'duty-xenokratis' || name.includes('ξενοκρατ') || code.includes('xenokrat')) return false;
      if (name.includes('κψμ') || name.includes('καψιμ') || code.includes('kpsm') || code.includes('ksym')) return false;
      if (this.isGuardDuty(d) && this.hasStandardGuardHours(d)) return false;
      return true;
    }).map(d => {
      const dtDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      return {
        dutyTypeId: d.dutyTypeId,
        dutyName: d.dutyName,
        shortName: d.shortName || d.dutyName,
        shiftHours: dtDef?.shiftHours || (d.slots[0]?.hoursNote || ''),
        slots: d.slots,
        timeGroups: this.createDutyTimeGroups(d.slots, dtDef?.shiftHours || '')
      };
    });
  });

  private createDutyTimeGroups(slots: ShiftSlotAssignment[], fallbackTime: string) {
    const groups = new Map<string, { times: { date: string; time: string }[]; slots: ShiftSlotAssignment[] }>();
    const date1 = this.date1Formatted();

    for (const slot of slots) {
      const intervals = slot.intervals || [];
      const note = slot.hoursNote || fallbackTime;
      const key = intervals.length > 0 ? JSON.stringify(intervals) : note;
      let group = groups.get(key);

      if (!group) {
        let dayOffset = 0;
        group = {
          times: intervals.length > 0
            ? this.formatDutyIntervals(intervals)
            : [{ date: date1, time: note || '-' }],
          slots: []
        };
        groups.set(key, group);
      }

      group.slots.push(slot);
    }

    if (groups.size === 0) {
      return [{ times: [{ date: date1, time: fallbackTime || '-' }], slots: [] as ShiftSlotAssignment[] }];
    }

    return [...groups.values()];
  }

  private formatDutyIntervals(intervals: TimeInterval[]) {
    const date1 = this.date1Formatted();
    const date2 = this.date2Formatted();
    let dayOffset = 0;
    let previousStart: number | undefined;

    return intervals.map(interval => {
      const [fromHour, fromMinute] = interval.from.split(':').map(Number);
      const from = fromHour * 60 + fromMinute;
      if (previousStart !== undefined && from < previousStart) dayOffset++;
      previousStart = from;
      return {
        date: this.formatDutyDateOffset(dayOffset, date1, date2),
        time: `${interval.from} - ${interval.to}`
      };
    });
  }

  private isGuardDuty(duty: DutyAssignment): boolean {
    const name = normalizeGreek(duty.dutyName || '');
    const id = normalizeGreek(duty.dutyTypeId || '');
    return name.includes('πυλ') || name.includes('σκοπ') || name.includes('περιπολ') ||
      id.includes('πυλ') || id.includes('σκοπ') || id.includes('περιπολ');
  }

  private hasStandardGuardHours(duty: DutyAssignment): boolean {
    if (duty.slots.length === 0) return false;
    return duty.slots.every(slot => {
      const groupIndex = slot.groupIndex;
      const standardIntervals = groupIndex ? STANDARD_GUARD_INTERVALS[groupIndex - 1] : undefined;
      if (!standardIntervals || !slot.intervals?.length) return false;
      return this.intervalSignature(slot.intervals) === this.intervalSignature(standardIntervals);
    });
  }

  private intervalSignature(intervals: TimeInterval[]): string {
    return intervals.map(interval => `${interval.from}-${interval.to}`).join('|');
  }

  private formatDutyDateOffset(dayOffset: number, date1: string, date2: string): string {
    if (dayOffset === 0) return date1;
    if (dayOffset === 1) return date2;

    const [year, month, day] = this.date().split('-').map(Number);
    const shiftedDate = new Date(year, month - 1, day + dayOffset);
    return this.formatShortDate(formatLocalDate(shiftedDate));
  }

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

  // --- Display Settings Methods ---
  toggleDisplaySettings() {
    this.isDisplaySettingsOpen.update(v => !v);
  }

  closeDisplaySettings() {
    this.isDisplaySettingsOpen.set(false);
  }

  updateDisplaySetting<K extends keyof PrintDisplaySettings>(key: K, value: PrintDisplaySettings[K]) {
    this.displaySettings.update(s => {
      const updated = { ...s, [key]: value };
      this.persistDisplaySettings(updated);
      return updated;
    });
  }

  resetDisplaySettings() {
    this.displaySettings.set({ ...DEFAULT_PRINT_SETTINGS });
    this.persistDisplaySettings(DEFAULT_PRINT_SETTINGS);
    this.storage.notify('Επαναφέρθηκαν οι προεπιλογές εμφάνισης.', 'info');
  }

  private loadDisplaySettings(): PrintDisplaySettings {
    try {
      const saved = localStorage.getItem('greek_army_print_display_settings');
      if (saved) {
        return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading print display settings', e);
    }
    return { ...DEFAULT_PRINT_SETTINGS };
  }

  private persistDisplaySettings(settings: PrintDisplaySettings) {
    try {
      localStorage.setItem('greek_army_print_display_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving print display settings', e);
    }
  }

  // --- Manual Text Overrides Methods ---
  toggleEditMode() {
    this.isEditModeActive.update(v => !v);
    if (this.isEditModeActive()) {
      this.storage.notify('Λειτουργία Επεξεργασίας: Κάντε κλικ σε οποιοδήποτε κείμενο για να το αλλάξετε.', 'info');
    }
  }

  getText(key: string, fallback: string): string {
    const override = this.textOverrides()[key];
    return override !== undefined ? override : (fallback ?? '');
  }

  hasOverride(key: string): boolean {
    return this.textOverrides()[key] !== undefined;
  }

  onTextBlur(key: string, event: Event, fallbackVal: string) {
    const el = event.target as HTMLElement;
    if (!el) return;
    const newText = (el.innerText || '').trim();
    const normalizedDefault = (fallbackVal || '').trim();

    if (newText === normalizedDefault || newText === '') {
      if (this.textOverrides()[key] !== undefined) {
        this.textOverrides.update(o => {
          const copy = { ...o };
          delete copy[key];
          return copy;
        });
        this.persistOverrides();
      }
      el.innerText = normalizedDefault;
    } else {
      this.textOverrides.update(o => ({ ...o, [key]: newText }));
      this.persistOverrides();
    }
  }

  resetOverrides() {
    if (this.overrideCount() === 0) return;
    this.textOverrides.set({});
    this.persistOverrides();
    this.storage.notify('Επαναφέρθηκαν όλα τα κείμενα στις αρχικές τιμές.', 'info');
  }

  private loadOverrides(dateStr: string) {
    try {
      const saved = localStorage.getItem(`greek_army_print_overrides_${dateStr}`);
      if (saved) {
        this.textOverrides.set(JSON.parse(saved));
        return;
      }
    } catch (e) {
      console.error('Error loading overrides', e);
    }
    this.textOverrides.set({});
  }

  private persistOverrides() {
    const d = this.date();
    if (!d) return;
    try {
      const overrides = this.textOverrides();
      if (Object.keys(overrides).length > 0) {
        localStorage.setItem(`greek_army_print_overrides_${d}`, JSON.stringify(overrides));
      } else {
        localStorage.removeItem(`greek_army_print_overrides_${d}`);
      }
    } catch (e) {
      console.error('Error persisting overrides', e);
    }
  }

  constructor() {
    this.route.params.subscribe(params => {
      if (params['date']) {
        this.date.set(params['date']);
        this.loadOverrides(params['date']);
        this.loadSchedule(params['date']);
      }
    });
  }

  loadSchedule(dateStr: string) {
    this.loadOverrides(dateStr);
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
      this.signatures.set([]);
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
      roleTitle: '',
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
      const exportSignatures = this.signatures().map((sig, idx) => ({
        ...sig,
        roleTitle: this.getText(`sig.${idx}.role`, sig.roleTitle),
        fullName: this.getText(`sig.${idx}.name`, sig.fullName),
        rank: this.getText(`sig.${idx}.rank`, sig.rank || '')
      }));

      const printSigs = this.printSignatures();
      const exportPrintSignatures = {
        left: {
          ...printSigs.left,
          roleTitle: this.getText('sig.left.role', printSigs.left.roleTitle),
          fullName: this.getText('sig.left.name', printSigs.left.fullName),
          rank: this.getText('sig.left.rank', printSigs.left.rank || '')
        },
        center: {
          ...printSigs.center,
          roleTitle: this.getText('sig.center.role', printSigs.center.roleTitle),
          fullName: this.getText('sig.center.name', printSigs.center.fullName),
          rank: this.getText('sig.center.rank', printSigs.center.rank || '')
        },
        right: {
          ...printSigs.right,
          roleTitle: this.getText('sig.right.role', printSigs.right.roleTitle),
          fullName: this.getText('sig.right.name', printSigs.right.fullName),
          rank: this.getText('sig.right.rank', printSigs.right.rank || '')
        }
      };

      this.excelService.exportScheduleToExcel(s, {
        schedule: s,
        date1Formatted: this.date1Formatted(),
        date2Formatted: this.date2Formatted(),
        leftColumnShifts: this.leftColumnShifts(),
        middleColumnData: this.middleColumnData(),
        rightColumnData: this.rightColumnData(),
        printSignatures: exportPrintSignatures,
        guardGroups: this.guardGroups(),
        cleaningSections: this.cleaningSections(),
        col3Data: this.col3Data(),
        extraGuards: this.extraGuards(),
        signatures: exportSignatures,
        unitTitle: this.getText('header.unit', this.unit().name || 'ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)'),
        divisionTitle: this.getText('header.division', this.unit().division || '2ο ΜΕΛ/Σ'),
        dateTitle: this.getText('header.title', 'ΥΠΗΡΕΣΙΕΣ ΣΤ\' ΚΤΗΡΙΟΥ Γ\' ΠΥΡΧΙΑΣ ΤΗΣ ' + this.date1Formatted()),
        subTitle: 'ΥΠΗΡΕΣΙΕΣ ΣΤ\' ΚΤΗΡΙΟΥ Γ\' ΠΥΡΧΙΑΣ',
        subRule1: this.getText('header.sub1', 'ΟΙ ΠΑΡΑΚΑΤΩ ΥΠΗΡΕΣΙΕΣ ΙΣΧΥΟΥΝ ΑΠΟ ΣΗΜΕΡΑ ΣΤΙΣ 14:00 ΕΩΣ ΤΙΣ 14:00 ΤΗΣ ΕΠΟΜΕΝΗΣ ΜΕΡΑΣ'),
        subRule2: this.getText('header.sub2', 'ΚΑΘΑΡΙΟΤΗΤΕΣ [14:00-15:00 & 20:00-21:00 & 06:30-07:30]'),
        formatSoldierFn: (personId, personNameFallback, suffix) => 
          this.formatSoldierDisplay(personId, personNameFallback, suffix)
      });
    }
  }
}
