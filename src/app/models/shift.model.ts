export type MilitaryCategory = 'Αξιωματικός' | 'Υπαξιωματικός' | 'Κληρωτός' | 'Στρατιώτης' | 'Οπλίτης';

export type PersonnelStatus = 'Ένοπλος' | 'Άοπλος' | 'Υπηρεσία Γραφείου' | 'Ελεύθερος Υπηρεσίας';

export type LeaveType = 
  | 'Ελεύθερος Υπηρεσίας (ΕΥ)'
  | 'Ελεύθερος Ορθοστασίας (ΕΟ)'
  | 'Ελεύθερος Ασκήσεων (ΕΑ)'
  | 'Ελεύθερος Αρβυλών (Εαρβ)'
  | 'Ελεύθερος Ξυρίσματος (Εξυρ)'
  | 'Εισαγωγή Στεπ'
  | 'Εισαγωγή Νοσοκομείο'
  | 'Άδεια';

export const ALL_LEAVE_TYPES: LeaveType[] = [
  'Ελεύθερος Υπηρεσίας (ΕΥ)',
  'Ελεύθερος Ορθοστασίας (ΕΟ)',
  'Ελεύθερος Ασκήσεων (ΕΑ)',
  'Ελεύθερος Αρβυλών (Εαρβ)',
  'Ελεύθερος Ξυρίσματος (Εξυρ)',
  'Εισαγωγή Στεπ',
  'Εισαγωγή Νοσοκομείο',
  'Άδεια'
];

export interface LeaveTypeMeta {
  type: LeaveType;
  category: 'ΑΠΩΝ' | 'ΚΩΛΥΟΜΕΝΟΣ' | 'ΕΛΕΥΘΕΡΟΣ' | 'ΕΝΗΜΕΡΩΤΙΚΟ';
  categoryLabel: string;
  badgeClass: string;
  blocksDuty: boolean;
  blocksStanding: boolean;
  isInformative: boolean;
  description: string;
}

export function getLeaveTypeMeta(type: LeaveType | string): LeaveTypeMeta {
  switch (type) {
    case 'Ελεύθερος Υπηρεσίας (ΕΥ)':
    case 'Ελεύθερος Υπηρεσίας (Ε.Υ.)':
      return {
        type: 'Ελεύθερος Υπηρεσίας (ΕΥ)',
        category: 'ΕΛΕΥΘΕΡΟΣ',
        categoryLabel: 'Ελεύθερος Υπηρεσίας (ΕΥ)',
        badgeClass: 'badge-danger',
        blocksDuty: true,
        blocksStanding: true,
        isInformative: false,
        description: 'Απαλλαγή από εκτέλεση οποιασδήποτε υπηρεσίας'
      };
    case 'Ελεύθερος Ορθοστασίας (ΕΟ)':
      return {
        type: 'Ελεύθερος Ορθοστασίας (ΕΟ)',
        category: 'ΕΛΕΥΘΕΡΟΣ',
        categoryLabel: 'Ελεύθερος Ορθοστασίας (ΕΟ)',
        badgeClass: 'badge-warning',
        blocksDuty: false,
        blocksStanding: true,
        isInformative: false,
        description: 'Απαλλαγή από ορθοστασία/σκοπιά'
      };
    case 'Ελεύθερος Ασκήσεων (ΕΑ)':
      return {
        type: 'Ελεύθερος Ασκήσεων (ΕΑ)',
        category: 'ΕΛΕΥΘΕΡΟΣ',
        categoryLabel: 'Ελεύθερος Ασκήσεων (ΕΑ)',
        badgeClass: 'badge-info',
        blocksDuty: false,
        blocksStanding: false,
        isInformative: false,
        description: 'Απαλλαγή από ασκήσεις και επιχειρησιακή εκπαίδευση'
      };
    case 'Ελεύθερος Αρβυλών (Εαρβ)':
      return {
        type: 'Ελεύθερος Αρβυλών (Εαρβ)',
        category: 'ΕΝΗΜΕΡΩΤΙΚΟ',
        categoryLabel: 'Ενημερωτικό (Εαρβ)',
        badgeClass: 'badge-corporate',
        blocksDuty: false,
        blocksStanding: false,
        isInformative: true,
        description: 'Ενημερωτικό: Απαλλαγή από αρβύλες (διαθέσιμος κανονικά)'
      };
    case 'Ελεύθερος Ξυρίσματος (Εξυρ)':
      return {
        type: 'Ελεύθερος Ξυρίσματος (Εξυρ)',
        category: 'ΕΝΗΜΕΡΩΤΙΚΟ',
        categoryLabel: 'Ενημερωτικό (Εξυρ)',
        badgeClass: 'badge-corporate',
        blocksDuty: false,
        blocksStanding: false,
        isInformative: true,
        description: 'Ενημερωτικό: Απαλλαγή από ξύρισμα (διαθέσιμος κανονικά)'
      };
    case 'Εισαγωγή Στεπ':
      return {
        type: 'Εισαγωγή Στεπ',
        category: 'ΚΩΛΥΟΜΕΝΟΣ',
        categoryLabel: 'Κωλυόμενος (ΣΤΕΠ)',
        badgeClass: 'badge-warning',
        blocksDuty: true,
        blocksStanding: true,
        isInformative: false,
        description: 'Νοσηλεία στο ΣΤΕΠ/Ιατρείο Μονάδας (εντός στρατοπέδου)'
      };
    case 'Εισαγωγή Νοσοκομείο':
      return {
        type: 'Εισαγωγή Νοσοκομείο',
        category: 'ΑΠΩΝ',
        categoryLabel: 'Απών (Νοσοκομείο)',
        badgeClass: 'badge-danger',
        blocksDuty: true,
        blocksStanding: true,
        isInformative: false,
        description: 'Νοσηλεία σε Στρατιωτικό Νοσοκομείο (εκτός στρατοπέδου)'
      };
    case 'Άδεια':
    default:
      return {
        type: 'Άδεια',
        category: 'ΑΠΩΝ',
        categoryLabel: 'Απών (Άδεια)',
        badgeClass: 'badge-primary',
        blocksDuty: true,
        blocksStanding: true,
        isInformative: false,
        description: 'Άδεια εκτός μονάδας'
      };
  }
}

export interface TimeInterval {
  from: string; // HH:MM, e.g. "14:00"
  to: string;   // HH:MM, e.g. "16:00"
}

export interface DutySlotDefinition {
  slotIndex: number;
  groupIndex?: number; // 1, 2, 3, 4 for time groups
  groupName?: string;
  groupTag?: string; // e.g. "COVER", "MAIN"
  label?: string; // e.g. "1η Θέση (14-16, 22-00, 06-08) - Σκοπός 1"
  intervals: TimeInterval[];
  hoursNote?: string;
}

export type TimePresetType = 
  | 'ROLLING_CYCLE' 
  | 'RESTAURANT_CYCLE'
  | 'CUSTOM'
  | 'GREEK_ARMY_2_6';

export type FitnessLevel = 'Ι1' | 'Ι2' | 'Ι3' | 'Ι4';

export interface Personnel {
  id: string;
  rank: string;
  rankShort: string;
  category: MilitaryCategory;
  fullName: string;
  asm: string;              // Αριθμός Στρατιωτικού Μητρώου ή ΕΣΣΟ
  specialty: string;        // ΟΠΛΟ (π.χ. ΠΖ – Πεζικό)
  corps?: string;
  fitnessProfile?: FitnessLevel; // Ι1, Ι2, Ι3, Ι4
  status: PersonnelStatus;  // Ένοπλος / Άοπλος
  company?: string;         // Προαιρετικό
  rotationalGroup?: string;
  barracksRoom?: string;    // Θάλαμος (π.χ. "101", "1.1")
  bedNumber?: string;       // Κρεβάτι (π.χ. "12", "6")
  weaponNumber?: string;    // Αριθμός Όπλου (π.χ. "124859")
  exemptFromAllDuties?: boolean; // Δεν εκτελεί καμία υπηρεσία (πλήρης απαλλαγή)
  eligibleDutyIds?: string[];    // IDs υπηρεσιών που είναι επιλέξιμος να εκτελέσει
  dutyScore: number;        // Πόσες υπηρεσίες έχει κάνει συνολικά (για δίκαιη κατανομή)
  weekendDutyScore?: number; // Πόσες υπηρεσίες σε Σαββατοκύριακα/Αργίες
  lastDutyDate?: string;    // Τελευταία ημερομηνία υπηρεσίας (YYYY-MM-DD)
  notes?: string;
  active: boolean;
}

export interface DutyType {
  id: string;
  name: string;             // π.χ. Οπλοφύλακας, Θαλαμοφύλακας, Εστιατόρια, Αρτοκλίβανος
  shortName: string;        // π.χ. Οπλοφύλακας
  category: MilitaryCategory | 'Οποιοσδήποτε';
  allowedRanks: string[];   // π.χ. ['Στρ', 'Υπδνεας', 'Δνεας']
  armsRequired: 'Ένοπλος' | 'Άοπλος' | 'Οποιοσδήποτε';
  requiredSpecialty?: string; // π.χ. 'Οδηγός', 'Μάγειρας'
  slots: number;            // Πόσα άτομα απαιτούνται (π.χ. 4 για 2-6)
  type: '24ωρη' | 'Βάρδιες' | 'Ημερήσια' | 'Προσαρμοσμένο';
  shiftHours: string;       // Περιγραφή ή σύνοψη ωραρίου
  timePresetType?: TimePresetType;
  slotDefinitions?: DutySlotDefinition[]; // Αναλυτικά διαστήματα ανά θέση/βάρδια
  weight: number;           // Συντελεστής δυσκολίας (π.χ. 2.0)
  description?: string;
  hasSpecialWeekendSwaps?: boolean; // Ένδειξη ειδικών εναλλαγών Σαββατοκύριακου
  weekendSwapNote?: string;         // Επεξηγηματικό κείμενο εναλλαγής Σ/Κ
  active: boolean;
}

export interface Leave {
  id: string;
  personId: string;
  personName: string;
  type: LeaveType;
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  reason?: string;
  status: 'Ενεργή' | 'Ολοκληρωμένη' | 'Ακυρωμένη';
}

export interface ShiftSlotAssignment {
  slotIndex: number;
  groupIndex?: number;
  personId: string | null;
  personName?: string;
  rankShort?: string;
  company?: string;
  rotationalGroup?: string;
  groupTag?: string;
  hoursNote?: string;       // π.χ. "14:00 - 16:00, 22:00 - 00:00, 06:00 - 08:00"
  intervals?: TimeInterval[];
  manualOverride?: boolean;
  conflictWarning?: string; // Μήνυμα εάν υπάρχει σύγκρουση (π.χ. άδεια, 2η υπηρεσία)
  conflictSeverity?: 'WARNING' | 'ERROR' | 'INFO';
}

export interface DutyAssignment {
  dutyTypeId: string;
  dutyName: string;
  shortName: string;
  category: string;
  weight?: number;
  slots: ShiftSlotAssignment[];
}

export interface WeekendPlan {
  fridayDate: string;
  saturdayDate: string;
  sundayDate: string;
  saturdayOffIds: string[]; // Soldier IDs with day off on Saturday
  sundayOffIds: string[];   // Soldier IDs with day off on Sunday
  inCampIds?: string[];     // Soldier IDs with duty throughout weekend / in camp
  updatedAt?: string;
}

export interface DailySchedule {
  date: string;             // YYYY-MM-DD
  isHolidayOrWeekend: boolean;
  dayNote?: string;         // e.g. Σημείωση ημέρας
  notes?: string;
  duties: DutyAssignment[];
  savedAt?: string;
  weekendPlan?: WeekendPlan;
  isFinalized?: boolean;
  finalizedAt?: string;
  previousLastDutyDates?: Record<string, string | undefined>;
}

export interface UnitInfo {
  name: string;             // π.χ. 535 Μ/Κ ΤΠ
  location: string;         // π.χ. Σιδηρόκαστρο
  division: string;         // π.χ. 16η Μ/Κ ΜΠ
  commanderName: string;    // π.χ. Αντισυνταγματάρχης (ΠΖ) Παπαδόπουλος Γεώργιος
  dutyOfficerSignatureTitle: string; // π.χ. Ο Αξιωματικός Επιχειρήσεων
  dutyOfficerName: string;  // π.χ. Ταγματάρχης (ΠΖ) Κωνσταντίνου Δημήτριος
}

export interface AppData {
  unitInfo: UnitInfo;
  personnel: Personnel[];
  dutyTypes: DutyType[];
  leaves: Leave[];
  schedules: DailySchedule[];
  weekendPlans?: Record<string, WeekendPlan>;
}

// Conflict validation interface
export interface ShiftConflict {
  type: 'LEAVE' | 'DOUBLE_ASSIGNMENT' | 'REST_VIOLATION' | 'RANK_MISMATCH' | 'ARMS_MISMATCH' | 'SPECIALTY_MISMATCH';
  severity: 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  personId: string;
  personName: string;
}

// Greek accent stripping utility
const ACCENT_MAP: Record<string, string> = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
  'ΐ': 'ι', 'ΰ': 'υ', 'ϊ': 'ι', 'ϋ': 'υ', 'Ϊ': 'Ι', 'Ϋ': 'Υ'
};

/** Strip all Greek accents / diacritics from a string */
export function stripGreekAccents(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u0384\u0385\u037A´`¨]/g, '')
    .replace(/[άέήίόύώΆΈΉΊΌΎΏΐΰϊϋΪΫ]/g, ch => ACCENT_MAP[ch] || ch);
}

/** Normalize a string for accent+case insensitive comparison */
export function normalizeGreek(str: string | null | undefined): string {
  if (!str) return '';
  return stripGreekAccents(str).toLowerCase().trim();
}

/** Convert a name to uppercase Greek without accents / intonation (Greek Army standard) */
export function toGreekCaps(str: string | null | undefined): string {
  if (!str) return '';
  return stripGreekAccents(str).toUpperCase();
}

/** Format ISO YYYY-MM-DD date string to Greek DD/MM/YYYY */
export function formatGreekDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const trimmed = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return trimmed;
}

/** Extract short code from corps / specialty (e.g. "ΠΖ – Πεζικό" -> "ΠΖ", "ΠΖ" -> "ΠΖ") */
export function getCorpsShort(corps?: string | null): string {
  if (!corps) return 'ΠΖ';
  const trimmed = corps.trim();
  const short = trimmed.split(/[–\-—]/)[0].trim().toUpperCase();
  return short || 'ΠΖ';
}

