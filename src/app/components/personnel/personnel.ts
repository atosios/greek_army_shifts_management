import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { ExcelExportService } from '../../services/excel-export.service';
import * as XLSX from 'xlsx';
import { Personnel, MilitaryCategory, PersonnelStatus, FitnessLevel, LeaveType, toGreekCaps, formatGreekDate, getCorpsShort, normalizeGreek } from '../../models/shift.model';
import { GREEK_RANKS, GREEK_CORPS } from '../../data/default-data';

export type CsvConflictStrategy = 'UPDATE' | 'SKIP' | 'INSERT';

export interface SoldierCalDuty {
  dutyName: string;
  shortName: string;
  category: string;
  hoursNote?: string;
}

export interface SoldierCalLeave {
  type: LeaveType | string;
  shortCode: string;
  badgeClass: string;
  reason?: string;
}

export interface SoldierCalDay {
  dateStr: string;        // "YYYY-MM-DD"
  dayNumber: number;      // 1..31
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  duties: SoldierCalDuty[];
  leaves: SoldierCalLeave[];
}

export interface ParsedCsvRow {
  rowNumber: number;
  fullName: string;
  asm: string;
  specialty: string;
  fitnessProfile: FitnessLevel;
  status: PersonnelStatus;
  barracksRoom: string;
  bedNumber: string;
  exemptFromAllDuties: boolean;
  dutyScore: number;
  notes: string;
  isValid: boolean;
  errorMessage?: string;
  hasConflict: boolean;
  conflictPersonId?: string;
  conflictPersonName?: string;
  conflictAction: CsvConflictStrategy;
}

@Component({
  selector: 'app-personnel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personnel.html',
  styleUrl: './personnel.css'
})
export class PersonnelComponent {
  storage = inject(StorageService);
  excelService = inject(ExcelExportService);

  readonly ranks = GREEK_RANKS;
  readonly corps = GREEK_CORPS;
  readonly formatGreekDate = formatGreekDate;
  readonly getCorpsShort = getCorpsShort;

  // Search & Filter state (Multi-select support)
  searchQuery = signal<string>('');
  filterFitness = signal<string[]>([]);
  filterCorps = signal<string[]>([]);
  filterArmed = signal<string>('ALL');
  filterRooms = signal<string[]>([]); // Dynamic rooms multi-select

  // Filter Modal
  isFilterModalOpen = signal<boolean>(false);

  // Sorting state
  sortColumn = signal<string>('fullName');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Table Multiple Selection State
  selectedSoldierIds = signal<Set<string>>(new Set<string>());

  readonly selectedCount = computed(() => this.selectedSoldierIds().size);

  readonly isAllSelected = computed(() => {
    const list = this.filteredPersonnel();
    if (list.length === 0) return false;
    const selected = this.selectedSoldierIds();
    return list.every(p => selected.has(p.id));
  });

  readonly isPartiallySelected = computed(() => {
    const list = this.filteredPersonnel();
    if (list.length === 0) return false;
    const selected = this.selectedSoldierIds();
    const count = list.filter(p => selected.has(p.id)).length;
    return count > 0 && count < list.length;
  });

  isSoldierSelected(id: string): boolean {
    return this.selectedSoldierIds().has(id);
  }

  toggleSelectSoldier(id: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const current = new Set(this.selectedSoldierIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedSoldierIds.set(current);
  }

  toggleSelectAll(checked: boolean) {
    const list = this.filteredPersonnel();
    const current = new Set(this.selectedSoldierIds());
    if (checked) {
      list.forEach(p => current.add(p.id));
    } else {
      list.forEach(p => current.delete(p.id));
    }
    this.selectedSoldierIds.set(current);
  }

  clearSelection() {
    this.selectedSoldierIds.set(new Set<string>());
  }

  // Bulk Operations Modals
  isBulkDeleteModalOpen = signal<boolean>(false);
  isBulkRoomModalOpen = signal<boolean>(false);
  isBulkCorpsModalOpen = signal<boolean>(false);

  bulkRoomTarget = signal<string>('');
  bulkCorpsTarget = signal<string>('ΠΖ');

  openBulkDeleteModal() {
    if (this.selectedCount() === 0) return;
    this.isBulkDeleteModalOpen.set(true);
  }

  closeBulkDeleteModal() {
    this.isBulkDeleteModalOpen.set(false);
  }

  executeBulkDelete() {
    const ids = Array.from(this.selectedSoldierIds());
    this.storage.deletePersonnelBulk(ids);
    this.clearSelection();
    this.closeBulkDeleteModal();
  }

  openBulkRoomModal() {
    if (this.selectedCount() === 0) return;
    this.bulkRoomTarget.set('');
    this.isBulkRoomModalOpen.set(true);
  }

  closeBulkRoomModal() {
    this.isBulkRoomModalOpen.set(false);
  }

  executeBulkRoomChange() {
    const target = toGreekCaps(this.bulkRoomTarget().trim());
    const ids = Array.from(this.selectedSoldierIds());
    ids.forEach(id => {
      this.storage.updatePersonnel(id, { barracksRoom: target });
    });
    this.clearSelection();
    this.closeBulkRoomModal();
  }

  openBulkCorpsModal() {
    if (this.selectedCount() === 0) return;
    this.bulkCorpsTarget.set('ΠΖ');
    this.isBulkCorpsModalOpen.set(true);
  }

  closeBulkCorpsModal() {
    this.isBulkCorpsModalOpen.set(false);
  }

  executeBulkCorpsChange() {
    const target = this.bulkCorpsTarget();
    const ids = Array.from(this.selectedSoldierIds());
    ids.forEach(id => {
      this.storage.updatePersonnel(id, { specialty: target });
    });
    this.clearSelection();
    this.closeBulkCorpsModal();
  }


  // Add/Edit Person Modal state
  isModalOpen = signal<boolean>(false);
  editingPersonId = signal<string | null>(null);

  // CSV Bulk Import Modal state
  isCsvModalOpen = signal<boolean>(false);
  csvFileName = signal<string>('');
  csvParsedRows = signal<ParsedCsvRow[]>([]);
  csvErrorMessage = signal<string | null>(null);
  isDraggingFile = signal<boolean>(false);
  globalConflictStrategy = signal<CsvConflictStrategy>('UPDATE');

  readonly csvValidCount = computed(() => this.csvParsedRows().filter(r => r.isValid).length);
  readonly csvInvalidCount = computed(() => this.csvParsedRows().filter(r => !r.isValid).length);
  readonly conflictsCount = computed(() => this.csvParsedRows().filter(r => r.isValid && r.hasConflict).length);
  readonly toInsertCount = computed(() => this.csvParsedRows().filter(r => r.isValid && r.conflictAction === 'INSERT').length);
  readonly toUpdateCount = computed(() => this.csvParsedRows().filter(r => r.isValid && r.conflictAction === 'UPDATE').length);
  readonly toSkipCount = computed(() => this.csvParsedRows().filter(r => r.isValid && r.conflictAction === 'SKIP').length);

  // Form Model - In Δύναμη everyone is ΣΤΡ
  formModel = {
    rankShort: 'ΣΤΡ',
    rank: 'ΣΤΡΑΤΙΩΤΗΣ',
    category: 'Κληρωτός' as MilitaryCategory,
    fullName: '',
    asm: '',
    specialty: 'ΠΖ',
    fitnessProfile: 'Ι1' as FitnessLevel,
    status: 'Ένοπλος' as PersonnelStatus,
    weaponNumber: '',
    barracksRoom: '',
    bedNumber: '',
    rotationalGroup: undefined,
    exemptFromAllDuties: false,
    eligibleDutyIds: [] as string[],
    dutyScore: 0,
    weekendDutyScore: 0,
    notes: '',
    active: true
  };

  // --- Soldier Calendar State (Edit Popup) ---
  readonly GREEK_MONTHS = [
    'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
    'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
  ];

  soldierCalDate = signal<Date>(new Date());

  readonly soldierCalMonthLabel = computed(() => {
    const d = this.soldierCalDate();
    return `${this.GREEK_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  readonly soldierCalendarDays = computed<SoldierCalDay[]>(() => {
    const current = this.soldierCalDate();
    const year = current.getFullYear();
    const month = current.getMonth();
    const personId = this.editingPersonId();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const allSchedules = this.storage.schedules();
    const allLeaves = this.storage.leaves();

    const firstDayOfMonth = new Date(year, month, 1);
    let startDayOfWeek = firstDayOfMonth.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Monday is 1, Sunday is 7

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: SoldierCalDay[] = [];

    const getEventsForDate = (dateStr: string) => {
      const duties: SoldierCalDuty[] = [];
      const leaves: SoldierCalLeave[] = [];

      if (!personId) {
        return { duties, leaves };
      }

      // Check schedules
      const sched = allSchedules.find(s => s.date === dateStr);
      if (sched && sched.duties) {
        sched.duties.forEach(d => {
          const matchSlot = d.slots?.find(sl => sl.personId === personId);
          if (matchSlot) {
            duties.push({
              dutyName: d.dutyName || d.shortName,
              shortName: d.shortName || d.dutyName,
              category: d.category,
              hoursNote: matchSlot.hoursNote
            });
          }
        });
      }

      // Check leaves
      allLeaves.forEach(l => {
        if (l.personId === personId && l.status !== 'Ακυρωμένη') {
          if (l.startDate <= dateStr && dateStr <= l.endDate) {
            let shortCode = 'ΑΔΕΙΑ';
            let badgeClass = 'cal-badge-leave';
            if (l.type.includes('Ελεύθερος Υπηρεσίας') || l.type.includes('(ΕΥ)') || l.type.includes('(Ε.Υ.)')) {
              shortCode = 'Ε.Υ.';
              badgeClass = 'cal-badge-ey';
            } else if (l.type.includes('Ελεύθερος Ασκήσεων') || l.type.includes('(ΕΑ)') || l.type.includes('(Ε.Α.)')) {
              shortCode = 'Ε.Α.';
              badgeClass = 'cal-badge-ea';
            } else if (l.type.includes('Ελεύθερος Ορθοστασίας') || l.type.includes('(ΕΟ)')) {
              shortCode = 'Ε.Ο.';
              badgeClass = 'cal-badge-eo';
            } else if (l.type.includes('Εαρβ')) {
              shortCode = 'Εαρβ';
              badgeClass = 'cal-badge-info';
            } else if (l.type.includes('Εξυρ')) {
              shortCode = 'Εξυρ';
              badgeClass = 'cal-badge-info';
            } else if (l.type.includes('Στεπ')) {
              shortCode = 'ΣΤΕΠ';
              badgeClass = 'cal-badge-step';
            } else if (l.type.includes('Νοσοκομείο')) {
              shortCode = 'ΝΟΣΟΚ.';
              badgeClass = 'cal-badge-hosp';
            }

            leaves.push({
              type: l.type,
              shortCode,
              badgeClass,
              reason: l.reason
            });
          }
        }
      });

      // Check weekend day-off plan
      const wkPlan = this.storage.getWeekendPlan(dateStr);
      if (wkPlan) {
        const dObj = new Date(dateStr);
        const dayNum = dObj.getDay();
        if (dayNum === 6 && wkPlan.saturdayOffIds?.includes(personId)) {
          leaves.push({
            type: 'Έξοδος Σαββάτου',
            shortCode: 'ΕΞΟΔΟΣ',
            badgeClass: 'cal-badge-off-sat',
            reason: 'Έξοδος Σαββάτου (από 12:00)'
          });
        } else if (dayNum === 0 && wkPlan.sundayOffIds?.includes(personId)) {
          leaves.push({
            type: 'Έξοδος Κυριακής',
            shortCode: 'ΕΞΟΔΟΣ',
            badgeClass: 'cal-badge-off-sun',
            reason: 'Έξοδος Κυριακής (από 10:00/12:00)'
          });
        }
      }

      return { duties, leaves };
    };

    // Leading padding days from previous month
    const prevMonthDaysCount = startDayOfWeek - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthNum = month === 0 ? 11 : month - 1;

    for (let i = prevMonthDaysCount - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const dateStr = `${prevYear}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = (startDayOfWeek - 1 - i);
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;
      const events = getEventsForDate(dateStr);

      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
        duties: events.duties,
        leaves: events.leaves
      });
    }

    // Days of current month
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dateObj = new Date(year, month, dayNum);
      let dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;
      const events = getEventsForDate(dateStr);

      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend,
        duties: events.duties,
        leaves: events.leaves
      });
    }

    // Trailing padding days to fill 35 or 42 cells
    const totalCellsNeeded = cells.length > 35 ? 42 : 35;
    const nextMonthDaysCount = totalCellsNeeded - cells.length;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonthNum = month === 11 ? 0 : month + 1;

    for (let dayNum = 1; dayNum <= nextMonthDaysCount; dayNum++) {
      const dateStr = `${nextYear}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dateObj = new Date(nextYear, nextMonthNum, dayNum);
      let dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;
      const events = getEventsForDate(dateStr);

      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
        duties: events.duties,
        leaves: events.leaves
      });
    }

    return cells;
  });

  readonly soldierCalMonthDutyCount = computed(() => {
    return this.soldierCalendarDays()
      .filter(d => d.isCurrentMonth)
      .reduce((sum, d) => sum + d.duties.length, 0);
  });

  readonly soldierCalMonthLeaveCount = computed(() => {
    return this.soldierCalendarDays()
      .filter(d => d.isCurrentMonth && d.leaves.length > 0)
      .length;
  });

  prevSoldierMonth() {
    const cur = this.soldierCalDate();
    this.soldierCalDate.set(new Date(cur.getFullYear(), cur.getMonth() - 1, 1));
  }

  nextSoldierMonth() {
    const cur = this.soldierCalDate();
    this.soldierCalDate.set(new Date(cur.getFullYear(), cur.getMonth() + 1, 1));
  }

  getUpcomingWeekendOff(personId: string): 'ΣΑΒΒΑΤΟ' | 'ΚΥΡΙΑΚΗ' | null {
    const today = new Date();
    const day = today.getDay();
    let friOffset = 0;
    if (day === 5) friOffset = 0;
    else if (day === 6) friOffset = -1;
    else if (day === 0) friOffset = -2;
    else friOffset = 5 - day;

    today.setDate(today.getDate() + friOffset);
    const friStr = today.toISOString().slice(0, 10);
    const plan = this.storage.getWeekendPlan(friStr);
    if (!plan) return null;
    if (plan.saturdayOffIds?.includes(personId)) return 'ΣΑΒΒΑΤΟ';
    if (plan.sundayOffIds?.includes(personId)) return 'ΚΥΡΙΑΚΗ';
    return null;
  }

  goToSoldierToday() {
    this.soldierCalDate.set(new Date());
  }

  /** Unique list of barracks rooms from existing personnel with soldier counts */
  readonly uniqueRooms = computed(() => {
    const list = this.storage.personnel();
    const roomMap = new Map<string, number>();
    list.forEach(p => {
      const room = p.barracksRoom?.trim();
      if (room) {
        roomMap.set(room, (roomMap.get(room) || 0) + 1);
      }
    });
    return Array.from(roomMap.entries())
      .map(([room, count]) => ({ room, count }))
      .sort((a, b) => a.room.localeCompare(b.room, 'el', { numeric: true }));
  });

  /** Count of personnel without an assigned barracks room */
  readonly unassignedRoomCount = computed(() => {
    return this.storage.personnel().filter(p => !p.barracksRoom || !p.barracksRoom.trim()).length;
  });

  /** Toggle methods for multi-select filters */
  toggleCorpsFilter(c: string) {
    const current = this.filterCorps();
    if (current.includes(c)) {
      this.filterCorps.set(current.filter(item => item !== c));
    } else {
      this.filterCorps.set([...current, c]);
    }
  }

  toggleFitnessFilter(f: string) {
    const current = this.filterFitness();
    if (current.includes(f)) {
      this.filterFitness.set(current.filter(item => item !== f));
    } else {
      this.filterFitness.set([...current, f]);
    }
  }

  toggleRoomFilter(room: string) {
    const current = this.filterRooms();
    if (current.includes(room)) {
      this.filterRooms.set(current.filter(r => r !== room));
    } else {
      this.filterRooms.set([...current, room]);
    }
  }

  getRoomsDisplayString(): string {
    return this.filterRooms()
      .map(r => r === '__NONE__' ? 'Χωρίς Θάλαμο' : r)
      .join(', ');
  }

  /** Count of active non-default filters */
  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.searchQuery().trim()) count++;
    if (this.filterFitness().length > 0) count++;
    if (this.filterCorps().length > 0) count++;
    if (this.filterArmed() !== 'ALL') count++;
    if (this.filterRooms().length > 0) count++;
    return count;
  });

  readonly hasActiveFilters = computed(() => this.activeFilterCount() > 0);

  /** Filtered and sorted personnel list */
  readonly filteredPersonnel = computed(() => {
    const list = this.storage.personnel();
    const query = toGreekCaps(this.searchQuery().trim());
    const fitness = this.filterFitness();
    const corps = this.filterCorps();
    const armed = this.filterArmed();
    const rooms = this.filterRooms();

    // 1. Filtering
    const filtered = list.filter((p) => {
      // Free text query across all fields
      if (query) {
        const matchesName = toGreekCaps(p.fullName).includes(query);
        const matchesAsm = toGreekCaps(p.asm || '').includes(query);
        const matchesCorps = toGreekCaps(p.specialty || '').includes(query) || getCorpsShort(p.specialty).includes(query);
        const matchesRoom = toGreekCaps(p.barracksRoom || '').includes(query);
        const matchesBed = toGreekCaps(p.bedNumber || '').includes(query);
        const matchesNotes = toGreekCaps(p.notes || '').includes(query);
        if (!matchesName && !matchesAsm && !matchesCorps && !matchesRoom && !matchesBed && !matchesNotes) {
          return false;
        }
      }

      // Fitness filter (Ι1, Ι2, Ι3, Ι4) - Multi-select
      if (fitness.length > 0) {
        const pFit = p.fitnessProfile || (p.status === 'Άοπλος' ? 'Ι3' : 'Ι1');
        if (!fitness.includes(pFit)) return false;
      }

      // Corps filter - Multi-select
      if (corps.length > 0) {
        const pCorps = getCorpsShort(p.specialty);
        if (!corps.includes(pCorps)) return false;
      }

      // Armed filter (Ένοπλος / Άοπλος)
      if (armed !== 'ALL' && p.status !== armed) return false;

      // Barracks Room filter - Dynamic Multi-select
      if (rooms.length > 0) {
        const pRoom = (p.barracksRoom || '').trim();
        const matchesRoom = rooms.some(r => {
          if (r === '__NONE__') return !pRoom;
          return toGreekCaps(pRoom) === toGreekCaps(r);
        });
        if (!matchesRoom) return false;
      }

      return true;
    });

    // 2. Sorting
    const col = this.sortColumn();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (col) {
        case 'aa': {
          const idxA = list.indexOf(a);
          const idxB = list.indexOf(b);
          return (idxA - idxB) * dir;
        }
        case 'fullName':
          return a.fullName.localeCompare(b.fullName, 'el') * dir;
        case 'asm':
          return (a.asm || '').localeCompare(b.asm || '', 'el', { numeric: true }) * dir;
        case 'corps':
          return getCorpsShort(a.specialty).localeCompare(getCorpsShort(b.specialty), 'el') * dir;
        case 'fitness': {
          const fitOrder: Record<string, number> = { 'Ι1': 1, 'Ι2': 2, 'Ι3': 3, 'Ι4': 4 };
          const fitA = fitOrder[a.fitnessProfile || 'Ι1'] || 0;
          const fitB = fitOrder[b.fitnessProfile || 'Ι1'] || 0;
          return (fitA - fitB) * dir;
        }
        case 'status':
          return a.status.localeCompare(b.status, 'el') * dir;
        case 'barracksRoom':
          return (a.barracksRoom || '').localeCompare(b.barracksRoom || '', 'el', { numeric: true }) * dir;
        case 'bedNumber':
          return (a.bedNumber || '').localeCompare(b.bedNumber || '', 'el', { numeric: true }) * dir;
        case 'dutyScore':
          return (a.dutyScore - b.dutyScore) * dir;
        case 'lastDutyDate': {
          const dateA = a.lastDutyDate || '';
          const dateB = b.lastDutyDate || '';
          return dateA.localeCompare(dateB) * dir;
        }
        default:
          return 0;
      }
    });
  });

  /** Sort toggle triggered by clicking a column header */
  toggleSort(columnKey: string) {
    if (this.sortColumn() === columnKey) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(columnKey);
      this.sortDirection.set('asc');
    }
  }

  // --- Filter Modal Controls ---
  openFilterModal() {
    this.isFilterModalOpen.set(true);
  }

  closeFilterModal() {
    this.isFilterModalOpen.set(false);
  }

  resetAllFilters() {
    this.searchQuery.set('');
    this.filterFitness.set([]);
    this.filterCorps.set([]);
    this.filterArmed.set('ALL');
    this.filterRooms.set([]);
  }

  clearFilter(type: string) {
    switch (type) {
      case 'query':
        this.searchQuery.set('');
        break;
      case 'fitness':
        this.filterFitness.set([]);
        break;
      case 'corps':
        this.filterCorps.set([]);
        break;
      case 'armed':
        this.filterArmed.set('ALL');
        break;
      case 'rooms':
        this.filterRooms.set([]);
        break;
    }
  }

  // --- Input Uppercase Keystroke Handlers ---
  onFullNameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const originalVal = input.value;
    const transformed = toGreekCaps(originalVal);

    this.formModel.fullName = transformed;

    if (originalVal !== transformed) {
      input.value = transformed;
      if (start !== null && end !== null) {
        input.setSelectionRange(start, end);
      }
    }
  }

  onFullNameBlur() {
    this.formModel.fullName = toGreekCaps(this.formModel.fullName.trim());
  }

  onAsmInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const originalVal = input.value;
    const transformed = toGreekCaps(originalVal);

    this.formModel.asm = transformed;

    if (originalVal !== transformed) {
      input.value = transformed;
      if (start !== null && end !== null) {
        input.setSelectionRange(start, end);
      }
    }
  }

  onRoomInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const originalVal = input.value;
    const transformed = toGreekCaps(originalVal);

    this.formModel.barracksRoom = transformed;

    if (originalVal !== transformed) {
      input.value = transformed;
      if (start !== null && end !== null) {
        input.setSelectionRange(start, end);
      }
    }
  }

  onBedInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const originalVal = input.value;
    const transformed = toGreekCaps(originalVal);

    this.formModel.bedNumber = transformed;

    if (originalVal !== transformed) {
      input.value = transformed;
      if (start !== null && end !== null) {
        input.setSelectionRange(start, end);
      }
    }
  }

  onWeaponNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const originalVal = input.value;
    const transformed = toGreekCaps(originalVal);

    this.formModel.weaponNumber = transformed;

    if (originalVal !== transformed) {
      input.value = transformed;
      if (start !== null && end !== null) {
        input.setSelectionRange(start, end);
      }
    }
  }

  onFitnessChange(fitness: FitnessLevel) {
    this.formModel.fitnessProfile = fitness;
    if (fitness === 'Ι1' || fitness === 'Ι2') {
      this.formModel.status = 'Ένοπλος';
      if (this.formModel.weaponNumber === '-') {
        this.formModel.weaponNumber = '';
      }
    } else {
      if (!this.formModel.status) {
        this.formModel.status = 'Ένοπλος';
      }
    }
  }

  onStatusChange(status: PersonnelStatus) {
    this.formModel.status = status;
    if (status === 'Άοπλος') {
      this.formModel.weaponNumber = '-';
    } else if (this.formModel.weaponNumber === '-') {
      this.formModel.weaponNumber = '';
    }
  }

  // --- Duty Eligibility Helpers ---
  isDutySelected(dutyId: string): boolean {
    if (this.formModel.exemptFromAllDuties) return false;
    return this.formModel.eligibleDutyIds.includes(dutyId);
  }

  toggleDutySelection(dutyId: string) {
    if (this.formModel.exemptFromAllDuties) return;
    const idx = this.formModel.eligibleDutyIds.indexOf(dutyId);
    if (idx >= 0) {
      this.formModel.eligibleDutyIds = this.formModel.eligibleDutyIds.filter(id => id !== dutyId);
    } else {
      this.formModel.eligibleDutyIds = [...this.formModel.eligibleDutyIds, dutyId];
    }
  }

  selectAllDuties() {
    this.formModel.exemptFromAllDuties = false;
    this.formModel.eligibleDutyIds = this.storage.dutyTypes().map(d => d.id);
  }

  deselectAllDuties() {
    this.formModel.eligibleDutyIds = [];
  }

  onExemptFromAllChange(isExempt: boolean) {
    this.formModel.exemptFromAllDuties = isExempt;
    if (isExempt) {
      this.formModel.eligibleDutyIds = [];
    } else {
      this.formModel.eligibleDutyIds = this.storage.dutyTypes().map(d => d.id);
    }
  }

  // --- Add / Edit Modal Controls ---
  openAddModal() {
    this.editingPersonId.set(null);
    const allDutyIds = this.storage.dutyTypes().map(d => d.id);
    this.formModel = {
      rankShort: 'ΣΤΡ',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      category: 'Κληρωτός',
      fullName: '',
      asm: '',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      weaponNumber: '',
      barracksRoom: '',
      bedNumber: '',
      rotationalGroup: undefined,
      exemptFromAllDuties: false,
      eligibleDutyIds: [...allDutyIds],
      dutyScore: 0,
      weekendDutyScore: 0,
      notes: '',
      active: true
    };
    this.soldierCalDate.set(new Date());
    this.isModalOpen.set(true);
  }

  openEditModal(p: Personnel) {
    this.editingPersonId.set(p.id);
    const fitness = (p.fitnessProfile || (p.status === 'Άοπλος' ? 'Ι3' : 'Ι1')) as FitnessLevel;
    const status = (fitness === 'Ι1' || fitness === 'Ι2') ? 'Ένοπλος' : (p.status === 'Άοπλος' ? 'Άοπλος' : 'Ένοπλος');
    const allDutyIds = this.storage.dutyTypes().map(d => d.id);
    const exempt = p.exemptFromAllDuties || false;
    const eligible = exempt 
      ? [] 
      : (p.eligibleDutyIds !== undefined ? [...p.eligibleDutyIds] : [...allDutyIds]);
    const weaponNum = status === 'Άοπλος' ? '-' : (p.weaponNumber ? toGreekCaps(p.weaponNumber) : '');

    this.formModel = {
      rankShort: 'ΣΤΡ',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      category: 'Κληρωτός',
      fullName: toGreekCaps(p.fullName),
      asm: toGreekCaps(p.asm || ''),
      specialty: getCorpsShort(p.specialty),
      fitnessProfile: fitness,
      status: status,
      weaponNumber: weaponNum,
      barracksRoom: toGreekCaps(p.barracksRoom || ''),
      bedNumber: toGreekCaps(p.bedNumber || ''),
      rotationalGroup: undefined,
      exemptFromAllDuties: exempt,
      eligibleDutyIds: eligible,
      dutyScore: p.dutyScore || 0,
      weekendDutyScore: p.weekendDutyScore || 0,
      notes: p.notes || '',
      active: true
    };
    this.soldierCalDate.set(new Date());
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingPersonId.set(null);
  }

  deleteCurrentPerson() {
    const id = this.editingPersonId();
    if (!id) return;
    const person = this.storage.personnel().find(p => p.id === id);
    const name = person ? `${person.rankShort} ${person.fullName}` : 'αυτόν τον στρατιώτη';
    if (confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά τον ${name};`)) {
      this.storage.deletePersonnel(id);
      this.closeModal();
    }
  }

  savePerson() {
    this.formModel.fullName = toGreekCaps(this.formModel.fullName.trim());
    if (this.formModel.asm) {
      this.formModel.asm = toGreekCaps(this.formModel.asm.trim());
    }
    this.formModel.barracksRoom = toGreekCaps(this.formModel.barracksRoom.trim());
    this.formModel.bedNumber = toGreekCaps(this.formModel.bedNumber.trim());
    this.formModel.specialty = getCorpsShort(this.formModel.specialty);

    if (!this.formModel.fullName) {
      this.storage.notify('Παρακαλώ συμπληρώστε το ονοματεπώνυμο.', 'warning');
      return;
    }

    // In Δύναμη everyone is always ΣΤΡ
    this.formModel.rankShort = 'ΣΤΡ';
    this.formModel.rank = 'ΣΤΡΑΤΙΩΤΗΣ';
    this.formModel.category = 'Κληρωτός';

    // Force armed if I1 or I2
    if (this.formModel.fitnessProfile === 'Ι1' || this.formModel.fitnessProfile === 'Ι2') {
      this.formModel.status = 'Ένοπλος';
    } else if (!this.formModel.status) {
      this.formModel.status = 'Ένοπλος';
    }

    if (this.formModel.status === 'Άοπλος') {
      this.formModel.weaponNumber = '-';
    } else if (this.formModel.weaponNumber) {
      this.formModel.weaponNumber = toGreekCaps(this.formModel.weaponNumber.trim());
    }

    // Always active
    this.formModel.active = true;

    if (this.formModel.exemptFromAllDuties) {
      this.formModel.eligibleDutyIds = [];
    }

    if (this.editingPersonId()) {
      this.storage.updatePersonnel(this.editingPersonId()!, this.formModel);
    } else {
      this.storage.addPersonnel(this.formModel);
    }

    this.closeModal();
  }

  toggleActive(p: Personnel) {
    this.storage.updatePersonnel(p.id, { active: !p.active });
  }

  deletePerson(p: Personnel) {
    if (confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε τον ${p.rankShort} ${p.fullName};`)) {
      this.storage.deletePersonnel(p.id);
    }
  }

  resetScores() {
    if (confirm('ΠΡΟΣΟΧΗ: Θέλετε να μηδενίσετε τις υπηρεσίες και τα μόρια όλων των στρατιωτών; (Χρήσιμο στην αρχή νέας σειράς/ΕΣΣΟ)')) {
      this.storage.resetAllDutyScores();
    }
  }

  exportExcel() {
    this.excelService.exportPersonnelRosterToExcel();
  }

  // --- CSV Bulk Import Methods ---
  openCsvModal() {
    this.csvFileName.set('');
    this.csvParsedRows.set([]);
    this.csvErrorMessage.set(null);
    this.isDraggingFile.set(false);
    this.globalConflictStrategy.set('UPDATE');
    this.isCsvModalOpen.set(true);
  }

  closeCsvModal() {
    this.isCsvModalOpen.set(false);
  }

  setGlobalConflictStrategy(strategy: CsvConflictStrategy) {
    this.globalConflictStrategy.set(strategy);
    const updated = this.csvParsedRows().map(row => {
      if (row.hasConflict) {
        return { ...row, conflictAction: strategy };
      }
      return row;
    });
    this.csvParsedRows.set(updated);
  }

  setRowConflictAction(row: ParsedCsvRow, action: CsvConflictStrategy) {
    const updated = this.csvParsedRows().map(r => {
      if (r.rowNumber === row.rowNumber) {
        return { ...r, conflictAction: action };
      }
      return r;
    });
    this.csvParsedRows.set(updated);
  }

  downloadCsvTemplate() {
    const headers = ['Ονοματεπώνυμο', 'ΑΣΜ', 'ΟΠΛΟ', 'ΘΑΛΑΜΟΣ', 'ΚΡΕΒΑΤΙ', 'ΙΚΑΝΟΤΗΤΑ'];
    const sample1 = ['ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ', '2024 Δ / 09144', 'ΠΖ', 'ΘΑΛΑΜΟΣ 1', '1', 'Ι1'];
    const sample2 = ['ΙΩΑΝΝΙΔΗΣ ΚΩΝΣΤΑΝΤΙΝΟΣ', '2024 Γ / 11204', 'ΤΧ', 'ΘΑΛΑΜΟΣ 2', '4', ''];

    // UTF-8 BOM (\uFEFF) for immediate correct Greek display in Excel
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      sample1.join(';'),
      sample2.join(';')
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'protypo_dynamis.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  onCsvFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.parseCsvFile(input.files[0]);
    }
  }

  onCsvDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(true);
  }

  onCsvDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
  }

  onCsvDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.parseCsvFile(event.dataTransfer.files[0]);
    }
  }

  parseCsvFile(file: File) {
    this.csvErrorMessage.set(null);
    this.csvFileName.set(file.name);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            this.csvErrorMessage.set('Το αρχείο Excel δεν περιέχει φύλλα εργασίας.');
            this.csvParsedRows.set([]);
            return;
          }
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          this.parseCsvContent(csvText, file.name);
        } catch (err) {
          this.csvErrorMessage.set('Αποτυχία ανάγνωσης αρχείου Excel.');
          this.csvParsedRows.set([]);
        }
      };
      reader.onerror = () => {
        this.csvErrorMessage.set('Αποτυχία ανάγνωσης αρχείου Excel.');
        this.csvParsedRows.set([]);
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        this.csvErrorMessage.set('Το αρχείο είναι κενό.');
        this.csvParsedRows.set([]);
        return;
      }
      this.parseCsvContent(content, file.name);
    };
    reader.onerror = () => {
      this.csvErrorMessage.set('Αποτυχία ανάγνωσης αρχείου.');
      this.csvParsedRows.set([]);
    };
    reader.readAsText(file, 'utf-8');
  }

  parseCsvContent(text: string, filename: string) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const rawRows = this.parseCsvLines(cleanText);
    if (rawRows.length === 0) {
      this.csvErrorMessage.set('Δεν βρέθηκαν γραμμές δεδομένων στο αρχείο.');
      this.csvParsedRows.set([]);
      return;
    }

    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const row = rawRows[i];
      const hasNameHeader = row.some(cell => {
        const norm = normalizeGreek(cell);
        return norm.includes('ονομ') || norm.includes('name');
      });
      if (hasNameHeader) {
        headerRowIdx = i;
        row.forEach((cell, colIdx) => {
          const norm = normalizeGreek(cell);
          if (norm.includes('ονομ') || norm.includes('name')) colMap['fullName'] = colIdx;
          else if (norm.includes('ασμ') || norm.includes('asm') || norm.includes('εσσο')) colMap['asm'] = colIdx;
          else if (norm.includes('οπλ') || norm.includes('ειδικ') || norm.includes('corps')) colMap['specialty'] = colIdx;
          else if (norm.includes('θαλαμ') || norm.includes('room')) colMap['room'] = colIdx;
          else if (norm.includes('κρεβ') || norm.includes('bed')) colMap['bed'] = colIdx;
          else if (norm.includes('ικαν') || norm.includes('fit')) colMap['fitness'] = colIdx;
        });
        break;
      }
    }

    if (headerRowIdx === -1) {
      colMap = {
        fullName: 0,
        asm: 1,
        specialty: 2,
        room: 3,
        bed: 4,
        fitness: 5
      };
    }

    const dataRows = rawRows.slice(headerRowIdx + 1);
    if (dataRows.length === 0) {
      this.csvErrorMessage.set('Δεν βρέθηκαν γραμμές με στοιχεία στρατιωτών κάτω από την επικεφαλίδα.');
      this.csvParsedRows.set([]);
      return;
    }

    const parsed: ParsedCsvRow[] = [];
    const seenAsmInCsv = new Set<string>();

    dataRows.forEach((row, idx) => {
      if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        return;
      }

      const rawFullName = (colMap['fullName'] !== undefined ? row[colMap['fullName']] : row[0]) || '';
      const rawAsm = (colMap['asm'] !== undefined ? row[colMap['asm']] : row[1]) || '';
      const rawSpecialty = (colMap['specialty'] !== undefined ? row[colMap['specialty']] : row[2]) || '';
      const rawRoom = (colMap['room'] !== undefined ? row[colMap['room']] : row[3]) || '';
      const rawBed = (colMap['bed'] !== undefined ? row[colMap['bed']] : row[4]) || '';
      const rawFitness = (colMap['fitness'] !== undefined ? row[colMap['fitness']] : row[5]) || '';

      const fullName = toGreekCaps(rawFullName.trim());
      const asm = toGreekCaps(rawAsm.trim());
      const specialty = getCorpsShort(rawSpecialty);
      const barracksRoom = toGreekCaps(rawRoom.trim());
      const bedNumber = toGreekCaps(rawBed.trim());

      // Fitness: if blank set to Ι1
      let fitnessProfile: FitnessLevel = 'Ι1';
      const normFit = rawFitness.trim().toUpperCase();
      if (!normFit || normFit === '') {
        fitnessProfile = 'Ι1';
      } else if (normFit.includes('4') || normFit === 'Ι4' || normFit === 'I4') {
        fitnessProfile = 'Ι4';
      } else if (normFit.includes('3') || normFit === 'Ι3' || normFit === 'I3') {
        fitnessProfile = 'Ι3';
      } else if (normFit.includes('2') || normFit === 'Ι2' || normFit === 'I2') {
        fitnessProfile = 'Ι2';
      } else {
        fitnessProfile = 'Ι1';
      }

      const status: PersonnelStatus = 'Ένοπλος';

      // Validation: Ονοματεπώνυμο (required else ignore), ΑΣΜ (required else ignore)
      const hasFullName = fullName.length > 0;
      const hasAsm = asm.length > 0;
      const isValid = hasFullName && hasAsm;

      let errorMessage: string | undefined;
      if (!hasFullName && !hasAsm) {
        errorMessage = 'Λείπει το Ονοματεπώνυμο και το Α.Σ.Μ. (Αγνοείται)';
      } else if (!hasFullName) {
        errorMessage = 'Λείπει το Ονοματεπώνυμο (Αγνοείται)';
      } else if (!hasAsm) {
        errorMessage = 'Λείπει το Α.Σ.Μ. (Αγνοείται)';
      }

      // Check conflict by Α.Σ.Μ.
      let hasConflict = false;
      let conflictPersonId: string | undefined;
      let conflictPersonName: string | undefined;
      let conflictAction: CsvConflictStrategy = 'INSERT';

      if (hasAsm) {
        const existing = this.storage.personnel().find(p => p.asm && toGreekCaps(p.asm.trim()) === asm);
        if (existing) {
          hasConflict = true;
          conflictPersonId = existing.id;
          conflictPersonName = `${existing.rankShort} ${existing.fullName}`;
          conflictAction = this.globalConflictStrategy();
        } else if (seenAsmInCsv.has(asm)) {
          hasConflict = true;
          conflictPersonName = 'Διπλότυπο Α.Σ.Μ. εντός του αρχείου';
          conflictAction = this.globalConflictStrategy();
        }
        seenAsmInCsv.add(asm);
      }

      parsed.push({
        rowNumber: idx + 1 + (headerRowIdx >= 0 ? headerRowIdx + 1 : 0),
        fullName,
        asm,
        specialty,
        fitnessProfile,
        status,
        barracksRoom,
        bedNumber,
        exemptFromAllDuties: false,
        dutyScore: 0,
        notes: '',
        isValid,
        errorMessage,
        hasConflict,
        conflictPersonId,
        conflictPersonName,
        conflictAction
      });
    });

    if (parsed.length === 0) {
      this.csvErrorMessage.set('Δεν βρέθηκαν έγκυρες εγγραφές στο αρχείο.');
    }

    this.csvParsedRows.set(parsed);
  }


  private parseCsvLines(text: string): string[][] {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    let delimiter = ';';
    if (commaCount > semicolonCount && commaCount > tabCount) delimiter = ',';
    else if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(c => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(c => c.length > 0)) {
        lines.push(currentRow);
      }
    }

    return lines;
  }

  confirmCsvImport() {
    const validRows = this.csvParsedRows().filter(r => r.isValid && r.conflictAction !== 'SKIP');
    if (validRows.length === 0) {
      if (this.csvParsedRows().some(r => r.isValid && r.conflictAction === 'SKIP')) {
        this.storage.notify('Όλες οι έγκυρες εγγραφές έχουν επιλεγεί προς παράλειψη.', 'info');
      } else {
        this.storage.notify('Δεν υπάρχουν έγκυρες εγγραφές προς εισαγωγή.', 'warning');
      }
      return;
    }

    const items = validRows.map(r => ({
      person: {
        fullName: r.fullName,
        asm: r.asm,
        specialty: r.specialty,
        fitnessProfile: r.fitnessProfile,
        status: r.status,
        barracksRoom: r.barracksRoom,
        bedNumber: r.bedNumber,
        exemptFromAllDuties: r.exemptFromAllDuties,
        dutyScore: r.dutyScore,
        notes: r.notes,
        active: true,
        rank: 'ΣΤΡΑΤΙΩΤΗΣ',
        rankShort: 'ΣΤΡ',
        category: 'Κληρωτός' as MilitaryCategory
      },
      action: r.conflictAction,
      existingPersonId: r.conflictPersonId
    }));

    this.storage.bulkImportPersonnel(items);
    this.closeCsvModal();
  }
}
