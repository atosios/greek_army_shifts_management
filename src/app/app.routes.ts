import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { PersonnelComponent } from './components/personnel/personnel';
import { LeavesComponent } from './components/leaves/leaves';
import { DutyTypesComponent } from './components/duty-types/duty-types';
import { ShiftSchedulerComponent } from './components/shift-scheduler/shift-scheduler';
import { CalendarComponent } from './components/calendar/calendar';
import { WeekendOffComponent } from './components/weekend-off/weekend-off';
import { PrintViewComponent } from './components/print-view/print-view';
import { SettingsComponent } from './components/settings/settings';

export const routes: Routes = [
  { path: '', component: DashboardComponent, title: 'Ταμπλό Μονάδας - Διαχείριση Υπηρεσιών' },
  { path: 'personnel', component: PersonnelComponent, title: 'Δύναμη' },
  { path: 'leaves', component: LeavesComponent, title: 'Άδειες & Απαλλαγές' },
  { path: 'duty-types', component: DutyTypesComponent, title: 'Υπηρεσίες & Πόστα' },
  { path: 'scheduler', component: ShiftSchedulerComponent, title: 'Έκδοση Υπηρεσιών & Πρόγραμμα' },
  { path: 'calendar', component: CalendarComponent, title: 'Ημερολόγιο Υπηρεσιών' },
  { path: 'weekend-off', component: WeekendOffComponent, title: 'Εξοδούχοι Σ/Κ' },
  { path: 'print/:date', component: PrintViewComponent, title: 'Εκτύπωση Διαταγής' },
  { path: 'settings', component: SettingsComponent, title: 'Ρυθμίσεις Μονάδας & USB' },
  { path: '**', redirectTo: '' }
];
