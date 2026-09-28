const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let currentDataFilePath = null;

// Determine portable storage path
function determineDefaultStoragePath() {
  // If running as portable executable, save next to the .exe on the USB drive
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir && fs.existsSync(portableDir)) {
    return path.join(portableDir, 'army_shifts_data.json');
  }

  // Development or installed fallback
  const appDataDir = path.join(app.getPath('userData'), 'greek_army_shifts');
  if (!fs.existsSync(appDataDir)) {
    try {
      fs.mkdirSync(appDataDir, { recursive: true });
    } catch (err) {
      console.error('Failed to create appDataDir:', err);
    }
  }

  // Also check if local data/ directory exists in project directory
  const localProjectDataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(localProjectDataDir)) {
    try {
      fs.mkdirSync(localProjectDataDir, { recursive: true });
    } catch (e) {
      // ignore
    }
  }

  // If localProjectDataDir exists and is writable, default to it
  try {
    const testFile = path.join(localProjectDataDir, '.test_write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return path.join(localProjectDataDir, 'army_shifts_data.json');
  } catch (e) {
    return path.join(appDataDir, 'army_shifts_data.json');
  }
}

// Initial sample seed data if no data file exists
function getDefaultInitialData() {
  return {
    unitInfo: {
      name: '535 Μ/Κ ΤΠ',
      location: 'Σιδηρόκαστρο',
      division: '16η Μ/Κ ΜΠ',
      commanderName: 'Αντισυνταγματάρχης (ΠΖ) Παπαδόπουλος Γεώργιος',
      dutyOfficerSignatureTitle: 'Ο Αξιωματικός Επιχειρήσεων',
      dutyOfficerName: 'Ταγματάρχης (ΠΖ) Κωνσταντίνου Δημήτριος'
    },
    personnel: [
      {
        id: 'p-1',
        rank: 'Υπολοχαγός',
        rankShort: 'Υπλγός',
        category: 'Αξιωματικός',
        fullName: 'Γεωργίου Αλέξανδρος',
        asm: '154/2012',
        specialty: 'Πεζικό (ΠΖ)',
        status: 'Ένοπλος',
        company: '1ος Λόχος',
        dutyScore: 2,
        notes: 'Εκπαιδευτής βολών',
        active: true
      },
      {
        id: 'p-2',
        rank: 'Ανθυπολοχαγός',
        rankShort: 'Ανθλγός',
        category: 'Αξιωματικός',
        fullName: 'Δημητρίου Νικόλαος',
        asm: '189/2015',
        specialty: 'Πεζικό (ΠΖ)',
        status: 'Ένοπλος',
        company: '2ος Λόχος',
        dutyScore: 3,
        notes: '',
        active: true
      },
      {
        id: 'p-3',
        rank: 'Ανθυπασπιστής',
        rankShort: 'Ανθστής',
        category: 'Υπαξιωματικός',
        fullName: 'Βασιλείου Ιωάννης',
        asm: '874/2005',
        specialty: 'Τεχνικό (ΤΧ)',
        status: 'Ένοπλος',
        company: 'Λόχος Υποστηρίξεως',
        dutyScore: 2,
        notes: '',
        active: true
      },
      {
        id: 'p-4',
        rank: 'Αρχιλοχίας',
        rankShort: 'Αρχιας',
        category: 'Υπαξιωματικός',
        fullName: 'Σταυρόπουλος Κωνσταντίνος',
        asm: '921/2008',
        specialty: 'Διαβιβάσεις (ΔΒ)',
        status: 'Ένοπλος',
        company: 'Λόχος Διοικήσεως',
        dutyScore: 3,
        notes: '',
        active: true
      },
      {
        id: 'p-5',
        rank: 'ΔΕΑ',
        rankShort: 'ΔΕΑ',
        category: 'Αξιωματικός',
        fullName: 'Αναστασιάδης Παναγιώτης',
        asm: '350/2024',
        specialty: 'Πεζικό (ΠΖ)',
        status: 'Ένοπλος',
        company: '1ος Λόχος',
        dutyScore: 4,
        notes: '',
        active: true
      },
      {
        id: 'p-6',
        rank: 'Λοχίας',
        rankShort: 'Λχιας',
        category: 'Κληρωτός',
        fullName: 'Μανώλης Χρήστος',
        asm: '2024 Β / 23412',
        specialty: 'Τουφεκιοφόρος (ΤΦ)',
        status: 'Ένοπλος',
        company: '1ος Λόχος',
        dutyScore: 4,
        notes: '',
        active: true
      },
      {
        id: 'p-7',
        rank: 'Δεκανέας',
        rankShort: 'Δνεας',
        category: 'Κληρωτός',
        fullName: 'Καραμανλής Ευάγγελος',
        asm: '2024 Γ / 11204',
        specialty: 'Τουφεκιοφόρος (ΤΦ)',
        status: 'Ένοπλος',
        company: '1ος Λόχος',
        dutyScore: 5,
        notes: '',
        active: true
      },
      {
        id: 'p-8',
        rank: 'Στρατιώτης',
        rankShort: 'Στρ',
        category: 'Κληρωτός',
        fullName: 'Παπαδόπουλος Σταύρος',
        asm: '2024 Δ / 09144',
        specialty: 'Τουφεκιοφόρος (ΤΦ)',
        status: 'Ένοπλος',
        company: '1ος Λόχος',
        dutyScore: 6,
        notes: '',
        active: true
      },
      {
        id: 'p-9',
        rank: 'Στρατιώτης',
        rankShort: 'Στρ',
        category: 'Κληρωτός',
        fullName: 'Νικολάου Ανδρέας',
        asm: '2024 Δ / 12389',
        specialty: 'Τουφεκιοφόρος (ΤΦ)',
        status: 'Ένοπλος',
        company: '1ος Λόχος',
        dutyScore: 5,
        notes: '',
        active: true
      },
      {
        id: 'p-10',
        rank: 'Στρατιώτης',
        rankShort: 'Στρ',
        category: 'Κληρωτός',
        fullName: 'Θεοδώρου Μιχαήλ',
        asm: '2024 Γ / 14590',
        specialty: 'Οδηγός (ΟΔ)',
        status: 'Ένοπλος',
        company: 'Λόχος Διοικήσεως',
        dutyScore: 4,
        notes: 'Άδεια οδήγησης Στάγιερ & Magirus',
        active: true
      },
      {
        id: 'p-11',
        rank: 'Στρατιώτης',
        rankShort: 'Στρ',
        category: 'Κληρωτός',
        fullName: 'Κωστόπουλος Πέτρος',
        asm: '2024 Γ / 08711',
        specialty: 'Μάγειρας (ΜΑΓ)',
        status: 'Άοπλος',
        company: 'Λόχος Διοικήσεως',
        dutyScore: 5,
        notes: 'Εστιάτορας / Μαγειρεία',
        active: true
      },
      {
        id: 'p-12',
        rank: 'Στρατιώτης',
        rankShort: 'Στρ',
        category: 'Κληρωτός',
        fullName: 'Αθανασιάδης Ηλίας',
        asm: '2024 Δ / 10223',
        specialty: 'Γραφέας (ΓΡΑΦ)',
        status: 'Υπηρεσία Γραφείου',
        company: '1ο Γραφείο',
        dutyScore: 3,
        notes: 'Ι4 - Άοπλος / Υπηρεσία Γραφείου',
        active: true
      },
      {
        id: 'p-13',
        rank: 'Στρατιώτης',
        rankShort: 'Στρ',
        category: 'Κληρωτός',
        fullName: 'Σακελλαρίου Σπυρίδων',
        asm: '2024 Δ / 07312',
        specialty: 'Τουφεκιοφόρος (ΤΦ)',
        status: 'Ένοπλος',
        company: '2ος Λόχος',
        dutyScore: 5,
        notes: '',
        active: true
      },
      {
        id: 'p-14',
        rank: 'Στρατιώτης',
        rankShort: 'Στρ',
        category: 'Κληρωτός',
        fullName: 'Λεβέντης Αθανάσιος',
        asm: '2024 Γ / 09841',
        specialty: 'Τουφεκιοφόρος (ΤΦ)',
        status: 'Ένοπλος',
        company: '2ος Λόχος',
        dutyScore: 4,
        notes: '',
        active: true
      }
    ],
    dutyTypes: [
      {
        id: 'duty-aydm',
        name: 'Αξιωματικός Υπηρεσίας Μονάδας (ΑΥΔΜ)',
        shortName: 'ΑΥΔΜ',
        category: 'Αξιωματικός',
        allowedRanks: ['Υπλγός', 'Ανθλγός', 'Ανθστής', 'ΔΕΑ'],
        armsRequired: 'Ένοπλος',
        slots: 1,
        type: '24ωρη',
        shiftHours: '08:00 - 08:00 (Επόμενη)',
        weight: 3,
        description: 'Υπεύθυνος ασφαλείας και λειτουργίας μονάδας επί 24ώρου βάσεως.',
        active: true
      },
      {
        id: 'duty-baydm',
        name: 'Βοηθός ΑΥΔΜ (ΒΑΥΔΜ)',
        shortName: 'ΒΑΥΔΜ',
        category: 'Υπαξιωματικός',
        allowedRanks: ['Αρχιας', 'Επχιας', 'Λχιας', 'ΔΕΑ', 'Δνεας'],
        armsRequired: 'Ένοπλος',
        slots: 1,
        type: '24ωρη',
        shiftHours: '08:00 - 08:00 (Επόμενη)',
        weight: 2.5,
        description: 'Βοηθός του ΑΥΔΜ, υπεύθυνος διακίνησης αναφορών και κλειδιών.',
        active: true
      },
      {
        id: 'duty-epoptis',
        name: 'Επόπτης / Αρχιφύλακας Στρατοπέδου',
        shortName: 'Αρχιφύλακας',
        category: 'Υπαξιωματικός',
        allowedRanks: ['Αρχιας', 'Επχιας', 'Λχιας', 'Δνεας'],
        armsRequired: 'Ένοπλος',
        slots: 1,
        type: '24ωρη',
        shiftHours: '08:00 - 08:00 (Επόμενη)',
        weight: 2,
        description: 'Επόπτης σκοπών, αλλαγών φρουράς και περιπόλων.',
        active: true
      },
      {
        id: 'duty-pyli',
        name: 'Σκοπός Κεντρικής Πύλης',
        shortName: 'Πύλη',
        category: 'Οπλίτης',
        allowedRanks: ['Στρ', 'Υπδνεας', 'Δνεας'],
        armsRequired: 'Ένοπλος',
        slots: 3,
        type: 'Βάρδιες',
        shiftHours: '3 βάρδιες (2ωρη/4ωρη ανάπαυση)',
        weight: 2,
        description: 'Έλεγχος εισόδου/εξόδου οχημάτων και προσωπικού στην πύλη.',
        active: true
      },
      {
        id: 'duty-peripolos',
        name: 'Περίπολος Ασφαλείας Στρατοπέδου',
        shortName: 'Περίπολος',
        category: 'Οπλίτης',
        allowedRanks: ['Στρ', 'Υπδνεας', 'Δνεας'],
        armsRequired: 'Ένοπλος',
        slots: 2,
        type: 'Βάρδιες',
        shiftHours: 'Βραδινή περίπολος (22:00 - 06:00)',
        weight: 2,
        description: 'Περιπολία περιμετρικά του στρατοπέδου και αποθηκών.',
        active: true
      },
      {
        id: 'duty-thalamofylakas',
        name: 'Θαλαμοφύλακας',
        shortName: 'Θαλαμοφύλακας',
        category: 'Οπλίτης',
        allowedRanks: ['Στρ', 'Υπδνεας', 'Δνεας'],
        armsRequired: 'Οποιοσδήποτε',
        slots: 2,
        type: 'Βάρδιες',
        shiftHours: '2 βάρδιες (Ημέρα & Νύχτα)',
        weight: 1,
        description: 'Φρούρηση και τάξη στους θαλάμους οπλιτών και οπλοβαστούς.',
        active: true
      },
      {
        id: 'duty-odigos',
        name: 'Οδηγός Υπηρεσίας (Ασθενοφόρο / Περίπολο)',
        shortName: 'Οδηγός Υπ.',
        category: 'Οπλίτης',
        allowedRanks: ['Στρ', 'Δνεας'],
        armsRequired: 'Οποιοσδήποτε',
        requiredSpecialty: 'Οδηγός',
        slots: 1,
        type: '24ωρη',
        shiftHours: '08:00 - 08:00 (Επιφυλακή)',
        weight: 1.5,
        description: 'Σε άμεση ετοιμότητα για διακομιδές ή κίνηση εκτάκτου ανάγκης.',
        active: true
      },
      {
        id: 'duty-estiatoras',
        name: 'Εστιάτορας / Μαγειρεία',
        shortName: 'Εστιάτορας',
        category: 'Οπλίτης',
        allowedRanks: ['Στρ'],
        armsRequired: 'Άοπλος',
        slots: 1,
        type: 'Ημερήσια',
        shiftHours: '06:30 - 21:00',
        weight: 1,
        description: 'Προετοιμασία εστιατορίου, διανομή συσσιτίου και καθαριότητα.',
        active: true
      }
    ],
    leaves: [
      {
        id: 'leave-1',
        personId: 'p-8',
        personName: 'Παπαδόπουλος Σταύρος',
        type: 'Κανονική Άδεια',
        startDate: '2026-09-27',
        endDate: '2026-10-02',
        reason: 'Διαταγή 43/2026',
        status: 'Ενεργή'
      },
      {
        id: 'leave-2',
        personId: 'p-12',
        personName: 'Αθανασιάδης Ηλίας',
        type: 'Ελεύθερος Υπηρεσίας (Ε.Υ.)',
        startDate: '2026-09-25',
        endDate: '2026-09-28',
        reason: 'Γνωμάτευση 401 ΓΣΝΑ',
        status: 'Ενεργή'
      }
    ],
    schedules: []
  };
}

// Ensure data file exists and return path
function ensureDataFile() {
  if (!currentDataFilePath) {
    currentDataFilePath = determineDefaultStoragePath();
  }

  const dir = path.dirname(currentDataFilePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error('Error creating directory for data file:', e);
    }
  }

  if (!fs.existsSync(currentDataFilePath)) {
    try {
      const defaultData = getDefaultInitialData();
      fs.writeFileSync(currentDataFilePath, JSON.stringify(defaultData, null, 2), 'utf-8');
      console.log('Created initial data file at:', currentDataFilePath);
    } catch (e) {
      console.error('Error writing initial data file:', e);
    }
  }

  return currentDataFilePath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Διαχείριση Υπηρεσιών Ελληνικού Στρατού',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false // allow local asset loading
    }
  });

  // Remove default menu for clean, distraction-free native desktop look
  mainWindow.setMenuBarVisibility(false);

  // Load Angular output or localhost in dev
  const indexPath = path.join(__dirname, 'dist', 'army-shift-app', 'browser', 'index.html');
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // Fallback if built directly in dist/army-shift-app
    const fallbackPath = path.join(__dirname, 'dist', 'army-shift-app', 'index.html');
    if (fs.existsSync(fallbackPath)) {
      mainWindow.loadFile(fallbackPath);
    } else {
      mainWindow.loadURL('http://localhost:4200');
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC handlers
function registerIpcHandlers() {
  // Load data
  ipcMain.handle('load-data', async () => {
    try {
      const filePath = ensureDataFile();
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(content), filePath };
    } catch (error) {
      console.error('Error reading data:', error);
      return { success: false, error: error.message };
    }
  });

  // Save data
  ipcMain.handle('save-data', async (event, data) => {
    try {
      const filePath = ensureDataFile();
      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
      return { success: true, filePath, savedAt: new Date().toISOString() };
    } catch (error) {
      console.error('Error saving data:', error);
      return { success: false, error: error.message };
    }
  });

  // Save data as new file
  ipcMain.handle('save-data-as', async (event, data) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Αποθήκευση Βάσης Δεδομένων ως...',
        defaultPath: currentDataFilePath || 'army_shifts_data.json',
        filters: [{ name: 'JSON Data File', extensions: ['json'] }]
      });

      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
        currentDataFilePath = result.filePath;
        return { success: true, filePath: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Select database file
  ipcMain.handle('select-data-file', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Επιλογή Αρχείου Δεδομένων',
        properties: ['openFile'],
        filters: [{ name: 'JSON Data File', extensions: ['json'] }]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        const content = fs.readFileSync(selectedPath, 'utf-8');
        currentDataFilePath = selectedPath;
        return { success: true, data: JSON.parse(content), filePath: selectedPath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Backup current data
  ipcMain.handle('backup-data', async () => {
    try {
      const filePath = ensureDataFile();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const parsedPath = path.parse(filePath);
      const backupPath = path.join(parsedPath.dir, `${parsedPath.name}_backup_${timestamp}${parsedPath.ext}`);
      
      fs.copyFileSync(filePath, backupPath);
      return { success: true, backupPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get current storage path
  ipcMain.handle('get-data-file-path', async () => {
    return {
      filePath: ensureDataFile(),
      isPortable: !!process.env.PORTABLE_EXECUTABLE_DIR
    };
  });

  // Save Excel file to disk
  ipcMain.handle('save-excel-file', async (event, arrayBuffer, defaultFilename) => {
    try {
      const defaultName = defaultFilename || `Ημερήσια_Διαταγή_Υπηρεσίας_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Εξαγωγή Προγράμματος Υπηρεσιών σε Excel',
        defaultPath: path.join(app.getPath('documents'), defaultName),
        filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }]
      });

      if (!result.canceled && result.filePath) {
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(result.filePath, buffer);
        return { success: true, filePath: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Open file with default application (e.g. Excel)
  ipcMain.handle('open-path', async (event, targetPath) => {
    try {
      const result = await shell.openPath(targetPath);
      return { success: !result, error: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Show item in explorer
  ipcMain.handle('show-item-in-folder', async (event, targetPath) => {
    try {
      shell.showItemInFolder(targetPath);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Print
  ipcMain.handle('print-window', async () => {
    if (!mainWindow) return { success: false };
    mainWindow.webContents.print({
      silent: false,
      printBackground: true,
      pageSize: 'A4'
    });
    return { success: true };
  });

  // Window controls
  ipcMain.handle('minimize-window', () => mainWindow?.minimize());
  ipcMain.handle('maximize-window', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle('close-window', () => mainWindow?.close());

  // App info
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      isPortable: !!process.env.PORTABLE_EXECUTABLE_DIR,
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      storagePath: currentDataFilePath
    };
  });
}

app.whenReady().then(() => {
  ensureDataFile();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
