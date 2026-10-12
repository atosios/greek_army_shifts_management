import { Injectable, signal, computed } from '@angular/core';
import { AppData, Personnel, HigherPersonnel, SignatureSlot, DutyType, Leave, SoldierRecord, SoldierRecordType, PenaltySubtype, DailySchedule, WeekendPlan, WeekendPreference, UnitInfo, ScheduleTemplate, DailyExodouchoiPlan, DailyExodouchoiSoldier, toGreekCaps, formatGreekDate, getCorpsShort, formatLocalDate, normalizeGreek, getLeaveTypeMeta } from '../models/shift.model';
import { DEFAULT_APP_DATA, DEFAULT_SCHEDULE_TEMPLATES, DEFAULT_HIGHER_PERSONNEL, DEFAULT_DUTY_TYPES, createEmptyAppData, normalizeRank } from '../data/default-data';
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
      saveCsvFile: (content: string, defaultFilename: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
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
  readonly appData = signal<AppData>(createEmptyAppData());
  readonly isElectron = signal<boolean>(false);
  readonly storageFilePath = signal<string>('Τοπική Μνήμη (Local Memory)');
  readonly isPortable = signal<boolean>(false);
  readonly lastSavedTime = signal<string>('');
  readonly isSaving = signal<boolean>(false);
  readonly statusNotification = signal<{ message: string; type: 'success' | 'warning' | 'error' | 'info' } | null>(null);

  // Computed signals
  readonly personnel = computed(() => this.appData().personnel);
  readonly higherPersonnel = computed<HigherPersonnel[]>(() => {
    return this.appData().higherPersonnel || [];
  });
  readonly dutyTypes = computed(() => this.appData().dutyTypes);
  readonly leaves = computed(() => this.appData().leaves);
  readonly soldierRecords = computed<SoldierRecord[]>(() => this.appData().soldierRecords || []);
  readonly schedules = computed(() => this.appData().schedules);
  readonly unitInfo = computed(() => this.appData().unitInfo);
  readonly weekendPlans = computed(() => this.appData().weekendPlans || {});
  readonly scheduleTemplates = computed<ScheduleTemplate[]>(() => this.appData().scheduleTemplates || []);
  readonly dailyExodouchoiPlans = computed<Record<string, DailyExodouchoiPlan>>(() => this.appData().dailyExodouchoiPlans || {});

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
          const migrated = this.sanitizeAndMigrateAppData(result.data);
          this.appData.set(migrated);
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
        const migrated = this.sanitizeAndMigrateAppData(parsed);
        this.appData.set(migrated);
        this.saveData();
        this.notify('Φορτώθηκαν αποθηκευμένα δεδομένα προγράμματος', 'info');
        return;
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }

    const initialData = this.sanitizeAndMigrateAppData(DEFAULT_APP_DATA);
    this.appData.set(initialData);
    this.saveData();
  }

  private sanitizeAndMigrateAppData(loadedData: any): AppData {
    if (!loadedData) return JSON.parse(JSON.stringify(DEFAULT_APP_DATA));

    // 1. Unit Info migration
    const emptyUnit = createEmptyAppData().unitInfo;
    loadedData.unitInfo = { ...emptyUnit, ...(loadedData.unitInfo || {}) };
    if (!loadedData.unitInfo.name || 
        loadedData.unitInfo.name === 'ΜΟΝΑΔΑ' || 
        loadedData.unitInfo.name === '543 ΤΠ' || 
        loadedData.unitInfo.name === '24 ΕΜΑ') {
      loadedData.unitInfo = {
        ...loadedData.unitInfo,
        name: DEFAULT_APP_DATA.unitInfo.name,
        location: DEFAULT_APP_DATA.unitInfo.location,
        division: DEFAULT_APP_DATA.unitInfo.division,
        commanderTitle: DEFAULT_APP_DATA.unitInfo.commanderTitle,
        commanderName: DEFAULT_APP_DATA.unitInfo.commanderName,
        dutyOfficerSignatureTitle: DEFAULT_APP_DATA.unitInfo.dutyOfficerSignatureTitle,
        dutyOfficerName: DEFAULT_APP_DATA.unitInfo.dutyOfficerName,
        supervisorSignatureTitle: DEFAULT_APP_DATA.unitInfo.supervisorSignatureTitle,
        supervisorName: DEFAULT_APP_DATA.unitInfo.supervisorName,
        emblemUrl: loadedData.unitInfo.emblemUrl || DEFAULT_APP_DATA.unitInfo.emblemUrl
      };
    }

    // 2. Higher Personnel
    loadedData.higherPersonnel = loadedData.higherPersonnel || [];
    if (loadedData.higherPersonnel.length === 0) {
      loadedData.higherPersonnel = JSON.parse(JSON.stringify(DEFAULT_HIGHER_PERSONNEL));
    } else {
      for (const hp of DEFAULT_HIGHER_PERSONNEL) {
        if (!loadedData.higherPersonnel.some((existing: any) => existing.fullName === hp.fullName || existing.roleTitle === hp.roleTitle)) {
          loadedData.higherPersonnel.push(JSON.parse(JSON.stringify(hp)));
        }
      }
    }

    // 3. Duty Types
    loadedData.dutyTypes = (loadedData.dutyTypes || []).map((d: any) => ({
      ...d,
      category: d.category === 'Οπλίτης' ? 'Στρατιώτης' : d.category,
      weekendSwapNote: undefined,
      allowedRanks: (d.allowedRanks || []).map((r: string) => normalizeRank(r).rankShort)
    }));

    for (const defDuty of DEFAULT_DUTY_TYPES) {
      const existing = loadedData.dutyTypes.find((d: any) => d.id === defDuty.id);
      if (!existing) {
        loadedData.dutyTypes.push(JSON.parse(JSON.stringify(defDuty)));
      } else {
        if ((!existing.slotDefinitions || existing.slotDefinitions.length === 0) && defDuty.slotDefinitions) {
          existing.slotDefinitions = JSON.parse(JSON.stringify(defDuty.slotDefinitions));
          existing.slots = defDuty.slots;
        }
        if (!existing.timePresetType && defDuty.timePresetType) {
          existing.timePresetType = defDuty.timePresetType;
        }
      }
    }

    for (const d of loadedData.dutyTypes) {
      if (d.slotDefinitions) {
        for (const sd of d.slotDefinitions) {
          if (sd.groupTag?.includes('ΓΚΡΟΥΠ')) sd.groupTag = undefined;
          if (sd.groupName?.includes('ΓΚΡΟΥΠ')) sd.groupName = '';
        }
      }
    }

    // 4. Schedule Templates
    if (!loadedData.scheduleTemplates || loadedData.scheduleTemplates.length === 0) {
      loadedData.scheduleTemplates = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATES));
    } else {
      const hasKenThivas = loadedData.scheduleTemplates.some((t: any) => t.id === 'tpl-kenthivas-standard');
      if (!hasKenThivas) {
        const kenTpl = DEFAULT_SCHEDULE_TEMPLATES.find(t => t.id === 'tpl-kenthivas-standard');
        if (kenTpl) {
          loadedData.scheduleTemplates = loadedData.scheduleTemplates.map((t: any) => ({
            ...t,
            isDefaultWeekday: false,
            isDefaultWeekend: false
          }));
          loadedData.scheduleTemplates.unshift(JSON.parse(JSON.stringify(kenTpl)));
        }
      }
    }

    // 5. Personnel List
    loadedData.personnel = loadedData.personnel || [];
    const existingPIds = new Set(loadedData.personnel.map((p: any) => p.id));
    if (loadedData.personnel.length < 30) {
      for (const defP of DEFAULT_APP_DATA.personnel) {
        if (!existingPIds.has(defP.id)) {
          loadedData.personnel.push(JSON.parse(JSON.stringify(defP)));
          existingPIds.add(defP.id);
        }
      }
    }

    const allDIds = loadedData.dutyTypes.map((d: any) => d.id);
    loadedData.personnel = loadedData.personnel.map((p: any) => {
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

    // 6. Clean schedules
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

    // 7. Leaves and soldier records
    loadedData.leaves = (loadedData.leaves || []).map((l: any) => ({
      ...l,
      personName: toGreekCaps(l.personName)
    }));
    loadedData.soldierRecords = (loadedData.soldierRecords || []).map((r: any) => ({
      ...r,
      personName: toGreekCaps(r.personName)
    }));
    loadedData.weekendPlans = loadedData.weekendPlans || {};
    loadedData.dailyExodouchoiPlans = loadedData.dailyExodouchoiPlans || {};

    return loadedData as AppData;
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
            phone: pData.phone !== undefined && pData.phone.trim() ? pData.phone.trim() : existing.phone,
            specialty: getCorpsShort(pData.specialty),
            fitnessProfile,
            status,
            barracksRoom: pData.barracksRoom ? toGreekCaps(pData.barracksRoom.trim()) : existing.barracksRoom,
            bedNumber: pData.bedNumber ? toGreekCaps(pData.bedNumber.trim()) : existing.bedNumber,
            weaponNumber: status === 'Άοπλος' ? '-' : (pData.weaponNumber ? toGreekCaps(pData.weaponNumber.trim()) : existing.weaponNumber || ''),
            exemptFromAllDuties,
            eligibleDutyIds,
            dutyScore: pData.dutyScore !== undefined && pData.dutyScore >= 0 ? pData.dutyScore : existing.dutyScore,
            lastDutyDate: pData.lastDutyDate ? pData.lastDutyDate : existing.lastDutyDate,
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
        phone: pData.phone ? pData.phone.trim() : '',
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
        lastDutyDate: pData.lastDutyDate ? pData.lastDutyDate : undefined,
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

  updatePersonnelBulk(ids: string[], updates: Partial<Personnel> | ((p: Personnel) => Partial<Personnel>)): number {
    if (!ids || ids.length === 0) return 0;
    const idSet = new Set(ids);
    let updatedCount = 0;

    this.appData.update(prev => {
      const updatedPersonnel = prev.personnel.map(p => {
        if (!idSet.has(p.id)) return p;
        updatedCount++;
        const patch = typeof updates === 'function' ? updates(p) : updates;
        const sanitized: Partial<Personnel> = {
          ...patch,
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
        if (sanitized.company !== undefined) {
          sanitized.company = sanitized.company ? toGreekCaps(sanitized.company.trim()) : undefined;
        }
        if (sanitized.rotationalGroup !== undefined) {
          sanitized.rotationalGroup = sanitized.rotationalGroup ? toGreekCaps(sanitized.rotationalGroup.trim()) : undefined;
        }
        if (sanitized.specialRole !== undefined) {
          sanitized.specialRole = sanitized.specialRole ? toGreekCaps(sanitized.specialRole.trim()) : undefined;
        }
        if (sanitized.fitnessProfile === 'Ι1' || sanitized.fitnessProfile === 'Ι2') {
          if (!patch.status) {
            sanitized.status = 'Ένοπλος';
          }
        }
        if (sanitized.status === 'Άοπλος') {
          sanitized.weaponNumber = '-';
        }
        if (sanitized.exemptFromAllDuties) {
          sanitized.eligibleDutyIds = [];
        }
        return { ...p, ...sanitized };
      });
      return { ...prev, personnel: updatedPersonnel };
    });

    this.saveData();
    this.notify(`Ενημερώθηκαν επιτυχώς ${updatedCount} στρατιώτες`, 'success');
    return updatedCount;
  }

  updatePersonnelPreference(id: string, preference: WeekendPreference) {
    this.updatePersonnel(id, { weekendPreference: preference });
    this.notify(`Η προτίμηση εξόδου ενημερώθηκε σε «${preference}»`, 'info');
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

      // 2. Remove leaves and soldier records
      const updatedLeaves = prev.leaves.filter(l => !idSet.has(l.personId));
      const updatedSoldierRecords = (prev.soldierRecords || []).filter(r => !idSet.has(r.personId));

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
        soldierRecords: updatedSoldierRecords,
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
    const todayStr = formatLocalDate(new Date());

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
        if (duty.isCustomizedForDay) {
          return sched; // Preserve day-specific customized duty
        }

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
    const todayStr = formatLocalDate(new Date());
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

  // --- Soldier Records (Αιτήματα & Ποινές) Actions ---
  addSoldierRecord(record: Omit<SoldierRecord, 'id' | 'createdAt'>) {
    const newRecord: SoldierRecord = {
      ...record,
      id: `sr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      personName: toGreekCaps(record.personName.trim()),
      reason: record.reason.trim(),
      notes: record.notes ? record.notes.trim() : '',
      createdAt: new Date().toISOString()
    };

    this.appData.update(prev => ({
      ...prev,
      soldierRecords: [newRecord, ...(prev.soldierRecords || [])]
    }));
    this.saveData();
    const typeLabel = newRecord.type === 'ΑΙΤΗΜΑ' ? 'Το αίτημα' : 'Η ποινή';
    this.notify(`${typeLabel} καταχωρήθηκε επιτυχώς για ${newRecord.personName}`, 'success');
  }

  updateSoldierRecord(id: string, updates: Partial<SoldierRecord>) {
    this.appData.update(prev => ({
      ...prev,
      soldierRecords: (prev.soldierRecords || []).map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          ...updates,
          personName: updates.personName ? toGreekCaps(updates.personName.trim()) : r.personName,
          reason: updates.reason !== undefined ? updates.reason.trim() : r.reason,
          notes: updates.notes !== undefined ? updates.notes.trim() : r.notes
        };
      })
    }));
    this.saveData();
    this.notify('Τα στοιχεία της εγγραφής ενημερώθηκαν', 'success');
  }

  deleteSoldierRecord(id: string) {
    this.appData.update(prev => ({
      ...prev,
      soldierRecords: (prev.soldierRecords || []).filter(r => r.id !== id)
    }));
    this.saveData();
    this.notify('Η εγγραφή διαγράφηκε', 'warning');
  }

  deleteSoldierRecordsBulk(ids: string[]) {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    this.appData.update(prev => ({
      ...prev,
      soldierRecords: (prev.soldierRecords || []).filter(r => !idSet.has(r.id))
    }));
    this.saveData();
    this.notify(`Διαγράφηκαν ${ids.length} εγγραφές`, 'warning');
  }

  /**
   * Checks whether a soldier has an active duty that prevents taking a day off on a date.
   * - Weekday cleaning does not block evening pass (person is available for pass).
   * - Weekend cleaning counts as duty.
   * - Next day morning cover / bakery slots (carried out tomorrow) do not occupy the soldier tonight.
   */
  hasSoldierActiveDutyOnDate(personId: string, dateStr: string): boolean {
    const schedule = this.getScheduleForDate(dateStr);
    if (!schedule || !schedule.duties) return false;

    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const day = d.getDay();

    for (const duty of schedule.duties) {
      for (const s of duty.slots) {
        if (s.personId === personId) {
          const normName = normalizeGreek(duty.dutyName || '');
          const normShort = normalizeGreek(duty.shortName || '');
          const normTag = normalizeGreek(s.groupTag || '');
          const normNote = normalizeGreek(s.hoursNote || '');

          const isCleaning = duty.dutyTypeId === 'duty-kathariotites' || 
                             normName.includes('καθαριοτητ') || 
                             normShort === 'καθ';

          const isBakery = duty.dutyTypeId === 'duty-artoklivanos' || 
                           normName.includes('αρτοκλιβαν') || 
                           normShort === 'αρτ';

          // Weekday cleaning does not block evening pass
          if (isCleaning && !isWeekend) {
            continue;
          }

          // Bakery is next-day morning (06:50-14:00)
          if (isBakery || normNote.includes('επομ')) {
            continue;
          }

          // Friday cover slot for Saturday morning (12:00-14:00)
          if (day === 5 && (s.groupTag === 'COVER' || normTag.includes('καλυψη') || normNote.includes('καλυψη') || (s.intervals?.length === 1 && s.intervals[0].from === '12:00' && s.intervals[0].to === '14:00'))) {
            continue;
          }

          // Saturday cover slot for Sunday morning
          if (day === 6 && (s.groupTag === 'COVER' || normTag.includes('καλυψη') || normNote.includes('καλυψη'))) {
            continue;
          }

          // Monday morning restaurant
          if (day === 1 && s.intervals?.length === 1 && s.intervals[0].from === '05:20' && s.intervals[0].to === '16:00') {
            continue;
          }

          return true; // Found an active duty that occupies the soldier
        }
      }
    }
    return false;
  }

  /**
   * Checks whether a soldier is on Leave or hospital absence outside the unit on a date.
   */
  isSoldierOnLeaveOnDate(personId: string, dateStr: string): boolean {
    const list = this.leaves();
    for (const l of list) {
      if (l.personId === personId && l.status !== 'Ακυρωμένη') {
        if (l.startDate <= dateStr && dateStr <= l.endDate) {
          const meta = getLeaveTypeMeta(l.type);
          if (!meta.isInformative && l.type !== 'Ελεύθερος Ορθοστασίας (ΕΟ)' && l.type !== 'Ελεύθερος Ασκήσεων (ΕΑ)') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Checks whether a soldier actually went out (had an active pass/outing) on a date.
   */
  didSoldierGoOutOnDate(personId: string, dateStr: string): boolean {
    // 1. Check daily exodouchoi plan if one exists
    const dailyPlan = this.getDailyExodouchoiPlan(dateStr);
    if (dailyPlan && dailyPlan.soldiers) {
      const s = dailyPlan.soldiers.find(x => x.personId === personId);
      if (s) {
        return Boolean(s.isGoingOut);
      }
    }

    // 2. Check weekend plan if Saturday or Sunday
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay();
    if (day === 6 || day === 0) {
      const wkndPlan = this.getWeekendPlan(dateStr);
      if (wkndPlan) {
        if (day === 6 && wkndPlan.saturdayOffIds?.includes(personId)) {
          return true;
        }
        if (day === 0 && wkndPlan.sundayOffIds?.includes(personId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks whether a specific day qualifies as 1 day of punishment served.
   * For ΣΤ ΕΞΟΔΟΥ:
   * "if someone has στ εξοδου that means that he must no go out if he has a day off. Only then it counts a punishment day passed"
   * -> Must have NO active duty on that day.
   * -> Must NOT be on leave / hospital outside camp.
   * -> Must NOT have gone out (stays in camp without pass).
   * -> ONLY THEN does it count as 1 punishment day passed!
   */
  didServePenaltyDay(record: SoldierRecord, dateStr: string): boolean {
    const penaltyType = (record.penaltyType as PenaltySubtype) || this.inferPenaltyType(record.reason);
    if (penaltyType === 'ΣΤ ΕΞΟΔΟΥ') {
      // Must NOT have duty
      if (this.hasSoldierActiveDutyOnDate(record.personId, dateStr)) {
        return false;
      }
      // Must NOT be on leave
      if (this.isSoldierOnLeaveOnDate(record.personId, dateStr)) {
        return false;
      }
      // Must NOT have gone out
      if (this.didSoldierGoOutOnDate(record.personId, dateStr)) {
        return false;
      }
      // Had day off AND stayed in camp -> ONLY THEN it counts!
      return true;
    }

    // For Κράτηση / Φυλάκιση: counts every elapsed calendar day
    return true;
  }

  /**
   * Counts how many days of punishment have been served between two dates.
   * If includeToDate is false, counts dates strictly prior to toDateStr (d < toDateStr).
   */
  countServedDaysBetween(
    record: SoldierRecord,
    fromDateStr: string,
    toDateStr: string,
    includeToDate = true
  ): number {
    const totalDays = Math.max(0, Number(record.totalDays) || 0);
    if (totalDays === 0 || !fromDateStr || !toDateStr || fromDateStr > toDateStr) {
      return 0;
    }

    const startParts = fromDateStr.split('-').map(Number);
    const endParts = toDateStr.split('-').map(Number);
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

    let servedCount = 0;
    const cur = new Date(start);

    while (cur <= end && servedCount < totalDays) {
      const curStr = formatLocalDate(cur);
      if (curStr === toDateStr && !includeToDate) {
        break;
      }

      if (this.didServePenaltyDay(record, curStr)) {
        servedCount++;
      }

      cur.setDate(cur.getDate() + 1);
    }

    return Math.min(totalDays, servedCount);
  }

  /**
   * Determines whether a penalty record is still ACTIVE on a given date.
   * If the penalty has already been fully served in previous days (or manually completed), it is not active.
   * If it is still active, the soldier MUST NOT go out on this date!
   */
  isPenaltyActiveOnDate(record: SoldierRecord, dateStr: string): boolean {
    if (record.type !== 'ΠΟΙΝΗ') return false;
    if (record.status === 'Ολοκληρώθηκε' || record.status === 'Απορρίφθηκε') return false;
    if (!record.date || record.date > dateStr) return false;

    const totalDays = Math.max(0, Number(record.totalDays) || 0);
    if (totalDays === 0) return false;

    if (record.isManualServedDays && record.servedDays !== undefined && record.servedDays !== null) {
      return Number(record.servedDays) < totalDays;
    }

    // Days served strictly prior to dateStr
    const servedPrior = this.countServedDaysBetween(record, record.date, dateStr, false);
    return servedPrior < totalDays;
  }

  /**
   * Returns all active penalties for a person on a specific date.
   */
  getActivePenaltiesForPerson(personId: string, dateStr: string): SoldierRecord[] {
    return (this.soldierRecords() || []).filter(r =>
      r.personId === personId && this.isPenaltyActiveOnDate(r, dateStr)
    );
  }

  /**
   * Returns whether a person has any active penalty on a specific date.
   */
  hasActivePenaltyOnDate(personId: string, dateStr: string): boolean {
    return this.getActivePenaltiesForPerson(personId, dateStr).length > 0;
  }

  /**
   * Calculates the current progress of a punishment record.
   * - If isManualServedDays is true and servedDays is provided, uses the manual count.
   * - If ΣΤ ΕΞΟΔΟΥ: counts days where the soldier had a day off AND stayed in camp without going out.
   * - If Κ or Φ: counts all past/present calendar days since the punishment date.
   * - Capped between 0 and totalDays.
   */
  calculatePenaltyProgress(
    record: SoldierRecord,
    asOfDateStr: string = formatLocalDate(new Date())
  ): { servedDays: number; totalDays: number; isCompleted: boolean; isManual: boolean; penaltyType: PenaltySubtype } {
    const totalDays = Math.max(0, Number(record.totalDays) || 0);
    const penaltyType = (record.penaltyType as PenaltySubtype) || this.inferPenaltyType(record.reason);

    if (totalDays === 0) {
      return {
        servedDays: 0,
        totalDays: 0,
        isCompleted: record.status === 'Ολοκληρώθηκε',
        isManual: Boolean(record.isManualServedDays),
        penaltyType
      };
    }

    if (record.isManualServedDays && record.servedDays !== undefined && record.servedDays !== null) {
      const served = Math.max(0, Math.min(totalDays, Number(record.servedDays)));
      return {
        servedDays: served,
        totalDays,
        isCompleted: served >= totalDays || record.status === 'Ολοκληρώθηκε',
        isManual: true,
        penaltyType
      };
    }

    if (!record.date) {
      return {
        servedDays: 0,
        totalDays,
        isCompleted: false,
        isManual: false,
        penaltyType
      };
    }

    const todayStr = formatLocalDate(new Date());

    if (asOfDateStr < record.date) {
      return {
        servedDays: 0,
        totalDays,
        isCompleted: false,
        isManual: false,
        penaltyType
      };
    }

    // Days served strictly prior to asOfDateStr
    const servedPrior = this.countServedDaysBetween(record, record.date, asOfDateStr, false);

    // For past dates (< todayStr): include asOfDateStr itself since it has already passed
    if (asOfDateStr < todayStr) {
      const servedTotal = this.countServedDaysBetween(record, record.date, asOfDateStr, true);
      return {
        servedDays: servedTotal,
        totalDays,
        isCompleted: servedTotal >= totalDays || record.status === 'Ολοκληρώθηκε',
        isManual: false,
        penaltyType
      };
    }

    // For today or future:
    // If already fully served in past days:
    if (servedPrior >= totalDays) {
      return {
        servedDays: totalDays,
        totalDays,
        isCompleted: true,
        isManual: false,
        penaltyType
      };
    }

    // Check if today qualifies as a served day (day off and staying in camp)
    const isServingToday = this.didServePenaltyDay(record, asOfDateStr);
    const effectiveServed = isServingToday ? Math.min(totalDays, servedPrior + 1) : servedPrior;

    return {
      servedDays: effectiveServed,
      totalDays,
      isCompleted: record.status === 'Ολοκληρώθηκε',
      isManual: false,
      penaltyType
    };
  }

  inferPenaltyType(text: string): PenaltySubtype {
    if (!text) return 'ΣΤ ΕΞΟΔΟΥ';
    const norm = normalizeGreek(text);
    if (norm.includes('φυλακ') || /\bφ\b/i.test(text)) return 'Φ';
    if (norm.includes('κρατησ') || /\bκ\b/i.test(text)) return 'Κ';
    if (norm.includes('στερησ') || norm.includes('εξοδ') || norm.includes('σε') || norm.includes('στ εξοδ')) return 'ΣΤ ΕΞΟΔΟΥ';
    return 'ΣΤ ΕΞΟΔΟΥ';
  }

  adjustPenaltyServedDays(recordId: string, delta: number) {
    const record = (this.soldierRecords() || []).find(r => r.id === recordId);
    if (!record || record.type !== 'ΠΟΙΝΗ') return;

    const currentProgress = this.calculatePenaltyProgress(record);
    const total = currentProgress.totalDays || 1;
    const newServed = Math.max(0, Math.min(total, currentProgress.servedDays + delta));
    const isCompleted = newServed >= total;

    this.updateSoldierRecord(recordId, {
      servedDays: newServed,
      isManualServedDays: true,
      status: isCompleted ? 'Ολοκληρώθηκε' : (record.status === 'Ολοκληρώθηκε' ? 'Εκκρεμεί' : record.status)
    });
  }

  resetPenaltyAutoCount(recordId: string) {
    this.updateSoldierRecord(recordId, {
      isManualServedDays: false,
      servedDays: undefined
    });
    this.notify('Επανήλθε ο αυτόματος υπολογισμός ημερών έκτισης', 'info');
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

  // --- Daily Exodouchoi Plans (Καθημερινοί Εξοδούχοι) ---
  saveDailyExodouchoiPlan(plan: DailyExodouchoiPlan, showNotification = true) {
    this.appData.update(prev => {
      const plans = { ...(prev.dailyExodouchoiPlans || {}) };
      plans[plan.date] = plan;
      return {
        ...prev,
        dailyExodouchoiPlans: plans
      };
    });
    this.saveData();
    if (showNotification) {
      this.notify(`Η κατάσταση εξοδούχων για τις ${formatGreekDate(plan.date)} αποθηκεύτηκε επιτυχώς.`, 'success');
    }
  }

  getDailyExodouchoiPlan(dateStr: string): DailyExodouchoiPlan | undefined {
    const plans = this.appData().dailyExodouchoiPlans || {};
    return plans[dateStr];
  }

  deleteDailyExodouchoiPlan(dateStr: string) {
    this.appData.update(prev => {
      const plans = { ...(prev.dailyExodouchoiPlans || {}) };
      delete plans[dateStr];
      return {
        ...prev,
        dailyExodouchoiPlans: plans
      };
    });
    this.saveData();
    this.notify(`Η προσαρμοσμένη κατάσταση εξοδούχων διαγράφηκε.`, 'info');
  }

  async downloadCsvFile(content: string, filename: string): Promise<boolean> {
    if (this.isElectron() && window.electronAPI?.saveCsvFile) {
      try {
        const res = await window.electronAPI.saveCsvFile(content, filename);
        if (res.success) {
          this.notify(`Το αρχείο CSV αποθηκεύτηκε: ${res.filePath}`, 'success');
          return true;
        }
        if (!res.canceled) {
          this.notify(`Σφάλμα αποθήκευσης CSV: ${res.error}`, 'error');
        }
        return false;
      } catch (err: any) {
        this.notify(`Σφάλμα: ${err.message}`, 'error');
        return false;
      }
    } else {
      try {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.notify('Το αρχείο CSV λήφθηκε επιτυχώς!', 'success');
        return true;
      } catch (err: any) {
        this.notify(`Σφάλμα λήψης CSV: ${err.message}`, 'error');
        return false;
      }
    }
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

  // --- Higher Personnel (Στελέχη / Υπογραφές) ---
  addHigherPersonnel(person: Omit<HigherPersonnel, 'id'>) {
    const newPerson: HigherPersonnel = {
      ...person,
      id: `hp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fullName: toGreekCaps(person.fullName.trim()),
      roleTitle: toGreekCaps(person.roleTitle.trim()),
      rank: person.rank.trim()
    };
    this.appData.update(prev => ({
      ...prev,
      higherPersonnel: [...(prev.higherPersonnel || []), newPerson]
    }));
    this.saveData();
    this.notify(`Προστέθηκε στο ανώτερο προσωπικό: ${newPerson.fullName}`, 'success');
  }

  updateHigherPersonnel(id: string, updates: Partial<HigherPersonnel>) {
    this.appData.update(prev => {
      const list = prev.higherPersonnel || [];
      const updated = list.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          ...updates,
          fullName: updates.fullName ? toGreekCaps(updates.fullName.trim()) : p.fullName,
          roleTitle: updates.roleTitle ? toGreekCaps(updates.roleTitle.trim()) : p.roleTitle,
          rank: updates.rank ? updates.rank.trim() : p.rank
        };
      });
      return {
        ...prev,
        higherPersonnel: updated
      };
    });
    this.saveData();
    this.notify('Το στέλεχος ενημερώθηκε επιτυχώς', 'success');
  }

  deleteHigherPersonnel(id: string) {
    this.appData.update(prev => ({
      ...prev,
      higherPersonnel: (prev.higherPersonnel || []).filter(p => p.id !== id)
    }));
    this.saveData();
    this.notify('Το στέλεχος διαγράφηκε', 'warning');
  }

  saveScheduleSignatures(dateStr: string, signatures: SignatureSlot[]) {
    this.appData.update(prev => {
      const schedules = [...prev.schedules];
      const idx = schedules.findIndex(s => s.date === dateStr);
      if (idx >= 0) {
        schedules[idx] = {
          ...schedules[idx],
          signatures
        };
      }
      return {
        ...prev,
        schedules
      };
    });
    this.saveData();
  }

  // --- Schedule Templates (Πρότυπα Υπηρεσιών) ---
  addScheduleTemplate(template: Omit<ScheduleTemplate, 'id' | 'createdAt' | 'updatedAt'>): ScheduleTemplate {
    const newTpl: ScheduleTemplate = {
      ...template,
      name: template.name.trim(),
      description: template.description?.trim() || '',
      id: `tpl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.appData.update(prev => {
      let tpls = prev.scheduleTemplates ? [...prev.scheduleTemplates] : [];
      if (newTpl.isDefaultWeekday) {
        tpls = tpls.map(t => ({ ...t, isDefaultWeekday: false }));
      }
      if (newTpl.isDefaultWeekend) {
        tpls = tpls.map(t => ({ ...t, isDefaultWeekend: false }));
      }
      return {
        ...prev,
        scheduleTemplates: [...tpls, newTpl]
      };
    });

    this.saveData();
    this.notify(`Δημιουργήθηκε το πρότυπο "${newTpl.name}"`, 'success');
    return newTpl;
  }

  updateScheduleTemplate(id: string, updates: Partial<ScheduleTemplate>): void {
    this.appData.update(prev => {
      let tpls = prev.scheduleTemplates ? [...prev.scheduleTemplates] : [];
      if (updates.isDefaultWeekday) {
        tpls = tpls.map(t => t.id === id ? t : { ...t, isDefaultWeekday: false });
      }
      if (updates.isDefaultWeekend) {
        tpls = tpls.map(t => t.id === id ? t : { ...t, isDefaultWeekend: false });
      }
      return {
        ...prev,
        scheduleTemplates: tpls.map(t => t.id === id ? { 
          ...t, 
          ...updates, 
          name: updates.name !== undefined ? updates.name.trim() : t.name,
          description: updates.description !== undefined ? updates.description.trim() : t.description,
          updatedAt: new Date().toISOString() 
        } : t)
      };
    });

    this.saveData();
    this.notify('Το πρότυπο ενημερώθηκε επιτυχώς', 'success');
  }

  deleteScheduleTemplate(id: string): void {
    const tpl = this.scheduleTemplates().find(t => t.id === id);
    this.appData.update(prev => ({
      ...prev,
      scheduleTemplates: (prev.scheduleTemplates || []).filter(t => t.id !== id)
    }));

    this.saveData();
    this.notify(`Το πρότυπο "${tpl?.name || ''}" διαγράφηκε`, 'warning');
  }

  duplicateScheduleTemplate(id: string): ScheduleTemplate | undefined {
    const original = this.scheduleTemplates().find(t => t.id === id);
    if (!original) return undefined;
    return this.addScheduleTemplate({
      name: `${original.name} (Αντίγραφο)`,
      description: original.description,
      dutyTypeIds: [...original.dutyTypeIds],
      isDefaultWeekday: false,
      isDefaultWeekend: false
    });
  }

  setDefaultTemplate(id: string, type: 'weekday' | 'weekend' | 'none'): void {
    this.appData.update(prev => {
      const tpls = (prev.scheduleTemplates || []).map(t => {
        if (type === 'weekday') {
          return { ...t, isDefaultWeekday: t.id === id };
        } else if (type === 'weekend') {
          return { ...t, isDefaultWeekend: t.id === id };
        } else {
          return t.id === id ? { ...t, isDefaultWeekday: false, isDefaultWeekend: false } : t;
        }
      });
      return { ...prev, scheduleTemplates: tpls };
    });

    this.saveData();
    this.notify('Ενημερώθηκε η προεπιλογή του προτύπου', 'info');
  }

  getTemplateById(id: string): ScheduleTemplate | undefined {
    return this.scheduleTemplates().find(t => t.id === id);
  }

  getDefaultTemplateForDate(dateStr: string): ScheduleTemplate | undefined {
    const tpls = this.scheduleTemplates();
    if (tpls.length === 0) return undefined;
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay();
    const isWknd = day === 0 || day === 6;
    if (isWknd) {
      return tpls.find(t => t.isDefaultWeekend) || tpls.find(t => t.id === 'tpl-weekend-standard');
    } else {
      return tpls.find(t => t.isDefaultWeekday) || tpls.find(t => t.id === 'tpl-weekday-standard');
    }
  }

  // --- Reset to Empty Data ---
  resetAllData() {
    this.appData.set(createEmptyAppData());
    this.saveData();
    this.notify('Όλα τα δεδομένα διαγράφηκαν', 'info');
  }
}
