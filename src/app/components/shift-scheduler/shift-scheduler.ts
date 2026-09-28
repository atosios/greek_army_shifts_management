import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SchedulerService } from '../../services/scheduler.service';
import { 
  DailySchedule, 
  DutyAssignment, 
  ShiftSlotAssignment, 
  Personnel, 
  DutyType,
  getLeaveTypeMeta,
  formatGreekDate 
} from '../../models/shift.model';
import { formatIntervalsToString, getDutySlotsForDate, getDayHandoverNote, isSlotConflictingWithDayOff } from '../../data/time-presets';

export interface GroupedTimeShift {
  shiftNumber: number;
  locationSubtitle?: string;
  intervalBadges: string[];
  complementaryBadges?: string[];  // Times from other days that complete the full shift (for cover slots)
  isCoverShift?: boolean;
  peopleCount: number;
  slots: {
    slotIndexInDuty: number;
    slot: ShiftSlotAssignment;
  }[];
}

export interface SafetyRemovalData {
  dutyNames: string[];
  execute: () => void;
}

export interface FinalizeModalData {
  scheduleDate: string;
  formattedDate: string;
  totalSlots: number;
  assignedSlots: number;
  assignedPersonnelCount: number;
  errors: {
    dutyName: string;
    slotIndex: number;
    hoursNote?: string;
    personName: string;
    reason: string;
  }[];
  warnings: {
    dutyName: string;
    slotIndex: number;
    hoursNote?: string;
    personName: string;
    reason: string;
  }[];
}

@Component({
  selector: 'app-shift-scheduler',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './shift-scheduler.html',
  styleUrl: './shift-scheduler.css'
})
export class ShiftSchedulerComponent {
  storage = inject(StorageService);
  scheduler = inject(SchedulerService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  readonly formatGreekDate = formatGreekDate;

  // Selected date signal (defaults to tomorrow)
  selectedDate = signal<string>(this.getDefaultTargetDate());

  // Current schedule for the selected date
  currentSchedule = signal<DailySchedule | null>(null);

  readonly activePersonnel = this.storage.activePersonnel;
  readonly activeDuties = this.storage.activeDutyTypes;

  // Active leaves on the selected date
  readonly leavesOnDate = computed(() => {
    const date = this.selectedDate();
    return this.storage.leaves().filter(l => 
      l.startDate <= date && date <= l.endDate && l.status !== 'Ακυρωμένη'
    );
  });

  // Day type helpers
  readonly isFriday = computed(() => this.scheduler.isFriday(this.selectedDate()));
  readonly isWeekend = computed(() => this.scheduler.isWeekend(this.selectedDate()));
  readonly isSaturday = computed(() => this.scheduler.isSaturday(this.selectedDate()));
  readonly isSunday = computed(() => this.scheduler.isSunday(this.selectedDate()));
  readonly isWeekendPlanSetForSelectedDate = computed(() => {
    if (!this.isFriday()) return true;
    const dates = this.scheduler.getWeekendDates(this.selectedDate());
    const plan = this.storage.getWeekendPlan(dates.friday);
    return !!plan && (plan.saturdayOffIds.length > 0 || plan.sundayOffIds.length > 0);
  });

  // Searchable person picker state
  activePickerSlot = signal<{ dutyIdx: number; slotIdx: number } | null>(null);
  personSearchQuery = signal<string>('');

  // Add / Manage Duties Modal state
  isAddDutyModalOpen = signal<boolean>(false);
  modalSelectedDutyIds = signal<Set<string>>(new Set());

  // Safety dialog for removing duties
  safetyRemovalModal = signal<SafetyRemovalData | null>(null);

  // Finalize / Reset Finalize Modal state
  finalizeModal = signal<FinalizeModalData | null>(null);
  resetFinalizeModal = signal<boolean>(false);

  readonly isCurrentScheduleFinalized = computed(() => {
    return Boolean(this.currentSchedule()?.isFinalized);
  });

  // Search filtered personnel for the active picker (only available personnel who can be placed)
  readonly filteredPersonnelForPicker = computed(() => {
    const q = this.personSearchQuery().trim().toLowerCase();
    const all = this.activePersonnel();
    const active = this.activePickerSlot();
    const sched = this.currentSchedule();

    if (!active || !sched) {
      return all;
    }

    const activeDuty = sched.duties[active.dutyIdx];
    const activeSlot = activeDuty?.slots[active.slotIdx];
    const dutyDef = this.storage.dutyTypes().find(dt => dt.id === activeDuty?.dutyTypeId);
    const date = sched.date;
    const day = new Date(date).getDay();
    const dates = this.scheduler.getWeekendDates(date);
    const plan = this.storage.getWeekendPlan(dates.friday);

    const isSlot12to14 = activeSlot ? this.isSlot12to14(activeSlot) : false;
    const isSlot10to12 = activeSlot ? this.isSlot10to12(activeSlot) : false;

    // Collect all person IDs already assigned on this same date (regardless of whether the day is validated or in draft)
    // We check both currentSchedule duties and the storage schedule for this date to ensure 100% consistency.
    const assignedPersonIdsOnDate = new Set<string>();

    const checkDutyList = (duties: DutyAssignment[]) => {
      for (let dIdx = 0; dIdx < duties.length; dIdx++) {
        const d = duties[dIdx];
        for (let sIdx = 0; sIdx < d.slots.length; sIdx++) {
          const slot = d.slots[sIdx];
          // Exclude the active slot itself so the currently assigned person can be shown as selected
          const isCurrentSlot = 
            (dIdx === active.dutyIdx || (activeDuty && d.dutyTypeId === activeDuty.dutyTypeId)) && 
            sIdx === active.slotIdx;
          if (isCurrentSlot) continue;
          if (slot.personId && slot.personId.trim()) {
            assignedPersonIdsOnDate.add(slot.personId.trim());
          }
        }
      }
    };

    if (sched.duties) {
      checkDutyList(sched.duties);
    }
    const storedSched = this.storage.getScheduleForDate(sched.date);
    if (storedSched && storedSched.duties) {
      checkDutyList(storedSched.duties);
    }

    // Filter available personnel only
    const available = all.filter(p => {
      // 1. Cannot be placed if already assigned elsewhere on this same date
      // Even if the day is not validated/finalized, assigned soldiers must not appear on other duties dropdowns
      if (assignedPersonIdsOnDate.has(p.id.trim())) {
        return false;
      }

      // 2. Full exemption
      if (p.exemptFromAllDuties) return false;

      // 3. Leave / ΕΥ / Hospital / STEP / EO
      const leave = this.scheduler.getPersonLeave(p.id, date);
      if (leave) {
        const meta = getLeaveTypeMeta(leave.type);
        if (meta.blocksDuty) return false;
        if (leave.type === 'Ελεύθερος Ορθοστασίας (ΕΟ)') {
          if (dutyDef?.armsRequired === 'Ένοπλος' || dutyDef?.name?.toLowerCase().includes('σκοπός') || dutyDef?.name?.toLowerCase().includes('πύλη') || dutyDef?.name?.toLowerCase().includes('περίπολος')) {
            return false;
          }
        }
      }

      // 4. Weekend Day-Off constraints:
      if (plan) {
        const isSatOff = plan.saturdayOffIds?.includes(p.id) ?? false;
        const isSunOff = plan.sundayOffIds?.includes(p.id) ?? false;

        // General departure constraint (Saturday 12:00, Sunday 10:00)
        if (isSlotConflictingWithDayOff(activeSlot, day, isSatOff, isSunOff)) return false;

        // Specific cover constraints:
        // Friday cover 12-14: must not have Saturday off
        if (day === 5 && isSlot12to14 && isSatOff) return false;
        // Saturday cover 10-12: must have Saturday off (not Sunday off)
        if (day === 6 && isSlot10to12 && isSunOff) return false;
        // Saturday cover 12-14: must have Sunday off (not Saturday off)
        if (day === 6 && isSlot12to14 && isSatOff) return false;
      }

      // 5. Duty type eligibility (arms, rank, specialty, eligibleDutyIds)
      if (dutyDef) {
        const elig = this.scheduler.isEligibleForDuty(p, dutyDef, date);
        if (!elig.eligible) return false;
      }

      return true;
    });

    if (!q) return available;

    return available.filter(p => 
      p.fullName.toLowerCase().includes(q) ||
      p.rankShort.toLowerCase().includes(q) ||
      p.rank.toLowerCase().includes(q) ||
      (p.specialty && p.specialty.toLowerCase().includes(q)) ||
      (p.company && p.company.toLowerCase().includes(q))
    );
  });

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.selectedDate.set(params['date']);
      }
      this.loadOrCreateSchedule();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.searchable-picker-anchor')) {
      this.closePersonPicker();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closePersonPicker();
    this.cancelSafetyRemoval();
    this.closeAddDutyModal();
    this.closeFinalizeModal();
    this.closeResetFinalizeModal();
  }

  getDefaultTargetDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Rosters are typically prepared for tomorrow
    return d.toISOString().slice(0, 10);
  }

  formatDateDdMmYyyy(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  getDayNameGreek(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const days = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
    return days[d.getDay()];
  }

  changeDate(newDate: string) {
    if (!newDate) return;
    this.selectedDate.set(newDate);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: newDate },
      queryParamsHandling: 'merge'
    });
    this.loadOrCreateSchedule();
  }

  navigateDay(delta: number) {
    const current = new Date(this.selectedDate());
    current.setDate(current.getDate() + delta);
    this.changeDate(current.toISOString().slice(0, 10));
  }

  loadOrCreateSchedule() {
    const date = this.selectedDate();
    const existing = this.storage.getScheduleForDate(date);
    const activeDuties = this.activeDuties();

    if (existing) {
      let modified = false;
      existing.duties.forEach(duty => {
        const ad = activeDuties.find(d => d.id === duty.dutyTypeId);
        if (ad) {
          const slotDefs = getDutySlotsForDate(ad, date);
          const targetCount = slotDefs.length > 0 ? slotDefs.length : (ad.slots || 1);

          // If more people were added in duty definition
          if (duty.slots.length < targetCount) {
            modified = true;
            for (let i = duty.slots.length; i < targetCount; i++) {
              const def = slotDefs[i];
              let hoursNote = ad.type === '24ωρη' ? '08:00 - 08:00' : `Βάρδια ${i + 1}`;
              if (def) {
                const str = formatIntervalsToString(def.intervals);
                hoursNote = def.label ? (def.label.includes(str) ? def.label : `${def.label}: ${str}`) : str;
              }
              duty.slots.push({
                slotIndex: i + 1,
                personId: null,
                personName: '',
                hoursNote: this.stripGroupText(hoursNote),
                intervals: def?.intervals ? [...def.intervals] : undefined
              });
            }
          } else if (duty.slots.length > targetCount) {
            // If people count was reduced
            modified = true;
            duty.slots = duty.slots.slice(0, targetCount);
          }

          // Sync duty metadata and slot details
          duty.dutyName = ad.name;
          duty.shortName = ad.shortName;
          duty.category = ad.category;
          const todayStr = new Date().toISOString().slice(0, 10);
          if (date >= todayStr || duty.weight === undefined || duty.weight === null) {
            duty.weight = ad.weight !== undefined && ad.weight !== null ? ad.weight : 1;
          }
          duty.slots.forEach((s, idx) => {
            s.slotIndex = idx + 1;
            const def = slotDefs[idx];
            if (def) {
              const str = formatIntervalsToString(def.intervals);
              const note = def.label ? (def.label.includes(str) ? def.label : `${def.label}: ${str}`) : str;
              s.hoursNote = this.stripGroupText(note);
              if (def.intervals) {
                s.intervals = [...def.intervals];
              }
              if (def.groupTag) {
                s.groupTag = def.groupTag;
              }
            }
          });
        }
      });

      // Add any active duties that are missing from existing schedule
      activeDuties.forEach(ad => {
        if (!existing.duties.some(d => d.dutyTypeId === ad.id)) {
          modified = true;
          const slotDefs = getDutySlotsForDate(ad, date);
          const slotsCount = slotDefs.length > 0 ? slotDefs.length : (ad.slots || 1);
          const slots: ShiftSlotAssignment[] = [];
          for (let i = 0; i < slotsCount; i++) {
            const def = slotDefs[i];
            let hoursNote = ad.type === '24ωρη' ? '08:00 - 08:00' : `Βάρδια ${i + 1}`;
            if (def) {
              const str = formatIntervalsToString(def.intervals);
              hoursNote = def.label ? (def.label.includes(str) ? def.label : `${def.label}: ${str}`) : str;
            }
            slots.push({
              slotIndex: i + 1,
              groupIndex: def?.groupIndex,
              personId: null,
              personName: '',
              hoursNote: this.stripGroupText(hoursNote),
              intervals: def?.intervals ? [...def.intervals] : undefined
            });
          }
          existing.duties.push({
            dutyTypeId: ad.id,
            dutyName: ad.name,
            shortName: ad.shortName,
            category: ad.category,
            weight: ad.weight !== undefined && ad.weight !== null ? ad.weight : 1,
            slots
          });
        }
      });

      this.revalidateSchedule(existing);
      if (modified) {
        this.storage.saveSchedule(existing);
      }
      this.currentSchedule.set(JSON.parse(JSON.stringify(existing)));
    } else {
      this.currentSchedule.set(this.createEmptyScheduleForDate(date));
    }
  }

  createEmptyScheduleForDate(date: string): DailySchedule {
    const duties: DutyAssignment[] = this.activeDuties().map(duty => {
      const slots: ShiftSlotAssignment[] = [];
      const slotDefs = getDutySlotsForDate(duty, date);
      const slotsCount = slotDefs.length > 0 ? slotDefs.length : (duty.slots || 1);

      for (let i = 0; i < slotsCount; i++) {
        const slotDef = slotDefs[i];
        let hoursNote = duty.type === '24ωρη' ? '08:00 - 08:00' : `Βάρδια ${i + 1}`;
        if (slotDef) {
          const str = formatIntervalsToString(slotDef.intervals);
          if (slotDef.label) {
            hoursNote = (slotDef.label.includes(str) || (slotDef.intervals?.length > 0 && slotDef.label.includes(slotDef.intervals[0].from)))
              ? slotDef.label
              : `${slotDef.label}: ${str}`;
          } else {
            hoursNote = str;
          }
        }
        hoursNote = this.stripGroupText(hoursNote);

        slots.push({
          slotIndex: i + 1,
          groupIndex: slotDef?.groupIndex,
          personId: null,
          personName: '',
          hoursNote,
          intervals: slotDef?.intervals ? [...slotDef.intervals] : undefined
        });
      }
      return {
        dutyTypeId: duty.id,
        dutyName: duty.name,
        shortName: duty.shortName,
        category: duty.category,
        weight: duty.weight !== undefined && duty.weight !== null ? duty.weight : 1,
        slots
      };
    });

    return {
      date,
      isHolidayOrWeekend: this.scheduler.isWeekend(date),
      dayNote: getDayHandoverNote(date),
      duties,
      savedAt: undefined
    };
  }

  // Groups slots that share the same time shift into a single box
  getGroupedShiftsForDuty(duty: DutyAssignment): GroupedTimeShift[] {
    const groups: GroupedTimeShift[] = [];
    const keyMap = new Map<string, GroupedTimeShift>();
    const dutyDef = this.storage.dutyTypes().find(dt => dt.id === duty.dutyTypeId);

    duty.slots.forEach((slot, sIdx) => {
      let timeKey = '';
      if (slot.groupIndex !== undefined && slot.groupIndex !== null) {
        timeKey = `grp-${slot.groupIndex}`;
      } else if (slot.intervals && slot.intervals.length > 0) {
        timeKey = slot.intervals.map(i => `${i.from}-${i.to}`).join('|');
      } else {
        timeKey = this.stripGroupText(slot.hoursNote || '').trim() || `slot-${sIdx}`;
      }

      const locationSubtitle = this.getSlotLocationSubtitle(slot, dutyDef);
      if (locationSubtitle && (slot.groupIndex === undefined || slot.groupIndex === null)) {
        timeKey = `${locationSubtitle}|${timeKey}`;
      }

      let existing = keyMap.get(timeKey);
      if (existing) {
        existing.slots.push({ slotIndexInDuty: sIdx, slot });
        existing.peopleCount = existing.slots.length;
      } else {
        const intervalBadges = this.extractIntervalBadges(slot, dutyDef);
        const compBadges = this.getComplementaryBadges(duty.dutyTypeId, slot);
        const hasComp = compBadges && compBadges.length > 0;
        const isCover = hasComp || this.isSlot12to14(slot) || this.isSlot10to12(slot) ||
                        (slot.hoursNote?.includes('Κάλυψη') ?? false);
        const complementaryBadges = hasComp ? compBadges : undefined;

        const newGroup: GroupedTimeShift = {
          shiftNumber: groups.length + 1,
          locationSubtitle: locationSubtitle || undefined,
          intervalBadges,
          complementaryBadges,
          isCoverShift: isCover,
          peopleCount: 1,
          slots: [{ slotIndexInDuty: sIdx, slot }]
        };
        keyMap.set(timeKey, newGroup);
        groups.push(newGroup);
      }
    });

    return groups;
  }

  /**
   * For cover slots, compute the complementary time badges from the linked day's full position.
   * e.g. Friday 12:00-14:00 cover → Saturday 4th position has 20:00-22:00, 04:00-06:00
   * Saturday 10:00-12:00 cover → Sunday 3rd position has 18:00-20:00, 02:00-04:00
   * Saturday 12:00-14:00 cover → Sunday 4th position has 20:00-22:00, 04:00-06:00
   * Friday restaurant 16:00-22:00 → Monday 05:20-16:00
   * Monday morning restaurant 05:20-16:00 → Friday 16:00-22:00
   */
  private getComplementaryBadges(dutyTypeId: string, slot: ShiftSlotAssignment): string[] {
    const date = this.selectedDate();
    const day = new Date(date).getDay();

    // Friday cover 12:00-14:00 → completed by Saturday 4th position: 20:00-22:00 (Σαβ), 04:00-06:00 (Κυρ)
    if (day === 5 && this.isSlot12to14(slot)) {
      return ['20:00 - 22:00 (Σαβ)', '04:00 - 06:00 (Κυρ)'];
    }

    // Friday restaurant 16:00-22:00 → completed on Monday 05:20-16:00
    if (day === 5 && (dutyTypeId === 'duty-estiatoria' || slot.hoursNote?.includes('Δευτέρα')) && slot.intervals?.some(i => i.from === '16:00' && i.to === '22:00')) {
      return ['05:20 - 16:00 (Δευ)'];
    }

    // Saturday cover 10:00-12:00 → completed by Sunday 3rd position: 18:00-20:00 (Κυρ), 02:00-04:00 (Δευ)
    if (day === 6 && this.isSlot10to12(slot)) {
      return ['18:00 - 20:00 (Κυρ)', '02:00 - 04:00 (Δευ)'];
    }

    // Saturday cover 12:00-14:00 → completed by Sunday 4th position: 20:00-22:00 (Κυρ), 04:00-06:00 (Δευ)
    if (day === 6 && this.isSlot12to14(slot)) {
      return ['20:00 - 22:00 (Κυρ)', '04:00 - 06:00 (Δευ)'];
    }

    // Monday morning restaurant 05:20-16:00 → 1st half was Friday 16:00-22:00
    if (day === 1 && (dutyTypeId === 'duty-estiatoria' || slot.hoursNote?.includes('Παρασκευής') || slot.hoursNote?.includes('Παρασκευή')) && slot.intervals?.some(i => i.from === '05:20' && i.to === '16:00')) {
      return ['16:00 - 22:00 (Παρ)'];
    }

    return [];
  }

  private getSlotLocationSubtitle(slot: ShiftSlotAssignment, dutyDef?: DutyType): string {
    const isCover = this.isSlot12to14(slot) || this.isSlot10to12(slot) ||
                    (slot.hoursNote?.includes('Κάλυψη') ?? false);
    if (isCover) {
      const day = new Date(this.selectedDate()).getDay();
      if (this.isSlot12to14(slot)) {
        return day === 5 ? 'Κάλυψη 4ης Θέσης (Εξοδούχος Κ)' : 'Κάλυψη 4ης Θέσης (Εξοδούχος Σ)';
      }
      if (this.isSlot10to12(slot)) {
        return 'Κάλυψη 3ης Θέσης (Εξοδούχος Σ)';
      }
    }

    if (!dutyDef || !dutyDef.slotDefinitions) return '';

    const def = dutyDef.slotDefinitions.find(sd => 
      (slot.groupIndex != null && sd.groupIndex === slot.groupIndex) || sd.slotIndex === slot.slotIndex
    );

    const typedName = (def?.groupName || '').trim();
    if (!typedName) return '';

    // If it's just generic default position names (e.g. "1η Θέση", "2η Θέση", "Θέση #1", etc.), treat as blank
    if (/^\d+η\s*Θέση$/i.test(typedName) || /^Θέση\s*#?\d+$/i.test(typedName)) {
      return '';
    }

    return typedName;
  }

  getNextDayShort(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDay();
    const map: { [key: number]: string } = {
      0: 'Δευ', // Sunday -> Monday
      1: 'Τρι', // Monday -> Tuesday
      2: 'Τετ', // Tuesday -> Wednesday
      3: 'Πεμ', // Wednesday -> Thursday
      4: 'Παρ', // Thursday -> Friday
      5: 'Σαβ', // Friday -> Saturday
      6: 'Κυρ'  // Saturday -> Sunday
    };
    return map[day] || '';
  }

  private isDuty14Cycle(dutyDef?: DutyType, slot?: ShiftSlotAssignment): boolean {
    if (dutyDef) {
      if (dutyDef.timePresetType === 'ROLLING_CYCLE' || dutyDef.timePresetType === 'GREEK_ARMY_2_6') return true;
      if (dutyDef.name.includes('Θαλαμοφύλακας') || dutyDef.name.includes('Οπλοφύλακας')) return true;
      if (dutyDef.name.includes('Σκοπός') || dutyDef.name.includes('Πύλη') || dutyDef.name.includes('Περίπολος')) return true;
      if (dutyDef.shiftHours?.includes('14:00')) return true;
    }
    if (slot?.hoursNote && (slot.hoursNote.includes('14:00') || slot.hoursNote.includes('Κάλυψη') || slot.hoursNote.includes('Θέση'))) {
      return true;
    }
    if (slot?.intervals && slot.intervals.some(i => i.from === '14:00' || i.from === '16:00' || i.from === '18:00' || i.from === '20:00' || i.from === '22:00')) {
      return true;
    }
    return false;
  }

  private isNextDayInterval(from: string, to: string, is14Cycle: boolean, isCoverSlot: boolean): boolean {
    if (isCoverSlot) {
      return true;
    }
    if (is14Cycle) {
      const fromHour = parseInt(from.split(':')[0], 10);
      if (!isNaN(fromHour) && fromHour >= 0 && fromHour < 14) {
        return true;
      }
    }
    return false;
  }

  private extractIntervalBadges(slot: ShiftSlotAssignment, dutyDef?: DutyType): string[] {
    const nextDayShort = this.getNextDayShort(this.selectedDate());
    const is14 = this.isDuty14Cycle(dutyDef, slot);
    const isCover = this.isSlot12to14(slot) || this.isSlot10to12(slot) || (slot.hoursNote?.includes('Κάλυψη') ?? false);

    if (slot.intervals && slot.intervals.length > 0) {
      return slot.intervals.map(i => {
        if (this.isNextDayInterval(i.from, i.to, is14, isCover)) {
          return `${i.from} - ${i.to} (${nextDayShort})`;
        }
        return `${i.from} - ${i.to}`;
      });
    }

    let text = this.stripGroupText(slot.hoursNote || '08:00 - 08:00');
    const sub = this.getSlotLocationSubtitle(slot, dutyDef);
    if (sub && text.startsWith(sub)) {
      text = text.replace(sub, '').replace(/^[:\s\-•]+/, '').trim();
    }

    if (!text) return ['08:00 - 08:00'];

    const rawBadges = text.split(/&|,/).map(b => b.trim()).filter(Boolean);
    const badges = rawBadges.map(b => {
      const match = b.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (match) {
        const from = match[1];
        const to = match[2];
        if (this.isNextDayInterval(from, to, is14, isCover)) {
          return `${from} - ${to} (${nextDayShort})`;
        }
        return `${from} - ${to}`;
      }
      return b;
    });

    return badges.length > 0 ? badges : [text];
  }

  stripGroupText(text: string): string {
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

  // --- Searchable Person Picker Methods ---
  isPickerOpen(dutyIdx: number, slotIdx: number): boolean {
    const p = this.activePickerSlot();
    return p !== null && p.dutyIdx === dutyIdx && p.slotIdx === slotIdx;
  }

  togglePersonPicker(dutyIdx: number, slotIdx: number, event: MouseEvent) {
    event.stopPropagation();
    if (this.isCurrentScheduleFinalized()) return;
    const current = this.activePickerSlot();
    if (current && current.dutyIdx === dutyIdx && current.slotIdx === slotIdx) {
      this.closePersonPicker();
    } else {
      this.activePickerSlot.set({ dutyIdx, slotIdx });
      this.personSearchQuery.set('');
    }
  }

  closePersonPicker() {
    this.activePickerSlot.set(null);
    this.personSearchQuery.set('');
  }

  selectPersonForSlot(dutyIdx: number, slotIdx: number, personId: string | null) {
    this.onSlotPersonChange(dutyIdx, slotIdx, personId || '');
    this.closePersonPicker();
  }

  isPersonServingWeekendTrick(personId: string, dateStr: string): boolean {
    const day = new Date(dateStr).getDay();
    const dates = this.scheduler.getWeekendDates(dateStr);

    if (day === 6) {
      // Saturday: was person on Friday's 12-14 cover?
      const friSched = this.storage.getScheduleForDate(dates.friday);
      return Boolean(friSched?.duties.some(d => 
        d.slots.some(s => this.isSlot12to14(s) && s.personId === personId)
      ));
    }
    if (day === 0) {
      // Sunday: was person on Saturday's 10-12 or 12-14 cover?
      const satSched = this.storage.getScheduleForDate(dates.saturday);
      return Boolean(satSched?.duties.some(d => 
        d.slots.some(s => (this.isSlot10to12(s) || this.isSlot12to14(s)) && s.personId === personId)
      ));
    }
    return false;
  }

  getPersonBadgeNote(personId: string): { text: string; isLeave?: boolean; isServed?: boolean; isWeekendTrick?: boolean } | null {
    const date = this.selectedDate();
    const leave = this.scheduler.getPersonLeave(personId, date);
    if (leave) {
      return { text: leave.type, isLeave: true };
    }

    // Check if currently picking for a weekend cover slot
    const active = this.activePickerSlot();
    const sched = this.currentSchedule();
    if (active && sched) {
      const activeDuty = sched.duties[active.dutyIdx];
      const activeSlot = activeDuty?.slots[active.slotIdx];
      if (activeSlot) {
        const dates = this.scheduler.getWeekendDates(sched.date);
        const plan = this.storage.getWeekendPlan(dates.friday);
        const day = new Date(sched.date).getDay();

        if (plan) {
          // Friday cover 12-14: Person must NOT be off on Saturday (must be Εξοδούχος Κυριακής)
          if (day === 5 && this.isSlot12to14(activeSlot)) {
            if (plan.saturdayOffIds.includes(personId)) {
              return { text: 'Εξοδούχος Σ (Μη επιλέξιμος)', isLeave: true };
            }
            if (plan.sundayOffIds.includes(personId)) {
              return { text: 'Εξοδούχος Κ (Επιλέξιμος)', isWeekendTrick: true };
            }
          }

          // Saturday covers 10-12 & 12-14: Person must NOT be off on Sunday (must be Εξοδούχος Σαββάτου)
          if (day === 6 && (this.isSlot10to12(activeSlot) || this.isSlot12to14(activeSlot))) {
            if (plan.sundayOffIds.includes(personId)) {
              return { text: 'Εξοδούχος Κ (Μη επιλέξιμος)', isLeave: true };
            }
            if (plan.saturdayOffIds.includes(personId)) {
              return { text: 'Εξοδούχος Σ (Επιλέξιμος)', isWeekendTrick: true };
            }
          }
        }
      }
    }

    if (this.scheduler.servedYesterday(personId, date)) {
      if (this.isPersonServingWeekendTrick(personId, date)) {
        return { text: 'Ειδική εναλλαγή Σ/Κ', isWeekendTrick: true };
      }
      return { text: 'Υπηρέτησε χθες', isServed: true };
    }
    return null;
  }

  // --- Add / Manage Duty Types with Badges & Safety Confirmation ---
  openAddDutyModal() {
    const sched = this.currentSchedule();
    const currentIds = new Set<string>();
    if (sched) {
      sched.duties.forEach(d => currentIds.add(d.dutyTypeId));
    }
    this.modalSelectedDutyIds.set(currentIds);
    this.isAddDutyModalOpen.set(true);
  }

  closeAddDutyModal() {
    this.isAddDutyModalOpen.set(false);
  }

  isDutySelectedInModal(dutyTypeId: string): boolean {
    return this.modalSelectedDutyIds().has(dutyTypeId);
  }

  toggleDutySelectionInModal(dutyTypeId: string) {
    const current = new Set(this.modalSelectedDutyIds());
    if (current.has(dutyTypeId)) {
      current.delete(dutyTypeId);
    } else {
      current.add(dutyTypeId);
    }
    this.modalSelectedDutyIds.set(current);
  }

  confirmDutyModalChanges() {
    const sched = this.currentSchedule();
    if (!sched) return;

    const selectedIds = this.modalSelectedDutyIds();
    // Find duties that were in the schedule but are now deselected
    const dutiesToRemove = sched.duties.filter(d => !selectedIds.has(d.dutyTypeId));

    if (dutiesToRemove.length > 0) {
      // Trigger safety dialog
      this.safetyRemovalModal.set({
        dutyNames: dutiesToRemove.map(d => d.dutyName),
        execute: () => {
          this.applyDutyModalChanges();
          this.safetyRemovalModal.set(null);
        }
      });
      return;
    }

    this.applyDutyModalChanges();
  }

  applyDutyModalChanges() {
    const sched = this.currentSchedule();
    if (!sched) return;

    const selectedIds = this.modalSelectedDutyIds();
    
    // 1. Remove deselected duties
    sched.duties = sched.duties.filter(d => selectedIds.has(d.dutyTypeId));

    // 2. Add newly selected duties
    const currentIds = new Set(sched.duties.map(d => d.dutyTypeId));
    this.activeDuties().forEach(dutyDef => {
      if (selectedIds.has(dutyDef.id) && !currentIds.has(dutyDef.id)) {
        const slotDefs = getDutySlotsForDate(dutyDef, sched.date);
        const slotsCount = slotDefs.length > 0 ? slotDefs.length : (dutyDef.slots || 1);
        const slots: ShiftSlotAssignment[] = [];

        for (let i = 0; i < slotsCount; i++) {
          const def = slotDefs[i];
          let hoursNote = dutyDef.type === '24ωρη' ? '08:00 - 08:00' : `Βάρδια ${i + 1}`;
          if (def) {
            const str = formatIntervalsToString(def.intervals);
            hoursNote = def.label ? `${def.label}: ${str}` : str;
          }
          hoursNote = this.stripGroupText(hoursNote);

          slots.push({
            slotIndex: i + 1,
            personId: null,
            personName: '',
            hoursNote,
            intervals: def?.intervals ? [...def.intervals] : undefined
          });
        }

        sched.duties.push({
          dutyTypeId: dutyDef.id,
          dutyName: dutyDef.name,
          shortName: dutyDef.shortName,
          category: dutyDef.category,
          weight: dutyDef.weight !== undefined && dutyDef.weight !== null ? dutyDef.weight : 1,
          slots
        });
      }
    });

    this.currentSchedule.set({ ...sched });
    this.storage.saveSchedule(sched);
    this.storage.notify('Οι υπηρεσίες της ημέρας ενημερώθηκαν επιτυχώς.', 'success');
    this.closeAddDutyModal();
  }

  // Remove single duty from card top-right with safety confirmation
  requestRemoveDutyFromDay(dutyIdx: number) {
    if (this.isCurrentScheduleFinalized()) return;
    const sched = this.currentSchedule();
    if (!sched) return;
    const duty = sched.duties[dutyIdx];
    if (!duty) return;

    this.safetyRemovalModal.set({
      dutyNames: [duty.dutyName],
      execute: () => {
        sched.duties.splice(dutyIdx, 1);
        this.currentSchedule.set({ ...sched });
        this.storage.saveSchedule(sched);
        this.storage.notify(`Η υπηρεσία "${duty.dutyName}" αφαιρέθηκε από τη σημερινή διαταγή.`, 'info');
        this.safetyRemovalModal.set(null);
      }
    });
  }

  cancelSafetyRemoval() {
    this.safetyRemovalModal.set(null);
  }

  // --- Primary CTA: Auto Produce Daily / Weekend Shifts ---
  onAutoGenerateClicked() {
    if (this.isCurrentScheduleFinalized()) return;
    const date = this.selectedDate();

    // Saturday/Sunday: button is disabled, do nothing
    if (this.isSaturday() || this.isSunday()) {
      return;
    }

    if (this.isFriday()) {
      const dates = this.scheduler.getWeekendDates(date);
      const plan = this.storage.getWeekendPlan(dates.friday);
      const isPlanSet = !!plan && (plan.saturdayOffIds.length > 0 || plan.sundayOffIds.length > 0);

      if (!isPlanSet || !plan) {
        this.storage.notify('Δεν επιτρέπεται η αυτόματη παραγωγή: Πρέπει πρώτα να ορίσετε τους εξοδούχους Σαββατοκύριακου στη σελίδα «Εξοδούχοι Σ/Κ».', 'warning');
        return;
      }

      const res = this.scheduler.generateWeekendSchedules(dates.friday, plan);
      this.revalidateSchedule(res.friday);
      this.revalidateSchedule(res.saturday);
      this.revalidateSchedule(res.sunday);
      this.currentSchedule.set(res.friday);
      this.storage.saveSchedule(res.friday);
      this.storage.saveSchedule(res.saturday);
      this.storage.saveSchedule(res.sunday);
      this.revalidateNeighborSchedules(dates.friday);
      this.storage.notify(`Η αυτόματη κατανομή υπηρεσιών για Παρασκευή, Σάββατο και Κυριακή ολοκληρώθηκε!`, 'success');
      return;
    }

    // Weekdays (Mon - Thu)
    const generated = this.scheduler.generateDailySchedule(date);
    this.revalidateSchedule(generated);
    this.currentSchedule.set(generated);
    this.storage.saveSchedule(generated);
    this.revalidateNeighborSchedules(date);
    this.storage.notify(`Η αυτόματη κατανομή για ${this.formatDateDdMmYyyy(date)} ολοκληρώθηκε!`, 'success');
  }

  // Clear all duty assignments for the current day
  clearAllDutiesForCurrentDay() {
    if (this.isCurrentScheduleFinalized()) {
      this.storage.notify('Το πρόγραμμα έχει οριστικοποιηθεί. Πατήστε «Επαναφορά» για να μπορέσετε να το τροποποιήσετε.', 'warning');
      return;
    }

    const sched = this.currentSchedule();
    if (!sched) return;

    const hasAnyAssigned = sched.duties.some(d => d.slots.some(s => !!s.personId));
    if (!hasAnyAssigned) {
      this.storage.notify('Δεν υπάρχουν τοποθετημένοι στρατιώτες στις θέσεις της ημέρας.', 'info');
      return;
    }

    const formattedDate = this.formatDateDdMmYyyy(sched.date);
    if (!confirm(`Είστε βέβαιοι ότι θέλετε να αφαιρέσετε όλους τους στρατιώτες από τις θέσεις της ημέρας (${formattedDate});`)) {
      return;
    }

    for (const duty of sched.duties) {
      for (const slot of duty.slots) {
        slot.personId = null;
        slot.personName = '';
        slot.rankShort = '';
        slot.company = '';
        slot.rotationalGroup = undefined;
        slot.manualOverride = false;
        slot.conflictWarning = undefined;
        slot.conflictSeverity = undefined;
      }
    }

    this.revalidateSchedule(sched);
    this.currentSchedule.set({ ...sched });
    this.storage.saveSchedule(sched);
    this.revalidateNeighborSchedules(sched.date);

    this.storage.notify(`Πραγματοποιήθηκε εκκαθάριση όλων των θέσεων για τις ${formattedDate}.`, 'success');
  }

  // Slot person assignment with auto-save
  onSlotPersonChange(dutyIdx: number, slotIdx: number, personId: string) {
    if (this.isCurrentScheduleFinalized()) return;
    const sched = this.currentSchedule();
    if (!sched) return;

    const dutyAssignment = sched.duties[dutyIdx];
    if (!dutyAssignment) return;
    const slot = dutyAssignment.slots[slotIdx];
    if (!slot) return;

    if (!personId) {
      slot.personId = null;
      slot.personName = '';
      slot.rankShort = '';
      slot.company = '';
      slot.conflictWarning = undefined;
      slot.manualOverride = true;

      this.revalidateSchedule(sched);
      this.currentSchedule.set({ ...sched });
      this.storage.saveSchedule(sched);

      this.revalidateNeighborSchedules(sched.date);

      const dDay = new Date(sched.date).getDay();
      if (this.isFriday() || this.isWeekend() || dDay === 1) {
        this.syncWeekendLinkedCoverSlot(sched.date, dutyAssignment.dutyTypeId, slotIdx, null);
      }
      return;
    }

    const person = this.storage.personnel().find(p => p.id === personId);
    if (!person) return;

    slot.personId = person.id;
    slot.personName = person.fullName;
    slot.rankShort = person.rankShort;
    slot.company = person.company;
    slot.manualOverride = true;

    this.revalidateSchedule(sched);
    this.currentSchedule.set({ ...sched });
    this.storage.saveSchedule(sched);

    this.revalidateNeighborSchedules(sched.date);

    // If it's a weekend cover slot or restaurant cycle slot, automatically sync
    const dDay = new Date(sched.date).getDay();
    if (this.isFriday() || this.isWeekend() || dDay === 1) {
      this.syncWeekendLinkedCoverSlot(sched.date, dutyAssignment.dutyTypeId, slotIdx, personId);
    }
  }

  // --- Weekend Cover Cross-Day Auto-Placement ---
  private isSlot12to14(slot: ShiftSlotAssignment): boolean {
    return Boolean(
      (slot.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('12:00-14:00') && !slot.hoursNote?.includes('20:00'))
    );
  }

  private isSlot10to12(slot: ShiftSlotAssignment): boolean {
    return Boolean(
      (slot.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('10:00-12:00') && !slot.hoursNote?.includes('18:00'))
    );
  }

  private isSlotSaturdayPos4Incomplete(slot: ShiftSlotAssignment): boolean {
    return Boolean(
      (slot.intervals?.some(i => i.from === '20:00') && slot.intervals?.some(i => i.from === '04:00') && slot.intervals.length === 2) ||
      (slot.hoursNote?.includes('20:00-22:00') && slot.hoursNote?.includes('04:00-06:00') && !slot.hoursNote?.includes('12:00'))
    );
  }

  private isSlotSundayPos3(slot: ShiftSlotAssignment): boolean {
    return Boolean(
      (slot.intervals?.some(i => i.from === '18:00') && slot.intervals?.some(i => i.from === '02:00')) ||
      (slot.hoursNote?.includes('18:00-20:00') && slot.hoursNote?.includes('02:00-04:00'))
    );
  }

  private isSlotSundayPos4(slot: ShiftSlotAssignment): boolean {
    return Boolean(
      (slot.intervals?.some(i => i.from === '20:00') && slot.intervals?.some(i => i.from === '04:00') && slot.intervals.length === 3) ||
      (slot.hoursNote?.includes('20:00-22:00') && slot.hoursNote?.includes('04:00-06:00') && slot.hoursNote?.includes('12:00'))
    );
  }

  syncWeekendLinkedCoverSlot(currentDate: string, dutyTypeId: string, slotIdx: number, personId: string | null) {
    const dutyDef = this.storage.dutyTypes().find(d => d.id === dutyTypeId);
    if (!dutyDef) return;

    const currentSched = this.currentSchedule();
    if (!currentSched) return;
    const currentDuty = currentSched.duties.find(d => d.dutyTypeId === dutyTypeId);
    if (!currentDuty) return;
    const slot = currentDuty.slots[slotIdx];
    if (!slot) return;

    const dates = this.scheduler.getWeekendDates(currentDate);
    const day = new Date(currentDate).getDay(); // 5 = Fri, 6 = Sat, 0 = Sun, 1 = Mon
    const person = personId ? this.storage.personnel().find(p => p.id === personId) || null : null;

    const isRestaurant = dutyDef.timePresetType === 'RESTAURANT_CYCLE' || 
                         dutyDef.id === 'duty-estiatoria' ||
                         dutyDef.name.includes('Εστιατόρι');

    if (isRestaurant) {
      if (day === 5) {
        // Friday restaurant (16:00-22:00) <=> Monday morning (05:20-16:00)
        const friRestSlots = currentDuty.slots.filter(s => s.intervals?.some(i => i.from === '16:00' && i.to === '22:00'));
        const subIdx = friRestSlots.indexOf(slot);
        if (subIdx >= 0) {
          const monDate = new Date(dates.friday);
          monDate.setDate(monDate.getDate() + 3);
          const mondayStr = monDate.toISOString().slice(0, 10);
          this.updateOtherDaySlot(mondayStr, dutyTypeId, 'MON_REST_MORNING', subIdx, person);
        }
      } else if (day === 1) {
        // Monday morning (05:20-16:00) <=> Friday (16:00-22:00)
        const monMorningSlots = currentDuty.slots.filter(s => s.intervals?.some(i => i.from === '05:20' && i.to === '16:00') && s.intervals.length === 1);
        const subIdx = monMorningSlots.indexOf(slot);
        if (subIdx >= 0) {
          const friDate = new Date(currentDate);
          friDate.setDate(friDate.getDate() - 3);
          const friStr = friDate.toISOString().slice(0, 10);
          this.updateOtherDaySlot(friStr, dutyTypeId, 'FRI_REST_EVENING', subIdx, person);
        }
      }
      return;
    }

    const isRolling = dutyDef.timePresetType === 'ROLLING_CYCLE' || 
                      dutyDef.timePresetType === 'GREEK_ARMY_2_6' || 
                      dutyDef.name.includes('Θαλαμοφύλακας') || 
                      dutyDef.name.includes('Οπλοφύλακας');
    if (!isRolling) return;

    // Case 1: Friday 12:00-14:00 Cover <=> Saturday Position 4 Incomplete
    if (day === 5) {
      if (this.isSlot12to14(slot)) {
        const coverSlots = currentDuty.slots.filter(s => this.isSlot12to14(s));
        const subIdx = coverSlots.indexOf(slot);
        this.updateOtherDaySlot(dates.saturday, dutyTypeId, 'SAT_POS_4_INCOMPLETE', subIdx, person);
      }
    } else if (day === 6) {
      // Saturday
      if (this.isSlotSaturdayPos4Incomplete(slot)) {
        const pos4Slots = currentDuty.slots.filter(s => this.isSlotSaturdayPos4Incomplete(s));
        const subIdx = pos4Slots.indexOf(slot);
        this.updateOtherDaySlot(dates.friday, dutyTypeId, 'FRI_COVER_12_14', subIdx, person);
      } else if (this.isSlot10to12(slot)) {
        // Saturday 10:00-12:00 Sunday Cover <=> Sunday Position 3
        const cover10Slots = currentDuty.slots.filter(s => this.isSlot10to12(s));
        const subIdx = cover10Slots.indexOf(slot);
        this.updateOtherDaySlot(dates.sunday, dutyTypeId, 'SUN_POS_3', subIdx, person);
      } else if (this.isSlot12to14(slot)) {
        // Saturday 12:00-14:00 Sunday Cover <=> Sunday Position 4
        const cover12Slots = currentDuty.slots.filter(s => this.isSlot12to14(s));
        const subIdx = cover12Slots.indexOf(slot);
        this.updateOtherDaySlot(dates.sunday, dutyTypeId, 'SUN_POS_4', subIdx, person);
      }
    } else if (day === 0) {
      // Sunday
      if (this.isSlotSundayPos3(slot)) {
        const pos3Slots = currentDuty.slots.filter(s => this.isSlotSundayPos3(s));
        const subIdx = pos3Slots.indexOf(slot);
        this.updateOtherDaySlot(dates.saturday, dutyTypeId, 'SAT_COVER_10_12', subIdx, person);
      } else if (this.isSlotSundayPos4(slot)) {
        const pos4Slots = currentDuty.slots.filter(s => this.isSlotSundayPos4(s));
        const subIdx = pos4Slots.indexOf(slot);
        this.updateOtherDaySlot(dates.saturday, dutyTypeId, 'SAT_COVER_12_14', subIdx, person);
      }
    }
  }

  private updateOtherDaySlot(
    targetDate: string, 
    dutyTypeId: string, 
    targetType: 'FRI_COVER_12_14' | 'SAT_POS_4_INCOMPLETE' | 'SAT_COVER_10_12' | 'SAT_COVER_12_14' | 'SUN_POS_3' | 'SUN_POS_4' | 'MON_REST_MORNING' | 'FRI_REST_EVENING', 
    subIdx: number, 
    person: Personnel | null
  ) {
    let sched = this.storage.getScheduleForDate(targetDate);
    if (!sched) {
      sched = this.createEmptyScheduleForDate(targetDate);
    }

    const duty = sched.duties.find(d => d.dutyTypeId === dutyTypeId);
    if (!duty) return;

    let targetSlots: ShiftSlotAssignment[] = [];
    if (targetType === 'FRI_COVER_12_14' || targetType === 'SAT_COVER_12_14') {
      targetSlots = duty.slots.filter(s => this.isSlot12to14(s));
    } else if (targetType === 'SAT_POS_4_INCOMPLETE') {
      targetSlots = duty.slots.filter(s => this.isSlotSaturdayPos4Incomplete(s));
    } else if (targetType === 'SAT_COVER_10_12') {
      targetSlots = duty.slots.filter(s => this.isSlot10to12(s));
    } else if (targetType === 'SUN_POS_3') {
      targetSlots = duty.slots.filter(s => this.isSlotSundayPos3(s));
    } else if (targetType === 'SUN_POS_4') {
      targetSlots = duty.slots.filter(s => this.isSlotSundayPos4(s));
    } else if (targetType === 'MON_REST_MORNING') {
      targetSlots = duty.slots.filter(s => s.intervals?.some(i => i.from === '05:20' && i.to === '16:00') && s.intervals.length === 1);
    } else if (targetType === 'FRI_REST_EVENING') {
      targetSlots = duty.slots.filter(s => s.intervals?.some(i => i.from === '16:00' && i.to === '22:00'));
    }

    if (targetSlots[subIdx]) {
      const targetSlot = targetSlots[subIdx];
      targetSlot.personId = person ? person.id : null;
      targetSlot.personName = person ? person.fullName : '';
      targetSlot.rankShort = person ? person.rankShort : '';
      targetSlot.company = person ? person.company : '';
      targetSlot.manualOverride = true;

      this.revalidateSchedule(sched);
      this.storage.saveSchedule(sched);
      this.storage.notify(`Αυτόματη συσχέτιση θέσης κάλυψης για ${this.getDayNameGreek(targetDate)}: ${person ? person.rankShort + ' ' + person.fullName : 'Κενή'}`, 'info');
    }
  }

  revalidateSchedule(sched: DailySchedule) {
    for (let dIdx = 0; dIdx < sched.duties.length; dIdx++) {
      const d = sched.duties[dIdx];
      const dutyType = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      if (!dutyType) continue;

      for (let sIdx = 0; sIdx < d.slots.length; sIdx++) {
        const slot = d.slots[sIdx];
        if (slot.personId) {
          const conflict = this.scheduler.validateSlotAssignment(
            slot.personId,
            dutyType,
            sched.date,
            sched.duties,
            dIdx,
            sIdx
          );
          if (conflict && !conflict.message.includes('Ειδική εναλλαγή')) {
            slot.conflictWarning = conflict.message;
            slot.conflictSeverity = conflict.severity;
          } else {
            slot.conflictWarning = undefined;
            slot.conflictSeverity = undefined;
          }
        } else {
          if (slot.conflictWarning === 'Δεν βρέθηκε διαθέσιμος στρατιώτης με τα απαιτούμενα κριτήρια.' || slot.conflictWarning === 'Δεν βρέθηκε διαθέσιμος οπλίτης με τα απαιτούμενα κριτήρια.') {
            slot.conflictSeverity = 'ERROR';
          } else {
            slot.conflictWarning = undefined;
            slot.conflictSeverity = undefined;
          }
        }
      }
    }
  }

  isSlotConflict(slot: ShiftSlotAssignment): boolean {
    return Boolean(slot.conflictWarning && !slot.conflictWarning.includes('Ειδική εναλλαγή'));
  }

  isSlotConflictWarning(slot: ShiftSlotAssignment): boolean {
    if (!this.isSlotConflict(slot)) return false;
    if (slot.conflictSeverity === 'WARNING') return true;
    const msg = slot.conflictWarning || '';
    if (msg.includes('προηγούμενη ημέρα') || msg.includes('επόμενη ημέρα') || msg.includes('ειδικότητα')) {
      return true;
    }
    return false;
  }

  isSlotConflictError(slot: ShiftSlotAssignment): boolean {
    if (!this.isSlotConflict(slot)) return false;
    if (slot.conflictSeverity === 'ERROR') return true;
    if (this.isSlotConflictWarning(slot)) return false;
    const msg = slot.conflictWarning || '';
    return msg.includes('Διπλή υπηρεσία') ||
           msg.includes('Δεν βρέθηκε διαθέσιμος') ||
           msg.includes('Ελεύθερος') ||
           msg.includes('εξοδούχος') ||
           msg.includes('ένοπλο') ||
           slot.conflictSeverity !== 'WARNING';
  }

  revalidateNeighborSchedules(dateStr: string) {
    // 1. Previous Day
    const prevDate = this.scheduler.getPreviousDate(dateStr);
    const prevSched = this.storage.getScheduleForDate(prevDate);
    if (prevSched) {
      this.revalidateSchedule(prevSched);
      this.storage.saveSchedule(prevSched);
    }

    // 2. Next Day
    const nextDate = this.scheduler.getNextDate(dateStr);
    const nextSched = this.storage.getScheduleForDate(nextDate);
    if (nextSched) {
      this.revalidateSchedule(nextSched);
      this.storage.saveSchedule(nextSched);
    }
  }

  // --- Finalization (Οριστικοποίηση) Methods ---
  openFinalizeModal() {
    const sched = this.currentSchedule();
    if (!sched) return;

    // Scan errors and warnings
    const errors: FinalizeModalData['errors'] = [];
    const warnings: FinalizeModalData['warnings'] = [];
    const assignedIds = new Set<string>();
    let totalSlots = 0;
    let assignedSlots = 0;

    for (const d of sched.duties) {
      for (const slot of d.slots) {
        totalSlots++;
        if (slot.personId) {
          assignedSlots++;
          assignedIds.add(slot.personId);

          if (this.isSlotConflictError(slot)) {
            errors.push({
              dutyName: d.dutyName,
              slotIndex: slot.slotIndex,
              hoursNote: slot.hoursNote,
              personName: `${slot.rankShort ? slot.rankShort + ' ' : ''}${slot.personName || ''}`.trim(),
              reason: slot.conflictWarning || 'Σφάλμα ανάθεσης'
            });
          } else if (this.isSlotConflictWarning(slot)) {
            warnings.push({
              dutyName: d.dutyName,
              slotIndex: slot.slotIndex,
              hoursNote: slot.hoursNote,
              personName: `${slot.rankShort ? slot.rankShort + ' ' : ''}${slot.personName || ''}`.trim(),
              reason: slot.conflictWarning || 'Προειδοποίηση υπηρεσίας'
            });
          }
        } else {
          // Empty slot
          errors.push({
            dutyName: d.dutyName,
            slotIndex: slot.slotIndex,
            hoursNote: slot.hoursNote,
            personName: 'Κενή Θέση',
            reason: slot.conflictWarning || 'Δεν έχει τοποθετηθεί στρατιώτης στο πόστο'
          });
        }
      }
    }

    this.finalizeModal.set({
      scheduleDate: sched.date,
      formattedDate: `${this.getDayNameGreek(sched.date)}, ${this.formatDateDdMmYyyy(sched.date)}`,
      totalSlots,
      assignedSlots,
      assignedPersonnelCount: assignedIds.size,
      errors,
      warnings
    });
  }

  closeFinalizeModal() {
    this.finalizeModal.set(null);
  }

  confirmFinalizeSchedule() {
    const sched = this.currentSchedule();
    if (!sched) return;

    // 1. Commit duty scores (+1 dutyScore, +1 weekendDutyScore if weekend)
    this.scheduler.commitScheduleScores(sched);

    // 2. Mark schedule as finalized
    sched.isFinalized = true;
    sched.finalizedAt = new Date().toISOString();

    // 3. Save updated schedule
    this.storage.saveSchedule(sched);
    this.currentSchedule.set({ ...sched });
    this.closeFinalizeModal();

    this.storage.notify(
      `Το πρόγραμμα για ${this.formatDateDdMmYyyy(sched.date)} οριστικοποιήθηκε! Υπολογίστηκαν και πιστώθηκαν τα μόρια των στρατιωτών.`,
      'success'
    );
  }

  openResetFinalizeModal() {
    this.resetFinalizeModal.set(true);
  }

  closeResetFinalizeModal() {
    this.resetFinalizeModal.set(false);
  }

  confirmResetFinalizeSchedule() {
    const sched = this.currentSchedule();
    if (!sched) return;

    // 1. Rollback duty scores (-1 dutyScore, -1 weekendDutyScore if weekend)
    this.scheduler.rollbackScheduleScores(sched);

    // 2. Mark schedule as not finalized
    sched.isFinalized = false;
    sched.finalizedAt = undefined;

    // 3. Save updated schedule
    this.storage.saveSchedule(sched);
    this.currentSchedule.set({ ...sched });
    this.closeResetFinalizeModal();

    this.storage.notify(
      `Η οριστικοποίηση για ${this.formatDateDdMmYyyy(sched.date)} ακυρώθηκε. Τα μόρια επαναφέρθηκαν και οι θέσεις ξεκλειδώθηκαν για επεξεργασία.`,
      'info'
    );
  }
}
