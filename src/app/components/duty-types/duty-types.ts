import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { DutyType, MilitaryCategory, TimeInterval, DutySlotDefinition, TimePresetType } from '../../models/shift.model';
import { GREEK_RANKS, SPECIALTIES } from '../../data/default-data';
import { 
  TIME_OPTIONS, 
  TimeGroupTemplate,
  GREEK_ARMY_26_GROUPS,
  generateGreekArmy26Slots, 
  formatIntervalsToString
} from '../../data/time-presets';

export interface CustomPositionItem {
  positionIndex: number;
  label: string;
  peopleCount: number;
  intervals: TimeInterval[];
}

export interface ClockNumberItem {
  value: number;
  label: string;
  x: number;
  y: number;
  isInner?: boolean;
}

export interface ClockTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isMajor: boolean;
}

@Component({
  selector: 'app-duty-types',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './duty-types.html',
  styleUrl: './duty-types.css'
})
export class DutyTypesComponent {
  storage = inject(StorageService);

  readonly allRanks = GREEK_RANKS;
  readonly specialties = SPECIALTIES;
  readonly dutyTypes = this.storage.dutyTypes;
  readonly timeOptions = TIME_OPTIONS;

  // --- Drag & Drop Reordering of Duty Types (Thumbnails) ---
  draggedDutyIndex = signal<number | null>(null);
  dragOverDutyIndex = signal<number | null>(null);

  onDutyDragStart(index: number, event: DragEvent) {
    this.draggedDutyIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  onDutyDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggedDutyIndex() !== null && this.draggedDutyIndex() !== index) {
      this.dragOverDutyIndex.set(index);
    }
  }

  onDutyDragLeave(index: number, event: DragEvent) {
    if (this.dragOverDutyIndex() === index) {
      this.dragOverDutyIndex.set(null);
    }
  }

  onDutyDrop(targetIndex: number, event: DragEvent) {
    event.preventDefault();
    const sourceIndex = this.draggedDutyIndex();
    this.draggedDutyIndex.set(null);
    this.dragOverDutyIndex.set(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;

    const list = [...this.dutyTypes()];
    const [moved] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, moved);
    this.storage.reorderDutyTypes(list);
    this.storage.notify(`Η σειρά των υπηρεσιών ενημερώθηκε`, 'info');
  }

  onDutyDragEnd(event: DragEvent) {
    this.draggedDutyIndex.set(null);
    this.dragOverDutyIndex.set(null);
  }

  // --- Drag & Drop Reordering of Position Thumbnails in Modal ---
  draggedPosIndex = signal<number | null>(null);
  dragOverPosIndex = signal<number | null>(null);

  onPosDragStart(index: number, event: DragEvent) {
    this.draggedPosIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  onPosDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggedPosIndex() !== null && this.draggedPosIndex() !== index) {
      this.dragOverPosIndex.set(index);
    }
  }

  onPosDragLeave(index: number, event: DragEvent) {
    if (this.dragOverPosIndex() === index) {
      this.dragOverPosIndex.set(null);
    }
  }

  onPosDrop(targetIndex: number, event: DragEvent) {
    event.preventDefault();
    const sourceIndex = this.draggedPosIndex();
    this.draggedPosIndex.set(null);
    this.dragOverPosIndex.set(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;

    this.markAsCustomIfRolling();
    const [moved] = this.positions.splice(sourceIndex, 1);
    this.positions.splice(targetIndex, 0, moved);

    // Re-index position indices and labels
    this.positions.forEach((pos, idx) => {
      pos.positionIndex = idx + 1;
      if (!pos.label || /^\d+η Θέση$/.test(pos.label)) {
        pos.label = `${idx + 1}η Θέση`;
      }
    });

    this.regenerateSlotsFromPositions();
    this.storage.notify(`Η σειρά των θέσεων άλλαξε`, 'info');
  }

  onPosDragEnd(event: DragEvent) {
    this.draggedPosIndex.set(null);
    this.dragOverPosIndex.set(null);
  }

  // Clock selector pre-calculated geometries (260x260 coordinate space, center 130, 130)
  readonly hourClockNumbers: ClockNumberItem[] = (() => {
    const items: ClockNumberItem[] = [];
    const outerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    outerHours.forEach((val, i) => {
      const deg = i * 30 - 90;
      const rad = (deg * Math.PI) / 180;
      items.push({
        value: val,
        label: val < 10 ? `0${val}` : `${val}`,
        x: +(130 + 92 * Math.cos(rad)).toFixed(2),
        y: +(130 + 92 * Math.sin(rad)).toFixed(2),
        isInner: false
      });
    });
    const innerHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    innerHours.forEach((val, i) => {
      const deg = i * 30 - 90;
      const rad = (deg * Math.PI) / 180;
      items.push({
        value: val,
        label: `${val}`,
        x: +(130 + 58 * Math.cos(rad)).toFixed(2),
        y: +(130 + 58 * Math.sin(rad)).toFixed(2),
        isInner: true
      });
    });
    return items;
  })();

  readonly minuteClockNumbers: ClockNumberItem[] = (() => {
    const items: ClockNumberItem[] = [];
    for (let i = 0; i < 12; i++) {
      const val = i * 5;
      const deg = i * 30 - 90;
      const rad = (deg * Math.PI) / 180;
      items.push({
        value: val,
        label: val < 10 ? `0${val}` : `${val}`,
        x: +(130 + 92 * Math.cos(rad)).toFixed(2),
        y: +(130 + 92 * Math.sin(rad)).toFixed(2),
        isInner: false
      });
    }
    return items;
  })();

  readonly clockTicks: ClockTick[] = (() => {
    const ticks: ClockTick[] = [];
    for (let i = 0; i < 60; i++) {
      const deg = i * 6 - 90;
      const rad = (deg * Math.PI) / 180;
      const isMajor = i % 5 === 0;
      const rOuter = 120;
      const rInner = isMajor ? 111 : 115;
      ticks.push({
        x1: +(130 + rInner * Math.cos(rad)).toFixed(2),
        y1: +(130 + rInner * Math.sin(rad)).toFixed(2),
        x2: +(130 + rOuter * Math.cos(rad)).toFixed(2),
        y2: +(130 + rOuter * Math.sin(rad)).toFixed(2),
        isMajor
      });
    }
    return ticks;
  })();

  // Clock selector state
  isClockOpen = signal<boolean>(false);
  clockTarget = signal<{ interval: TimeInterval; field: 'from' | 'to'; title: string } | null>(null);
  clockMode = signal<'hours' | 'minutes'>('hours');
  clockHour = signal<number>(14);
  clockMinute = signal<number>(0);
  hourInputStr = signal<string>('14');
  minuteInputStr = signal<string>('00');
  isClockDragging = false;

  get clockHandX(): number {
    const h = this.clockHour();
    const isOuter = (h === 0 || h >= 13);
    const r = isOuter ? 92 : 58;
    const rad = (((h % 12) * 30 - 90) * Math.PI) / 180;
    return +(130 + r * Math.cos(rad)).toFixed(2);
  }

  get clockHandY(): number {
    const h = this.clockHour();
    const isOuter = (h === 0 || h >= 13);
    const r = isOuter ? 92 : 58;
    const rad = (((h % 12) * 30 - 90) * Math.PI) / 180;
    return +(130 + r * Math.sin(rad)).toFixed(2);
  }

  get clockMinuteHandX(): number {
    const m = this.clockMinute();
    const r = 92;
    const rad = ((m * 6 - 90) * Math.PI) / 180;
    return +(130 + r * Math.cos(rad)).toFixed(2);
  }

  get clockMinuteHandY(): number {
    const m = this.clockMinute();
    const r = 92;
    const rad = ((m * 6 - 90) * Math.PI) / 180;
    return +(130 + r * Math.sin(rad)).toFixed(2);
  }

  // The ONLY two time options: Πρότυπο εναλλασσόμενο and Προσαρμοσμένο
  readonly presetDescriptions: { value: TimePresetType; label: string; desc: string }[] = [
    { 
      value: 'ROLLING_CYCLE', 
      label: 'Πρότυπο εναλλασσόμενο', 
      desc: '4 χρονικές θέσεις 2-6 ανά 6ωρο (14:00-14:00). Περιλαμβάνει την ειδική προσαρμογή βαρδιών του Σαββατοκύριακου (Παρασκευή, Σάββατο, Κυριακή) με διαχωρισμό των βαρδιών παράδοσης-παραλαβής ώστε να εξυπηρετούνται οι απαλλαγές (έξοδος 12:00 Σαββάτου με κάλυψη 12:00-14:00, έξοδος 10:00 Κυριακής με κάλυψη 10:00-12:00 & 12:00-14:00).' 
    },
    { 
      value: 'RESTAURANT_CYCLE', 
      label: 'Πρότυπο Εστιατορίων', 
      desc: 'Καθημερινές: 16:00-22:00 & 05:20-16:00 (επόμενη). Παρασκευή: 16:00-22:00. Σάββατο: 07:00-22:00 (χωρίς εξοδούχους Σαββάτου). Κυριακή: 07:00-22:00 (χωρίς εξοδούχους Κυριακής). Δευτέρα πρωί: 05:20-16:00 από τα άτομα της Παρασκευής.' 
    },
    {
      value: 'STANDBY',
      label: 'Επιφυλακή',
      desc: 'Χωρίς καθορισμένο ωράριο. Ορίζονται άτομα σε επιφυλακή εντός μονάδας για αντικατάσταση σε περίπτωση κωλύματος ή αδυναμίας εκτέλεσης υπηρεσίας από άλλο στρατιώτη.'
    },
    { 
      value: 'CUSTOM', 
      label: 'Προσαρμοσμένο', 
      desc: 'Ελεύθερος καθορισμός θέσεων, ατόμων ανά θέση και διαστημάτων (Από - Έως).' 
    }
  ];

  isModalOpen = signal<boolean>(false);
  editingDutyId = signal<string | null>(null);
  isAdvancedOpen = signal<boolean>(false);

  // Positions template for both rolling cycle and custom modes
  positions: CustomPositionItem[] = [];

  // Compatibility aliases
  get rollingGroups(): any[] { return this.positions; }
  set rollingGroups(val: any[]) { this.positions = val; }
  get customPositions(): CustomPositionItem[] { return this.positions; }
  set customPositions(val: CustomPositionItem[]) { this.positions = val; }

  formModel = this.getInitialFormModel();

  getDefaultStandbyPositions(count: number = 1): CustomPositionItem[] {
    const list: CustomPositionItem[] = [];
    const n = Math.max(1, count);
    for (let i = 1; i <= n; i++) {
      list.push({
        positionIndex: i,
        label: n > 1 ? `${i}η Επιφυλακή` : 'Επιφυλακή',
        peopleCount: 1,
        intervals: []
      });
    }
    return list;
  }

  getDefaultRollingPositions(): CustomPositionItem[] {
    return [
      {
        positionIndex: 1,
        label: '1η Θέση',
        peopleCount: 2,
        intervals: [
          { from: '14:00', to: '16:00' },
          { from: '22:00', to: '00:00' },
          { from: '06:00', to: '08:00' }
        ]
      },
      {
        positionIndex: 2,
        label: '2η Θέση',
        peopleCount: 2,
        intervals: [
          { from: '16:00', to: '18:00' },
          { from: '00:00', to: '02:00' },
          { from: '08:00', to: '10:00' }
        ]
      },
      {
        positionIndex: 3,
        label: '3η Θέση',
        peopleCount: 2,
        intervals: [
          { from: '18:00', to: '20:00' },
          { from: '02:00', to: '04:00' },
          { from: '10:00', to: '12:00' }
        ]
      },
      {
        positionIndex: 4,
        label: '4η Θέση',
        peopleCount: 2,
        intervals: [
          { from: '20:00', to: '22:00' },
          { from: '04:00', to: '06:00' },
          { from: '12:00', to: '14:00' }
        ]
      }
    ];
  }

  getDefaultRestaurantPositions(): CustomPositionItem[] {
    return [
      {
        positionIndex: 1,
        label: '',
        peopleCount: 2,
        intervals: [
          { from: '16:00', to: '22:00' },
          { from: '05:20', to: '16:00' }
        ]
      }
    ];
  }

  private getInitialFormModel() {
    this.positions = this.getDefaultRollingPositions();
    return {
      name: '',
      shortName: '',
      category: 'Στρατιώτης' as MilitaryCategory | 'Οποιοσδήποτε',
      allowedRanks: [] as string[], // by default not set to anything (optional)
      armsRequired: 'Ένοπλος' as 'Ένοπλος' | 'Άοπλος' | 'Οποιοσδήποτε',
      requiredSpecialty: '', // by default not set (optional)
      slots: 8, // Αριθμός ατόμων (ανά 24ωρο) - default 8
      type: 'Βάρδιες' as '24ωρη' | 'Βάρδιες' | 'Ημερήσια' | 'Προσαρμοσμένο',
      timePresetType: 'ROLLING_CYCLE' as TimePresetType,
      shiftHours: 'Πρότυπο εναλλασσόμενο: 4 θέσεις ανά 6ωρο (2 άτομα/θέση - 8 σύνολο)',
      slotDefinitions: [] as DutySlotDefinition[],
      weight: 1, // standard default 1
      description: '', // by default not set (optional)
      hasSpecialWeekendSwaps: false,
      weekendSwapNote: '',
      active: true
    };
  }

  toggleAdvanced() {
    this.isAdvancedOpen.update(v => !v);
  }

  clearAllRanks() {
    this.formModel.allowedRanks = [];
  }

  restoreDefaults() {
    if (confirm('Θέλετε να επαναφέρετε τις βασικές υπηρεσίες μονάδας (Θαλαμοφύλακας / Οπλοφύλακας, Καθαριότητες, Εστιατόρια, Αρτοκλίβανος);')) {
      this.storage.restoreDefaultDutyTypes();
    }
  }

  openAddModal() {
    this.editingDutyId.set(null);
    this.isAdvancedOpen.set(false);
    this.positions = this.getDefaultRollingPositions();
    this.formModel = this.getInitialFormModel();
    this.regenerateSlotsFromPositions();
    this.isModalOpen.set(true);
  }

  openEditModal(duty: DutyType) {
    this.editingDutyId.set(duty.id);
    this.isAdvancedOpen.set(false);
    
    const isRolling = duty.timePresetType === 'ROLLING_CYCLE' || duty.timePresetType === 'GREEK_ARMY_2_6';
    const isRestaurant = duty.timePresetType === 'RESTAURANT_CYCLE' || duty.id === 'duty-estiatoria';
    const isStandby = duty.timePresetType === 'STANDBY' || (duty.name?.toLowerCase().includes('επιφυλακ') && duty.timePresetType !== 'CUSTOM');

    if (duty.slotDefinitions && duty.slotDefinitions.length > 0) {
      this.positions = this.extractPositionsFromSlots(duty.slotDefinitions);
    } else if (isRolling) {
      this.positions = this.getDefaultRollingPositions();
    } else if (isRestaurant) {
      this.positions = this.getDefaultRestaurantPositions();
    } else if (isStandby) {
      this.positions = this.getDefaultStandbyPositions(duty.slots || 1);
    } else {
      this.positions = [
        {
          positionIndex: 1,
          label: '',
          peopleCount: Math.max(1, duty.slots || 1),
          intervals: [{ from: '08:00', to: '14:00' }]
        }
      ];
    }

    const calculatedSlots = this.positions.reduce((acc, p) => acc + (p.peopleCount || 1), 0);

    const presetType: TimePresetType = isRolling 
      ? 'ROLLING_CYCLE' 
      : (isRestaurant ? 'RESTAURANT_CYCLE' : (isStandby ? 'STANDBY' : 'CUSTOM'));

    this.formModel = {
      name: duty.name,
      shortName: duty.shortName,
      category: duty.category,
      allowedRanks: [...(duty.allowedRanks || [])],
      armsRequired: duty.armsRequired,
      requiredSpecialty: duty.requiredSpecialty || '',
      slots: calculatedSlots,
      type: duty.type,
      timePresetType: presetType,
      shiftHours: duty.shiftHours || '08:00 - 08:00',
      slotDefinitions: [],
      weight: duty.weight ?? 1,
      description: duty.description || '',
      hasSpecialWeekendSwaps: duty.hasSpecialWeekendSwaps ?? false,
      weekendSwapNote: duty.weekendSwapNote || '',
      active: duty.active
    };

    this.regenerateSlotsFromPositions(false);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingDutyId.set(null);
  }

  private extractPositionsFromSlots(slotDefs?: DutySlotDefinition[]): CustomPositionItem[] {
    if (!slotDefs || slotDefs.length === 0) {
      return this.getDefaultRollingPositions();
    }

    const posMap = new Map<number, CustomPositionItem>();
    let nextAutoId = 1;
    const intervalToIdMap = new Map<string, number>();

    for (const slot of slotDefs) {
      let posId: number;
      if (slot.groupIndex !== undefined && slot.groupIndex !== null && Number.isFinite(Number(slot.groupIndex))) {
        posId = Number(slot.groupIndex);
      } else {
        const timeKey = (slot.intervals || []).map(i => `${i.from}-${i.to}`).join('|') || `slot-${slot.slotIndex}`;
        if (!intervalToIdMap.has(timeKey)) {
          intervalToIdMap.set(timeKey, nextAutoId++);
        }
        posId = intervalToIdMap.get(timeKey)!;
      }

      if (!posMap.has(posId)) {
        posMap.set(posId, {
          positionIndex: posId,
          label: slot.groupName !== undefined ? slot.groupName : '',
          peopleCount: 1,
          intervals: slot.intervals ? JSON.parse(JSON.stringify(slot.intervals)) : [{ from: '08:00', to: '14:00' }]
        });
      } else {
        posMap.get(posId)!.peopleCount += 1;
      }
    }

    return Array.from(posMap.values()).sort((a, b) => a.positionIndex - b.positionIndex);
  }

  onPresetChange(preset: TimePresetType) {
    if (preset === 'ROLLING_CYCLE' || preset === 'GREEK_ARMY_2_6') {
      this.formModel.timePresetType = 'ROLLING_CYCLE';
      this.formModel.type = 'Βάρδιες';
      this.positions = this.getDefaultRollingPositions();
      this.regenerateSlotsFromPositions();
    } else if (preset === 'RESTAURANT_CYCLE') {
      this.formModel.timePresetType = 'RESTAURANT_CYCLE';
      this.formModel.type = 'Βάρδιες';
      this.positions = this.getDefaultRestaurantPositions();
      this.regenerateSlotsFromPositions();
    } else if (preset === 'STANDBY') {
      this.formModel.timePresetType = 'STANDBY';
      this.formModel.type = 'Ημερήσια';
      this.formModel.shiftHours = 'Χωρίς ωράριο (Επιφυλακή)';
      this.positions = this.getDefaultStandbyPositions();
      this.regenerateSlotsFromPositions();
    } else {
      this.formModel.timePresetType = 'CUSTOM';
      if (!this.positions || this.positions.length === 0) {
        this.positions = this.getDefaultRollingPositions();
      }
      this.regenerateSlotsFromPositions();
    }
  }

  isRollingSelected(): boolean {
    return this.formModel.timePresetType === 'ROLLING_CYCLE' || this.formModel.timePresetType === 'GREEK_ARMY_2_6';
  }

  isRestaurantSelected(): boolean {
    return this.formModel.timePresetType === 'RESTAURANT_CYCLE';
  }

  isStandbySelected(): boolean {
    return this.formModel.timePresetType === 'STANDBY';
  }

  isDutyRolling(duty: DutyType): boolean {
    return duty.timePresetType === 'ROLLING_CYCLE' || duty.timePresetType === 'GREEK_ARMY_2_6';
  }

  isDutyRestaurant(duty: DutyType): boolean {
    return duty.timePresetType === 'RESTAURANT_CYCLE' || duty.id === 'duty-estiatoria';
  }

  isDutyStandby(duty: DutyType): boolean {
    return duty.timePresetType === 'STANDBY';
  }

  // Switch selection to CUSTOM whenever ANY modification is made to the rolling cycle positions
  markAsCustomIfRolling() {
    if (this.formModel.timePresetType === 'ROLLING_CYCLE' || this.formModel.timePresetType === 'GREEK_ARMY_2_6') {
      this.formModel.timePresetType = 'CUSTOM';
    }
  }

  // Unified position actions
  adjustPositionPeople(pos: CustomPositionItem, delta: number) {
    this.markAsCustomIfRolling();
    const current = pos.peopleCount || 1;
    pos.peopleCount = Math.max(1, Math.min(24, current + delta));
    this.regenerateSlotsFromPositions();
  }

  setPositionPeople(pos: CustomPositionItem, val: any) {
    this.markAsCustomIfRolling();
    pos.peopleCount = Math.max(1, Math.min(24, Number(val) || 1));
    this.regenerateSlotsFromPositions();
  }

  onIntervalTimeChange() {
    this.markAsCustomIfRolling();
    this.regenerateSlotsFromPositions();
  }

  onPositionLabelChange() {
    this.markAsCustomIfRolling();
    this.regenerateSlotsFromPositions();
  }

  // --- Clock Selector Methods ---
  setClockMode(mode: 'hours' | 'minutes') {
    this.clockMode.set(mode);
  }

  openClockPicker(interval: TimeInterval, field: 'from' | 'to', title: string = 'Επιλογή Ώρας') {
    const currentVal = interval[field] || '08:00';
    const parts = currentVal.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h) || h < 0 || h > 23) h = 8;
    if (isNaN(m) || m < 0 || m > 59) m = 0;

    this.clockHour.set(h);
    this.clockMinute.set(m);
    this.hourInputStr.set(this.formatTwoDigits(h));
    this.minuteInputStr.set(this.formatTwoDigits(m));
    this.clockMode.set('hours');
    this.clockTarget.set({ interval, field, title });
    this.isClockOpen.set(true);
  }

  confirmClockPicker() {
    const target = this.clockTarget();
    if (target) {
      const hh = this.formatTwoDigits(this.clockHour());
      const mm = this.formatTwoDigits(this.clockMinute());
      target.interval[target.field] = `${hh}:${mm}`;
      this.onIntervalTimeChange();
    }
    this.isClockOpen.set(false);
  }

  cancelClockPicker() {
    this.isClockOpen.set(false);
  }

  formatTwoDigits(val: number): string {
    return val < 10 ? `0${val}` : `${val}`;
  }

  focusHourInput(input: HTMLInputElement) {
    this.clockMode.set('hours');
    input.focus();
    input.select();
  }

  focusMinuteInput(input: HTMLInputElement) {
    this.clockMode.set('minutes');
    input.focus();
    input.select();
  }

  onHourInputFocus(event: FocusEvent) {
    this.clockMode.set('hours');
    (event.target as HTMLInputElement).select();
  }

  onMinuteInputFocus(event: FocusEvent) {
    this.clockMode.set('minutes');
    (event.target as HTMLInputElement).select();
  }

  onHourInput(event: Event, nextInput?: HTMLInputElement) {
    const el = event.target as HTMLInputElement;
    let clean = el.value.replace(/\D/g, '');
    if (clean.length > 2) clean = clean.slice(0, 2);

    this.hourInputStr.set(clean);
    if (!clean) return;

    let num = parseInt(clean, 10);
    if (!isNaN(num)) {
      if (num > 23) {
        num = 23;
        clean = '23';
        this.hourInputStr.set('23');
        el.value = '23';
      }
      this.clockHour.set(num);

      // Auto-advance to minutes if 2 full digits are typed, or if digit is 3..9
      if (clean.length === 2 || num >= 3) {
        if (nextInput) {
          setTimeout(() => {
            this.clockMode.set('minutes');
            nextInput.focus();
            nextInput.select();
          }, 40);
        }
      }
    }
  }

  onHourBlur(event: FocusEvent) {
    const el = event.target as HTMLInputElement;
    const formatted = this.formatTwoDigits(this.clockHour());
    this.hourInputStr.set(formatted);
    el.value = formatted;
  }

  onMinuteInput(event: Event) {
    const el = event.target as HTMLInputElement;
    let clean = el.value.replace(/\D/g, '');
    if (clean.length > 2) clean = clean.slice(0, 2);

    this.minuteInputStr.set(clean);
    if (!clean) return;

    let num = parseInt(clean, 10);
    if (!isNaN(num)) {
      if (num > 59) {
        num = 59;
        clean = '59';
        this.minuteInputStr.set('59');
        el.value = '59';
      }
      this.clockMinute.set(num);
    }
  }

  onMinuteBlur(event: FocusEvent) {
    const el = event.target as HTMLInputElement;
    const formatted = this.formatTwoDigits(this.clockMinute());
    this.minuteInputStr.set(formatted);
    el.value = formatted;
  }

  onClockPointerDown(event: PointerEvent) {
    this.isClockDragging = true;
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {}
    this.handleClockPointerEvent(event);
  }

  onClockPointerMove(event: PointerEvent) {
    if (!this.isClockDragging) return;
    this.handleClockPointerEvent(event);
  }

  onClockPointerUp(event: PointerEvent) {
    if (!this.isClockDragging) return;
    this.isClockDragging = false;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {}
    if (this.clockMode() === 'hours') {
      this.clockMode.set('minutes');
    }
  }

  private handleClockPointerEvent(event: PointerEvent) {
    const target = event.currentTarget as SVGElement;
    const rect = target.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const x = (clickX / rect.width) * 260;
    const y = (clickY / rect.height) * 260;

    const dx = x - 130;
    const dy = y - 130;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    if (this.clockMode() === 'hours') {
      const hour12 = Math.round(deg / 30) % 12;
      if (dist >= 76) {
        // Outer ring (00, 13..23)
        const h = hour12 === 0 ? 0 : hour12 + 12;
        this.clockHour.set(h);
        this.hourInputStr.set(this.formatTwoDigits(h));
      } else {
        // Inner ring (1..12)
        const h = hour12 === 0 ? 12 : hour12;
        this.clockHour.set(h);
        this.hourInputStr.set(this.formatTwoDigits(h));
      }
    } else {
      // Minutes mode (00..59)
      const min = Math.round(deg / 6) % 60;
      this.clockMinute.set(min);
      this.minuteInputStr.set(this.formatTwoDigits(min));
    }
  }

  addIntervalToPosition(pos: CustomPositionItem) {
    this.markAsCustomIfRolling();
    let from = '14:00';
    let to = '16:00';
    if (pos.intervals.length > 0) {
      const last = pos.intervals[pos.intervals.length - 1];
      from = last.to;
      const [h, m] = from.split(':').map(Number);
      const nextH = (h + 2) % 24;
      to = `${nextH < 10 ? '0' : ''}${nextH}:${m < 10 ? '0' : ''}${m}`;
    }
    pos.intervals.push({ from, to });
    this.regenerateSlotsFromPositions();
  }

  removeIntervalFromPosition(pos: CustomPositionItem, intIdx: number) {
    if (pos.intervals.length > 1) {
      this.markAsCustomIfRolling();
      pos.intervals.splice(intIdx, 1);
      this.regenerateSlotsFromPositions();
    } else {
      this.storage.notify('Κάθε θέση πρέπει να περιλαμβάνει τουλάχιστον ένα ωράριο.', 'warning');
    }
  }

  addPosition() {
    if (this.isStandbySelected()) {
      const newIdx = this.positions.length + 1;
      this.positions.push({
        positionIndex: newIdx,
        label: `${newIdx}η Επιφυλακή`,
        peopleCount: 1,
        intervals: []
      });
      this.regenerateSlotsFromPositions();
      return;
    }

    this.markAsCustomIfRolling();
    const newIdx = this.positions.length + 1;
    const baseIntervals: TimeInterval[] = this.positions.length > 0 && this.positions[0].intervals?.length
      ? JSON.parse(JSON.stringify(this.positions[0].intervals))
      : [{ from: '08:00', to: '14:00' }];

    this.positions.push({
      positionIndex: newIdx,
      label: '',
      peopleCount: 1,
      intervals: baseIntervals
    });
    this.regenerateSlotsFromPositions();
  }

  removePosition(index: number) {
    if (this.positions.length <= 1) {
      this.storage.notify('Πρέπει να υπάρχει τουλάχιστον μία θέση στο πόστο.', 'warning');
      return;
    }
    this.markAsCustomIfRolling();
    this.positions.splice(index, 1);
    this.positions.forEach((pos, idx) => {
      pos.positionIndex = idx + 1;
      if (pos.label && /^\d+η Θέση$/.test(pos.label)) {
        pos.label = `${idx + 1}η Θέση`;
      }
    });
    this.regenerateSlotsFromPositions();
  }

  copyFirstPositionToAll() {
    if (this.positions.length <= 1) return;
    this.markAsCustomIfRolling();
    const template = JSON.stringify(this.positions[0].intervals);
    for (let i = 1; i < this.positions.length; i++) {
      this.positions[i].intervals = JSON.parse(template);
    }
    this.regenerateSlotsFromPositions();
    this.storage.notify('Τα ωράρια της 1ης θέσης αντιγράφηκαν σε όλες τις θέσεις επιτυχώς.', 'info');
  }

  regenerateSlotsFromPositions(updateShiftHours: boolean = true) {
    const slots: DutySlotDefinition[] = [];
    let globalIndex = 1;

    if (this.isStandbySelected()) {
      for (const pos of this.positions) {
        const pCount = Math.max(1, pos.peopleCount || 1);
        for (let p = 1; p <= pCount; p++) {
          const posLabel = (pos.label || '').trim() || 'Επιφυλακή';
          const label = pCount > 1 ? `${posLabel} - Άτομο ${p}` : posLabel;
          slots.push({
            slotIndex: globalIndex++,
            groupIndex: pos.positionIndex,
            groupName: posLabel,
            label,
            intervals: []
          });
        }
      }
    } else {
      for (const pos of this.positions) {
        const pCount = Math.max(1, pos.peopleCount || 1);
        const timesStr = formatIntervalsToString(pos.intervals);
        for (let p = 1; p <= pCount; p++) {
          const posLabel = (pos.label || '').trim();
          const base = posLabel ? `${posLabel} (${timesStr})` : timesStr;
          const label = pCount > 1 
            ? (posLabel ? `${posLabel} (${timesStr}) - Άτομο ${p}` : `${timesStr} - Άτομο ${p}`)
            : base;

          slots.push({
            slotIndex: globalIndex++,
            groupIndex: pos.positionIndex,
            groupName: posLabel,
            label,
            intervals: JSON.parse(JSON.stringify(pos.intervals))
          });
        }
      }
    }

    this.formModel.slotDefinitions = slots;
    this.formModel.slots = slots.length;

    if (updateShiftHours) {
      if (this.formModel.timePresetType === 'ROLLING_CYCLE' || this.formModel.timePresetType === 'GREEK_ARMY_2_6') {
        const posSummary = this.positions.map(p => `${p.label || ('#' + p.positionIndex)}: ${p.peopleCount || 1}`).join(', ');
        this.formModel.shiftHours = `Πρότυπο εναλλασσόμενο: 4 θέσεις ανά 6ωρο (${this.formModel.slots} άτομα σύνολο: ${posSummary})`;
      } else if (this.formModel.timePresetType === 'RESTAURANT_CYCLE') {
        this.formModel.shiftHours = `Πρότυπο Εστιατορίων: 16:00-22:00 & 05:20-16:00 (${this.formModel.slots} άτομα)`;
      } else if (this.formModel.timePresetType === 'STANDBY') {
        this.formModel.shiftHours = `Χωρίς ωράριο (Επιφυλακή - ${this.formModel.slots} ${this.formModel.slots === 1 ? 'άτομο' : 'άτομα'})`;
      } else {
        if (slots.length > 0 && slots[0].intervals?.length) {
          this.formModel.shiftHours = formatIntervalsToString(slots[0].intervals);
        }
      }
    }
  }

  // Backward-compatibility wrappers
  adjustGroupPeople(grp: any, delta: number) { this.adjustPositionPeople(grp, delta); }
  setGroupPeople(grp: any, val: any) { this.setPositionPeople(grp, val); }
  onGroupPeopleChange() { this.markAsCustomIfRolling(); this.regenerateSlotsFromPositions(); }
  regenerateRollingSlots() { this.regenerateSlotsFromPositions(); }
  addIntervalToRollingGroup(grp: any) { this.addIntervalToPosition(grp); }
  removeIntervalFromRollingGroup(grp: any, idx: number) { this.removeIntervalFromPosition(grp, idx); }
  addCustomPosition() { this.addPosition(); }
  removeCustomPosition(idx: number) { this.removePosition(idx); }
  adjustCustomPositionPeople(pos: any, delta: number) { this.adjustPositionPeople(pos, delta); }
  setCustomPositionPeople(pos: any, val: any) { this.setPositionPeople(pos, val); }
  addIntervalToCustomPosition(pos: any) { this.addIntervalToPosition(pos); }
  removeIntervalFromCustomPosition(pos: any, idx: number) { this.removeIntervalFromPosition(pos, idx); }
  copyFirstCustomPositionToAll() { this.copyFirstPositionToAll(); }
  regenerateCustomSlots() { this.regenerateSlotsFromPositions(); }

  // Thumbnail helpers
  getDutyPositionPeople(duty: DutyType, posIndex: number): number {
    if (!duty.slotDefinitions || duty.slotDefinitions.length === 0) {
      return Math.max(1, Math.round(duty.slots / 4));
    }
    const count = duty.slotDefinitions.filter(s => s.groupIndex === posIndex).length;
    return count > 0 ? count : Math.max(1, Math.round(duty.slots / 4));
  }

  getDutyDistinctPositions(duty: DutyType): { positionIndex: number; label: string; count: number; intervals: TimeInterval[] }[] {
    if (!duty.slotDefinitions || duty.slotDefinitions.length === 0) {
      if (this.isDutyRolling(duty)) {
        return this.getDefaultRollingPositions().map(p => ({
          positionIndex: p.positionIndex,
          label: p.label,
          count: p.peopleCount,
          intervals: p.intervals
        }));
      }
      if (this.isDutyStandby(duty)) {
        return [
          {
            positionIndex: 1,
            label: 'Επιφυλακή',
            count: duty.slots || 1,
            intervals: []
          }
        ];
      }
      return [
        {
          positionIndex: 1,
          label: '1η Θέση',
          count: duty.slots || 1,
          intervals: [{ from: '08:00', to: '14:00' }]
        }
      ];
    }

    const res: { positionIndex: number; label: string; count: number; intervals: TimeInterval[] }[] = [];
    const map = new Map<number, { positionIndex: number; label: string; count: number; intervals: TimeInterval[] }>();

    let nextAutoId = 1;
    const intervalToIdMap = new Map<string, number>();

    for (const s of duty.slotDefinitions) {
      let slotIdentifier: number;
      if (s.groupIndex !== undefined && s.groupIndex !== null && Number.isFinite(Number(s.groupIndex))) {
        slotIdentifier = Number(s.groupIndex);
      } else {
        // Fallback for slots without groupIndex: group by exact time intervals without using title
        const timeKey = (s.intervals || []).map(i => `${i.from}-${i.to}`).join('|') || `slot-${s.slotIndex}`;
        if (!intervalToIdMap.has(timeKey)) {
          intervalToIdMap.set(timeKey, nextAutoId++);
        }
        slotIdentifier = intervalToIdMap.get(timeKey)!;
      }

      if (!map.has(slotIdentifier)) {
        const item = {
          positionIndex: slotIdentifier,
          label: s.groupName || `${slotIdentifier}η Θέση`,
          count: 1,
          intervals: s.intervals ? JSON.parse(JSON.stringify(s.intervals)) : []
        };
        map.set(slotIdentifier, item);
        res.push(item);
      } else {
        map.get(slotIdentifier)!.count += 1;
      }
    }
    return res;
  }

  getCustomDistinctPositions(duty: DutyType): { label: string; count: number; intervals: TimeInterval[] }[] {
    return this.getDutyDistinctPositions(duty);
  }

  formatIntervals(intervals?: TimeInterval[]): string {
    if (!intervals || intervals.length === 0) return 'Χωρίς ωράριο';
    return intervals.map(i => `${i.from}-${i.to}`).join(', ');
  }

  formatGroupIntervals(grp: TimeGroupTemplate): string {
    return formatIntervalsToString(grp.intervals);
  }

  toggleRankSelection(rankShort: string) {
    const idx = this.formModel.allowedRanks.indexOf(rankShort);
    if (idx >= 0) {
      this.formModel.allowedRanks.splice(idx, 1);
    } else {
      this.formModel.allowedRanks.push(rankShort);
    }
  }

  selectAllRanks() {
    this.formModel.allowedRanks = this.allRanks.map(r => r.short);
  }

  selectSoldierRanksOnly() {
    this.formModel.allowedRanks = ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'];
  }

  selectOfficerRanksOnly() {
    this.formModel.allowedRanks = ['ΔΕΑ', 'ΑΝΘΛΓΟΣ', 'ΥΠΛΓΟΣ', 'ΛΓΟΣ'];
  }

  saveDuty() {
    if (!this.formModel.name.trim() || !this.formModel.shortName.trim()) {
      this.storage.notify('Παρακαλώ συμπληρώστε την ονομασία και τη σύντμηση του πόστου.', 'warning');
      return;
    }

    this.regenerateSlotsFromPositions();

    if (this.formModel.timePresetType === 'STANDBY') {
      this.formModel.shiftHours = `Χωρίς ωράριο (Επιφυλακή - ${this.formModel.slots} ${this.formModel.slots === 1 ? 'άτομο' : 'άτομα'})`;
    } else if (this.formModel.timePresetType === 'ROLLING_CYCLE' || this.formModel.timePresetType === 'GREEK_ARMY_2_6') {
      const posSummary = this.positions.map(p => `${p.label || ('#' + p.positionIndex)}: ${p.peopleCount || 1}`).join(', ');
      this.formModel.shiftHours = `Πρότυπο εναλλασσόμενο: 4 θέσεις ανά 6ωρο (${this.formModel.slots} άτομα σύνολο: ${posSummary})`;
    } else if (this.formModel.timePresetType === 'RESTAURANT_CYCLE') {
      this.formModel.shiftHours = `Πρότυπο Εστιατορίων: 16:00-22:00 & 05:20-16:00 (${this.formModel.slots} άτομα)`;
    } else if (this.formModel.slotDefinitions && this.formModel.slotDefinitions.length > 0) {
      const slot1Str = formatIntervalsToString(this.formModel.slotDefinitions[0].intervals);
      this.formModel.shiftHours = slot1Str;
    }

    const payload = {
      name: this.formModel.name,
      shortName: this.formModel.shortName,
      category: this.formModel.category,
      allowedRanks: this.formModel.allowedRanks,
      armsRequired: this.formModel.armsRequired,
      requiredSpecialty: this.formModel.requiredSpecialty,
      slots: this.formModel.slots,
      type: this.formModel.type,
      timePresetType: this.formModel.timePresetType,
      slotDefinitions: this.formModel.slotDefinitions,
      shiftHours: this.formModel.shiftHours,
      weight: (this.formModel.weight !== undefined && this.formModel.weight !== null && !isNaN(Number(this.formModel.weight)) && Number(this.formModel.weight) >= 0) ? Number(this.formModel.weight) : 1,
      description: this.formModel.description,
      hasSpecialWeekendSwaps: this.formModel.hasSpecialWeekendSwaps,
      weekendSwapNote: this.formModel.weekendSwapNote,
      active: this.formModel.active
    };

    if (this.editingDutyId()) {
      this.storage.updateDutyType(this.editingDutyId()!, payload);
    } else {
      this.storage.addDutyType(payload);
    }

    this.closeModal();
  }

  toggleActive(duty: DutyType) {
    this.storage.updateDutyType(duty.id, { active: !duty.active });
  }

  duplicateDuty(duty: DutyType) {
    const clone: Omit<DutyType, 'id'> = {
      name: `${duty.name} (Αντίγραφο)`,
      shortName: `${duty.shortName} (Αντ.)`,
      category: duty.category,
      allowedRanks: duty.allowedRanks ? [...duty.allowedRanks] : [],
      armsRequired: duty.armsRequired,
      requiredSpecialty: duty.requiredSpecialty || '',
      slots: duty.slots,
      type: duty.type,
      timePresetType: duty.timePresetType,
      shiftHours: duty.shiftHours,
      slotDefinitions: duty.slotDefinitions ? JSON.parse(JSON.stringify(duty.slotDefinitions)) : undefined,
      weight: duty.weight,
      description: duty.description || '',
      hasSpecialWeekendSwaps: duty.hasSpecialWeekendSwaps,
      weekendSwapNote: duty.weekendSwapNote,
      active: duty.active
    };

    this.storage.addDutyType(clone);
    this.storage.notify(`Δημιουργήθηκε αντίγραφο του πόστου "${duty.name}".`, 'success');
  }

  deleteDuty(duty: DutyType) {
    if (confirm(`Διαγραφή του πόστου/υπηρεσίας "${duty.name}";`)) {
      this.storage.deleteDutyType(duty.id);
    }
  }
}
