import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { SoldierRecord, SoldierRecordType, PenaltySubtype, Personnel, HigherPersonnel, formatGreekDate, formatLocalDate, formatRecordPersonName, normalizeGreek } from '../../models/shift.model';

@Component({
  selector: 'app-requests-penalties',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './requests-penalties.html',
  styleUrl: './requests-penalties.css'
})
export class RequestsPenaltiesComponent {
  storage = inject(StorageService);
  excelService = inject(ExcelExportService);

  readonly formatGreekDate = formatGreekDate;
  readonly formatRecordPersonName = formatRecordPersonName;
  readonly todayStr = formatLocalDate(new Date());

  selectedTab = signal<'ALL' | 'REQUESTS' | 'PENALTIES'>('ALL');
  searchQuery = signal<string>('');
  dateFilter = signal<string>('');
  filterTypes = signal<SoldierRecordType[]>([]);
  filterStatuses = signal<NonNullable<SoldierRecord['status']>[]>([]);
  filterDateFrom = signal<string>('');
  filterDateTo = signal<string>('');
  isFilterModalOpen = signal<boolean>(false);
  sortColumn = signal<'type' | 'date' | 'personName' | 'reason' | 'notes' | 'status'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  readonly recordStatuses: NonNullable<SoldierRecord['status']>[] = [
    'Εκκρεμεί', 'Εγκρίθηκε', 'Απορρίφθηκε', 'Ολοκληρώθηκε'
  ];

  readonly penaltyTypes: PenaltySubtype[] = ['ΣΤ ΕΞΟΔΟΥ', 'Κ', 'Φ', 'ΑΛΛΟ'];

  // Modal State
  isModalOpen = signal<boolean>(false);
  editingRecordId = signal<string | null>(null);

  // Copy text state
  copiedRecordKey = signal<string | null>(null);

  // Soldier combobox selector state
  personSearchQuery = signal<string>('');
  isPersonDropdownOpen = signal<boolean>(false);
  reasonAutocompleteContext = signal<{ start: number; end: number; query: string; pronoun: 'τον' | 'την' } | null>(null);
  reasonAutocompleteIndex = signal<number>(0);

  formModel: {
    type: SoldierRecordType;
    personId: string;
    personName: string;
    date: string;
    reason: string;
    notes: string;
    status: 'Εκκρεμεί' | 'Εγκρίθηκε' | 'Απορρίφθηκε' | 'Ολοκληρώθηκε';
    penaltyType: PenaltySubtype;
    totalDays: number | null;
    servedDays: number | null;
    isManualServedDays: boolean;
  } = {
    type: 'ΑΙΤΗΜΑ',
    personId: '',
    personName: '',
    date: formatLocalDate(new Date()),
    reason: '',
    notes: '',
    status: 'Εκκρεμεί',
    penaltyType: 'ΣΤ ΕΞΟΔΟΥ',
    totalDays: 3,
    servedDays: 0,
    isManualServedDays: false
  };

  readonly activePersonnel = this.storage.activePersonnel;
  readonly soldierRecords = this.storage.soldierRecords;
  readonly activeFilterCount = computed(() =>
    Number(this.selectedTab() !== 'ALL') +
    Number(!!this.searchQuery().trim()) +
    Number(!!this.dateFilter()) +
    Number(this.filterTypes().length > 0) +
    Number(this.filterStatuses().length > 0) +
    Number(!!this.filterDateFrom()) +
    Number(!!this.filterDateTo())
  );
  readonly higherPersonnelSuggestions = computed(() => {
    const context = this.reasonAutocompleteContext();
    if (!context) return [];

    const query = normalizeGreek(context.query);
    const compactQuery = query.replace(/\s/g, '');
    return this.storage.higherPersonnel().filter(person => {
      const searchable = normalizeGreek(`${person.rank} ${person.fullName} ${person.roleTitle}`);
      if (!query || searchable.includes(query)) return true;

      const compactRank = normalizeGreek(person.rank).replace(/[\s().-]/g, '');
      return compactQuery.length >= 3 && this.isSubsequence(compactQuery, compactRank);
    });
  });

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
    const types = this.filterTypes();
    const statuses = this.filterStatuses();
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();

    const filtered = list.filter(r => {
      // Tab filter
      if (tab === 'REQUESTS' && r.type !== 'ΑΙΤΗΜΑ') return false;
      if (tab === 'PENALTIES' && r.type !== 'ΠΟΙΝΗ') return false;
      if (types.length > 0 && !types.includes(r.type)) return false;

      const status = r.status || 'Εκκρεμεί';
      if (statuses.length > 0 && !statuses.includes(status)) return false;

      // Date filter
      if (date && r.date !== date) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;

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

    const column = this.sortColumn();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const valueA = this.getSortValue(a, column);
      const valueB = this.getSortValue(b, column);
      return valueA.localeCompare(valueB, 'el', { numeric: true }) * direction;
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

  private getSortValue(record: SoldierRecord, column: 'type' | 'date' | 'personName' | 'reason' | 'notes' | 'status'): string {
    switch (column) {
      case 'type': return normalizeGreek(record.type);
      case 'date': return record.date;
      case 'personName': return normalizeGreek(record.personName);
      case 'reason': return normalizeGreek(record.reason);
      case 'notes': return normalizeGreek(record.notes || '');
      case 'status': return normalizeGreek(record.status || 'Εκκρεμεί');
    }
  }

  toggleSort(column: 'type' | 'date' | 'personName' | 'reason' | 'notes' | 'status') {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.sortColumn.set(column);
    this.sortDirection.set(column === 'date' ? 'desc' : 'asc');
  }

  toggleTypeFilter(type: SoldierRecordType) {
    this.filterTypes.update(selected => selected.includes(type)
      ? selected.filter(item => item !== type)
      : [...selected, type]);
  }

  toggleStatusFilter(status: NonNullable<SoldierRecord['status']>) {
    this.filterStatuses.update(selected => selected.includes(status)
      ? selected.filter(item => item !== status)
      : [...selected, status]);
  }

  openFilterModal() {
    this.isFilterModalOpen.set(true);
  }

  closeFilterModal() {
    this.isFilterModalOpen.set(false);
  }

  resetAllFilters() {
    this.selectedTab.set('ALL');
    this.searchQuery.set('');
    this.dateFilter.set('');
    this.filterTypes.set([]);
    this.filterStatuses.set([]);
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
  }

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

  onReasonChange(value: string, input: HTMLTextAreaElement) {
    this.formModel.reason = value;
    this.updateReasonAutocomplete(input);
  }

  onReasonKeyup(event: KeyboardEvent, input: HTMLTextAreaElement) {
    if (event.key === 'Escape' || event.key === 'Enter') return;
    this.updateReasonAutocomplete(input);
  }

  closeReasonAutocomplete() {
    this.reasonAutocompleteContext.set(null);
  }

  updateReasonAutocomplete(input: HTMLTextAreaElement) {
    if (this.formModel.type !== 'ΠΟΙΝΗ') {
      this.reasonAutocompleteContext.set(null);
      return;
    }

    const caret = input.selectionStart;
    const beforeCaret = input.value.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\s)απ[όο]\s+(τον|την)\s+([^\n]*)$/i);
    if (!match) {
      this.reasonAutocompleteContext.set(null);
      return;
    }

    const pronoun = match[1].toLowerCase() as 'τον' | 'την';
    const query = match[2];
    const nextContext = { start: caret - query.length, end: caret, query, pronoun };
    const previousContext = this.reasonAutocompleteContext();
    if (!previousContext || previousContext.start !== nextContext.start || previousContext.query !== query || previousContext.pronoun !== pronoun) {
      this.reasonAutocompleteIndex.set(0);
    }
    this.reasonAutocompleteContext.set(nextContext);
  }

  onReasonKeydown(event: KeyboardEvent, input: HTMLTextAreaElement) {
    if (event.key === 'Escape') {
      this.reasonAutocompleteContext.set(null);
      return;
    }

    const suggestions = this.higherPersonnelSuggestions();
    if (!this.reasonAutocompleteContext() || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.reasonAutocompleteIndex.update(index => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.reasonAutocompleteIndex.update(index => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.selectHigherPersonnel(suggestions[this.reasonAutocompleteIndex()], input);
    }
  }

  selectHigherPersonnel(person: HigherPersonnel, input: HTMLTextAreaElement) {
    const context = this.reasonAutocompleteContext();
    if (!context) return;

    const referenceName = this.formatReferenceName(person.fullName, context.pronoun === 'τον');
    const reference = `${this.formatReferenceRank(person.rank)} ${referenceName}`;
    const reason = `${this.formModel.reason.slice(0, context.start)}${reference} ${this.formModel.reason.slice(context.end)}`;
    const caret = context.start + reference.length + 1;
    this.formModel.reason = reason;
    input.value = reason;
    input.focus();
    input.setSelectionRange(caret, caret);
    this.reasonAutocompleteContext.set(null);
  }

  formatReferenceRank(rank: string): string {
    return rank.replace(/[Σς](?=\s*(?:\([^)]*\))?\s*$)/, '');
  }

  formatReferenceName(name: string, masculine: boolean): string {
    if (!masculine) return name;

    return name.replace(/[Α-ΩΆΈΉΊΌΎΏΪΫ]+/gu, word => {
      if (word.endsWith('ΟΣ')) return `${word.slice(0, -2)}Ο`;
      if (word.endsWith('ΗΣ')) return `${word.slice(0, -2)}Η`;
      if (word.endsWith('ΑΣ')) return `${word.slice(0, -2)}Α`;
      return word;
    });
  }

  private isSubsequence(query: string, target: string): boolean {
    let queryIndex = 0;
    for (const character of target) {
      if (character === query[queryIndex]) queryIndex++;
      if (queryIndex === query.length) return true;
    }
    return false;
  }

  getRecordProgress(record: SoldierRecord) {
    return this.storage.calculatePenaltyProgress(record);
  }

  getProgressTooltip(record: SoldierRecord, prog: any): string {
    let rule = '';
    if (prog.penaltyType === 'ΣΤ ΕΞΟΔΟΥ') {
      rule = 'Στέρηση Εξόδου: Προσμετράται ημέρα μόνο όταν ο στρατιώτης δεν έχει υπηρεσία (είναι εξοδούχος).';
    } else {
      rule = `${prog.penaltyType}: Προσμετράται για κάθε ημερολογιακή ημέρα που παρέρχεται.`;
    }
    const mode = prog.isManual ? ' (Χειροκίνητη ρύθμιση)' : ' (Αυτόματος υπολογισμός)';
    return `Έκτιση: ${prog.servedDays}/${prog.totalDays} ημέρες. ${rule}${mode}`;
  }

  adjustProgress(record: SoldierRecord, delta: number, event?: Event) {
    if (event) event.stopPropagation();
    this.storage.adjustPenaltyServedDays(record.id, delta);
  }

  resetAutoProgress(record: SoldierRecord, event?: Event) {
    if (event) event.stopPropagation();
    this.storage.resetPenaltyAutoCount(record.id);
  }

  async exportPenaltiesExcel() {
    const penalties = this.filteredRecords().filter(r => r.type === 'ΠΟΙΝΗ');
    const recordsToExport = penalties.length > 0 ? penalties : this.storage.soldierRecords().filter(r => r.type === 'ΠΟΙΝΗ');
    const asOfDate = this.dateFilter() || this.todayStr;
    await this.excelService.exportPenaltiesToExcel(recordsToExport, asOfDate);
  }

  openAddModal(type: SoldierRecordType = 'ΑΙΤΗΜΑ') {
    this.editingRecordId.set(null);
    this.closeReasonAutocomplete();
    const today = formatLocalDate(new Date());

    this.formModel = {
      type,
      personId: '',
      personName: '',
      date: today,
      reason: '',
      notes: '',
      status: 'Εκκρεμεί',
      penaltyType: 'ΣΤ ΕΞΟΔΟΥ',
      totalDays: type === 'ΠΟΙΝΗ' ? 3 : null,
      servedDays: 0,
      isManualServedDays: false
    };
    this.personSearchQuery.set('');
    this.isPersonDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }

  openEditModal(r: SoldierRecord) {
    this.editingRecordId.set(r.id);
    this.closeReasonAutocomplete();
    const prog = this.storage.calculatePenaltyProgress(r);

    this.formModel = {
      type: r.type,
      personId: r.personId,
      personName: r.personName,
      date: r.date,
      reason: r.reason,
      notes: r.notes || '',
      status: r.status || 'Εκκρεμεί',
      penaltyType: (r.penaltyType as PenaltySubtype) || prog.penaltyType || 'ΣΤ ΕΞΟΔΟΥ',
      totalDays: r.totalDays !== undefined ? r.totalDays : (r.type === 'ΠΟΙΝΗ' ? (prog.totalDays || 3) : null),
      servedDays: r.servedDays !== undefined ? r.servedDays : prog.servedDays,
      isManualServedDays: Boolean(r.isManualServedDays)
    };
    this.personSearchQuery.set(r.personName);
    this.isPersonDropdownOpen.set(false);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingRecordId.set(null);
    this.isPersonDropdownOpen.set(false);
    this.closeReasonAutocomplete();
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

    const isPenalty = this.formModel.type === 'ΠΟΙΝΗ';
    let totalDays: number | undefined = undefined;
    let servedDays: number | undefined = undefined;

    if (isPenalty) {
      totalDays = this.formModel.totalDays ? Math.max(1, Number(this.formModel.totalDays)) : 3;
      servedDays = this.formModel.servedDays !== null && this.formModel.servedDays !== undefined 
        ? Math.max(0, Math.min(totalDays, Number(this.formModel.servedDays))) 
        : 0;
    }

    const payload = {
      type: this.formModel.type,
      personId: this.formModel.personId,
      personName: this.formModel.personName,
      date: this.formModel.date,
      reason: this.formModel.reason,
      notes: this.formModel.notes,
      status: this.formModel.status,
      penaltyType: isPenalty ? this.formModel.penaltyType : undefined,
      totalDays: isPenalty ? totalDays : undefined,
      servedDays: isPenalty && this.formModel.isManualServedDays ? servedDays : undefined,
      isManualServedDays: isPenalty ? Boolean(this.formModel.isManualServedDays) : undefined
    };

    if (isPenalty && totalDays && servedDays !== undefined && servedDays >= totalDays && this.formModel.status === 'Εκκρεμεί') {
      payload.status = 'Ολοκληρώθηκε';
    }

    if (this.editingRecordId()) {
      this.storage.updateSoldierRecord(this.editingRecordId()!, payload);
    } else {
      this.storage.addSoldierRecord(payload);
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

  async copyText(text: string, key: string, label = 'Το κείμενο') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    this.copiedRecordKey.set(key);
    this.storage.notify(`${label} αντιγράφηκε στο πρόχειρο.`, 'info');
    setTimeout(() => {
      if (this.copiedRecordKey() === key) {
        this.copiedRecordKey.set(null);
      }
    }, 2000);
  }
}
