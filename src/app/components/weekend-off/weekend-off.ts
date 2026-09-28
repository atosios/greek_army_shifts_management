import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SchedulerService } from '../../services/scheduler.service';
import { Personnel, WeekendPlan, formatGreekDate } from '../../models/shift.model';

@Component({
  selector: 'app-weekend-off',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './weekend-off.html',
  styleUrl: './weekend-off.css'
})
export class WeekendOffComponent {
  storage = inject(StorageService);
  scheduler = inject(SchedulerService);
  router = inject(Router);

  readonly formatGreekDate = formatGreekDate;

  private toLocalDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDefaultWeekendFriday(): string {
    const d = new Date();
    const day = d.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    let friOffset = 0;
    if (day === 5) friOffset = 0;
    else if (day === 6) friOffset = -1;
    else if (day === 0) friOffset = -2;
    else friOffset = 5 - day;

    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + friOffset);
    return this.toLocalDateString(target);
  }

  // Selected weekend's Friday date (YYYY-MM-DD)
  selectedFriday = signal<string>(this.getDefaultWeekendFriday());

  // Group IDs
  satOffIds = signal<string[]>([]);
  sunOffIds = signal<string[]>([]);
  inCampIds = signal<string[]>([]);

  // Search filter
  searchQuery = signal<string>('');

  // Active personnel & leaves
  readonly activePersonnel = this.storage.activePersonnel;
  readonly leaves = this.storage.leaves;

  // Computed weekend dates
  readonly weekendDates = computed(() => {
    return this.scheduler.getWeekendDates(this.selectedFriday());
  });

  // Previous weekend plan
  readonly previousWeekendPlan = computed(() => {
    return this.storage.getPreviousWeekendPlan(this.weekendDates().friday);
  });

  // Personnel on leave during this weekend
  readonly soldiersOnLeave = computed(() => {
    const dates = this.weekendDates();
    const leavesList = this.leaves();
    const result = new Map<string, string>(); // personId -> leave note

    for (const l of leavesList) {
      if (l.status === 'Ακυρωμένη') continue;
      if ((l.startDate <= dates.friday && dates.friday <= l.endDate) ||
          (l.startDate <= dates.saturday && dates.saturday <= l.endDate) ||
          (l.startDate <= dates.sunday && dates.sunday <= l.endDate)) {
        result.set(l.personId, `${l.type}`);
      }
    }
    return result;
  });

  // Populated soldier objects for Saturday Off
  readonly satOffSoldiers = computed(() => {
    const ids = new Set(this.satOffIds());
    const q = this.searchQuery().trim().toLowerCase();
    return this.activePersonnel().filter(p => {
      if (!ids.has(p.id)) return false;
      if (!q) return true;
      return p.fullName.toLowerCase().includes(q) || (p.specialty && p.specialty.toLowerCase().includes(q));
    });
  });

  // Populated soldier objects for Sunday Off
  readonly sunOffSoldiers = computed(() => {
    const ids = new Set(this.sunOffIds());
    const q = this.searchQuery().trim().toLowerCase();
    return this.activePersonnel().filter(p => {
      if (!ids.has(p.id)) return false;
      if (!q) return true;
      return p.fullName.toLowerCase().includes(q) || (p.specialty && p.specialty.toLowerCase().includes(q));
    });
  });

  // Populated soldier objects for Unassigned (not yet assigned to Saturday or Sunday)
  readonly unassignedSoldiers = computed(() => {
    const sat = new Set(this.satOffIds());
    const sun = new Set(this.sunOffIds());
    const q = this.searchQuery().trim().toLowerCase();
    return this.activePersonnel().filter(p => {
      if (sat.has(p.id) || sun.has(p.id)) return false;
      if (!q) return true;
      return p.fullName.toLowerCase().includes(q) || (p.specialty && p.specialty.toLowerCase().includes(q));
    });
  });

  constructor() {
    this.loadWeekendPlan();
  }

  navigateWeekend(deltaWeeks: number) {
    const parts = this.selectedFriday().split('-').map(Number);
    const current = new Date(parts[0], parts[1] - 1, parts[2] + (deltaWeeks * 7));
    this.selectedFriday.set(this.toLocalDateString(current));
    this.loadWeekendPlan();
  }

  setUpcomingWeekend() {
    this.selectedFriday.set(this.getDefaultWeekendFriday());
    this.loadWeekendPlan();
  }

  loadWeekendPlan() {
    const friday = this.weekendDates().friday;
    if (this.selectedFriday() !== friday) {
      this.selectedFriday.set(friday);
    }
    const existing = this.storage.getWeekendPlan(friday);

    if (existing) {
      this.satOffIds.set([...existing.saturdayOffIds]);
      this.sunOffIds.set([...existing.sundayOffIds]);
      this.inCampIds.set([]);
      return;
    }

    // Auto-rotation from previous week
    const prevPlan = this.storage.getPreviousWeekendPlan(friday);
    if (prevPlan && (prevPlan.saturdayOffIds.length > 0 || prevPlan.sundayOffIds.length > 0)) {
      // Invert: Last week's Saturday group becomes this week's Sunday group, and vice versa
      const newSat = [...prevPlan.sundayOffIds];
      const newSun = [...prevPlan.saturdayOffIds];
      this.satOffIds.set(newSat);
      this.sunOffIds.set(newSun);
      this.inCampIds.set([]);
      this.storage.notify('Εφαρμόστηκε αυτόματη αντιστροφή από το προηγούμενο Σ/Κ (οι εξοδούχοι Σαββάτου έγιναν Κυριακής και αντίστροφα).', 'info');
      this.persistPlan(false);
      return;
    }

    // Default half-half allocation if no previous plan exists
    this.applyBalancedPreset(true);
  }

  // --- Presets ---
  applyBalancedPreset(save = true) {
    const personnel = this.activePersonnel().filter(p => !p.exemptFromAllDuties);
    const sat: string[] = [];
    const sun: string[] = [];

    personnel.forEach((p, idx) => {
      if (idx % 2 === 0) sat.push(p.id);
      else sun.push(p.id);
    });

    this.satOffIds.set(sat);
    this.sunOffIds.set(sun);
    this.inCampIds.set([]);
    if (save) {
      this.persistPlan(false);
    }
  }

  invertCurrentGroups() {
    const temp = this.satOffIds();
    this.satOffIds.set(this.sunOffIds());
    this.sunOffIds.set(temp);
    this.persistPlan(false);
    this.storage.notify('Έγινε αντιστροφή των ομάδων Σαββάτου και Κυριακής.', 'info');
  }

  clearGroup(group: 'SAT' | 'SUN') {
    if (group === 'SAT') {
      this.satOffIds.set([]);
      this.persistPlan(false);
      this.storage.notify('Έγινε εκκαθάριση των εξοδούχων Σαββάτου.', 'info');
    } else {
      this.sunOffIds.set([]);
      this.persistPlan(false);
      this.storage.notify('Έγινε εκκαθάριση των εξοδούχων Κυριακής.', 'info');
    }
  }

  // --- Manual Movement ---
  moveToGroup(personId: string, targetGroup: 'SAT' | 'SUN' | 'UNASSIGNED') {
    const sat = new Set(this.satOffIds());
    const sun = new Set(this.sunOffIds());

    sat.delete(personId);
    sun.delete(personId);

    if (targetGroup === 'SAT') sat.add(personId);
    else if (targetGroup === 'SUN') sun.add(personId);

    this.satOffIds.set(Array.from(sat));
    this.sunOffIds.set(Array.from(sun));
    this.persistPlan(false);
  }

  // --- Persistence ---
  persistPlan(showNotification = false) {
    const dates = this.weekendDates();
    const plan: WeekendPlan = {
      fridayDate: dates.friday,
      saturdayDate: dates.saturday,
      sundayDate: dates.sunday,
      saturdayOffIds: this.satOffIds(),
      sundayOffIds: this.sunOffIds(),
      inCampIds: [],
      updatedAt: new Date().toISOString()
    };

    this.storage.saveWeekendPlan(plan, showNotification);
  }

  saveWeekendPlan() {
    this.persistPlan(true);
  }
}
