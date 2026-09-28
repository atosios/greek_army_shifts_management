import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { UnitInfo } from '../../models/shift.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent {
  storage = inject(StorageService);

  unitForm: UnitInfo = {
    name: '',
    location: '',
    division: '',
    commanderName: '',
    dutyOfficerSignatureTitle: '',
    dutyOfficerName: ''
  };

  constructor() {
    this.unitForm = { ...this.storage.unitInfo() };
  }

  saveUnitInfo() {
    if (!this.unitForm.name.trim()) {
      this.storage.notify('Παρακαλώ συμπληρώστε την ονομασία της μονάδας.', 'warning');
      return;
    }
    this.storage.updateUnitInfo(this.unitForm);
  }

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
