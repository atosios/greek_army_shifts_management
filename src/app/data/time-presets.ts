import { DutySlotDefinition, TimeInterval, TimePresetType, normalizeGreek } from '../models/shift.model';

export const TIME_OPTIONS: string[] = [
  '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
  '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30',
  '24:00'
];

export function formatIntervalsToString(intervals: TimeInterval[]): string {
  if (!intervals || intervals.length === 0) return 'Χωρίς ωράριο';
  return intervals.map(i => `${i.from}-${i.to}`).join(' & ');
}

export interface TimeGroupTemplate {
  groupIndex: number;
  groupName: string;
  shortLabel: string;
  intervals: TimeInterval[];
  peopleCount?: number;
}

export const GREEK_ARMY_26_GROUPS: TimeGroupTemplate[] = [
  {
    groupIndex: 1,
    groupName: '1η Θέση (14:00-16:00, 22:00-00:00, 06:00-08:00)',
    shortLabel: '1η Θέση',
    peopleCount: 2,
    intervals: [
      { from: '14:00', to: '16:00' },
      { from: '22:00', to: '00:00' },
      { from: '06:00', to: '08:00' }
    ]
  },
  {
    groupIndex: 2,
    groupName: '2η Θέση (16:00-18:00, 00:00-02:00, 08:00-10:00)',
    shortLabel: '2η Θέση',
    peopleCount: 2,
    intervals: [
      { from: '16:00', to: '18:00' },
      { from: '00:00', to: '02:00' },
      { from: '08:00', to: '10:00' }
    ]
  },
  {
    groupIndex: 3,
    groupName: '3η Θέση (18:00-20:00, 02:00-04:00, 10:00-12:00)',
    shortLabel: '3η Θέση',
    peopleCount: 2,
    intervals: [
      { from: '18:00', to: '20:00' },
      { from: '02:00', to: '04:00' },
      { from: '10:00', to: '12:00' }
    ]
  },
  {
    groupIndex: 4,
    groupName: '4η Θέση (20:00-22:00, 04:00-06:00, 12:00-14:00)',
    shortLabel: '4η Θέση',
    peopleCount: 2,
    intervals: [
      { from: '20:00', to: '22:00' },
      { from: '04:00', to: '06:00' },
      { from: '12:00', to: '14:00' }
    ]
  }
];

export const GREEK_ARMY_26_POSITIONS = GREEK_ARMY_26_GROUPS;

export function generateGreekArmy26Slots(totalPeople: number = 8, customGroups?: TimeGroupTemplate[]): DutySlotDefinition[] {
  const groups = customGroups || GREEK_ARMY_26_GROUPS;
  const count = Math.max(1, Number(totalPeople) || 8);
  const base = Math.floor(count / 4);
  const remainder = count % 4;

  const slots: DutySlotDefinition[] = [];
  let globalSlotIndex = 1;

  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g];
    let countInGroup = grp.peopleCount;
    if (countInGroup === undefined || countInGroup === null) {
      countInGroup = base + (g < remainder ? 1 : 0);
    }
    countInGroup = Math.max(1, countInGroup);

    for (let p = 1; p <= countInGroup; p++) {
      const timesStr = formatIntervalsToString(grp.intervals);
      const label = countInGroup > 1 
        ? `${grp.shortLabel} (${timesStr}) - Σκοπός ${p}` 
        : `${grp.shortLabel} (${timesStr})`;
      
      slots.push({
        slotIndex: globalSlotIndex++,
        groupIndex: grp.groupIndex,
        groupName: grp.shortLabel,
        label,
        intervals: JSON.parse(JSON.stringify(grp.intervals))
      });
    }
  }

  return slots;
}

export function isSlotConflictingWithDayOff(
  slot: { intervals?: { from: string; to: string }[]; hoursNote?: string } | null | undefined,
  dayOfWeek: number,
  isSatOff: boolean,
  isSunOff: boolean
): boolean {
  if (dayOfWeek === 6 && isSatOff) {
    // Saturday departure is 12:00 (720 min)
    if (!slot) return true;
    let intervals = slot.intervals;
    if (!intervals || intervals.length === 0) {
      if (slot.hoursNote) {
        const matches = [...slot.hoursNote.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g)];
        if (matches.length > 0) {
          intervals = matches.map(m => ({ from: m[1], to: m[2] }));
        }
      }
    }
    if (!intervals || intervals.length === 0) return true;
    for (const inv of intervals) {
      if (!inv.from || !inv.to) return true;
      const [fH, fM] = inv.from.split(':').map(Number);
      const [tH, tM] = inv.to.split(':').map(Number);
      const fromMin = fH * 60 + fM;
      const toMin = tH * 60 + tM;
      // If crosses midnight
      if (toMin <= fromMin) {
        return true;
      }
      // Ends after 12:00 or starts at/after 12:00
      if (toMin > 720 || fromMin >= 720) {
        return true;
      }
    }
    return false;
  }

  if (dayOfWeek === 0 && isSunOff) {
    // Sunday departure is 10:00 (600 min)
    if (!slot) return true;
    let intervals = slot.intervals;
    if (!intervals || intervals.length === 0) {
      if (slot.hoursNote) {
        const matches = [...slot.hoursNote.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g)];
        if (matches.length > 0) {
          intervals = matches.map(m => ({ from: m[1], to: m[2] }));
        }
      }
    }
    if (!intervals || intervals.length === 0) return true;
    for (const inv of intervals) {
      if (!inv.from || !inv.to) return true;
      const [fH, fM] = inv.from.split(':').map(Number);
      const [tH, tM] = inv.to.split(':').map(Number);
      const fromMin = fH * 60 + fM;
      const toMin = tH * 60 + tM;
      // If crosses midnight
      if (toMin <= fromMin) {
        return true;
      }
      // Ends after 10:00 or starts at/after 10:00
      if (toMin > 600 || fromMin >= 600) {
        return true;
      }
    }
    return false;
  }

  return false;
}

export function generateRestaurantSlotsForDay(
  day: number,
  peopleCount: number,
  nextDay: string
): DutySlotDefinition[] {
  const count = Math.max(1, peopleCount || 2);
  const slots: DutySlotDefinition[] = [];
  let globalIndex = 1;

  if (day === 5) {
    // Παρασκευή: 16:00 - 22:00
    for (let p = 1; p <= count; p++) {
      const pSuffix = count > 1 ? ` - Άτομο ${p}` : '';
      slots.push({
        slotIndex: globalIndex++,
        groupIndex: 1,
        groupName: '',
        label: `16:00-22:00${pSuffix}`,
        hoursNote: '16:00 - 22:00',
        intervals: [{ from: '16:00', to: '22:00' }]
      });
    }
    return slots;
  }

  if (day === 6) {
    // Σάββατο: 07:00 - 22:00 (Χωρίς εξοδούχους Σαββάτου)
    for (let p = 1; p <= count; p++) {
      const pSuffix = count > 1 ? ` - Άτομο ${p}` : '';
      slots.push({
        slotIndex: globalIndex++,
        groupIndex: 1,
        groupName: '',
        label: `07:00-22:00${pSuffix}`,
        hoursNote: '07:00 - 22:00',
        intervals: [{ from: '07:00', to: '22:00' }]
      });
    }
    return slots;
  }

  if (day === 0) {
    // Κυριακή: 07:00 - 22:00 (Χωρίς εξοδούχους Κυριακής)
    for (let p = 1; p <= count; p++) {
      const pSuffix = count > 1 ? ` - Άτομο ${p}` : '';
      slots.push({
        slotIndex: globalIndex++,
        groupIndex: 1,
        groupName: '',
        label: `07:00-22:00${pSuffix}`,
        hoursNote: '07:00 - 22:00',
        intervals: [{ from: '07:00', to: '22:00' }]
      });
    }
    return slots;
  }

  if (day === 1) {
    // Δευτέρα:
    // 1) Πρωινό: 05:20 - 16:00 (Ολοκλήρωση από τα άτομα της Παρασκευής)
    for (let p = 1; p <= count; p++) {
      const pSuffix = count > 1 ? ` - Άτομο ${p}` : '';
      slots.push({
        slotIndex: globalIndex++,
        groupIndex: 1,
        groupName: 'Ολοκλήρωση Παρασκευής',
        label: `05:20-16:00 (Ολοκλήρωση Παρασκευής)${pSuffix}`,
        hoursNote: '05:20 - 16:00 (Παρασκευής)',
        intervals: [{ from: '05:20', to: '16:00' }]
      });
    }
    // 2) Απογευματινό Δευτέρας: 16:00 - 22:00 & 05:20 - 16:00 επομένης
    for (let p = 1; p <= count; p++) {
      const pSuffix = count > 1 ? ` - Άτομο ${p}` : '';
      slots.push({
        slotIndex: globalIndex++,
        groupIndex: 2,
        groupName: '',
        label: `16:00-22:00 & 05:20-16:00 (επομ.)${pSuffix}`,
        hoursNote: `16:00 - 22:00 & 05:20 - 16:00 (${nextDay})`,
        intervals: [
          { from: '16:00', to: '22:00' },
          { from: '05:20', to: '16:00' }
        ]
      });
    }
    return slots;
  }

  // Τρίτη - Πέμπτη: 16:00 - 22:00 & 05:20 - 16:00 επομένης
  for (let p = 1; p <= count; p++) {
    const pSuffix = count > 1 ? ` - Άτομο ${p}` : '';
    slots.push({
      slotIndex: globalIndex++,
      groupIndex: 1,
      groupName: '',
      label: `16:00-22:00 & 05:20-16:00 (επομ.)${pSuffix}`,
      hoursNote: `16:00 - 22:00 & 05:20 - 16:00 (${nextDay})`,
      intervals: [
        { from: '16:00', to: '22:00' },
        { from: '05:20', to: '16:00' }
      ]
    });
  }
  return slots;
}

export function getSlotDefinitionsForPreset(preset: TimePresetType, slotsCount: number): DutySlotDefinition[] {
  if (preset === 'ROLLING_CYCLE' || preset === 'GREEK_ARMY_2_6') {
    return generateGreekArmy26Slots(slotsCount);
  }

  if (preset === 'RESTAURANT_CYCLE') {
    const count = Math.max(1, Number(slotsCount) || 2);
    const defs: DutySlotDefinition[] = [];
    for (let i = 1; i <= count; i++) {
      defs.push({
        slotIndex: i,
        groupIndex: 1,
        groupName: '',
        label: count > 1 ? `16:00-22:00 & 05:20-16:00 (επομ.) - Άτομο ${i}` : '16:00-22:00 & 05:20-16:00 (επομ.)',
        intervals: [
          { from: '16:00', to: '22:00' },
          { from: '05:20', to: '16:00' }
        ]
      });
    }
    return defs;
  }
  
  // CUSTOM
  const count = Math.max(1, Number(slotsCount) || 1);
  const defs: DutySlotDefinition[] = [];
  for (let i = 1; i <= count; i++) {
    defs.push({
      slotIndex: i,
      label: `${i}η Θέση`,
      intervals: [{ from: '08:00', to: '14:00' }]
    });
  }
  return defs;
}

/** Get short name of the next day in Greek (for shifts passing midnight) */
export function getNextDayShortGreek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const nextDay = (day + 1) % 7;
  const names = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'];
  return names[nextDay];
}

/** Get handover / rotation banner note for the day */
export function getDayHandoverNote(dateStr: string): string | undefined {
  const d = new Date(dateStr);
  const day = d.getDay();
  switch (day) {
    case 5:
      return 'Ειδική εναλλαγή για έξοδο Σαββάτου 12:00 (Κάλυψη 12:00-14:00)';
    case 6:
      return 'Ειδική εναλλαγή για έξοδο Κυριακής 10:00 (Κάλυψη 10:00-12:00 & 12:00-14:00)';
    case 0:
      return 'Πλήρης κάλυψη μέχρι Δευτέρα 14:00';
    default:
      return undefined;
  }
}

/**
 * Generates rolling weekend/weekday slots for 24h shifts (14:00 - 14:00).
 * Multiplier is 2 for Θαλαμοφύλακας (2 people per position = 8 slots)
 * and 1 for Οπλοφύλακας (1 person per position = 4 slots).
 */
export function generateRollingWeekendSlots(
  day: number, 
  multiplier: number, 
  nextDay: string
): DutySlotDefinition[] {
  const slots: DutySlotDefinition[] = [];
  let globalIndex = 1;

  const addPositionSlot = (
    posIdx: number, 
    internalRole: string | undefined, 
    intervals: TimeInterval[], 
    customLabel?: string
  ) => {
    for (let p = 1; p <= multiplier; p++) {
      const pSuffix = multiplier > 1 ? ` - Άτομο ${p}` : '';
      const baseLabel = customLabel || `${posIdx}η Θέση`;
      const timesStr = formatIntervalsToString(intervals);
      slots.push({
        slotIndex: globalIndex++,
        groupIndex: posIdx,
        groupName: `${posIdx}η Θέση`,
        groupTag: internalRole,
        label: `${baseLabel}${pSuffix} (${timesStr})`,
        intervals: JSON.parse(JSON.stringify(intervals))
      });
    }
  };

  if (day === 5) {
    // Παρασκευή (Έξοδος Σαββάτου 12:00)
    addPositionSlot(1, undefined, [
      { from: '14:00', to: '16:00' },
      { from: '22:00', to: '00:00' },
      { from: '06:00', to: '08:00' }
    ]);
    addPositionSlot(2, undefined, [
      { from: '16:00', to: '18:00' },
      { from: '00:00', to: '02:00' },
      { from: '08:00', to: '10:00' }
    ]);
    addPositionSlot(3, undefined, [
      { from: '18:00', to: '20:00' },
      { from: '02:00', to: '04:00' },
      { from: '10:00', to: '12:00' }
    ]);
    addPositionSlot(4, undefined, [
      { from: '20:00', to: '22:00' },
      { from: '04:00', to: '06:00' }
    ], '4η Θέση - Βάρδια Παρασκευής');
    // Κάλυψη 4ης Θέσης το Σάββατο 12:00 - 14:00 (Εξοδούχος Κυριακής)
    addPositionSlot(4, 'COVER', [
      { from: '12:00', to: '14:00' }
    ], 'Κάλυψη 4ης Θέσης (Εξοδούχος Κ)');
    return slots;
  }

  if (day === 6) {
    // Σάββατο (Έξοδος Κυριακής 10:00)
    addPositionSlot(1, undefined, [
      { from: '14:00', to: '16:00' },
      { from: '22:00', to: '00:00' },
      { from: '06:00', to: '08:00' }
    ]);
    addPositionSlot(2, undefined, [
      { from: '16:00', to: '18:00' },
      { from: '00:00', to: '02:00' },
      { from: '08:00', to: '10:00' }
    ]);
    addPositionSlot(3, undefined, [
      { from: '18:00', to: '20:00' },
      { from: '02:00', to: '04:00' }
    ], '3η Θέση - Βάρδια Σαββάτου');
    // Κάλυψη 3ης Θέσης την Κυριακή 10:00 - 12:00 (Εξοδούχος Σαββάτου)
    addPositionSlot(3, 'COVER', [
      { from: '10:00', to: '12:00' }
    ], 'Κάλυψη 3ης Θέσης (Εξοδούχος Σ)');
    addPositionSlot(4, undefined, [
      { from: '20:00', to: '22:00' },
      { from: '04:00', to: '06:00' }
    ], '4η Θέση - Βάρδια Σαββάτου');
    // Κάλυψη 4ης Θέσης την Κυριακή 12:00 - 14:00 (Εξοδούχος Σαββάτου)
    addPositionSlot(4, 'COVER', [
      { from: '12:00', to: '14:00' }
    ], 'Κάλυψη 4ης Θέσης (Εξοδούχος Σ)');
    return slots;
  }

  if (day === 0) {
    // Κυριακή (Κάλυψη μέχρι Δευτέρα)
    addPositionSlot(1, undefined, [
      { from: '14:00', to: '16:00' },
      { from: '22:00', to: '00:00' },
      { from: '06:00', to: '08:00' }
    ]);
    addPositionSlot(2, undefined, [
      { from: '16:00', to: '18:00' },
      { from: '00:00', to: '02:00' },
      { from: '08:00', to: '10:00' }
    ]);
    addPositionSlot(3, undefined, [
      { from: '18:00', to: '20:00' },
      { from: '02:00', to: '04:00' },
      { from: '10:00', to: '12:00' }
    ]);
    addPositionSlot(4, undefined, [
      { from: '20:00', to: '22:00' },
      { from: '04:00', to: '06:00' },
      { from: '12:00', to: '14:00' }
    ]);
    return slots;
  }

  // Δευτέρα - Πέμπτη
  addPositionSlot(1, undefined, [
    { from: '14:00', to: '16:00' },
    { from: '22:00', to: '00:00' },
    { from: '06:00', to: '08:00' }
  ]);
  addPositionSlot(2, undefined, [
    { from: '16:00', to: '18:00' },
    { from: '00:00', to: '02:00' },
    { from: '08:00', to: '10:00' }
  ]);
  addPositionSlot(3, undefined, [
    { from: '18:00', to: '20:00' },
    { from: '02:00', to: '04:00' },
    { from: '10:00', to: '12:00' }
  ]);
  addPositionSlot(4, undefined, [
    { from: '20:00', to: '22:00' },
    { from: '04:00', to: '06:00' },
    { from: '12:00', to: '14:00' }
  ]);
  return slots;
}

/**
 * Resolves the precise duty slots for a specific calendar date,
 * taking into account standard Greek Army 2-6 rolling shifts, cleanings, mess hall,
 * and the specific weekend handover rules.
 */
export function getDutySlotsForDate(
  duty: { 
    id: string; 
    name: string; 
    shortName?: string; 
    slotDefinitions?: DutySlotDefinition[]; 
    slots?: number;
    timePresetType?: TimePresetType;
  }, 
  dateStr: string
): DutySlotDefinition[] {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const nextDay = getNextDayShortGreek(dateStr);

  const normName = normalizeGreek(duty.name || '');
  const normShort = normalizeGreek(duty.shortName || '');
  const id = duty.id || '';

  const isThf = id === 'duty-thalamofylakas' || 
                (normShort === 'θφ' && !normName.includes('οπλοφυλακ')) || 
                (normName.includes('θαλαμοφυλακ') && !normName.includes('οπλοφυλακ'));

  const isOpl = id === 'duty-oplofylakas' || 
                normShort === 'οπλ' || 
                (normName.includes('οπλοφυλακ') && !isThf);

  const isKath = id === 'duty-kathariotites' || 
                 normShort === 'καθ' || 
                 normName.includes('καθαριοτητ');

  const isEst = id === 'duty-estiatoria' || 
                normShort === 'εστ' || 
                normName.includes('εστιατορι');

  const isArt = id === 'duty-artoklivanos' || 
                normShort === 'αρτ' || 
                normName.includes('αρτοκλιβαν');

  // Any duty with ROLLING_CYCLE preset (including ΘΦ, ΟΠΛ) automatically uses the rolling weekend swaps
  const isRolling = duty.timePresetType === 'ROLLING_CYCLE' || 
                    duty.timePresetType === 'GREEK_ARMY_2_6' ||
                    isThf || 
                    isOpl;

  if (isRolling) {
    const slotsCount = Number(duty.slots) || (isThf ? 8 : 4);
    const multiplier = slotsCount >= 8 ? Math.max(1, Math.round(slotsCount / 4)) : 1;
    return generateRollingWeekendSlots(day, multiplier, nextDay);
  }

  const isRestaurant = duty.timePresetType === 'RESTAURANT_CYCLE' || 
                       (isEst && duty.timePresetType !== 'CUSTOM');

  if (isRestaurant) {
    const count = Number(duty.slots) || (duty.slotDefinitions?.length || 2);
    return generateRestaurantSlotsForDay(day, count, nextDay);
  }

  // 1. If the duty has configured slot definitions (e.g. customized by the user in Duty Types), honor them directly!
  if (duty.slotDefinitions && duty.slotDefinitions.length > 0) {
    return duty.slotDefinitions.map((s, idx) => ({
      ...s,
      slotIndex: idx + 1,
      groupTag: s.groupTag?.includes('ΓΚΡΟΥΠ') ? undefined : s.groupTag
    }));
  }

  // 2. ΚΑΘΑΡΙΟΤΗΤΕΣ (14:00, 20:00, 07:00 επομ.) - Default preset fallback if no slotDefinitions configured
  if (isKath) {
    const cleaningTimes: TimeInterval[] = [
      { from: '14:00', to: '14:30' },
      { from: '20:00', to: '20:30' },
      { from: '07:00', to: '07:30' }
    ];

    const baseSlots: DutySlotDefinition[] = [
      {
        slotIndex: 1,
        label: `Τουαλέτες`,
        intervals: JSON.parse(JSON.stringify(cleaningTimes))
      },
      {
        slotIndex: 2,
        label: `Λουτρά / Νιπτήρες`,
        intervals: JSON.parse(JSON.stringify(cleaningTimes))
      },
      {
        slotIndex: 3,
        label: `Σκάλες / Διάδρομοι`,
        intervals: JSON.parse(JSON.stringify(cleaningTimes))
      },
      {
        slotIndex: 4,
        label: `Προαύλιος Χώρος`,
        intervals: JSON.parse(JSON.stringify(cleaningTimes))
      }
    ];

    const count = Math.max(1, Number(duty.slots) || 4);
    if (count <= 4) {
      return baseSlots.slice(0, count);
    }
    const result = [...baseSlots];
    for (let i = 4; i < count; i++) {
      const parent = baseSlots[i % 4];
      result.push({
        slotIndex: i + 1,
        label: `${parent.label} - Άτομο ${Math.floor(i / 4) + 1}`,
        intervals: JSON.parse(JSON.stringify(cleaningTimes))
      });
    }
    return result;
  }

  // 3. ΕΣΤΙΑΤΟΡΙΑ (16:00-22:00 & 05:20-16:00 επομ.) - Default preset fallback
  if (isEst) {
    const slot1Tag = undefined;
    const slot2Tag = (day === 5 || day === 6) ? 'COVER' : undefined;

    const baseSlots: DutySlotDefinition[] = [
      {
        slotIndex: 1,
        label: `Εστιατόρια (16:00-22:00)`,
        groupTag: slot1Tag,
        intervals: [{ from: '16:00', to: '22:00' }]
      },
      {
        slotIndex: 2,
        label: `Εστιατόρια (05:20-16:00 ${nextDay})`,
        groupTag: slot2Tag,
        intervals: [{ from: '05:20', to: '16:00' }]
      }
    ];

    const count = Math.max(1, Number(duty.slots) || 2);
    if (count <= 2) {
      return baseSlots.slice(0, count);
    }
    const result = [...baseSlots];
    for (let i = 2; i < count; i++) {
      const parent = baseSlots[i % 2];
      result.push({
        slotIndex: i + 1,
        label: `${parent.label} - Άτομο ${Math.floor(i / 2) + 1}`,
        groupTag: parent.groupTag,
        intervals: JSON.parse(JSON.stringify(parent.intervals))
      });
    }
    return result;
  }

  // 4. ΑΡΤΟΚΛΙΒΑΝΟΣ (06:50-14:00 επομ.) - Default preset fallback
  if (isArt) {
    const artTag = (day === 5 || day === 6 || day === 0) ? 'COVER' : undefined;

    const count = Math.max(1, Number(duty.slots) || 1);
    const result: DutySlotDefinition[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        slotIndex: i + 1,
        label: count > 1 ? `Αρτοκλίβανος (06:50-14:00 ${nextDay}) - Άτομο ${i + 1}` : `Αρτοκλίβανος (06:50-14:00 ${nextDay})`,
        groupTag: artTag,
        intervals: [{ from: '06:50', to: '14:00' }]
      });
    }
    return result;
  }

  const count = Math.max(1, Number(duty.slots) || 1);
  return getSlotDefinitionsForPreset(duty.timePresetType || 'CUSTOM', count);
}

/** Check if duty has special weekend swaps */
export function isDefaultWeekendDuty(duty: { id?: string; shortName?: string; name?: string; timePresetType?: TimePresetType; hasSpecialWeekendSwaps?: boolean }): boolean {
  if (duty.timePresetType === 'ROLLING_CYCLE' || duty.timePresetType === 'GREEK_ARMY_2_6') return true;
  if (duty.hasSpecialWeekendSwaps) return true;
  const id = duty.id || '';
  const s = duty.shortName || '';
  const n = duty.name || '';
  return (
    id === 'duty-thalamofylakas' ||
    id === 'duty-oplofylakas' ||
    id === 'duty-kathariotites' ||
    id === 'duty-estiatoria' ||
    id === 'duty-artoklivanos' ||
    s === 'ΘΦ' ||
    s === 'ΟΠΛ' ||
    s === 'Καθ' ||
    s === 'Εστ' ||
    s === 'Αρτ' ||
    n.includes('Θαλαμοφύλακας') ||
    n.includes('Οπλοφύλακας') ||
    n.includes('Καθαριότητες') ||
    n.includes('Εστιατόρια') ||
    n.includes('Αρτοκλίβανος')
  );
}

/** Returns the weekend swap explanation note for a duty type */
export function getDutyWeekendNote(duty: { id?: string; shortName?: string; name?: string; timePresetType?: TimePresetType; weekendSwapNote?: string; slots?: number }): string | null {
  if (duty.weekendSwapNote) return duty.weekendSwapNote;
  const id = duty.id || '';
  const s = duty.shortName || '';
  const n = duty.name || '';

  if (duty.timePresetType === 'ROLLING_CYCLE' || duty.timePresetType === 'GREEK_ARMY_2_6' || id === 'duty-thalamofylakas' || id === 'duty-oplofylakas' || s === 'ΘΦ' || s === 'ΟΠΛ' || n.includes('Θαλαμοφύλακας') || n.includes('Οπλοφύλακας')) {
    const isThf = id === 'duty-thalamofylakas' || (s === 'ΘΦ' && !n.includes('Οπλοφύλακας')) || (n.includes('Θαλαμοφύλακας') && !n.includes('Οπλοφύλακας'));
    const countNote = isThf ? '2 άτομα ανά θέση (8 σύνολο)' : '1 άτομο ανά θέση (4 σύνολο)';
    return `Πρότυπο εναλλασσόμενο: Αυτόματη κάλυψη απαλλαγών Σ/Κ (Παρασκευή έξοδος Σαββάτου 12:00, Σάββατο έξοδος Κυριακής 10:00, Κυριακή κάλυψη μέχρι Δευτέρα) — ${countNote}`;
  }
  if (id === 'duty-kathariotites' || s === 'Καθ' || n.includes('Καθαριότητες')) {
    return 'Αυτόματη εναλλαγή Σαββατοκύριακου για κάλυψη των απαλλαγών';
  }
  if (id === 'duty-estiatoria' || s === 'Εστ' || n.includes('Εστιατόρια')) {
    return 'Αυτόματη εναλλαγή Σαββατοκύριακου (Παρασκευή & Σάββατο βράδυ / Σάββατο & Κυριακή πρωί)';
  }
  if (id === 'duty-artoklivanos' || s === 'Αρτ' || n.includes('Αρτοκλίβανος')) {
    return 'Αυτόματη εναλλαγή Σαββατοκύριακου (Σάββατο, Κυριακή, Δευτέρα πρωί)';
  }
  return null;
}

/** Strips internal rotation group tags and redundant labels from hours notes */
export function stripGroupText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[\s*ΓΚΡΟΥΠ[^\]]*\]/gi, '')
    .replace(/\[\s*GROUP[^\]]*\]/gi, '')
    .replace(/ΓΚΡΟΥΠ\s*[0-9]*/gi, '')
    .replace(/Γκρουπ\s*[0-9]*/gi, '')
    .replace(/γρουπ\s*[0-9]*/gi, '')
    .replace(/group\s*[0-9]*/gi, '')
    .replace(/-\s*Άτομο\s*[0-9]/gi, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}


