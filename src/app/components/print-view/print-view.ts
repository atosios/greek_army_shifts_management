import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { DailySchedule, Personnel, ShiftSlotAssignment, formatGreekDate } from '../../models/shift.model';

@Component({
  selector: 'app-print-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './print-view.html',
  styleUrl: './print-view.css'
})
export class PrintViewComponent {
  storage = inject(StorageService);
  excelService = inject(ExcelExportService);
  route = inject(ActivatedRoute);

  readonly formatGreekDate = formatGreekDate;
  date = signal<string>(new Date().toISOString().slice(0, 10));
  schedule = signal<DailySchedule | null>(null);

  readonly unit = this.storage.unitInfo;

  readonly printableSlots = computed(() => {
    const s = this.schedule();
    if (!s) return [];
    const result: { index: number; dutyName: string; person: Personnel | undefined; slot: ShiftSlotAssignment }[] = [];
    let idx = 1;
    for (const duty of s.duties) {
      for (const slot of duty.slots) {
        result.push({
          index: idx++,
          dutyName: duty.dutyName,
          person: this.getPerson(slot.personId),
          slot
        });
      }
    }
    return result;
  });

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
    } else {
      this.storage.notify(`Δεν βρέθηκε αποθηκευμένη διαταγή για την ημερομηνία ${dateStr}.`, 'warning');
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
      this.excelService.exportScheduleToExcel(s);
    }
  }
}
