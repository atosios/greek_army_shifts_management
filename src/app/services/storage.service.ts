import { Injectable, signal, computed } from '@angular/core';
import { AppData, Personnel, DutyType, Leave, DailySchedule, WeekendPlan, UnitInfo, toGreekCaps, formatGreekDate, getCorpsShort } from '../models/shift.model';
import { DEFAULT_APP_DATA, normalizeRank } from '../data/default-data';
import { getDutySlotsForDate, formatIntervalsToString, stripGroupText } from '../data/time-presets';

declare global {
  interface Window {
    electronAPI?: {
      loadData: () => Promise<{ success: boolean; data?: AppData; filePath?: string; error?: string }>;
      saveData: (data: AppData) => Promise<{ success: boolean; filePath?: string; savedAt?: string; error?: string }>;
      saveDataAs: (data: AppData) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      selectDataFile: () => Promise<{ success: boolean; data?: AppData; filePath?: string; canceled?: boolean; error?: string }>;
      backupData: () => Promise<{ success: boolean; backupPath?: string; error?: string }>;
      getDataFilePath: () => Promise<{ filePath: string; isPortable: boolean }>;
      saveExcelFile: (buffer: ArrayBuffer, defaultFilename: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      openPath: (path: string) => Promise<{ success: boolean; error?: string }>;
      showItemInFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
      printWindow: () => Promise<{ success: boolean }>;
      minimizeWindow?: () => Promise<void>;
      maximizeWindow?: () => Promise<void>;
      closeWindow?: () => Promise<void>;
      getAppInfo: () => Promise<any>;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly LOCAL_STORAGE_KEY = 'greek_army_shifts_app_data';

  // Signals
  readonly appData = signal<AppData>(DEFAULT_APP_DATA);
  readonly isElectron = signal<boolean>(false);
  readonly storageFilePath = signal<string>('Τοπική Μνήμη (Local Memory)');
  readonly isPortable = signal<boolean>(false);
  readonly lastSavedTime = signal<string>('');
  readonly isSaving = signal<boolean>(false);
  readonly statusNotification = signal<{ message: string; type: 'success' | 'warning' | 'error' | 'info' } | null>(null);

  // Computed signals
  readonly personnel = computed(() => this.appData().personnel);
  readonly dutyTypes = computed(() => this.appData().dutyTypes);
  readonly leaves = computed(() => this.appData().leaves);
  readonly schedules = computed(() => this.appData().schedules);
  readonly unitInfo = computed(() => this.appData().unitInfo);
  readonly weekendPlans = computed(() => this.appData().weekendPlans || {});

  readonly activePersonnel = computed(() => 
    this.appData().personnel.filter(p => p.active)
  );

  readonly activeDutyTypes = computed(() => 
    this.appData().dutyTypes.filter(d => d.active)
  );

  constructor() {
    this.initializeData();
  }

  async initializeData() {
    const hasElectron = typeof window !== 'undefined' && !!window.electronAPI;
    this.isElectron.set(hasElectron);

    if (hasElectron && window.electronAPI) {
      try {
        const info = await window.electronAPI.getDataFilePath();
        this.storageFilePath.set(info.filePath);
        this.isPortable.set(info.isPortable);

        const result = await window.electronAPI.loadData();
        if (result.success && result.data) {
          const loadedData = result.data;
          const hasKath = loadedData.dutyTypes?.some((d: any) => d.id === 'duty-kathariotites');
          const thf = loadedData.dutyTypes?.find((d: any) => d.id === 'duty-thalamofylakas');
          const opl = loadedData.dutyTypes?.find((d: any) => d.id === 'duty-oplofylakas');
          const hasOldNotes = thf?.description?.includes('Γκρουπ') || thf?.weekendSwapNote;
          if (!hasKath || !thf || thf.slots !== 8 || !opl || hasOldNotes) {
            loadedData.dutyTypes = DEFAULT_APP_DATA.dutyTypes;
          }
          if (loadedData.dutyTypes) {
            loadedData.dutyTypes = loadedData.dutyTypes.map((d: any) => ({
              ...d,
              weekendSwapNote: undefined,
              allowedRanks: (d.allowedRanks || []).map((r: string) => normalizeRank(r).rankShort)
            }));
          }
          if (!loadedData.personnel || loadedData.personnel.length < 24) {
            loadedData.personnel = DEFAULT_APP_DATA.personnel;
          } else {
            const allDIds = (loadedData.dutyTypes || DEFAULT_APP_DATA.dutyTypes).map((d: any) => d.id);
            loadedData.personnel = loadedData.personnel.map((p, index) => {
              const isExempt = p.exemptFromAllDuties || false;
              return {
                ...p,
                rank: 'ΣΤΡΑΤΙΩΤΗΣ',
                rankShort: 'ΣΤΡ',
                category: 'Κληρωτός' as const,
                specialty: getCorpsShort(p.specialty),
                rotationalGroup: undefined,
                barracksRoom: p.barracksRoom || '',
                bedNumber: p.bedNumber || '',
                weaponNumber: p.status === 'Άοπλος' ? '-' : (p.weaponNumber || ''),
                fullName: toGreekCaps(p.fullName),
                fitnessProfile: p.fitnessProfile || (p.status === 'Άοπλος' ? 'Ι3' : 'Ι1'),
                status: p.status === 'Άοπλος' ? 'Άοπλος' : 'Ένοπλος',
                exemptFromAllDuties: isExempt,
                eligibleDutyIds: isExempt ? [] : (p.eligibleDutyIds && p.eligibleDutyIds.length > 0 ? p.eligibleDutyIds : allDIds)
              };
            });
          }
          if (loadedData.schedules) {
            for (const s of loadedData.schedules) {
              if (s.duties) {
                for (const d of s.duties) {
                  if (d.slots) {
                    for (const sl of d.slots) {
                      if (sl.groupTag?.includes('ΓΚΡΟΥΠ')) sl.groupTag = undefined;
                      if (sl.rotationalGroup?.includes('ΓΚΡΟΥΠ')) sl.rotationalGroup = undefined;
                    }
                  }
                }
              }
            }
          }
          if (loadedData.dutyTypes) {
            for (const d of loadedData.dutyTypes) {
              if (d.slotDefinitions) {
                for (const sd of d.slotDefinitions) {
                  if (sd.groupTag?.includes('ΓΚΡΟΥΠ')) sd.groupTag = undefined;
                  if (sd.groupName?.includes('ΓΚΡΟΥΠ')) sd.groupName = '';
                }
              }
            }
          }
          if (loadedData.leaves) {
            loadedData.leaves = loadedData.leaves.map(l => ({
              ...l,
              personName: toGreekCaps(l.personName)
            }));
          }
          this.appData.set(loadedData);
          this.notify('Φορτώθηκαν δεδομένα επιτυχώς από το αρχείο USB/Δίσκου', 'success');
          return;
        }
      } catch (err) {
        console.error('Failed to load from Electron:', err);
      }
    }

    // Fallback to localStorage
    try {
      const localDataStr = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (localDataStr) {
        const parsed = JSON.parse(localDataStr);
        const hasKath = parsed.dutyTypes?.some((d: any) => d.id === 'duty-kathariotites');
        const thf = parsed.dutyTypes?.find((d: any) => d.id === 'duty-thalamofylakas');
        const opl = parsed.dutyTypes?.find((d: any) => d.id === 'duty-oplofylakas');
        const hasOldNotes = thf?.description?.includes('Γκρουπ') || thf?.weekendSwapNote;
        if (!hasKath || !thf || thf.slots !== 8 || !opl || hasOldNotes) {
          parsed.dutyTypes = DEFAULT_APP_DATA.dutyTypes;
        } else if (parsed.dutyTypes) {
          parsed.dutyTypes = parsed.dutyTypes.map((d: any) => ({
            ...d,
            category: d.category === 'Οπλίτης' ? 'Στρατιώτης' : d.category,
            weekendSwapNote: undefined,
            allowedRanks: (d.allowedRanks || []).map((r: string) => normalizeRank(r).rankShort)
          }));
        }
        if (!parsed.personnel || parsed.personnel.length < 24) {
          parsed.personnel = DEFAULT_APP_DATA.personnel;
        } else {
          const allDIds = (parsed.dutyTypes || DEFAULT_APP_DATA.dutyTypes).map((d: any) => d.id);
          parsed.personnel = parsed.personnel.map((p: any, index: number) => {
            const isExempt = p.exemptFromAllDuties || false;
            return {
              ...p,
              rank: 'ΣΤΡΑΤΙΩΤΗΣ',
              rankShort: 'ΣΤΡ',
              category: 'Κληρωτός' as const,
              specialty: getCorpsShort(p.specialty),
              rotationalGroup: undefined,
              barracksRoom: p.barracksRoom || '',
              bedNumber: p.bedNumber || '',
              weaponNumber: p.status === 'Άοπλος' ? '-' : (p.weaponNumber || ''),
              fullName: toGreekCaps(p.fullName),
              fitnessProfile: p.fitnessProfile || (p.status === 'Άοπλος' ? 'Ι3' : 'Ι1'),
              status: p.status === 'Άοπλος' ? 'Άοπλος' : 'Ένοπλος',
              exemptFromAllDuties: isExempt,
              eligibleDutyIds: isExempt ? [] : (p.eligibleDutyIds && p.eligibleDutyIds.length > 0 ? p.eligibleDutyIds : allDIds)
            };
          });
        }
        if (parsed.schedules) {
          for (const s of parsed.schedules) {
            if (s.duties) {
              for (const d of s.duties) {
                if (d.slots) {
                  for (const sl of d.slots) {
                    if (sl.groupTag?.includes('ΓΚΡΟΥΠ')) sl.groupTag = undefined;
                    if (sl.rotationalGroup?.includes('ΓΚΡΟΥΠ')) sl.rotationalGroup = undefined;
                  }
                }
              }
            }
          }
        }
        if (parsed.dutyTypes) {
          for (const d of parsed.dutyTypes) {
            if (d.slotDefinitions) {
              for (const sd of d.slotDefinitions) {
                if (sd.groupTag?.includes('ΓΚΡΟΥΠ')) sd.groupTag = undefined;
                if (sd.groupName?.includes('ΓΚΡΟΥΠ')) sd.groupName = '';
              }
            }
          }
        }
        if (parsed.leaves) {
          parsed.leaves = parsed.leaves.map((l: any) => ({
            ...l,
            personName: toGreekCaps(l.personName)
          }));
        }
        this.appData.set(parsed);
        this.saveData();
        this.notify('Φορτώθηκαν αποθηκευμένα δεδομένα προγράμματος', 'info');
        return;
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }

    // Default seed data
    this.appData.set(DEFAULT_APP_DATA);
    this.saveData();
  }

  notify(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') {
    this.statusNotification.set({ message, type });
    setTimeout(() => {
      if (this.statusNotification()?.message === message) {
        this.statusNotification.set(null);
      }
    }, 4500);
  }

  async saveData(): Promise<boolean> {
    this.isSaving.set(true);
    const dataToSave = this.appData();

    try {
      // Always keep local storage updated as a mirror
      try {
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (e) {
        // ignore localStorage errors (e.g. quota)
      }

      if (this.isElectron() && window.electronAPI) {
        const res = await window.electronAPI.saveData(dataToSave);
        if (res.success) {
          const time = new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          this.lastSavedTime.set(time);
          if (res.filePath) {
            this.storageFilePath.set(res.filePath);
          }
          this.notify('Τα δεδομένα αποθηκεύτηκαν επιτυχώς στο αρχείο!', 'success');
          return true;
        } else {
          this.notify(`Σφάλμα αποθήκευσης: ${res.error}`, 'error');
          return false;
        }
      } else {
        const time = new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.lastSavedTime.set(time);
        this.notify('Αποθηκεύτηκε στην τοπική μνήμη περιηγητή', 'success');
        return true;
      }
    } catch (err: any) {
      this.notify(`Σφάλμα: ${err.message}`, 'error');
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  async saveDataAs(): Promise<boolean> {
    if (!this.isElectron() || !window.electronAPI) {
      this.notify('Η λειτουργία "Αποθήκευση ως" είναι διαθέσιμη στην εφαρμογή επιφάνειας εργασίας (Electron)', 'warning');
      return false;
    }

    try {
      const res = await window.electronAPI.saveDataAs(this.appData());
      if (res.success && res.filePath) {
        this.storageFilePath.set(res.filePath);
        this.notify(`Νέο αρχείο βάσης δημιουργήθηκε: ${res.filePath}`, 'success');
        return true;
      }
      return false;
    } catch (e: any) {
      this.notify(`Σφάλμα: ${e.message}`, 'error');
      return false;
    }
  }

  async loadFromOtherFile(): Promise<boolean> {
    if (!this.isElectron() || !window.electronAPI) {
      this.notify('Η επιλογή αρχείου είναι διαθέσιμη στην εφαρμογή επιφάνειας εργασίας (Electron)', 'warning');
      return false;
    }

    try {
      const res = await window.electronAPI.selectDataFile();
      if (res.success && res.data && res.filePath) {
        this.appData.set(res.data);
        this.storageFilePath.set(res.filePath);
        this.notify(`Φορτώθηκε επιτυχώς το αρχείο: ${res.filePath}`, 'success');
        return true;
      }
      return false;
    } catch (e: any) {
      this.notify(`Σφάλμα: ${e.message}`, 'error');
      return false;
    }
  }

  async createBackup(): Promise<boolean> {
    if (!this.isElectron() || !window.electronAPI) {
      // Web fallback: download json
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.appData(), null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `army_shifts_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.notify('Το αντίγραφο ασφαλείας λήφθηκε (JSON)', 'success');
      return true;
    }

    try {
      const res = await window.electronAPI.backupData();
      if (res.success && res.backupPath) {
        this.notify(`Δημιουργήθηκε αντίγραφο ασφαλείας: ${res.backupPath}`, 'success');
        return true;
      } else {
        this.notify(`Σφάλμα δημιουργίας αντιγράφου: ${res.error}`, 'error');
        return false;
      }
    } catch (e: any) {
      this.notify(`Σφάλμα: ${e.message}`, 'error');
      return false;
    }
  }

  // --- Personnel Actions ---
  addPersonnel(person: Omit<Personnel, 'id' | 'dutyScore'> & { dutyScore?: number }) {
    const fitnessProfile = person.fitnessProfile || (person.status === 'Άοπλος' ? 'Ι3' : 'Ι1');
    const status = (fitnessProfile === 'Ι1' || fitnessProfile === 'Ι2') ? 'Ένοπλος' : (person.status === 'Άοπλος' ? 'Άοπλος' : 'Ένοπλος');
    const allDutyIds = this.appData().dutyTypes.map(d => d.id);
    const exemptFromAllDuties = person.exemptFromAllDuties || false;
    const eligibleDutyIds = exemptFromAllDuties 
      ? [] 
      : (person.eligibleDutyIds && person.eligibleDutyIds.length > 0 ? person.eligibleDutyIds : allDutyIds);

    const newPerson: Personnel = {
      ...person,
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      specialty: getCorpsShort(person.specialty),
      barracksRoom: person.barracksRoom ? toGreekCaps(person.barracksRoom.trim()) : '',
      bedNumber: person.bedNumber ? toGreekCaps(person.bedNumber.trim()) : '',
      weaponNumber: status === 'Άοπλος' ? '-' : (person.weaponNumber ? toGreekCaps(person.weaponNumber.trim()) : ''),
      fullName: toGreekCaps(person.fullName.trim()),
      fitnessProfile,
      status,
      exemptFromAllDuties,
      eligibleDutyIds,
      id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dutyScore: person.dutyScore ?? 0,
      weekendDutyScore: 0,
      active: true
    };

    this.appData.update(prev => ({
      ...prev,
      personnel: [newPerson, ...prev.personnel]
    }));
    this.saveData();
    this.notify(`Προστέθηκε ο ${newPerson.rankShort} ${newPerson.fullName}`, 'success');
  }

  bulkAddPersonnel(people: (Omit<Personnel, 'id' | 'dutyScore'> & { dutyScore?: number })[]) {
    if (!people || people.length === 0) return;
    const allDutyIds = this.appData().dutyTypes.map(d => d.id);
    const newPersons: Personnel[] = people.map((person, index) => {
      const fitnessProfile = person.fitnessProfile || (person.status === 'Άοπλος' ? 'Ι3' : 'Ι1');
      const status = (fitnessProfile === 'Ι1' || fitnessProfile === 'Ι2') ? 'Ένοπλος' : (person.status === 'Άοπλος' ? 'Άοπλος' : 'Ένοπλος');
      const exemptFromAllDuties = person.exemptFromAllDuties || false;
      const eligibleDutyIds = exemptFromAllDuties 
        ? [] 
        : (person.eligibleDutyIds && person.eligibleDutyIds.length > 0 ? person.eligibleDutyIds : allDutyIds);

      return {
        ...person,
        rank: 'ΣΤΡΑΤΙΩΤΗΣ',
        rankShort: 'ΣΤΡ',
        category: 'Κληρωτός',
        specialty: getCorpsShort(person.specialty),
        barracksRoom: person.barracksRoom ? toGreekCaps(person.barracksRoom.trim()) : '',
        bedNumber: person.bedNumber ? toGreekCaps(person.bedNumber.trim()) : '',
        weaponNumber: status === 'Άοπλος' ? '-' : (person.weaponNumber ? toGreekCaps(person.weaponNumber.trim()) : ''),
        fullName: toGreekCaps(person.fullName.trim()),
        fitnessProfile,
        status,
        exemptFromAllDuties,
        eligibleDutyIds,
        id: `p-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        dutyScore: person.dutyScore ?? 0,
        weekendDutyScore: 0,
        active: true
      };
    });

    this.appData.update(prev => ({
      ...prev,
      personnel: [...newPersons, ...prev.personnel]
    }));
    this.saveData();
    this.notify(`Εισήχθησαν επιτυχώς ${newPersons.length} νέοι στρατιώτες στη Δύναμη`, 'success');
  }

  bulkImportPersonnel(
    items: {
      person: Omit<Personnel, 'id' | 'dutyScore'> & { dutyScore?: number };
      action: 'INSERT' | 'UPDATE' | 'SKIP';
      existingPersonId?: string;
    }[]
  ) {
    if (!items || items.length === 0) return;
    const allDutyIds = this.appData().dutyTypes.map(d => d.id);
    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    let currentPersonnel = [...this.appData().personnel];
    const newPersonsToAdd: Personnel[] = [];

    items.forEach((item, index) => {
      if (item.action === 'SKIP') {
        skippedCount++;
        return;
      }

      const pData = item.person;
      const fitnessProfile = pData.fitnessProfile || (pData.status === 'Άοπλος' ? 'Ι3' : 'Ι1');
      const status = (fitnessProfile === 'Ι1' || fitnessProfile === 'Ι2') ? 'Ένοπλος' : (pData.status === 'Άοπλος' ? 'Άοπλος' : 'Ένοπλος');
      const exemptFromAllDuties = pData.exemptFromAllDuties || false;
      const eligibleDutyIds = exemptFromAllDuties 
        ? [] 
        : (pData.eligibleDutyIds && pData.eligibleDutyIds.length > 0 ? pData.eligibleDutyIds : allDutyIds);

      if (item.action === 'UPDATE' && item.existingPersonId) {
        const idx = currentPersonnel.findIndex(p => p.id === item.existingPersonId);
        if (idx >= 0) {
          const existing = currentPersonnel[idx];
          currentPersonnel[idx] = {
            ...existing,
            fullName: toGreekCaps(pData.fullName.trim()),
            asm: toGreekCaps((pData.asm || '').trim()),
            specialty: getCorpsShort(pData.specialty),
            fitnessProfile,
            status,
            barracksRoom: pData.barracksRoom ? toGreekCaps(pData.barracksRoom.trim()) : existing.barracksRoom,
            bedNumber: pData.bedNumber ? toGreekCaps(pData.bedNumber.trim()) : existing.bedNumber,
            weaponNumber: status === 'Άοπλος' ? '-' : (pData.weaponNumber ? toGreekCaps(pData.weaponNumber.trim()) : existing.weaponNumber || ''),
            exemptFromAllDuties,
            eligibleDutyIds,
            dutyScore: pData.dutyScore !== undefined && pData.dutyScore > 0 ? pData.dutyScore : existing.dutyScore,
            notes: pData.notes ? pData.notes.trim() : existing.notes
          };
          updatedCount++;
          return;
        }
      }

      newPersonsToAdd.push({
        ...pData,
        rank: 'ΣΤΡΑΤΙΩΤΗΣ',
        rankShort: 'ΣΤΡ',
        category: 'Κληρωτός',
        specialty: getCorpsShort(pData.specialty),
        barracksRoom: pData.barracksRoom ? toGreekCaps(pData.barracksRoom.trim()) : '',
        bedNumber: pData.bedNumber ? toGreekCaps(pData.bedNumber.trim()) : '',
        weaponNumber: status === 'Άοπλος' ? '-' : (pData.weaponNumber ? toGreekCaps(pData.weaponNumber.trim()) : ''),
        fullName: toGreekCaps(pData.fullName.trim()),
        fitnessProfile,
        status,
        exemptFromAllDuties,
        eligibleDutyIds,
        id: `p-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        dutyScore: pData.dutyScore ?? 0,
        weekendDutyScore: 0,
        active: true
      });
      insertedCount++;
    });

    this.appData.update(prev => ({
      ...prev,
      personnel: [...newPersonsToAdd, ...currentPersonnel]
    }));
    this.saveData();

    const summaryParts: string[] = [];
    if (insertedCount > 0) summaryParts.push(`${insertedCount} νέοι`);
    if (updatedCount > 0) summaryParts.push(`${updatedCount} ενημερώθηκαν`);
    if (skippedCount > 0) summaryParts.push(`${skippedCount} παραλείφθηκαν`);
    this.notify(`Εισαγωγή ολοκληρώθηκε: ${summaryParts.join(', ')}`, 'success');
  }

  updatePersonnel(id: string, updates: Partial<Personnel>) {
    const sanitized: Partial<Personnel> = { 
      ...updates,
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός'
    };
    if (sanitized.specialty) {
      sanitized.specialty = getCorpsShort(sanitized.specialty);
    }
    if (sanitized.barracksRoom !== undefined) {
      sanitized.barracksRoom = toGreekCaps(sanitized.barracksRoom.trim());
    }
    if (sanitized.bedNumber !== undefined) {
      sanitized.bedNumber = toGreekCaps(sanitized.bedNumber.trim());
    }
    if (sanitized.weaponNumber !== undefined) {
      sanitized.weaponNumber = sanitized.status === 'Άοπλος' ? '-' : toGreekCaps(sanitized.weaponNumber.trim());
    }
    if (sanitized.fullName !== undefined) {
      sanitized.fullName = toGreekCaps(sanitized.fullName.trim());
    }
    if (sanitized.fitnessProfile === 'Ι1' || sanitized.fitnessProfile === 'Ι2') {
      sanitized.status = 'Ένοπλος';
    }
    if (sanitized.status === 'Άοπλος') {
      sanitized.weaponNumber = '-';
    }
    if (sanitized.exemptFromAllDuties) {
      sanitized.eligibleDutyIds = [];
    }
    this.appData.update(prev => ({
      ...prev,
      personnel: prev.personnel.map(p => p.id === id ? { ...p, ...sanitized } : p)
    }));
    this.saveData();
    this.notify('Στοιχεία προσωπικού ενημερώθηκαν', 'success');
  }

  deletePersonnel(id: string) {
    this.deletePersonnelBulk([id]);
  }

  deletePersonnelBulk(ids: string[]) {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const existing = this.appData().personnel.filter(p => idSet.has(p.id));
    if (existing.length === 0) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let removedFromUpcomingCount = 0;

    this.appData.update(prev => {
      // 1. Remove from personnel roster
      const updatedPersonnel = prev.personnel.filter(p => !idSet.has(p.id));

      // 2. Remove leaves
      const updatedLeaves = prev.leaves.filter(l => !idSet.has(l.personId));

      // 3. Remove from upcoming duties (date >= todayStr), keeping past schedules untouched
      const updatedSchedules = prev.schedules.map(sched => {
        if (!sched.duties || sched.date < todayStr) {
          return sched;
        }

        let schedModified = false;
        const newDuties = sched.duties.map(duty => {
          let dutyModified = false;
          const newSlots = duty.slots.map(slot => {
            if (slot.personId && idSet.has(slot.personId)) {
              dutyModified = true;
              schedModified = true;
              removedFromUpcomingCount++;
              return {
                ...slot,
                personId: null,
                personName: '',
                rankShort: '',
                company: '',
                rotationalGroup: undefined,
                manualOverride: false,
                conflictWarning: 'Δεν βρέθηκε διαθέσιμος στρατιώτης με τα απαιτούμενα κριτήρια.',
                conflictSeverity: 'ERROR' as const
              };
            }
            return slot;
          });

          return dutyModified ? { ...duty, slots: newSlots } : duty;
        });

        if (!schedModified) {
          return sched;
        }

        let newPrevDates = sched.previousLastDutyDates;
        if (newPrevDates) {
          let prevDatesModified = false;
          const copyDates = { ...newPrevDates };
          for (const id of ids) {
            if (copyDates[id]) {
              delete copyDates[id];
              prevDatesModified = true;
            }
          }
          if (prevDatesModified) {
            newPrevDates = copyDates;
          }
        }

        return {
          ...sched,
          duties: newDuties,
          previousLastDutyDates: newPrevDates
        };
      });

      // 4. Remove from upcoming weekend plans
      let updatedWeekendPlans = prev.weekendPlans;
      if (prev.weekendPlans) {
        let plansModified = false;
        const nextPlans: Record<string, WeekendPlan> = {};
        for (const [friDate, plan] of Object.entries(prev.weekendPlans)) {
          const isUpcoming = (plan.sundayDate || friDate) >= todayStr;
          const hasAny = plan.saturdayOffIds.some(pid => idSet.has(pid)) ||
                         plan.sundayOffIds.some(pid => idSet.has(pid)) ||
                         plan.inCampIds?.some(pid => idSet.has(pid));

          if (isUpcoming && hasAny) {
            plansModified = true;
            nextPlans[friDate] = {
              ...plan,
              saturdayOffIds: plan.saturdayOffIds.filter(pid => !idSet.has(pid)),
              sundayOffIds: plan.sundayOffIds.filter(pid => !idSet.has(pid)),
              inCampIds: plan.inCampIds?.filter(pid => !idSet.has(pid))
            };
          } else {
            nextPlans[friDate] = plan;
          }
        }
        if (plansModified) {
          updatedWeekendPlans = nextPlans;
        }
      }

      return {
        ...prev,
        personnel: updatedPersonnel,
        leaves: updatedLeaves,
        schedules: updatedSchedules,
        weekendPlans: updatedWeekendPlans
      };
    });

    this.saveData();

    if (existing.length === 1) {
      const p = existing[0];
      if (removedFromUpcomingCount > 0) {
        this.notify(`Διαγράφηκε ο ${p.rankShort} ${p.fullName} και αφαιρέθηκε από ${removedFromUpcomingCount} επερχόμενες θέσεις υπηρεσίας.`, 'warning');
      } else {
        this.notify(`Διαγράφηκε ο ${p.rankShort} ${p.fullName}`, 'warning');
      }
    } else {
      if (removedFromUpcomingCount > 0) {
        this.notify(`Διαγράφηκαν ${existing.length} στρατιώτες και αφαιρέθηκαν από ${removedFromUpcomingCount} επερχόμενες θέσεις υπηρεσίας.`, 'warning');
      } else {
        this.notify(`Διαγράφηκαν ${existing.length} στρατιώτες.`, 'warning');
      }
    }
  }

  bulkUpdateDutyScores(updates: { id: string; dutyScoreDelta: number; weekendDutyScoreDelta?: number; lastDutyDate?: string | null }[]) {
    if (!updates || updates.length === 0) return;
    const updateMap = new Map(updates.map(u => [u.id, u]));

    this.appData.update(prev => ({
      ...prev,
      personnel: prev.personnel.map(p => {
        const u = updateMap.get(p.id);
        if (!u) return p;
        return {
          ...p,
          dutyScore: Math.max(0, Math.round(((p.dutyScore || 0) + u.dutyScoreDelta) * 100) / 100),
          weekendDutyScore: u.weekendDutyScoreDelta !== undefined
            ? Math.max(0, Math.round(((p.weekendDutyScore || 0) + u.weekendDutyScoreDelta) * 100) / 100)
            : (p.weekendDutyScore || 0),
          lastDutyDate: u.lastDutyDate !== undefined ? (u.lastDutyDate ? u.lastDutyDate : undefined) : p.lastDutyDate
        };
      })
    }));
    this.saveData();
  }

  resetAllDutyScores() {
    this.appData.update(prev => ({
      ...prev,
      personnel: prev.personnel.map(p => ({ ...p, dutyScore: 0, weekendDutyScore: 0, lastDutyDate: undefined }))
    }));
    this.saveData();
    this.notify('Μηδενίστηκαν τα μόρια / σύνολα υπηρεσιών όλων των στρατιωτών', 'info');
  }

  // --- Duty Types Actions ---
  addDutyType(duty: Omit<DutyType, 'id'>) {
    const newDuty: DutyType = {
      ...duty,
      id: `duty-${Date.now()}`
    };

    this.appData.update(prev => ({
      ...prev,
      dutyTypes: [...prev.dutyTypes, newDuty],
      personnel: prev.personnel.map(p => {
        // If "does no duties" is checked, keep them exempt
        if (p.exemptFromAllDuties) return p;
        // By default place that new duty as checked to all people
        const existingEligible = p.eligibleDutyIds ? [...p.eligibleDutyIds] : prev.dutyTypes.map(d => d.id);
        if (!existingEligible.includes(newDuty.id)) {
          existingEligible.push(newDuty.id);
        }
        return {
          ...p,
          eligibleDutyIds: existingEligible
        };
      })
    }));
    this.saveData();
    this.notify(`Προστέθηκε η υπηρεσία ${newDuty.name}`, 'success');
  }

  updateDutyType(id: string, updates: Partial<DutyType>) {
    const todayStr = new Date().toISOString().slice(0, 10);

    this.appData.update(prev => {
      const oldDuty = prev.dutyTypes.find(d => d.id === id);
      const oldWeight = (oldDuty?.weight !== undefined && oldDuty?.weight !== null) ? oldDuty.weight : 1;

      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.weight !== undefined && sanitizedUpdates.weight !== null) {
        const rawW = Number(sanitizedUpdates.weight);
        sanitizedUpdates.weight = !isNaN(rawW) && rawW >= 0 ? rawW : 1;
      }

      const updatedDutyTypes = prev.dutyTypes.map(d => d.id === id ? { ...d, ...sanitizedUpdates } : d);
      const updatedDuty = updatedDutyTypes.find(d => d.id === id);

      if (!updatedDuty) {
        return { ...prev, dutyTypes: updatedDutyTypes };
      }

      const newWeight = (updatedDuty.weight !== undefined && updatedDuty.weight !== null) ? updatedDuty.weight : 1;
      const weightDelta = newWeight - oldWeight;

      // Track soldier score adjustments for upcoming finalized schedules (date >= todayStr)
      const soldierScoreDeltas: Record<string, { dutyScoreDelta: number; weekendDutyScoreDelta: number }> = {};

      // Automatically reflect changes onto existing schedules of UPCOMING days only (date >= todayStr), keeping past schedules untouched
      const updatedSchedules = prev.schedules.map(sched => {
        if (sched.date < todayStr || !sched.duties) {
          return sched;
        }

        const dutyIdx = sched.duties.findIndex(d => d.dutyTypeId === id);
        if (dutyIdx < 0) {
          return sched;
        }

        const duty = sched.duties[dutyIdx];

        // If this upcoming schedule was already finalized and weight changed, adjust personnel scores accordingly
        if (sched.isFinalized && weightDelta !== 0) {
          const isWknd = sched.isHolidayOrWeekend;
          for (const s of duty.slots) {
            if (s.personId) {
              if (!soldierScoreDeltas[s.personId]) {
                soldierScoreDeltas[s.personId] = { dutyScoreDelta: 0, weekendDutyScoreDelta: 0 };
              }
              soldierScoreDeltas[s.personId].dutyScoreDelta += weightDelta;
              if (isWknd) {
                soldierScoreDeltas[s.personId].weekendDutyScoreDelta += weightDelta;
              }
            }
          }
        }

        const slotDefs = getDutySlotsForDate(updatedDuty, sched.date);
        const targetCount = slotDefs.length > 0 ? slotDefs.length : (updatedDuty.slots || 1);

        const updatedSlots = [...duty.slots];

        // If more people/slots were added, append new empty slots
        if (updatedSlots.length < targetCount) {
          for (let i = updatedSlots.length; i < targetCount; i++) {
            const def = slotDefs[i];
            let hoursNote = updatedDuty.type === '24ωρη' ? '08:00 - 08:00' : `Βάρδια ${i + 1}`;
            if (def) {
              const str = formatIntervalsToString(def.intervals);
              hoursNote = def.label ? (def.label.includes(str) ? def.label : `${def.label}: ${str}`) : str;
            }
            updatedSlots.push({
              slotIndex: i + 1,
              groupIndex: def?.groupIndex,
              personId: null,
              personName: '',
              hoursNote: stripGroupText(hoursNote),
              intervals: def?.intervals ? [...def.intervals] : undefined
            });
          }
        } else if (updatedSlots.length > targetCount) {
          // If slots were reduced, keep up to targetCount
          updatedSlots.splice(targetCount);
        }

        const newDuties = [...sched.duties];
        newDuties[dutyIdx] = {
          ...duty,
          dutyName: updatedDuty.name,
          shortName: updatedDuty.shortName,
          category: updatedDuty.category,
          weight: newWeight,
          slots: updatedSlots.map((s, idx) => {
            const def = slotDefs[idx];
            let hoursNote = s.hoursNote;
            if (def) {
              const str = formatIntervalsToString(def.intervals);
              const note = def.label ? (def.label.includes(str) ? def.label : `${def.label}: ${str}`) : str;
              hoursNote = stripGroupText(note);
            }
            return {
              ...s,
              slotIndex: idx + 1,
              groupIndex: def?.groupIndex ?? s.groupIndex,
              hoursNote,
              intervals: def?.intervals ? [...def.intervals] : s.intervals,
              groupTag: def?.groupTag ?? s.groupTag
            };
          })
        };

        return {
          ...sched,
          duties: newDuties
        };
      });

      // Apply score adjustments to personnel if any upcoming finalized schedules were affected
      let updatedPersonnel = prev.personnel;
      if (Object.keys(soldierScoreDeltas).length > 0) {
        updatedPersonnel = prev.personnel.map(p => {
          const adj = soldierScoreDeltas[p.id];
          if (!adj) return p;
          return {
            ...p,
            dutyScore: Math.max(0, Math.round(((p.dutyScore || 0) + adj.dutyScoreDelta) * 100) / 100),
            weekendDutyScore: Math.max(0, Math.round(((p.weekendDutyScore || 0) + adj.weekendDutyScoreDelta) * 100) / 100)
          };
        });
      }

      return {
        ...prev,
        dutyTypes: updatedDutyTypes,
        schedules: updatedSchedules,
        personnel: updatedPersonnel
      };
    });

    this.saveData();
    this.notify('Στοιχεία υπηρεσίας ενημερώθηκαν και συγχρονίστηκαν με τις επερχόμενες ημέρες', 'success');
  }

  deleteDutyType(id: string) {
    const todayStr = new Date().toISOString().slice(0, 10);
    this.appData.update(prev => {
      const updatedSchedules = prev.schedules.map(sched => {
        if (sched.date >= todayStr && sched.duties) {
          return {
            ...sched,
            duties: sched.duties.filter(d => d.dutyTypeId !== id)
          };
        }
        return sched;
      });
      return {
        ...prev,
        dutyTypes: prev.dutyTypes.filter(d => d.id !== id),
        schedules: updatedSchedules
      };
    });
    this.saveData();
    this.notify('Η υπηρεσία διαγράφηκε', 'warning');
  }

  reorderDutyTypes(newOrder: DutyType[]) {
    this.appData.update(prev => ({
      ...prev,
      dutyTypes: [...newOrder]
    }));
    this.saveData();
  }

  restoreDefaultDutyTypes() {
    this.appData.update(prev => ({
      ...prev,
      dutyTypes: JSON.parse(JSON.stringify(DEFAULT_APP_DATA.dutyTypes)),
      personnel: prev.personnel.map(p => {
        if (p.exemptFromAllDuties) return p;
        return {
          ...p,
          eligibleDutyIds: DEFAULT_APP_DATA.dutyTypes.map(d => d.id)
        };
      })
    }));
    this.saveData();
    this.notify('Επαναφέρθηκαν οι προεπιλεγμένες υπηρεσίες μονάδας', 'success');
  }

  // --- Leaves Actions ---
  addLeave(leave: Omit<Leave, 'id'>) {
    const newLeave: Leave = {
      ...leave,
      id: `leave-${Date.now()}`
    };

    this.appData.update(prev => ({
      ...prev,
      leaves: [newLeave, ...prev.leaves]
    }));
    this.saveData();
    this.notify(`Καταχωρήθηκε ${newLeave.type} για ${newLeave.personName}`, 'success');
  }

  updateLeave(id: string, updates: Partial<Leave>) {
    this.appData.update(prev => ({
      ...prev,
      leaves: prev.leaves.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
    this.saveData();
    this.notify('Στοιχεία άδειας ενημερώθηκαν', 'success');
  }

  deleteLeave(id: string) {
    this.appData.update(prev => ({
      ...prev,
      leaves: prev.leaves.filter(l => l.id !== id)
    }));
    this.saveData();
    this.notify('Η άδεια/απαλλαγή διαγράφηκε', 'warning');
  }

  // --- Schedule Actions ---
  saveSchedule(schedule: DailySchedule) {
    this.appData.update(prev => {
      const existingIdx = prev.schedules.findIndex(s => s.date === schedule.date);
      let updatedSchedules = [...prev.schedules];
      if (existingIdx >= 0) {
        updatedSchedules[existingIdx] = schedule;
      } else {
        updatedSchedules.push(schedule);
      }
      return {
        ...prev,
        schedules: updatedSchedules
      };
    });
    this.saveData();
    this.notify(`Αποθηκεύτηκε το πρόγραμμα υπηρεσιών για ${formatGreekDate(schedule.date)}`, 'success');
  }

  saveSchedules(schedules: DailySchedule[], notificationMessage?: string) {
    this.appData.update(prev => {
      let updatedSchedules = [...prev.schedules];
      for (const sched of schedules) {
        const existingIdx = updatedSchedules.findIndex(s => s.date === sched.date);
        if (existingIdx >= 0) {
          updatedSchedules[existingIdx] = sched;
        } else {
          updatedSchedules.push(sched);
        }
      }
      return {
        ...prev,
        schedules: updatedSchedules
      };
    });
    this.saveData();
    if (notificationMessage) {
      this.notify(notificationMessage, 'success');
    }
  }

  getScheduleForDate(dateStr: string): DailySchedule | undefined {
    return this.appData().schedules.find(s => s.date === dateStr);
  }

  // --- Weekend Plans ---
  saveWeekendPlan(plan: WeekendPlan, showNotification = true) {
    this.appData.update(prev => {
      const plans = { ...(prev.weekendPlans || {}) };
      plans[plan.fridayDate] = plan;

      // Also attach to any existing schedules for Friday, Saturday, Sunday
      const updatedSchedules = prev.schedules.map(s => {
        if (s.date === plan.fridayDate || s.date === plan.saturdayDate || s.date === plan.sundayDate) {
          return { ...s, weekendPlan: plan };
        }
        return s;
      });

      return {
        ...prev,
        schedules: updatedSchedules,
        weekendPlans: plans
      };
    });
    this.saveData();
    if (showNotification) {
      this.notify(`Αποθηκεύτηκε ο προγραμματισμός εξόδων Σ/Κ (${formatGreekDate(plan.fridayDate)})`, 'success');
    }
  }

  getWeekendPlan(dateStr: string): WeekendPlan | undefined {
    const plans = this.appData().weekendPlans || {};
    // Check direct friday date or if dateStr matches saturday or sunday
    if (plans[dateStr]) return plans[dateStr];
    for (const fridayKey of Object.keys(plans)) {
      const p = plans[fridayKey];
      if (p.fridayDate === dateStr || p.saturdayDate === dateStr || p.sundayDate === dateStr) {
        return p;
      }
    }
    return undefined;
  }

  getPreviousWeekendPlan(fridayDateStr: string): WeekendPlan | undefined {
    const parts = fridayDateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] - 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const prevFri = `${year}-${month}-${day}`;
    return this.getWeekendPlan(prevFri);
  }

  // --- Unit Info ---
  updateUnitInfo(info: UnitInfo) {
    this.appData.update(prev => ({
      ...prev,
      unitInfo: info
    }));
    this.saveData();
    this.notify('Τα στοιχεία της Μονάδας ενημερώθηκαν', 'success');
  }

  // --- Reset to Default Seed Data ---
  resetToDefaultData() {
    this.appData.set(DEFAULT_APP_DATA);
    this.saveData();
    this.notify('Επαναφέρθηκαν τα προεπιλεγμένα πρότυπα δεδομένα', 'info');
  }
}
