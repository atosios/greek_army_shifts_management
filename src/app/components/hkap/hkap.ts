import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ExcelExportService } from '../../services/excel-export.service';
import { SoldierRecord, SignatureSlot, formatGreekDate, formatLocalDate, formatRecordPersonName, normalizeGreek, toGreekCaps } from '../../models/shift.model';

export interface HkapRowItem {
  numberText: string;
  record?: SoldierRecord;
  soldierName: string;
  content: string;
  notes: string;
  isEmpty: boolean;
}

export interface HkapPrintPage {
  pageNumber: number;
  type: 'REQUESTS' | 'PENALTIES';
  title: string;
  rows: HkapRowItem[];
  isEmpty: boolean;
}

@Component({
  selector: 'app-hkap',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './hkap.html',
  styleUrl: './hkap.css'
})
export class HkapComponent {
  storage = inject(StorageService);
  excelService = inject(ExcelExportService);

  readonly formatGreekDate = formatGreekDate;
  readonly formatRecordPersonName = formatRecordPersonName;
  readonly higherPersonnel = this.storage.higherPersonnel;
  readonly unit = this.storage.unitInfo;

  // Selected date for HKAP
  date = signal<string>(formatLocalDate(new Date()));

  // Selected record IDs to include in printout
  selectedRecordIds = signal<Set<string>>(new Set<string>());
  selectionSearch = signal<string>('');
  selectionTypeFilter = signal<'ALL' | SoldierRecord['type']>('ALL');
  selectionStatusFilter = signal<'ACTIVE' | 'ALL' | NonNullable<SoldierRecord['status']>>('ACTIVE');
  selectionDateFilter = signal<string>('');

  // Editable top right header lines (matching military document format)
  headerLine1 = signal<string>('');
  headerLine2 = signal<string>('');
  headerLine3 = signal<string>('');
  headerLine4 = signal<string>('');

  // Signatures configuration (Same signature system as in duty print)
  signatures = signal<SignatureSlot[]>([]);

  // Selection drawer & header config state
  isSelectionPanelOpen = signal<boolean>(false);
  isHeaderConfigOpen = signal<boolean>(false);

  // Copy text state
  copiedKey = signal<string | null>(null);

  // All soldier records from storage
  readonly allRecords = this.storage.soldierRecords;

  readonly filteredSelectionRecords = computed(() => {
    const query = normalizeGreek(this.selectionSearch());
    const type = this.selectionTypeFilter();
    const status = this.selectionStatusFilter();
    const date = this.selectionDateFilter();

    return this.allRecords().filter(record => {
      if (type !== 'ALL' && record.type !== type) return false;
      if (date && record.date !== date) return false;

      const recordStatus = record.status || 'Εκκρεμεί';
      if (status === 'ACTIVE' && recordStatus === 'Ολοκληρώθηκε') return false;
      if (status !== 'ACTIVE' && status !== 'ALL' && recordStatus !== status) return false;

      if (query) {
        const searchable = normalizeGreek(`${record.personName} ${record.reason} ${record.notes || ''}`);
        if (!searchable.includes(query)) return false;
      }

      return true;
    });
  });

  readonly selectedFilteredRecordCount = computed(() =>
    this.filteredSelectionRecords().filter(record => this.selectedRecordIds().has(record.id)).length
  );

  /** Format title date as DD/MM/YY (e.g. 10/09/26) exactly like in the user's images */
  formatTitleDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.trim().split('-');
    if (parts.length === 3) {
      const yy = parts[0].slice(-2);
      return `${parts[2]}/${parts[1]}/${yy}`;
    }
    const slashParts = dateStr.trim().split('/');
    if (slashParts.length === 3) {
      const yy = slashParts[2].slice(-2);
      return `${slashParts[0]}/${slashParts[1]}/${yy}`;
    }
    return dateStr;
  }

  private buildEmptyRow(): HkapRowItem {
    return {
      numberText: '0',
      soldierName: '-',
      content: '-',
      notes: '-',
      isEmpty: true
    };
  }

  private buildRowsForRecord(record: SoldierRecord, index: number): HkapRowItem {
    return {
      numberText: String(index + 1),
      record,
      soldierName: toGreekCaps(formatRecordPersonName(record.personName)),
      content: toGreekCaps(record.reason),
      notes: record.notes ? toGreekCaps(record.notes) : '-',
      isEmpty: false
    };
  }

  private calculateRowsPerPage(rows: HkapRowItem[]): number {
    if (rows.length <= 1) return 1;

    const longTextCount = rows.filter(row => {
      const textLength = `${row.content || ''}${row.notes || ''}`.length;
      return textLength > 180;
    }).length;

    const baseRows = 9;
    const shrinkBy = Math.min(3, Math.floor(longTextCount / 2));
    return Math.max(5, baseRows - shrinkBy);
  }

  private buildPageGroups(rows: HkapRowItem[], type: 'REQUESTS' | 'PENALTIES'): HkapPrintPage[] {
    const effectiveRows = rows.length > 0 ? rows : [this.buildEmptyRow()];
    const capacity = this.calculateRowsPerPage(effectiveRows);
    const pages: HkapPrintPage[] = [];

    for (let start = 0; start < effectiveRows.length; start += capacity) {
      const slice = effectiveRows.slice(start, start + capacity);
      pages.push({
        pageNumber: pages.length + 1,
        type,
        title: type === 'REQUESTS'
          ? `ΑΙΤΗΣΕΩΝ – ΑΝΑΦΟΡΩΝ ΟΠΛΙΤΩΝ ΤΗΣ ${this.formatTitleDate(this.date())}`
          : `ΠΟΙΝΩΝ ΟΠΛΙΤΩΝ ΤΗΣ ${this.formatTitleDate(this.date())}`,
        rows: slice,
        isEmpty: slice.every(row => row.isEmpty)
      });
    }

    return pages;
  }

  readonly requestPages = computed<HkapPrintPage[]>(() => {
    const selectedIds = this.selectedRecordIds();
    const rows = this.allRecords()
      .filter(r => r.type === 'ΑΙΤΗΜΑ' && selectedIds.has(r.id))
      .map((r, idx) => this.buildRowsForRecord(r, idx));

    return this.buildPageGroups(rows, 'REQUESTS');
  });

  readonly penaltyPages = computed<HkapPrintPage[]>(() => {
    const selectedIds = this.selectedRecordIds();
    const rows = this.allRecords()
      .filter(r => r.type === 'ΠΟΙΝΗ' && selectedIds.has(r.id))
      .map((r, idx) => this.buildRowsForRecord(r, idx));

    return this.buildPageGroups(rows, 'PENALTIES');
  });

  readonly printPages = computed<HkapPrintPage[]>(() => {
    const pages: HkapPrintPage[] = [];
    let pageNumber = 1;

    this.requestPages().forEach(page => {
      pages.push({ ...page, pageNumber: pageNumber++ });
    });

    this.penaltyPages().forEach(page => {
      pages.push({ ...page, pageNumber: pageNumber++ });
    });

    return pages;
  });

  readonly estimatedPrintPages = computed(() => this.printPages().length);

  // Selected requests to print
  readonly printableRequests = computed<HkapRowItem[]>(() => {
    const selectedIds = this.selectedRecordIds();
    const records = this.allRecords().filter(r => r.type === 'ΑΙΤΗΜΑ' && selectedIds.has(r.id));

    if (records.length === 0) {
      return [this.buildEmptyRow()];
    }

    return records.map((r, idx) => this.buildRowsForRecord(r, idx));
  });

  // Selected penalties to print
  readonly printablePenalties = computed<HkapRowItem[]>(() => {
    const selectedIds = this.selectedRecordIds();
    const records = this.allRecords().filter(r => r.type === 'ΠΟΙΝΗ' && selectedIds.has(r.id));

    if (records.length === 0) {
      return [this.buildEmptyRow()];
    }

    // When filled: number starting from 1, exactly one row per selected entry
    return records.map((r, idx) => {
      const prog = this.storage.calculatePenaltyProgress(r);
      let contentText = toGreekCaps(r.reason);
      if (prog.totalDays > 0) {
        contentText += ` (${prog.servedDays}/${prog.totalDays} ΗΜ.)`;
      }

      return {
        numberText: String(idx + 1),
        record: r,
        soldierName: toGreekCaps(formatRecordPersonName(r.personName)),
        content: contentText,
        notes: r.notes ? toGreekCaps(r.notes) : '-',
        isEmpty: false
      };
    });
  });

  constructor() {
    this.initHeaderLines();
    this.initDefaultSignatures();
    this.initDefaultSelections();
  }

  initHeaderLines() {
    const saved = localStorage.getItem('hkap_header_lines');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.headerLine1.set(parsed.line1 || 'ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)');
        this.headerLine2.set(parsed.line2 || '2η ΜΕΝ/Σ');
        this.headerLine3.set(parsed.line3 || "Γ' ΠΥΡΧΙΑ");
        this.headerLine4.set(parsed.line4 || "ΣΤ' ΚΤΗΡΙΟ");
        return;
      } catch (e) {
        // fallback
      }
    }

    const u = this.unit();
    this.headerLine1.set(u.name || 'ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)');
    this.headerLine2.set(u.division || '2η ΜΕΝ/Σ');
    this.headerLine3.set(u.dutyOfficerSignatureTitle || "Γ' ΠΥΡΧΙΑ");
    this.headerLine4.set(u.location || "ΣΤ' ΚΤΗΡΙΟ");
  }

  saveHeaderLines() {
    const data = {
      line1: this.headerLine1().trim(),
      line2: this.headerLine2().trim(),
      line3: this.headerLine3().trim(),
      line4: this.headerLine4().trim()
    };
    localStorage.setItem('hkap_header_lines', JSON.stringify(data));
    this.storage.notify('Οι γραμμές επικεφαλίδας ΗΚΑΠ αποθηκεύτηκαν', 'success');
  }

  resetDefaultHeaderLines() {
    const u = this.unit();
    this.headerLine1.set(u.name || 'ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)');
    this.headerLine2.set(u.division || '2η ΜΕΝ/Σ');
    this.headerLine3.set(u.dutyOfficerSignatureTitle || "Γ' ΠΥΡΧΙΑ");
    this.headerLine4.set(u.location || "ΣΤ' ΚΤΗΡΙΟ");
    this.saveHeaderLines();
  }

  // --- Signature System as in Duty Print ---
  initDefaultSignatures() {
    const hp = this.higherPersonnel();
    if (hp && hp.length > 0) {
      const cmd = hp.find(p => p.roleTitle.includes('ΔΙΟΙΚΗΤΗΣ') || p.roleTitle.includes('ΔΚΤΗΣ ΜΟΙΡΑΣ'));
      const duty = hp.find(p => p.roleTitle.includes('ΠΥΡΧΙΑΣ') || p.roleTitle.includes('ΥΠΗΡΕΣΙΑΣ'));

      const defaultSlots: SignatureSlot[] = [];
      if (cmd) {
        defaultSlots.push({
          roleTitle: cmd.roleTitle,
          fullName: cmd.fullName,
          rank: cmd.rank,
          higherPersonnelId: cmd.id
        });
      }
      if (duty && duty.id !== cmd?.id) {
        defaultSlots.push({
          roleTitle: duty.roleTitle,
          fullName: duty.fullName,
          rank: duty.rank,
          higherPersonnelId: duty.id
        });
      }

      for (const p of hp) {
        if (defaultSlots.length >= 2) break;
        if (!defaultSlots.some(s => s.higherPersonnelId === p.id)) {
          defaultSlots.push({
            roleTitle: p.roleTitle,
            fullName: p.fullName,
            rank: p.rank,
            higherPersonnelId: p.id
          });
        }
      }

      this.signatures.set(defaultSlots);
    } else {
      this.signatures.set([
        { roleTitle: 'ΔΚΤΗΣ ΜΟΙΡΑΣ', fullName: 'ΖΑΒΙΤΣΑΝΟΣ ΔΗΜΗΤΡΙΟΣ', rank: 'ΤΧΗΣ (ΠΒ)' },
        { roleTitle: 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ', fullName: 'ΛΙΝΑΡΔΟΣ ΜΑΡΙΟΣ', rank: 'ΥΠΛΓΟΣ (ΠΖ)' }
      ]);
    }
  }

  onSelectSigner(slotIndex: number, higherPersonnelId: string) {
    const hp = this.higherPersonnel().find(p => p.id === higherPersonnelId);
    if (hp) {
      this.signatures.update(sigs => {
        const copy = [...sigs];
        copy[slotIndex] = {
          roleTitle: hp.roleTitle,
          fullName: hp.fullName,
          rank: hp.rank,
          higherPersonnelId: hp.id
        };
        return copy;
      });
    }
  }

  addSignatureSlot() {
    const hpList = this.higherPersonnel();
    const existingIds = new Set(this.signatures().map(s => s.higherPersonnelId));
    const nextAvailable = hpList.find(p => !existingIds.has(p.id)) || hpList[0];
    const newSlot: SignatureSlot = nextAvailable ? {
      roleTitle: nextAvailable.roleTitle,
      fullName: nextAvailable.fullName,
      rank: nextAvailable.rank,
      higherPersonnelId: nextAvailable.id
    } : {
      roleTitle: 'ΑΞΙΩΜΑΤΙΚΟΣ ΥΠΗΡΕΣΙΑΣ',
      fullName: '',
      rank: ''
    };
    this.signatures.update(sigs => [...sigs, newSlot]);
  }

  removeSignatureSlot(slotIndex: number) {
    if (this.signatures().length <= 1) {
      this.storage.notify('Απαιτείται τουλάχιστον μία υπογραφή στο έγγραφο.', 'warning');
      return;
    }
    this.signatures.update(sigs => sigs.filter((_, idx) => idx !== slotIndex));
  }

  moveSignature(slotIndex: number, direction: 'left' | 'right') {
    const targetIdx = direction === 'left' ? slotIndex - 1 : slotIndex + 1;
    if (targetIdx < 0 || targetIdx >= this.signatures().length) return;
    this.signatures.update(sigs => {
      const copy = [...sigs];
      const temp = copy[slotIndex];
      copy[slotIndex] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  }

  resetDefaultSignatures() {
    this.initDefaultSignatures();
    this.storage.notify('Επαναφέρθηκαν οι προεπιλεγμένες υπογραφές', 'info');
  }

  initDefaultSelections() {
    const d = this.date();
    const matching = this.filteredSelectionRecords().filter(r => r.date === d);
    const set = new Set<string>();
    matching.forEach(r => set.add(r.id));
    this.selectedRecordIds.set(set);
  }

  onDateChange(newDate: string) {
    this.date.set(newDate);
    const matching = this.filteredSelectionRecords().filter(r => r.date === newDate);
    const set = new Set<string>();
    matching.forEach(r => set.add(r.id));
    this.selectedRecordIds.set(set);
  }

  toggleRecordSelection(id: string) {
    this.selectedRecordIds.update(set => {
      const copy = new Set(set);
      if (copy.has(id)) {
        copy.delete(id);
      } else {
        copy.add(id);
      }
      return copy;
    });
  }

  isRecordSelected(id: string): boolean {
    return this.selectedRecordIds().has(id);
  }

  clearSelectionFilters() {
    this.selectionSearch.set('');
    this.selectionTypeFilter.set('ALL');
    this.selectionStatusFilter.set('ACTIVE');
    this.selectionDateFilter.set('');
  }

  toggleSelectionPanel() {
    this.isSelectionPanelOpen.update(v => !v);
  }

  toggleHeaderConfig() {
    this.isHeaderConfigOpen.update(v => !v);
  }

  print() {
    if (this.storage.isElectron() && window.electronAPI) {
      window.electronAPI.printWindow();
    } else {
      window.print();
    }
  }

  async exportExcel() {
    const headerLines = [
      this.headerLine1(),
      this.headerLine2(),
      this.headerLine3(),
      this.headerLine4()
    ].filter(l => !!l.trim());

    await this.excelService.exportHkapToExcel({
      date: this.date(),
      headerLines,
      requests: this.printableRequests(),
      penalties: this.printablePenalties(),
      signatures: this.signatures()
    });
  }

  async copyText(text: string, key: string) {
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
    this.copiedKey.set(key);
    this.storage.notify('Το κείμενο αντιγράφηκε στο πρόχειρο.', 'info');
    setTimeout(() => {
      if (this.copiedKey() === key) {
        this.copiedKey.set(null);
      }
    }, 2000);
  }
}
