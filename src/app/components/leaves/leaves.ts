import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { Leave, LeaveType, Personnel, ALL_LEAVE_TYPES, getLeaveTypeMeta, normalizeGreek, toGreekCaps, formatGreekDate, formatLocalDate } from '../../models/shift.model';

@Component({
  selector: 'app-leaves',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leaves.html',
  styleUrl: './leaves.css'
})
export class LeavesComponent {
  storage = inject(StorageService);

  readonly formatGreekDate = formatGreekDate;
  readonly todayStr = formatLocalDate(new Date());

  readonly leaveTypes: LeaveType[] = ALL_LEAVE_TYPES;

  getTypeBadgeClass(type: LeaveType | string): string {
    return getLeaveTypeMeta(type).badgeClass;
  }

  getTypeCategoryLabel(type: LeaveType | string): string {
    return getLeaveTypeMeta(type).categoryLabel;
  }

  /** Convert name to CAPS without accents */
  caps(str: string): string {
    return toGreekCaps(str);
  }

  /** Auto-compute status from dates */
  computeStatus(l: Leave): string {
    const today = this.todayStr;
    if (l.endDate < today) return 'Ολοκληρωμένη';
    if (l.startDate <= today && today <= l.endDate) return 'Ενεργή';
    return 'Προσεχής';
  }

  selectedTab = signal<'ALL' | 'ACTIVE_TODAY' | 'UPCOMING' | 'PAST'>('ACTIVE_TODAY');
  searchQuery = signal<string>('');

  // Modal state
  isModalOpen = signal<boolean>(false);
  editingLeaveId = signal<string | null>(null);

  // Person search combobox state
  personSearchQuery = signal<string>('');
  isPersonDropdownOpen = signal<boolean>(false);

  formModel = {
    personId: '',
    personName: '',
    type: 'Ελεύθερος Υπηρεσίας (ΕΥ)' as LeaveType,
    startDate: formatLocalDate(new Date()),
    endDate: formatLocalDate(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)),
    reason: '',
    status: 'Ενεργή' as 'Ενεργή' | 'Ολοκληρωμένη' | 'Ακυρωμένη'
  };

  readonly activePersonnel = this.storage.activePersonnel;

  // Filtered personnel for combobox (accent+case insensitive)
  readonly filteredPersonnel = computed(() => {
    const list = this.activePersonnel();
    const query = normalizeGreek(this.personSearchQuery().trim());
    if (!query) return list;

    return list.filter(p => 
      normalizeGreek(p.fullName).includes(query) ||
      normalizeGreek(p.rankShort).includes(query) ||
      (p.rank && normalizeGreek(p.rank).includes(query)) ||
      (p.company && normalizeGreek(p.company).includes(query)) ||
      (p.specialty && normalizeGreek(p.specialty).includes(query))
    );
  });

  openPersonDropdown() {
    this.isPersonDropdownOpen.set(true);
  }

  closePersonDropdown() {
    this.isPersonDropdownOpen.set(false);
  }

  togglePersonDropdown(event: Event) {
    event.stopPropagation();
    this.isPersonDropdownOpen.update(v => !v);
  }

  onPersonSearchInput(val: string) {
    this.personSearchQuery.set(val);
    this.isPersonDropdownOpen.set(true);
    const currentPerson = this.activePersonnel().find(p => p.id === this.formModel.personId);
    if (!currentPerson || normalizeGreek(`${currentPerson.rankShort} ${currentPerson.fullName}`) !== normalizeGreek(val)) {
      this.formModel.personId = '';
      this.formModel.personName = '';
    }
  }

  clearPersonSearch(event: Event) {
    event.stopPropagation();
    this.personSearchQuery.set('');
    this.formModel.personId = '';
    this.formModel.personName = '';
    this.isPersonDropdownOpen.set(true);
  }

  selectPerson(p: Personnel) {
    this.formModel.personId = p.id;
    this.formModel.personName = `${p.rankShort} ${p.fullName}`;
    this.personSearchQuery.set(`${p.rankShort} ${p.fullName}`);
    this.isPersonDropdownOpen.set(false);
  }

  // Filtered leaves (accent+case insensitive search)
  readonly filteredLeaves = computed(() => {
    const list = this.storage.leaves();
    const tab = this.selectedTab();
    const query = normalizeGreek(this.searchQuery().trim());
    const today = this.todayStr;

    return list.filter(l => {
      // Query search (accent+case insensitive)
      if (query && !normalizeGreek(l.personName).includes(query) && !normalizeGreek(l.type).includes(query)) {
        return false;
      }

      // Tab filter (auto-compute status from dates)
      const status = this.computeStatus(l);
      if (tab === 'ACTIVE_TODAY') {
        return status === 'Ενεργή';
      }
      if (tab === 'UPCOMING') {
        return status === 'Προσεχής';
      }
      if (tab === 'PAST') {
        return status === 'Ολοκληρωμένη';
      }

      return true;
    });
  });

  openAddModal() {
    this.editingLeaveId.set(null);
    const firstPerson = this.activePersonnel()[0];
    const today = formatLocalDate(new Date());
    const end = formatLocalDate(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000));

    this.formModel = {
      personId: firstPerson ? firstPerson.id : '',
      personName: firstPerson ? `${firstPerson.rankShort} ${firstPerson.fullName}` : '',
      type: 'Ελεύθερος Υπηρεσίας (ΕΥ)',
      startDate: today,
      endDate: end,
      reason: '',
      status: 'Ενεργή'
    };
    this.personSearchQuery.set(firstPerson ? `${firstPerson.rankShort} ${firstPerson.fullName}` : '');
    this.isPersonDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }

  openEditModal(l: Leave) {
    this.editingLeaveId.set(l.id);
    this.formModel = {
      personId: l.personId,
      personName: l.personName,
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason || '',
      status: l.status
    };
    this.personSearchQuery.set(l.personName);
    this.isPersonDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingLeaveId.set(null);
    this.isPersonDropdownOpen.set(false);
  }

  onPersonSelect(id: string) {
    this.formModel.personId = id;
    const p = this.activePersonnel().find(x => x.id === id);
    if (p) {
      this.formModel.personName = `${p.rankShort} ${p.fullName}`;
      this.personSearchQuery.set(`${p.rankShort} ${p.fullName}`);
    }
  }

  saveLeave() {
    if (!this.formModel.personId) {
      const matches = this.filteredPersonnel();
      if (matches.length === 1) {
        this.selectPerson(matches[0]);
      } else {
        this.storage.notify('Παρακαλώ επιλέξτε στρατιώτη/στέλεχος από τη λίστα.', 'warning');
        return;
      }
    }

    if (this.formModel.endDate < this.formModel.startDate) {
      this.storage.notify('Η ημερομηνία λήξης δεν μπορεί να είναι προγενέστερη της ημερομηνίας έναρξης.', 'error');
      return;
    }

    // Auto-compute status from dates
    const today = this.todayStr;
    if (this.formModel.endDate < today) {
      this.formModel.status = 'Ολοκληρωμένη';
    } else {
      this.formModel.status = 'Ενεργή';
    }

    if (this.editingLeaveId()) {
      this.storage.updateLeave(this.editingLeaveId()!, this.formModel);
    } else {
      this.storage.addLeave(this.formModel);
    }

    this.closeModal();
  }

  deleteLeave(l: Leave) {
    if (confirm(`Διαγραφή άδειας/απαλλαγής για ${l.personName};`)) {
      this.storage.deleteLeave(l.id);
    }
  }
}
