import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SchedulerService } from '../../services/scheduler.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { formatGreekDate } from '../../models/shift.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  storage = inject(StorageService);
  scheduler = inject(SchedulerService);
  excelService = inject(ExcelExportService);

  readonly formatGreekDate = formatGreekDate;
  readonly todayStr = new Date().toISOString().slice(0, 10);
  readonly tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  readonly unit = this.storage.unitInfo;
  readonly personnel = this.storage.personnel;
  readonly activePersonnel = this.storage.activePersonnel;
  readonly leaves = this.storage.leaves;
  readonly dutyTypes = this.storage.dutyTypes;

  // Compute today's active leaves
  readonly todayLeaves = computed(() => {
    const today = this.todayStr;
    return this.leaves().filter(l => 
      l.startDate <= today && today <= l.endDate && l.status !== 'Ακυρωμένη'
    );
  });

  // Compute today's schedule
  readonly todaySchedule = computed(() => {
    return this.storage.getScheduleForDate(this.todayStr);
  });

  // Tomorrow schedule
  readonly tomorrowSchedule = computed(() => {
    return this.storage.getScheduleForDate(this.tomorrowStr);
  });

  // Total soldiers on duty today
  readonly onDutyTodayCount = computed(() => {
    const sched = this.todaySchedule();
    if (!sched) return 0;
    let count = 0;
    for (const d of sched.duties) {
      for (const s of d.slots) {
        if (s.personId) count++;
      }
    }
    return count;
  });

  // Present today
  readonly presentCount = computed(() => {
    const total = this.activePersonnel().length;
    const onLeave = this.todayLeaves().length;
    return Math.max(0, total - onLeave);
  });

  // Off duty / Exodouchoi
  readonly offDutyCount = computed(() => {
    const present = this.presentCount();
    const onDuty = this.onDutyTodayCount();
    return Math.max(0, present - onDuty);
  });

  exportTodayExcel() {
    const sched = this.todaySchedule();
    if (sched) {
      this.excelService.exportScheduleToExcel(sched);
    } else {
      this.storage.notify('Δεν έχει δημιουργηθεί ακόμη πρόγραμμα για σήμερα. Μεταβείτε στην "Έκδοση Υπηρεσιών" για αυτόματη παραγωγή.', 'warning');
    }
  }

  createBackup() {
    this.storage.createBackup();
  }
}
