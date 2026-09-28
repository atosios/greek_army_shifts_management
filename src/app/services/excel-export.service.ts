import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { StorageService } from './storage.service';
import { DailySchedule, Personnel, Leave, formatGreekDate, getCorpsShort } from '../models/shift.model';

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {
  private storage = inject(StorageService);

  async exportScheduleToExcel(schedule: DailySchedule): Promise<boolean> {
    const unit = this.storage.unitInfo();
    const personnelMap = new Map<string, Personnel>();
    this.storage.personnel().forEach(p => personnelMap.set(p.id, p));

    // Prepare rows
    const rows: (string | number)[][] = [];

    // Header metadata
    rows.push(['ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ']);
    rows.push(['ΥΠΟΥΡΓΕΙΟ ΕΘΝΙΚΗΣ ΑΜΥΝΑΣ']);
    rows.push([`ΣΧΗΜΑΤΙΣΜΟΣ: ${unit.division || '16η Μ/Κ ΜΠ'}`]);
    rows.push([`ΜΟΝΑΔΑ: ${unit.name} - ${unit.location}`]);
    rows.push([]);
    rows.push([`ΗΜΕΡΗΣΙΑ ΔΙΑΤΑΓΗ ΥΠΗΡΕΣΙΑΣ`]);
    rows.push([`ΗΜΕΡΟΜΗΝΙΑ: ${formatGreekDate(schedule.date)} ${schedule.isHolidayOrWeekend ? '(ΑΡΓΙΑ / ΣΑΒΒΑΤΟΚΥΡΙΑΚΟ)' : '(ΚΑΘΗΜΕΡΙΝΗ)'}`]);
    rows.push([]);

    // Table Header
    rows.push([
      'Α/Α',
      'Υπηρεσία / Καθήκον',
      'Βαθμός',
      'Ονοματεπώνυμο',
      'Α.Σ.Μ. / ΕΣΣΟ',
      'Υπομονάδα / Λόχος',
      'Κατάσταση',
      'Ωράριο / Βάρδια Υπηρεσίας',
      'Υπογραφή / Παρατηρήσεις'
    ]);

    let counter = 1;
    let totalAssigned = 0;

    for (const duty of schedule.duties) {
      for (const slot of duty.slots) {
        const p = slot.personId ? personnelMap.get(slot.personId) : null;
        if (p) totalAssigned++;

        rows.push([
          counter++,
          duty.dutyName,
          p ? p.rankShort : '---',
          p ? p.fullName : (slot.personName || 'ΚΕΝΟ'),
          p ? p.asm : '---',
          p ? (p.company || '---') : '---',
          p ? p.status : '---',
          slot.hoursNote || '08:00 - 08:00',
          slot.conflictWarning ? (slot.conflictWarning.includes('Ειδική εναλλαγή') ? `[${slot.conflictWarning}]` : `[ΠΡΟΣΟΧΗ: ${slot.conflictWarning}]`) : ''
        ]);
      }
    }

    rows.push([]);
    rows.push(['ΣΥΓΚΕΝΤΡΩΤΙΚΑ ΣΤΟΙΧΕΙΑ ΔΥΝΑΜΕΩΣ']);
    rows.push(['Σύνολο Προσωπικού σε Υπηρεσία:', totalAssigned]);

    // Leaves on this date
    const leavesOnDate = this.storage.leaves().filter(l => 
      l.startDate <= schedule.date && schedule.date <= l.endDate && l.status !== 'Ακυρωμένη'
    );
    rows.push(['Προσωπικό σε Άδεια / Απαλλαγή / Ε.Υ.:', leavesOnDate.length]);
    if (leavesOnDate.length > 0) {
      for (const l of leavesOnDate) {
        rows.push(['', `- ${l.personName} (${l.type}: ${formatGreekDate(l.startDate)} έως ${formatGreekDate(l.endDate)})`]);
      }
    }

    rows.push([]);
    rows.push([]);
    // Signature block
    rows.push([
      '',
      unit.dutyOfficerSignatureTitle || 'Ο Αξιωματικός Επιχειρήσεων',
      '',
      '',
      '',
      'Ο ΔΙΟΙΚΗΤΗΣ'
    ]);
    rows.push([
      '',
      unit.dutyOfficerName || 'Ταγματάρχης (ΠΖ) Κωνσταντίνου Δημήτριος',
      '',
      '',
      '',
      unit.commanderName || 'Αντισυνταγματάρχης (ΠΖ) Παπαδόπουλος Γεώργιος'
    ]);

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // A/A
      { wch: 36 }, // Duty
      { wch: 14 }, // Rank
      { wch: 28 }, // Full Name
      { wch: 18 }, // ASM
      { wch: 22 }, // Company
      { wch: 16 }, // Status
      { wch: 32 }, // Hours
      { wch: 30 }  // Signature / Notes
    ];

    // Create Workbook
    const wb = XLSX.utils.book_new();
    const sheetName = `Διαταγή_${schedule.date.slice(5)}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const filename = `Ημερήσια_Διαταγή_Υπηρεσίας_${unit.name.replace(/[\/\s]/g, '_')}_${schedule.date}.xlsx`;

    // Save using Electron or Web download
    if (this.storage.isElectron() && window.electronAPI) {
      try {
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const res = await window.electronAPI.saveExcelFile(buffer, filename);
        if (res.success && res.filePath) {
          this.storage.notify(`Το αρχείο Excel εξήχθη επιτυχώς: ${res.filePath}`, 'success');
          // Offer to open it
          return true;
        } else if (res.canceled) {
          return false;
        } else {
          this.storage.notify(`Σφάλμα εξαγωγής: ${res.error}`, 'error');
          return false;
        }
      } catch (err: any) {
        this.storage.notify(`Σφάλμα: ${err.message}`, 'error');
        return false;
      }
    } else {
      // Browser fallback
      XLSX.writeFile(wb, filename);
      this.storage.notify('Το αρχείο Excel λήφθηκε επιτυχώς!', 'success');
      return true;
    }
  }

  // Export full personnel roster to Excel
  async exportPersonnelRosterToExcel(): Promise<boolean> {
    const personnel = this.storage.personnel();
    const unit = this.storage.unitInfo();

    const rows: (string | number)[][] = [
      ['ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ'],
      ['ΥΠΟΥΡΓΕΙΟ ΕΘΝΙΚΗΣ ΑΜΥΝΑΣ'],
      [`ΜΟΝΑΔΑ: ${unit.name} - ${unit.location}`],
      ['ΕΠΙΣΗΜΗ ΚΑΤΑΣΤΑΣΗ ΔΥΝΑΜΕΩΣ & ΜΗΤΡΩΟΥ ΥΠΗΡΕΣΙΩΝ'],
      [`Ημερομηνία Εξαγωγής: ${new Date().toLocaleDateString('el-GR')}`],
      [],
      [
        'Α/Α',
        'Βαθμός',
        'Ονοματεπώνυμο',
        'Α.Σ.Μ.',
        'ΟΠΛΟ',
        'Ικανότητα',
        'Οπλισμός',
        'Θάλαμος',
        'Κρεβάτι',
        'Υπηρεσίες',
        'Τελευταία Υπηρεσία',
        'Ενεργός'
      ]
    ];

    personnel.forEach((p, idx) => {
      rows.push([
        idx + 1,
        p.rankShort || 'ΣΤΡ',
        p.fullName,
        p.asm || '-',
        getCorpsShort(p.specialty),
        p.fitnessProfile || (p.status === 'Άοπλος' ? 'Ι3' : 'Ι1'),
        p.status,
        p.barracksRoom || '-',
        p.bedNumber || '-',
        p.dutyScore,
        p.lastDutyDate ? formatGreekDate(p.lastDutyDate) : 'Καμία',
        p.active ? 'ΝΑΙ' : 'ΟΧΙ'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 10 },
      { wch: 28 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Δύναμη_Προσωπικού');
    const filename = `Δύναμη_Προσωπικού_${unit.name.replace(/[\/\s]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    if (this.storage.isElectron() && window.electronAPI) {
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const res = await window.electronAPI.saveExcelFile(buffer, filename);
      if (res.success && res.filePath) {
        this.storage.notify(`Το αρχείο Excel δημιουργήθηκε: ${res.filePath}`, 'success');
        return true;
      }
      return false;
    } else {
      XLSX.writeFile(wb, filename);
      this.storage.notify('Το αρχείο Excel λήφθηκε επιτυχώς!', 'success');
      return true;
    }
  }
}
