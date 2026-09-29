import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SoldierRecord, SoldierRecordType, Personnel, formatGreekDate, formatLocalDate, normalizeGreek, toGreekCaps } from '../../models/shift.model';

@Component({
  selector: 'app-requests-penalties',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './requests-penalties.html',
  styleUrl: './requests-penalties.css'
})
export class RequestsPenaltiesComponent {
  storage = inject(StorageService);

  readonly formatGreekDate = formatGreekDate;
  readonly todayStr = formatLocalDate(new Date());

  selectedTab = signal<'ALL' | 'REQUESTS' | 'PENALTIES'>('ALL');
  searchQuery = signal<string>('');
  dateFilter = signal<string>('');

  // Modal State
  isModalOpen = signal<boolean>(false);
  editingRecordId = signal<string | null>(null);

  // Soldier combobox selector state
  personSearchQuery = signal<string>('');
  isPersonDropdownOpen = signal<boolean>(false);

  formModel: {
    type: SoldierRecordType;
    personId: string;
    personName: string;
    date: string;
    reason: string;
    notes: string;
    status: 'Εκκρεμεί' | 'Εγκρίθηκε' | 'Απορρίφθηκε' | 'Ολοκληρώθηκε';
  } = {
    type: 'ΑΙΤΗΜΑ',
    personId: '',
    personName: '',
    date: formatLocalDate(new Date()),
    reason: '',
    notes: '',
    status: 'Εκκρεμεί'
  };

  readonly activePersonnel = this.storage.activePersonnel;
  readonly soldierRecords = this.storage.soldierRecords;

  // Filtered personnel for combobox
  readonly filteredPersonnel = computed(() => {
    const list = this.activePersonnel();
    const query = normalizeGreek(this.personSearchQuery().trim());
    if (!query) return list;

    return list.filter(p =>
      normalizeGreek(p.fullName).includes(query) ||
      normalizeGreek(p.rankShort).includes(query) ||
      (p.rank && normalizeGreek(p.rank).includes(query)) ||
      (p.asm && normalizeGreek(p.asm).includes(query)) ||
      (p.specialty && normalizeGreek(p.specialty).includes(query))
    );
  });

  // Filtered records
  readonly filteredRecords = computed(() => {
    const list = this.soldierRecords();
    const tab = this.selectedTab();
    const query = normalizeGreek(this.searchQuery().trim());
    const date = this.dateFilter();

    return list.filter(r => {
      // Tab filter
      if (tab === 'REQUESTS' && r.type !== 'ΑΙΤΗΜΑ') return false;
      if (tab === 'PENALTIES' && r.type !== 'ΠΟΙΝΗ') return false;

      // Date filter
      if (date && r.date !== date) return false;

      // Query filter
      if (query) {
        const matchesName = normalizeGreek(r.personName).includes(query);
        const matchesReason = normalizeGreek(r.reason).includes(query);
        const matchesNotes = r.notes ? normalizeGreek(r.notes).includes(query) : false;
        const matchesType = normalizeGreek(r.type).includes(query);
        if (!matchesName && !matchesReason && !matchesNotes && !matchesType) {
          return false;
        }
      }

      return true;
    });
  });

  // Statistics
  readonly stats = computed(() => {
    const all = this.soldierRecords();
    const today = this.todayStr;
    return {
      total: all.length,
      requests: all.filter(r => r.type === 'ΑΙΤΗΜΑ').length,
      penalties: all.filter(r => r.type === 'ΠΟΙΝΗ').length,
      todayCount: all.filter(r => r.date === today).length
    };
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

  openAddModal(type: SoldierRecordType = 'ΑΙΤΗΜΑ') {
    this.editingRecordId.set(null);
    const firstPerson = this.activePersonnel()[0];
    const today = formatLocalDate(new Date());

    this.formModel = {
      type,
      personId: firstPerson ? firstPerson.id : '',
      personName: firstPerson ? `${firstPerson.rankShort} ${firstPerson.fullName}` : '',
      date: today,
      reason: '',
      notes: '',
      status: 'Εκκρεμεί'
    };
    this.personSearchQuery.set(firstPerson ? `${firstPerson.rankShort} ${firstPerson.fullName}` : '');
    this.isPersonDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }

  openEditModal(r: SoldierRecord) {
    this.editingRecordId.set(r.id);
    this.formModel = {
      type: r.type,
      personId: r.personId,
      personName: r.personName,
      date: r.date,
      reason: r.reason,
      notes: r.notes || '',
      status: r.status || 'Εκκρεμεί'
    };
    this.personSearchQuery.set(r.personName);
    this.isPersonDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingRecordId.set(null);
    this.isPersonDropdownOpen.set(false);
  }

  saveRecord() {
    if (!this.formModel.personId) {
      const matches = this.filteredPersonnel();
      if (matches.length === 1) {
        this.selectPerson(matches[0]);
      } else {
        this.storage.notify('Παρακαλώ επιλέξτε στρατιώτη από τη λίστα.', 'warning');
        return;
      }
    }

    if (!this.formModel.reason.trim()) {
      this.storage.notify('Παρακαλώ συμπληρώστε την αιτιολογία.', 'warning');
      return;
    }

    if (this.editingRecordId()) {
      this.storage.updateSoldierRecord(this.editingRecordId()!, this.formModel);
    } else {
      this.storage.addSoldierRecord(this.formModel);
    }

    this.closeModal();
  }

  deleteRecord(r: SoldierRecord) {
    const typeLabel = r.type === 'ΑΙΤΗΜΑ' ? 'του αιτήματος' : 'της ποινής';
    if (confirm(`Επιβεβαίωση διαγραφής ${typeLabel} για τον ${r.personName};`)) {
      this.storage.deleteSoldierRecord(r.id);
    }
  }

  setDateFilterToday() {
    this.dateFilter.set(this.todayStr);
  }

  clearDateFilter() {
    this.dateFilter.set('');
  }
}
