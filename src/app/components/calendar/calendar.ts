import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SchedulerService } from '../../services/scheduler.service';
import { DailySchedule, DutyAssignment, Leave, WeekendPlan, formatGreekDate } from '../../models/shift.model';

export interface CalendarDayCell {
  dateStr: string;            // 'YYYY-MM-DD'
  dayNumber: number;          // 1 .. 31
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  isFriday: boolean;
  hasSchedule: boolean;
  isFinalized: boolean;
  totalSlots: number;
  mannedSlots: number;
  distinctPersonnelCount: number;
  dutiesSummary: {
    dutyTypeId: string;
    shortName: string;
    dutyName: string;
    manned: number;
    total: number;
  }[];
  activeLeavesCount: number;
  leaves: {
    personName: string;
    type: string;
  }[];
  schedule?: DailySchedule;
  weekendPlan?: WeekendPlan;
}

export interface GroupedDutySlotPerson {
  slotIndex: number;
  personId: string | null;
  personName?: string;
  rankShort?: string;
  company?: string;
  conflictWarning?: string;
  conflictSeverity?: 'WARNING' | 'ERROR' | 'INFO';
}

export interface GroupedDutySlot {
  key: string;
  groupTitle?: string;
  hoursNote: string;
  intervals?: { from: string; to: string }[];
  peopleCount: number;
  assignedCount: number;
  slotIndices: number[];
  persons: GroupedDutySlotPerson[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css'
})
export class CalendarComponent {
  storage = inject(StorageService);
  scheduler = inject(SchedulerService);
  router = inject(Router);

  readonly formatGreekDate = formatGreekDate;

  readonly greekMonths = [
    'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
    'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
  ];

  readonly greekWeekdays = [
    'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'
  ];

  readonly greekWeekdaysShort = [
    'ΔΕΥ', 'ΤΡΙ', 'ΤΕΤ', 'ΠΕΜ', 'ΠΑΡ', 'ΣΑΒ', 'ΚΥΡ'
  ];

  // Current calendar view state
  currentYear = signal<number>(new Date().getFullYear());
  currentMonth = signal<number>(new Date().getMonth()); // 0-indexed: 0 = Jan, 11 = Dec

  // Preview Modal state
  selectedPreviewDate = signal<string | null>(null);

  readonly todayDateStr = new Date().toISOString().slice(0, 10);

  // Month and Year label
  readonly monthYearLabel = computed(() => {
    const m = this.greekMonths[this.currentMonth()];
    const y = this.currentYear();
    return `${m} ${y}`;
  });

  // Calendar Days Grid computed from signals
  readonly calendarDays = computed<CalendarDayCell[]>(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const today = this.todayDateStr;

    const schedulesMap = new Map<string, DailySchedule>();
    for (const s of this.storage.schedules()) {
      schedulesMap.set(s.date, s);
    }

    const allLeaves = this.storage.leaves();

    // First day of current month
    const firstDay = new Date(year, month, 1);
    // getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Convert to Monday = 0: (d.getDay() + 6) % 7
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    // Number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Number of days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: CalendarDayCell[] = [];

    // 1. Fill leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dateStr = prevDate.toISOString().slice(0, 10);
      cells.push(this.buildDayCell(dateStr, dNum, false, today, schedulesMap, allLeaves));
    }

    // 2. Fill days of current month
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const currDate = new Date(year, month, dNum);
      const dateStr = currDate.toISOString().slice(0, 10);
      cells.push(this.buildDayCell(dateStr, dNum, true, today, schedulesMap, allLeaves));
    }

    // 3. Fill trailing days for next month to complete the row of 7
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let dNum = 1; dNum <= remaining; dNum++) {
        const nextDate = new Date(year, month + 1, dNum);
        const dateStr = nextDate.toISOString().slice(0, 10);
        cells.push(this.buildDayCell(dateStr, dNum, false, today, schedulesMap, allLeaves));
      }
    }

    return cells;
  });

  // Selected Day Cell for Modal Preview
  readonly selectedDayPreview = computed<CalendarDayCell | null>(() => {
    const dateStr = this.selectedPreviewDate();
    if (!dateStr) return null;
    return this.calendarDays().find(d => d.dateStr === dateStr) || null;
  });

  private buildDayCell(
    dateStr: string,
    dayNumber: number,
    isCurrentMonth: boolean,
    todayStr: string,
    schedulesMap: Map<string, DailySchedule>,
    allLeaves: Leave[]
  ): CalendarDayCell {
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const isFriday = dayOfWeek === 5;
    const isWeekend = isSaturday || isSunday;

    const sched = schedulesMap.get(dateStr);

    let totalSlots = 0;
    let mannedSlots = 0;
    const assignedIds = new Set<string>();
    const dutiesSummary: CalendarDayCell['dutiesSummary'] = [];

    if (sched && sched.duties) {
      for (const duty of sched.duties) {
        let dutyManned = 0;
        const dutyTotal = duty.slots.length;
        totalSlots += dutyTotal;

        for (const slot of duty.slots) {
          if (slot.personId) {
            mannedSlots++;
            dutyManned++;
            assignedIds.add(slot.personId);
          }
        }

        if (dutyManned > 0) {
          dutiesSummary.push({
            dutyTypeId: duty.dutyTypeId,
            shortName: duty.shortName || duty.dutyName.slice(0, 3).toUpperCase(),
            dutyName: duty.dutyName,
            manned: dutyManned,
            total: dutyTotal
          });
        }
      }
    }

    const hasSchedule = Boolean(sched && sched.duties && sched.duties.length > 0 && mannedSlots > 0);
    const isFinalized = Boolean(sched?.isFinalized && mannedSlots > 0);

    // Active leaves on this date
    const leavesOnDate = allLeaves
      .filter(l => l.startDate <= dateStr && dateStr <= l.endDate && l.status !== 'Ακυρωμένη')
      .map(l => ({ personName: l.personName, type: l.type }));

    return {
      dateStr,
      dayNumber,
      isCurrentMonth,
      isToday: dateStr === todayStr,
      isWeekend,
      isSaturday,
      isSunday,
      isFriday,
      hasSchedule,
      isFinalized,
      totalSlots,
      mannedSlots,
      distinctPersonnelCount: assignedIds.size,
      dutiesSummary,
      activeLeavesCount: leavesOnDate.length,
      leaves: leavesOnDate,
      schedule: sched,
      weekendPlan: sched?.weekendPlan
    };
  }

  // --- Calendar Navigation Actions ---
  prevMonth() {
    let m = this.currentMonth() - 1;
    let y = this.currentYear();
    if (m < 0) {
      m = 11;
      y--;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
  }

  nextMonth() {
    let m = this.currentMonth() + 1;
    let y = this.currentYear();
    if (m > 11) {
      m = 0;
      y++;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
  }

  goToToday() {
    const now = new Date();
    this.currentYear.set(now.getFullYear());
    this.currentMonth.set(now.getMonth());
  }

  // --- Day Click & Interaction ---
  onDayClick(day: CalendarDayCell) {
    this.selectedPreviewDate.set(day.dateStr);
  }

  closePreview() {
    this.selectedPreviewDate.set(null);
  }

  goToScheduler(dateStr: string) {
    this.closePreview();
    this.router.navigate(['/scheduler'], { queryParams: { date: dateStr } });
  }

  formatDateDdMm(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  }

  // --- Grouping Slots on same duty with same time ---
  getGroupedDutySlots(duty: DutyAssignment): GroupedDutySlot[] {
    const dutyDef = this.storage.dutyTypes().find(dt => dt.id === duty.dutyTypeId);
    const groups: GroupedDutySlot[] = [];
    const map = new Map<string, GroupedDutySlot>();

    for (const slot of duty.slots) {
      let key = '';
      if (slot.groupIndex !== undefined && slot.groupIndex !== null) {
        key = `grp-${slot.groupIndex}`;
      } else if (slot.intervals && slot.intervals.length > 0) {
        key = slot.intervals.map(i => `${i.from}-${i.to}`).join('|');
      } else if (slot.hoursNote) {
        key = this.cleanHours(slot.hoursNote);
      } else {
        key = `slot-${slot.slotIndex}`;
      }

      // Check for custom position title defined on duty definition
      const defSlot = dutyDef?.slotDefinitions?.find(sd =>
        (slot.groupIndex != null && sd.groupIndex === slot.groupIndex) || sd.slotIndex === slot.slotIndex
      );
      let customTitle = (defSlot?.groupName || '').trim();
      customTitle = this.cleanHours(customTitle);
      if (/^\d+η\s*Θέση$/i.test(customTitle) || /^Θέση\s*#?\d+$/i.test(customTitle)) {
        customTitle = '';
      }
      if (customTitle && slot.groupIndex == null) {
        key = `${customTitle}|${key}`;
      }

      let group = map.get(key);
      if (!group) {
        const cleanHoursStr = this.cleanHours(slot.hoursNote || '');
        group = {
          key,
          groupTitle: customTitle || undefined,
          hoursNote: cleanHoursStr,
          intervals: slot.intervals ? [...slot.intervals] : undefined,
          peopleCount: 0,
          assignedCount: 0,
          slotIndices: [],
          persons: []
        };
        map.set(key, group);
        groups.push(group);
      }

      group.peopleCount++;
      if (slot.personId) {
        group.assignedCount++;
      }
      group.slotIndices.push(slot.slotIndex);
      group.persons.push({
        slotIndex: slot.slotIndex,
        personId: slot.personId,
        personName: slot.personName,
        rankShort: slot.rankShort,
        company: slot.company,
        conflictWarning: slot.conflictWarning,
        conflictSeverity: slot.conflictSeverity
      });
    }

    return groups;
  }

  formatShiftHours(group: GroupedDutySlot): string {
    if (group.intervals && group.intervals.length > 0) {
      return group.intervals.map(i => `${i.from} - ${i.to}`).join(' • ');
    }
    if (group.hoursNote) {
      return group.hoursNote.split(/&|,/).map(h => this.cleanHours(h.trim())).filter(Boolean).join(' • ');
    }
    return '24ωρο';
  }

  private cleanHours(text: string): string {
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
}
