import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SchedulerService } from '../../services/scheduler.service';
import { Personnel, WeekendPlan, WeekendPreference, formatGreekDate } from '../../models/shift.model';

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

  // Preferences modal state
  isPreferencesModalOpen = signal<boolean>(false);
  prefFilter = signal<'ALL' | 'SAT' | 'SUN' | 'NONE'>('ALL');
  prefSearchQuery = signal<string>('');

  // Active personnel & leaves
  readonly activePersonnel = this.storage.activePersonnel;
  readonly leaves = this.storage.leaves;

  // Filtered personnel for preferences modal
  readonly filteredPersonnelForPreferences = computed(() => {
    const filter = this.prefFilter();
    const q = this.prefSearchQuery().trim().toLowerCase();
    return this.activePersonnel().filter(p => {
      if (filter === 'SAT' && p.weekendPreference !== 'Σάββατο') return false;
      if (filter === 'SUN' && p.weekendPreference !== 'Κυριακή') return false;
      if (filter === 'NONE' && p.weekendPreference && p.weekendPreference !== 'Χωρίς προτίμηση') return false;
      if (!q) return true;
      return p.fullName.toLowerCase().includes(q) || (p.specialty && p.specialty.toLowerCase().includes(q));
    });
  });

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

  // Personnel with active penalties during this weekend
  readonly soldiersWithPenalties = computed(() => {
    const dates = this.weekendDates();
    const result = new Map<string, { sat: boolean; sun: boolean; label: string }>();

    for (const p of this.activePersonnel()) {
      const activeSat = this.storage.getActivePenaltiesForPerson(p.id, dates.saturday);
      const activeSun = this.storage.getActivePenaltiesForPerson(p.id, dates.sunday);
      if (activeSat.length > 0 || activeSun.length > 0) {
        const pen = (activeSat[0] || activeSun[0]);
        const prog = this.storage.calculatePenaltyProgress(pen, dates.friday);
        result.set(p.id, {
          sat: activeSat.length > 0,
          sun: activeSun.length > 0,
          label: `${pen.penaltyType || 'ΣΤ ΕΞΟΔΟΥ'} (${prog.servedDays}/${prog.totalDays})`
        });
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
    const dates = this.weekendDates();
    const personnel = this.activePersonnel().filter(p => !p.exemptFromAllDuties);
    const sat: string[] = [];
    const sun: string[] = [];
    const balanced: string[] = [];

    personnel.forEach(p => {
      const penSat = this.storage.hasActivePenaltyOnDate(p.id, dates.saturday);
      const penSun = this.storage.hasActivePenaltyOnDate(p.id, dates.sunday);
      if (penSat && penSun) {
        // Active penalty on both days: cannot be given pass on either day
        return;
      }
      if (penSat) {
        sun.push(p.id); // Blocked Sat, can go Sun
      } else if (penSun) {
        sat.push(p.id); // Blocked Sun, can go Sat
      } else {
        balanced.push(p.id);
      }
    });

    balanced.forEach(id => {
      if (sat.length <= sun.length) {
        sat.push(id);
      } else {
        sun.push(id);
      }
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
    const dates = this.weekendDates();
    if (targetGroup === 'SAT' && this.storage.hasActivePenaltyOnDate(personId, dates.saturday)) {
      this.storage.notify('Προσοχή: Ο στρατιώτης έχει ενεργή ποινή (ΣΤ ΕΞΟΔΟΥ) το Σάββατο.', 'warning');
    } else if (targetGroup === 'SUN' && this.storage.hasActivePenaltyOnDate(personId, dates.sunday)) {
      this.storage.notify('Προσοχή: Ο στρατιώτης έχει ενεργή ποινή (ΣΤ ΕΞΟΔΟΥ) την Κυριακή.', 'warning');
    }

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

  // --- Duties & Preference Presets ---
  deriveFromDuties() {
    const plan = this.scheduler.deriveWeekendPlanForFriday(this.selectedFriday());
    this.satOffIds.set([...plan.saturdayOffIds]);
    this.sunOffIds.set([...plan.sundayOffIds]);
    this.inCampIds.set([]);
    this.storage.notify('Η κατανομή εξοδούχων υπολογίστηκε αυτόματα βάσει των υπηρεσιών του Σ/Κ!', 'success');
  }

  applyPreferencesPreset() {
    const dates = this.weekendDates();
    const personnel = this.activePersonnel().filter(p => !p.exemptFromAllDuties);
    const sat: string[] = [];
    const sun: string[] = [];
    const noPref: string[] = [];

    personnel.forEach(p => {
      const penSat = this.storage.hasActivePenaltyOnDate(p.id, dates.saturday);
      const penSun = this.storage.hasActivePenaltyOnDate(p.id, dates.sunday);
      if (penSat && penSun) {
        return; // Stays in camp on both days
      }

      if (penSat) {
        sun.push(p.id);
        return;
      }
      if (penSun) {
        sat.push(p.id);
        return;
      }

      if (p.weekendPreference === 'Σάββατο') {
        sat.push(p.id);
      } else if (p.weekendPreference === 'Κυριακή') {
        sun.push(p.id);
      } else {
        noPref.push(p.id);
      }
    });

    // Balance remaining personnel
    noPref.forEach(id => {
      if (sat.length <= sun.length) {
        sat.push(id);
      } else {
        sun.push(id);
      }
    });

    this.satOffIds.set(sat);
    this.sunOffIds.set(sun);
    this.inCampIds.set([]);
    this.persistPlan(false);
    this.storage.notify('Εφαρμόστηκαν οι δηλωμένες προτιμήσεις του προσωπικού!', 'success');
  }

  // --- Preferences Modal Controls ---
  openPreferencesModal() {
    this.isPreferencesModalOpen.set(true);
  }

  closePreferencesModal() {
    this.isPreferencesModalOpen.set(false);
  }

  setSoldierPreference(personId: string, pref: WeekendPreference) {
    this.storage.updatePersonnelPreference(personId, pref);
  }

  cycleSoldierPreference(p: Personnel, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const current = p.weekendPreference || 'Χωρίς προτίμηση';
    let next: WeekendPreference = 'Χωρίς προτίμηση';
    if (current === 'Χωρίς προτίμηση') next = 'Σάββατο';
    else if (current === 'Σάββατο') next = 'Κυριακή';
    else if (current === 'Κυριακή') next = 'Χωρίς προτίμηση';

    this.storage.updatePersonnelPreference(p.id, next);
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
