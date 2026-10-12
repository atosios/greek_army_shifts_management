import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SchedulerService } from '../../services/scheduler.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { 
  DailyExodouchoiPlan, 
  DailyExodouchoiSoldier, 
  formatGreekDate, 
  formatLocalDate, 
  toGreekCaps 
} from '../../models/shift.model';

@Component({
  selector: 'app-daily-exodouchoi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './daily-exodouchoi.html',
  styleUrl: './daily-exodouchoi.css'
})
export class DailyExodouchoiComponent {
  storage = inject(StorageService);
  scheduler = inject(SchedulerService);
  excelExport = inject(ExcelExportService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  readonly formatGreekDate = formatGreekDate;

  // Selected date string (YYYY-MM-DD)
  selectedDate = signal<string>(formatLocalDate(new Date()));

  // Active filter: 'ALL' | 'GOING_OUT' | 'IN_CAMP' | 'LEAVE_PENALTY'
  activeFilter = signal<'ALL' | 'GOING_OUT' | 'IN_CAMP' | 'LEAVE_PENALTY'>('ALL');

  // Search filter
  searchQuery = signal<string>('');

  // Current Exodouchoi plan for the selected date
  currentPlan = signal<DailyExodouchoiPlan | null>(null);

  // Unsaved changes tracking
  hasUnsavedChanges = signal<boolean>(false);

  // Day metadata computed
  readonly dayInfo = computed(() => {
    const dStr = this.selectedDate();
    const parts = dStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isWeekend = day === 0 || day === 6;
    const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
    return {
      dayName: dayNames[day],
      isWeekend,
      dayIndex: day
    };
  });

  // Schedule exists for selected date
  readonly hasScheduleForDate = computed(() => {
    return !!this.storage.getScheduleForDate(this.selectedDate());
  });

  // Filtered soldiers list
  readonly displayedSoldiers = computed(() => {
    const plan = this.currentPlan();
    if (!plan || !plan.soldiers) return [];

    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.activeFilter();

    return plan.soldiers.filter(s => {
      // 1. Status Filter
      if (filter === 'GOING_OUT' && !s.isGoingOut) return false;
      if (filter === 'IN_CAMP' && (s.isGoingOut || s.isOnLeaveTonight || s.hasPenaltyTonight)) return false;
      if (filter === 'LEAVE_PENALTY' && (!s.isOnLeaveTonight && !s.hasPenaltyTonight)) return false;

      // 2. Text Search
      if (!q) return true;
      const matchName = s.fullName.toLowerCase().includes(q);
      const matchAsm = s.asm.toLowerCase().includes(q);
      const matchSpec = s.specialty.toLowerCase().includes(q);
      const matchDuty = s.dutyStatusText.toLowerCase().includes(q);
      const matchRoom = (s.barracksRoom || '').toLowerCase().includes(q);
      const matchNotes = (s.notes || '').toLowerCase().includes(q);

      return matchName || matchAsm || matchSpec || matchDuty || matchRoom || matchNotes;
    });
  });

  // Summary statistics
  readonly stats = computed(() => {
    const plan = this.currentPlan();
    if (!plan || !plan.soldiers) {
      return { total: 0, goingOut: 0, inCamp: 0, onLeave: 0, penalties: 0, manual: 0 };
    }
    const soldiers = plan.soldiers;
    const total = soldiers.length;
    const goingOut = soldiers.filter(s => s.isGoingOut).length;
    const onLeave = soldiers.filter(s => s.isOnLeaveTonight).length;
    const penalties = soldiers.filter(s => s.hasPenaltyTonight).length;
    const inCamp = soldiers.filter(s => !s.isGoingOut && !s.isOnLeaveTonight && !s.hasPenaltyTonight).length;
    const manual = soldiers.filter(s => s.manualOverride).length;

    return { total, goingOut, inCamp, onLeave, penalties, manual };
  });

  constructor() {
    // Check query params for initial date
    this.route.queryParams.subscribe(params => {
      if (params['date'] && /^\d{4}-\d{2}-\d{2}$/.test(params['date'])) {
        this.selectedDate.set(params['date']);
      }
      this.loadOrGeneratePlan(false);
    });
  }

  onDateInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate.set(input.value);
      this.loadOrGeneratePlan(false);
    }
  }

  navigateDay(deltaDays: number) {
    const parts = this.selectedDate().split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
    this.selectedDate.set(formatLocalDate(d));
    this.loadOrGeneratePlan(false);
  }

  setToday() {
    this.selectedDate.set(formatLocalDate(new Date()));
    this.loadOrGeneratePlan(false);
  }

  /**
   * Loads existing saved plan from storage or generates fresh based on shift sheet and rules.
   */
  loadOrGeneratePlan(forceRecalculate = false) {
    const dateStr = this.selectedDate();
    const storedPlan = this.storage.getDailyExodouchoiPlan(dateStr);

    if (storedPlan && !forceRecalculate) {
      // Use existing saved plan (clone to allow edits)
      this.currentPlan.set(JSON.parse(JSON.stringify(storedPlan)));
      this.hasUnsavedChanges.set(false);
    } else {
      // Generate fresh using scheduler rules and merge any existing manual overrides if not forcing complete reset
      const newPlan = this.scheduler.generateDailyExodouchoiPlan(
        dateStr, 
        forceRecalculate ? undefined : storedPlan
      );
      this.currentPlan.set(newPlan);
      // If no stored plan existed, auto-save the generated plan so it's readily accessible
      if (!storedPlan) {
        this.storage.saveDailyExodouchoiPlan(newPlan, false);
      }
      this.hasUnsavedChanges.set(false);
    }
  }

  /**
   * Complete recalculation from shift schedule and rules (resets manual changes).
   */
  recalculateFromRules() {
    const plan = this.scheduler.generateDailyExodouchoiPlan(this.selectedDate(), undefined);
    this.currentPlan.set(plan);
    this.hasUnsavedChanges.set(true);
    this.storage.notify('Έγινε επαναϋπολογισμός εξοδούχων σύμφωνα με τις υπηρεσίες και τους κανόνες.', 'info');
  }

  /**
   * Toggles whether a soldier is going out or staying in camp.
   */
  toggleGoingOut(soldier: DailyExodouchoiSoldier) {
    const plan = this.currentPlan();
    if (!plan) return;

    soldier.isGoingOut = !soldier.isGoingOut;
    soldier.manualOverride = true;
    this.hasUnsavedChanges.set(true);

    if (soldier.isGoingOut && soldier.hasPenaltyTonight) {
      this.storage.notify(`Προσοχή: Ο ${soldier.fullName} έχει ενεργή ποινή. Εφόσον εξέλθει, η ημέρα αυτή ΔΕΝ θα προσμετρηθεί ως εκτιθείσα ημέρα ποινής!`, 'warning');
    }

    // Auto persist to avoid accidental loss
    this.persistCurrentPlan(false);
  }

  /**
   * Set pass status for all soldiers currently displayed.
   */
  setAllDisplayed(goingOut: boolean) {
    const displayed = this.displayedSoldiers();
    if (displayed.length === 0) return;

    let updatedCount = 0;
    displayed.forEach(s => {
      // Protect soldiers with active leave or penalties from bulk exit
      if (goingOut && (s.isOnLeaveTonight || s.hasPenaltyTonight)) {
        return;
      }
      s.isGoingOut = goingOut;
      s.manualOverride = true;
      updatedCount++;
    });

    this.hasUnsavedChanges.set(true);
    this.persistCurrentPlan(false);
    this.storage.notify(`Ενημερώθηκαν ${updatedCount} στρατιώτες ως ${goingOut ? 'Εξοδούχοι' : 'Μέσα'}.`, 'info');
  }

  /**
   * Reset a single soldier back to their calculated status.
   */
  resetSoldier(soldier: DailyExodouchoiSoldier) {
    const freshPlan = this.scheduler.generateDailyExodouchoiPlan(this.selectedDate(), undefined);
    const fresh = freshPlan.soldiers.find(s => s.personId === soldier.personId);
    if (fresh) {
      soldier.isGoingOut = fresh.isGoingOut;
      soldier.dutyStatusText = fresh.dutyStatusText;
      soldier.hasDutyTonight = fresh.hasDutyTonight;
      soldier.isOnLeaveTonight = fresh.isOnLeaveTonight;
      soldier.hasPenaltyTonight = fresh.hasPenaltyTonight;
      soldier.manualOverride = false;
      this.hasUnsavedChanges.set(true);
      this.persistCurrentPlan(false);
      this.storage.notify(`Επαναφορά κατάστασης για τον ${soldier.fullName}.`, 'info');
    }
  }

  /**
   * Update remarks / notes for a soldier.
   */
  onNotesChange(soldier: DailyExodouchoiSoldier, newNotes: string) {
    soldier.notes = newNotes;
    this.hasUnsavedChanges.set(true);
    this.persistCurrentPlan(false);
  }

  /**
   * Saves the current plan to disk/storage.
   */
  persistCurrentPlan(showNotification = true) {
    const plan = this.currentPlan();
    if (!plan) return;

    plan.updatedAt = new Date().toISOString();
    this.storage.saveDailyExodouchoiPlan(plan, showNotification);
    this.hasUnsavedChanges.set(false);
  }

  savePlan() {
    this.persistCurrentPlan(true);
  }

  /**
   * Export to CSV.
   */
  async exportCsv(onlyGoingOut = false) {
    const plan = this.currentPlan();
    if (!plan) {
      this.storage.notify('Δεν υπάρχουν δεδομένα προς εξαγωγή.', 'warning');
      return;
    }
    // Ensure changes are saved
    this.persistCurrentPlan(false);
    await this.excelExport.exportExodouchoiToCsv(plan, onlyGoingOut);
  }

  /**
   * Export to Excel (.xlsx).
   */
  async exportExcel(onlyGoingOut = false) {
    const plan = this.currentPlan();
    if (!plan) {
      this.storage.notify('Δεν υπάρχουν δεδομένα προς εξαγωγή.', 'warning');
      return;
    }
    this.persistCurrentPlan(false);
    await this.excelExport.exportExodouchoiToExcel(plan, onlyGoingOut);
  }

  /**
   * Trigger print.
   */
  printList() {
    if (typeof window !== 'undefined' && window.electronAPI?.printWindow) {
      window.electronAPI.printWindow();
    } else {
      window.print();
    }
  }
}
