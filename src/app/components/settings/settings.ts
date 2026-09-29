import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { UnitInfo, HigherPersonnel } from '../../models/shift.model';
import { DEFAULT_EMBLEM_BASE64 } from '../../data/default-emblem';

export type SettingsTab = 'unit' | 'personnel' | 'database';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent {
  storage = inject(StorageService);

  readonly defaultEmblem = DEFAULT_EMBLEM_BASE64;
  readonly higherPersonnel = this.storage.higherPersonnel;

  // Active inner sidebar tab
  activeTab = signal<SettingsTab>('unit');

  // Unit Details Form
  unitForm: UnitInfo = {
    name: '',
    location: '',
    division: '',
    commanderTitle: 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ',
    commanderName: '',
    dutyOfficerSignatureTitle: 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ',
    dutyOfficerName: '',
    supervisorSignatureTitle: 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ',
    supervisorName: '',
    emblemUrl: DEFAULT_EMBLEM_BASE64
  };

  // Higher Personnel Modal & Form State
  showHpModal = signal<boolean>(false);
  editingHpId = signal<string | null>(null);

  hpForm = {
    fullName: '',
    rank: '',
    roleTitle: ''
  };

  readonly rolePresets = [
    'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ',
    'ΔΚΤΗΣ ΠΥΡΧΙΑΣ',
    'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ',
    'ΑΞΙΩΜΑΤΙΚΟΣ ΕΠΙΧΕΙΡΗΣΕΩΝ',
    'ΥΠΟΔΙΟΙΚΗΤΗΣ',
    'ΑΞΙΩΜΑΤΙΚΟΣ ΥΠΗΡΕΣΙΑΣ',
    'ΒΟΗΘΟΣ ΑΞΙΩΜΑΤΙΚΟΥ ΥΠΗΡΕΣΙΑΣ'
  ];

  readonly rankPresets = [
    'ΑΝΧΗΣ (ΠΒ)',
    'ΤΧΗΣ (ΠΒ)',
    'ΛΓΟΣ (ΠΒ)',
    'ΥΠΛΓΟΣ (ΠΖ)',
    'ΑΝΘΛΓΟΣ (ΠΒ)',
    'ΑΝΘΣΤΗΣ (ΠΖ)',
    'ΑΡΧΛΧΙΑΣ (ΠΖ)',
    'ΕΠΛΧΙΑΣ (ΠΒ)',
    'ΛΧΙΑΣ (ΠΖ)'
  ];

  constructor() {
    const current = this.storage.unitInfo();
    this.unitForm = { 
      ...current,
      commanderTitle: current.commanderTitle || 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ',
      dutyOfficerSignatureTitle: current.dutyOfficerSignatureTitle || 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ',
      supervisorSignatureTitle: current.supervisorSignatureTitle || 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ',
      supervisorName: current.supervisorName || '',
      emblemUrl: current.emblemUrl || DEFAULT_EMBLEM_BASE64
    };
  }

  setTab(tab: SettingsTab) {
    this.activeTab.set(tab);
  }

  onEmblemFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.storage.notify('Παρακαλώ επιλέξτε έγκυρο αρχείο εικόνας (PNG, JPG, WEBP, SVG).', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result as string;
      if (result) {
        this.processEmblemImage(result);
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  processEmblemImage(dataUrl: string) {
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      if (img.width > maxDim || img.height > maxDim) {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          this.unitForm.emblemUrl = canvas.toDataURL('image/png');
          this.storage.notify('Το νέο έμβλημα επιλέχθηκε. Πατήστε "Αποθήκευση Στοιχείων Μονάδας" για κατοχύρωση.', 'info');
          return;
        }
      }
      this.unitForm.emblemUrl = dataUrl;
      this.storage.notify('Το νέο έμβλημα επιλέχθηκε. Πατήστε "Αποθήκευση Στοιχείων Μονάδας" για κατοχύρωση.', 'info');
    };
    img.src = dataUrl;
  }

  resetEmblemToDefault() {
    this.unitForm.emblemUrl = DEFAULT_EMBLEM_BASE64;
    this.storage.notify('Επαναφέρθηκε το προεπιλεγμένο έμβλημα στρατοπέδου.', 'info');
  }

  saveUnitInfo() {
    if (!this.unitForm.name.trim()) {
      this.storage.notify('Παρακαλώ συμπληρώστε την ονομασία της μονάδας.', 'warning');
      return;
    }
    this.storage.updateUnitInfo(this.unitForm);
  }

  // --- Higher Personnel Actions ---
  openAddHpModal() {
    this.editingHpId.set(null);
    this.hpForm = {
      fullName: '',
      rank: 'ΑΝΧΗΣ (ΠΒ)',
      roleTitle: 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ'
    };
    this.showHpModal.set(true);
  }

  openEditHpModal(hp: HigherPersonnel) {
    this.editingHpId.set(hp.id);
    this.hpForm = {
      fullName: hp.fullName,
      rank: hp.rank,
      roleTitle: hp.roleTitle
    };
    this.showHpModal.set(true);
  }

  closeHpModal() {
    this.showHpModal.set(false);
    this.editingHpId.set(null);
  }

  selectTitlePreset(title: string) {
    this.hpForm.roleTitle = title;
  }

  selectRankPreset(rank: string) {
    this.hpForm.rank = rank;
  }

  saveHp() {
    if (!this.hpForm.fullName.trim()) {
      this.storage.notify('Παρακαλώ συμπληρώστε το ονοματεπώνυμο του στελέχους.', 'warning');
      return;
    }
    if (!this.hpForm.roleTitle.trim()) {
      this.storage.notify('Παρακαλώ συμπληρώστε τη θέση ευθύνης / καθήκον.', 'warning');
      return;
    }
    if (!this.hpForm.rank.trim()) {
      this.storage.notify('Παρακαλώ συμπληρώστε το βαθμό του στελέχους.', 'warning');
      return;
    }

    const editId = this.editingHpId();
    if (editId) {
      this.storage.updateHigherPersonnel(editId, {
        fullName: this.hpForm.fullName,
        rank: this.hpForm.rank,
        roleTitle: this.hpForm.roleTitle
      });
    } else {
      this.storage.addHigherPersonnel({
        fullName: this.hpForm.fullName,
        rank: this.hpForm.rank,
        roleTitle: this.hpForm.roleTitle
      });
    }
    this.closeHpModal();
  }

  deleteHp(id: string, name: string) {
    if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το στέλεχος «${name}»;`)) {
      this.storage.deleteHigherPersonnel(id);
    }
  }

  // --- Database Actions ---
  createBackup() {
    this.storage.createBackup();
  }

  saveAs() {
    this.storage.saveDataAs();
  }

  openOtherFile() {
    this.storage.loadFromOtherFile();
  }

  resetToDefault() {
    if (confirm('ΠΡΟΣΟΧΗ: Θέλετε να επαναφέρετε τα προεπιλεγμένα πρότυπα δεδομένα; Όλες οι τρέχουσες αλλαγές θα αντικατασταθούν.')) {
      this.storage.resetToDefaultData();
      this.unitForm = { ...this.storage.unitInfo() };
    }
  }
}
