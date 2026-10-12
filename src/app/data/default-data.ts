import { AppData, HigherPersonnel, ScheduleTemplate, DutyType } from '../models/shift.model';
import { generateGreekArmy26Slots } from './time-presets';
import { DEFAULT_EMBLEM_BASE64 } from './default-emblem';

export function createEmptyAppData(): AppData {
  return {
    unitInfo: {
      name: '',
      location: '',
      division: '',
      commanderTitle: '',
      commanderName: '',
      dutyOfficerSignatureTitle: '',
      dutyOfficerName: '',
      supervisorSignatureTitle: '',
      supervisorName: '',
      emblemUrl: ''
    },
    higherPersonnel: [],
    personnel: [],
    dutyTypes: [],
    leaves: [],
    soldierRecords: [],
    schedules: [],
    weekendPlans: {},
    scheduleTemplates: [],
    dailyExodouchoiPlans: {}
  };
}

export const DEFAULT_HIGHER_PERSONNEL: HigherPersonnel[] = [
  {
    id: 'hp-1',
    roleTitle: 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ',
    fullName: 'ΖΑΒΙΤΣΑΝΟΣ ΔΗΜΗΤΡΙΟΣ',
    rank: 'ΑΝΧΗΣ (ΠΒ)'
  },
  {
    id: 'hp-2',
    roleTitle: 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ',
    fullName: 'ΛΙΝΑΡΔΟΣ ΜΑΡΙΟΣ',
    rank: 'ΥΠΛΓΟΣ (ΠΖ)'
  },
  {
    id: 'hp-3',
    roleTitle: 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ',
    fullName: 'ΤΕΡΖΟΓΛΟΥ ΕΥΜΟΡΦΙΑ',
    rank: 'ΑΝΘΛΓΟΣ (ΠΒ)'
  },
  {
    id: 'hp-4',
    roleTitle: 'ΑΞΙΩΜΑΤΙΚΟΣ ΕΠΙΧΕΙΡΗΣΕΩΝ',
    fullName: 'ΚΩΝΣΤΑΝΤΙΝΟΥ ΔΗΜΗΤΡΙΟΣ',
    rank: 'ΤΧΗΣ (ΠΖ)'
  },
  {
    id: 'hp-5',
    roleTitle: 'ΑΞΙΩΜΑΤΙΚΟΣ ΥΠΗΡΕΣΙΑΣ',
    fullName: 'ΔΗΜΗΤΡΙΑΔΗΣ ΝΙΚΟΛΑΟΣ',
    rank: 'ΑΝΘΛΓΟΣ (ΠΖ)'
  }
];

export const DEFAULT_APP_DATA: AppData = {
  unitInfo: {
    name: 'ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)',
    location: 'Θήβα',
    division: '2ο ΜΕΛ/Σ',
    commanderTitle: 'ΔΙΟΙΚΗΤΗΣ ΜΟΙΡΑΣ',
    commanderName: 'ΖΑΒΙΤΣΑΝΟΣ ΔΗΜΗΤΡΙΟΣ\nΑΝΧΗΣ (ΠΒ)',
    dutyOfficerSignatureTitle: 'ΔΚΤΗΣ ΠΥΡΧΙΑΣ',
    dutyOfficerName: 'ΛΙΝΑΡΔΟΣ ΜΑΡΙΟΣ\nΥΠΛΓΟΣ (ΠΖ)',
    supervisorSignatureTitle: 'ΑΛΧΙΑΣ ΠΥΡΧΙΑΣ',
    supervisorName: 'ΤΕΡΖΟΓΛΟΥ ΕΥΜΟΡΦΙΑ\nΑΝΘΛΓΟΣ (ΠΒ)',
    emblemUrl: DEFAULT_EMBLEM_BASE64
  },
  higherPersonnel: DEFAULT_HIGHER_PERSONNEL,
  personnel: [
    {
      id: 'p-1',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΓΕΩΡΓΙΟΥ ΑΛΕΞΑΝΔΡΟΣ',
      asm: '154/2012',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '1',
      dutyScore: 2,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-22',
      notes: 'Εκπαιδευτής βολών',
      active: true
    },
    {
      id: 'p-2',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΔΗΜΗΤΡΙΟΥ ΝΙΚΟΛΑΟΣ',
      asm: '189/2015',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '2',
      dutyScore: 3,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-20',
      notes: '',
      active: true
    },
    {
      id: 'p-3',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΒΑΣΙΛΕΙΟΥ ΙΩΑΝΝΗΣ',
      asm: '874/2005',
      specialty: 'ΤΧ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '3',
      dutyScore: 2,
      weekendDutyScore: 0,
      lastDutyDate: '2026-09-21',
      notes: '',
      active: true
    },
    {
      id: 'p-4',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΣΤΑΥΡΟΠΟΥΛΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ',
      asm: '921/2008',
      specialty: 'ΔΒ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '4',
      dutyScore: 3,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-23',
      notes: '',
      active: true
    },
    {
      id: 'p-5',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΑΝΑΣΤΑΣΙΑΔΗΣ ΠΑΝΑΓΙΩΤΗΣ',
      asm: '350/2024',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      specialRole: 'ΜΟΝΙΜΟΣ ΕΣΤΙΑΤΟΡΙΑ',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '5',
      dutyScore: 4,
      weekendDutyScore: 2,
      lastDutyDate: '2026-09-24',
      notes: '',
      active: true
    },
    {
      id: 'p-6',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΑΝΩΛΗΣ ΧΡΗΣΤΟΣ',
      asm: '2024 Β / 23412',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      specialRole: 'ΜΟΝΙΜΟΣ ΚΨΜ',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '6',
      dutyScore: 4,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-22',
      notes: '',
      active: true
    },
    {
      id: 'p-7',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΡΑΜΑΝΛΗΣ ΕΥΑΓΓΕΛΟΣ',
      asm: '2024 Γ / 11204',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      specialRole: 'ΥΠΕΥΘΥΝΟΣ ΥΛΙΚΟΥ ΚΑΘΑΡΙΟΤΗΤΑΣ',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '7',
      dutyScore: 5,
      weekendDutyScore: 2,
      lastDutyDate: '2026-09-21',
      notes: '',
      active: true
    },
    {
      id: 'p-8',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΣΤΑΥΡΟΣ',
      asm: '2024 Δ / 09144',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      specialRole: 'ΓΡΑΦΕΑΣ',
      barracksRoom: 'ΘΑΛΑΜΟΣ 1',
      bedNumber: '8',
      dutyScore: 6,
      weekendDutyScore: 2,
      lastDutyDate: '2026-09-24',
      notes: '',
      active: true
    },
    {
      id: 'p-9',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΝΙΚΟΛΑΟΥ ΑΝΔΡΕΑΣ',
      asm: '2024 Δ / 12389',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '1',
      dutyScore: 5,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-23',
      notes: '',
      active: true
    },
    {
      id: 'p-10',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΘΕΟΔΩΡΟΥ ΜΙΧΑΗΛ',
      asm: '2024 Γ / 14590',
      specialty: 'ΕΜ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '2',
      dutyScore: 4,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-21',
      notes: '',
      active: true
    },
    {
      id: 'p-11',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΩΣΤΟΠΟΥΛΟΣ ΠΕΤΡΟΣ',
      asm: '2024 Γ / 08711',
      specialty: 'ΕΜ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '3',
      dutyScore: 5,
      weekendDutyScore: 2,
      lastDutyDate: '2026-09-23',
      notes: '',
      active: true
    },
    {
      id: 'p-12',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΑΘΑΝΑΣΙΑΔΗΣ ΗΛΙΑΣ',
      asm: '2024 Δ / 10223',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι4',
      status: 'Άοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '4',
      dutyScore: 3,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-20',
      notes: '',
      active: true
    },
    {
      id: 'p-13',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΣΑΚΕΛΛΑΡΙΟΥ ΣΠΥΡΙΔΩΝ',
      asm: '2024 Δ / 07312',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '5',
      dutyScore: 4,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-22',
      notes: '',
      active: true
    },
    {
      id: 'p-14',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΛΕΒΕΝΤΗΣ ΑΘΑΝΑΣΙΟΣ',
      asm: '2024 Γ / 09841',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '6',
      dutyScore: 3,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-19',
      notes: '',
      active: true
    },
    {
      id: 'p-15',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΤΡΙΑΝΤΑΦΥΛΛΟΥ ΔΗΜΗΤΡΙΟΣ',
      asm: '2024 Δ / 13902',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '7',
      dutyScore: 3,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-18',
      notes: '',
      active: true
    },
    {
      id: 'p-16',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΧΑΤΖΗΓΕΩΡΓΙΟΥ ΒΑΣΙΛΕΙΟΣ',
      asm: '2024 Γ / 11099',
      specialty: 'ΕΜ',
      fitnessProfile: 'Ι2',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 2',
      bedNumber: '8',
      dutyScore: 3,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-19',
      notes: '',
      active: true
    },
    {
      id: 'p-17',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΑΝΩΛΑΚΗΣ ΕΥΑΓΓΕΛΟΣ',
      asm: '2024 Δ / 14120',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '1',
      dutyScore: 2,
      weekendDutyScore: 0,
      lastDutyDate: '2026-09-21',
      notes: '',
      active: true
    },
    {
      id: 'p-18',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΣΤΕΦΑΝΙΔΗΣ ΘΕΟΔΩΡΟΣ',
      asm: '2024 Γ / 11500',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '2',
      dutyScore: 1,
      weekendDutyScore: 0,
      lastDutyDate: '2026-09-22',
      notes: '',
      active: true
    },
    {
      id: 'p-19',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΡΡΑΣ ΣΩΤΗΡΙΟΣ',
      asm: '2024 Δ / 14211',
      specialty: 'ΠΒ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '3',
      dutyScore: 1,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-23',
      notes: '',
      active: true
    },
    {
      id: 'p-20',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΑΝΤΩΝΙΟΥ ΧΡΗΣΤΟΣ',
      asm: '2024 Γ / 11844',
      specialty: 'ΤΘ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '4',
      dutyScore: 2,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-20',
      notes: '',
      active: true
    },
    {
      id: 'p-21',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΦΩΤΙΑΔΗΣ ΠΑΝΑΓΙΩΤΗΣ',
      asm: '2024 Δ / 14350',
      specialty: 'ΜΧ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '5',
      dutyScore: 2,
      weekendDutyScore: 0,
      lastDutyDate: '2026-09-21',
      notes: '',
      active: true
    },
    {
      id: 'p-22',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΟΣΜΙΔΗΣ ΚΩΝΣΤΑΝΤΙΝΟΣ',
      asm: '2024 Β / 09812',
      specialty: 'ΥΠ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '6',
      dutyScore: 3,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-17',
      notes: '',
      active: true
    },
    {
      id: 'p-23',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΔΙΑΜΑΝΤΗΣ ΑΧΙΛΛΕΑΣ',
      asm: '2024 Δ / 14488',
      specialty: 'ΑΣ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '7',
      dutyScore: 1,
      weekendDutyScore: 0,
      lastDutyDate: '2026-09-22',
      notes: '',
      active: true
    },
    {
      id: 'p-24',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΙΧΑΗΛΙΔΗΣ ΙΟΡΔΑΝΗΣ',
      asm: '2024 Γ / 11990',
      specialty: 'ΥΓ',
      fitnessProfile: 'Ι3',
      status: 'Ένοπλος',
      barracksRoom: 'ΘΑΛΑΜΟΣ 3',
      bedNumber: '8',
      dutyScore: 2,
      weekendDutyScore: 1,
      lastDutyDate: '2026-09-19',
      notes: '',
      active: true
    },
    {
      id: 'p-25',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΡΑΓΙΑΝΝΙΔΗΣ ΑΝΤΩΝΙΟΣ',
      asm: '2024 Γ / 12101',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-26',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΤΣΑΡΑΣ ΑΛΕΞΑΝΔΡΟΣ',
      asm: '2024 Γ / 12102',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-27',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΤΣΙΟΥΛΗΣ ΦΙΛΙΠΠΟΣ',
      asm: '2024 Γ / 12103',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-28',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΟΥΦΟΣ ΓΕΩΡΓΙΟΣ',
      asm: '2024 Γ / 12104',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-29',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΟΥΡΟΥΒΑΚΑΛΗΣ ΑΝΔΡΕΑΣ',
      asm: '2024 Γ / 12105',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-30',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΠΟΥΛΑΚΗΣ ΝΙΚΟΛΑΟΣ',
      asm: '2024 Γ / 12106',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-31',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΠΑΡΤΖΗΣ ΙΩΑΝΝΗΣ',
      asm: '2024 Γ / 12107',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-32',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΥΛΩΝΑΣ ΙΩΑΝΝΗΣ',
      asm: '2024 Γ / 12108',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-33',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΠΑΝΟΥΣΗΣ ΜΙΧΑΗΛ',
      asm: '2024 Γ / 12109',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-34',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΛΟΥΛΟΥΔΗΣ ΑΘΑΝΑΣΙΟΣ',
      asm: '2024 Γ / 12110',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-35',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΠΑΡΑΘΥΡΑΣ ΑΝΑΣΤΑΣΙΟΣ',
      asm: '2024 Γ / 12111',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-36',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΤΕΛΙΔΗΣ ΚΩΝΣΤΑΝΤΙΝΟΣ',
      asm: '2024 Γ / 12112',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-37',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΔΕΜΕΡΤΖΙΔΗΣ ΠΑΝΑΓΙΩΤΗΣ',
      asm: '2024 Γ / 12113',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-38',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΕΛΕΥΘΕΡΙΑΔΗΣ ΕΥΑΓΓΕΛΟΣ',
      asm: '2024 Γ / 12114',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-39',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΖΑΡΟΥΚΑΣ ΧΡΗΣΤΟΣ',
      asm: '2024 Γ / 12115',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-40',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΖΑΡΟΥΚΑΣ ΠΑΝΑΓΙΩΤΗΣ',
      asm: '2024 Γ / 12116',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-41',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΗΛΙΑΔΗΣ ΚΩΝΣΤΑΝΤΙΝΟΣ',
      asm: '2024 Γ / 12117',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-42',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΥΡΙΜΗΣ ΔΗΜΗΤΡΙΟΣ',
      asm: '2024 Γ / 12118',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-43',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΣΙΔΗΡΟΠΟΥΛΟΣ ΕΛΕΥΘΕΡΙΟΣ',
      asm: '2024 Γ / 12119',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-44',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΣΟΥΕΚΑΚΗΣ ΙΩΑΝΝΗΣ',
      asm: '2024 Γ / 12120',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-45',
      rank: 'ΔΕΚΑΝΕΑΣ',
      rankShort: 'ΔΚΑΣ',
      category: 'Κληρωτός',
      fullName: 'ΑΜΑΝΑΤΙΔΗΣ ΜΑΡΙΟΣ',
      asm: '2024 Γ / 12121',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-46',
      rank: 'ΔΕΚΑΝΕΑΣ',
      rankShort: 'ΔΚΑΣ',
      category: 'Κληρωτός',
      fullName: 'ΑΣΥΜΟΛΗΤΟΣ ΕΥΑΓΓΕΛΟΣ',
      asm: '2024 Γ / 12122',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-47',
      rank: 'ΔΕΚΑΝΕΑΣ',
      rankShort: 'ΔΚΑΣ',
      category: 'Κληρωτός',
      fullName: 'ΑΛΑΜΑΝΑΣ ΙΩΑΝΝΗΣ',
      asm: '2024 Γ / 12123',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-48',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΓΚΟΝΤΑΛΗΣ ΛΑΜΠΡΟΣ',
      asm: '2024 Γ / 12124',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-49',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΓΚΟΥΤΚΟΥΛΗΣ ΔΗΜΗΤΡΙΟΣ',
      asm: '2024 Γ / 12125',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-50',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΑΝΤΖΑΡΙΔΗΣ ΑΝΕΣΤΗΣ',
      asm: '2024 Γ / 12126',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-51',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΓΑΙΤΑΝΙΔΗΣ ΧΡΗΣΤΟΣ',
      asm: '2024 Γ / 12127',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-52',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΓΕΡΕΜΤΖΕΣ ΧΑΡΑΛΑΜΠΟΣ',
      asm: '2024 Γ / 12128',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-53',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΩΝΣΤΑΝΤΙΝΟΥΔΗΣ ΜΙΧΑΗΛ',
      asm: '2024 Γ / 12129',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-54',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΩΣΤΕΛΛΟΣ ΘΩΜΑΣ',
      asm: '2024 Γ / 12130',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-55',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΩΤΣΕΛΗΣ ΣΤΕΦΑΝΟΣ',
      asm: '2024 Γ / 12131',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-56',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΑΙΓΟΥΤΑΣ ΙΩΑΝΝΗΣ',
      asm: '2024 Γ / 12132',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-57',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΠΟΥΝΤΑΚΙΔΗΣ ΡΑΦΑΗΛ',
      asm: '2024 Γ / 12133',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-58',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΠΟΥΣΙΑΣ ΔΗΜΗΤΡΙΟΣ',
      asm: '2024 Γ / 12134',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-59',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΤΣΑΟΥΣΙΔΗΣ ΔΗΜΟΣΘΕΝΗΣ',
      asm: '2024 Γ / 12135',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-60',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΧΑΡΑΛΑΜΠΙΔΗΣ ΧΑΡΑΛΑΜΠΟΣ',
      asm: '2024 Γ / 12136',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-61',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΡΑΣΑΡΙΔΗΣ ΠΑΝΑΓΙΩΤΗΣ',
      asm: '2024 Γ / 12137',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-62',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΣΟΥΛΙΩΤΗΣ ΓΕΩΡΓΙΟΣ',
      asm: '2024 Γ / 12138',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-63',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΡΑΘΑΝΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ',
      asm: '2024 Γ / 12139',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-64',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΟΚΚΙΝΟΣ ΛΕΩΝΙΔΑΣ',
      asm: '2024 Γ / 12140',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-65',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΟΛΟΒΟΣ ΣΠΥΡΙΔΩΝ',
      asm: '2024 Γ / 12141',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-66',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΣΙΑΣΙΟΣ ΝΙΚΟΛΑΟΣ',
      asm: '2024 Γ / 12142',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-67',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΤΣΑΤΣΑΛΜΑΣ ΚΩΝΣΤΑΝΤΙΝΟΣ',
      asm: '2024 Γ / 12143',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-68',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΤΣΟΥΒΑΛΑΣ ΔΗΜΗΤΡΙΟΣ',
      asm: '2024 Γ / 12144',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-69',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΦΑΝΟΥΔΑΟΓΛΟΥ ΟΡΦΕΑΣ',
      asm: '2024 Γ / 12145',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-70',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΦΑΡΜΑΚΗΣ ΡΑΦΑΗΛ',
      asm: '2024 Γ / 12146',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-71',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΧΙΟΝΙΔΗΣ ΝΙΚΟΛΑΟΣ',
      asm: '2024 Γ / 12147',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι1',
      status: 'Ένοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-72',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΑΡΒΑΝΙΤΗΣ ΝΙΚΟΛΑΟΣ',
      asm: '2024 Γ / 12148',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-73',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΒΡΑΤΣΙΣΤΑΣ ΧΡΗΣΤΟΣ',
      asm: '2024 Γ / 12149',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-74',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΛΑΙΤΖΙΔΗΣ ΕΥΑΓΓΕΛΟΣ',
      asm: '2024 Γ / 12150',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-75',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΑΡΑΣΑΒΒΙΔΗΣ ΝΙΚΟΛΑΟΣ',
      asm: '2024 Γ / 12151',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-76',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΛΗΜΑΤΣΑΚΗΣ ΑΝΤΩΝΙΟΣ',
      asm: '2024 Γ / 12152',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-77',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΚΟΝΤΟΦΑΚΑΣ ΓΕΩΡΓΙΟΣ',
      asm: '2024 Γ / 12153',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-78',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΛΑΜΟ ΕΛΒΙΣ',
      asm: '2024 Γ / 12154',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    },
    {
      id: 'p-79',
      rank: 'ΣΤΡΑΤΙΩΤΗΣ',
      rankShort: 'ΣΤΡ',
      category: 'Κληρωτός',
      fullName: 'ΜΑΣΤΡΟΤΑΣΙΟΣ ΠΑΝΑΓΙΩΤΗΣ',
      asm: '2024 Γ / 12155',
      specialty: 'ΠΖ',
      fitnessProfile: 'Ι3',
      status: 'Άοπλος',
      dutyScore: 1,
      active: true
    }
  ],
  dutyTypes: [
    {
      id: 'duty-oplofylakas',
      name: 'Οπλοφύλακας',
      shortName: 'ΟΦ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'],
      armsRequired: 'Ένοπλος',
      slots: 4,
      type: 'Βάρδιες',
      timePresetType: 'ROLLING_CYCLE',
      shiftHours: '2ωρες κυλιόμενες: 14:00-16:00, 22:00-00:00, 06:00-08:00 (4 θέσεις × 1 άτομο = 4 σύνολο)',
      slotDefinitions: [
        {
          slotIndex: 1,
          groupIndex: 1,
          groupName: '1η Θέση',
          label: '1η Θέση (14:00-16:00, 22:00-00:00, 06:00-08:00)',
          intervals: [
            { from: '14:00', to: '16:00' },
            { from: '22:00', to: '00:00' },
            { from: '06:00', to: '08:00' }
          ]
        },
        {
          slotIndex: 2,
          groupIndex: 2,
          groupName: '2η Θέση',
          label: '2η Θέση (16:00-18:00, 00:00-02:00, 08:00-10:00)',
          intervals: [
            { from: '16:00', to: '18:00' },
            { from: '00:00', to: '02:00' },
            { from: '08:00', to: '10:00' }
          ]
        },
        {
          slotIndex: 3,
          groupIndex: 3,
          groupName: '3η Θέση',
          label: '3η Θέση (18:00-20:00, 02:00-04:00, 10:00-12:00)',
          intervals: [
            { from: '18:00', to: '20:00' },
            { from: '02:00', to: '04:00' },
            { from: '10:00', to: '12:00' }
          ]
        },
        {
          slotIndex: 4,
          groupIndex: 4,
          groupName: '4η Θέση',
          label: '4η Θέση (20:00-22:00, 04:00-06:00, 12:00-14:00)',
          intervals: [
            { from: '20:00', to: '22:00' },
            { from: '04:00', to: '06:00' },
            { from: '12:00', to: '14:00' }
          ]
        }
      ],
      weight: 2,
      description: 'Ένοπλη φύλαξη οπλοβαστών επί 24ώρου βάσεως (1 άτομο ανά 2ωρη βάρδια - 4 άτομα σύνολο).',
      hasSpecialWeekendSwaps: true,
      active: true
    },
    {
      id: 'duty-thalamofylakas',
      name: 'Θαλαμοφύλακας',
      shortName: 'ΘΦ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'],
      armsRequired: 'Οποιοσδήποτε',
      slots: 8,
      type: 'Βάρδιες',
      timePresetType: 'ROLLING_CYCLE',
      shiftHours: '2ωρες κυλιόμενες: 14:00-16:00, 22:00-00:00, 06:00-08:00 (4 θέσεις × 2 άτομα = 8 σύνολο)',
      slotDefinitions: [
        {
          slotIndex: 1,
          groupIndex: 1,
          groupName: '1η Θέση',
          label: '1η Θέση - Άτομο 1 (14:00-16:00, 22:00-00:00, 06:00-08:00)',
          intervals: [
            { from: '14:00', to: '16:00' },
            { from: '22:00', to: '00:00' },
            { from: '06:00', to: '08:00' }
          ]
        },
        {
          slotIndex: 2,
          groupIndex: 1,
          groupName: '1η Θέση',
          label: '1η Θέση - Άτομο 2 (14:00-16:00, 22:00-00:00, 06:00-08:00)',
          intervals: [
            { from: '14:00', to: '16:00' },
            { from: '22:00', to: '00:00' },
            { from: '06:00', to: '08:00' }
          ]
        },
        {
          slotIndex: 3,
          groupIndex: 2,
          groupName: '2η Θέση',
          label: '2η Θέση - Άτομο 1 (16:00-18:00, 00:00-02:00, 08:00-10:00)',
          intervals: [
            { from: '16:00', to: '18:00' },
            { from: '00:00', to: '02:00' },
            { from: '08:00', to: '10:00' }
          ]
        },
        {
          slotIndex: 4,
          groupIndex: 2,
          groupName: '2η Θέση',
          label: '2η Θέση - Άτομο 2 (16:00-18:00, 00:00-02:00, 08:00-10:00)',
          intervals: [
            { from: '16:00', to: '18:00' },
            { from: '00:00', to: '02:00' },
            { from: '08:00', to: '10:00' }
          ]
        },
        {
          slotIndex: 5,
          groupIndex: 3,
          groupName: '3η Θέση',
          label: '3η Θέση - Άτομο 1 (18:00-20:00, 02:00-04:00, 10:00-12:00)',
          intervals: [
            { from: '18:00', to: '20:00' },
            { from: '02:00', to: '04:00' },
            { from: '10:00', to: '12:00' }
          ]
        },
        {
          slotIndex: 6,
          groupIndex: 3,
          groupName: '3η Θέση',
          label: '3η Θέση - Άτομο 2 (18:00-20:00, 02:00-04:00, 10:00-12:00)',
          intervals: [
            { from: '18:00', to: '20:00' },
            { from: '02:00', to: '04:00' },
            { from: '10:00', to: '12:00' }
          ]
        },
        {
          slotIndex: 7,
          groupIndex: 4,
          groupName: '4η Θέση',
          label: '4η Θέση - Άτομο 1 (20:00-22:00, 04:00-06:00, 12:00-14:00)',
          intervals: [
            { from: '20:00', to: '22:00' },
            { from: '04:00', to: '06:00' },
            { from: '12:00', to: '14:00' }
          ]
        },
        {
          slotIndex: 8,
          groupIndex: 4,
          groupName: '4η Θέση',
          label: '4η Θέση - Άτομο 2 (20:00-22:00, 04:00-06:00, 12:00-14:00)',
          intervals: [
            { from: '20:00', to: '22:00' },
            { from: '04:00', to: '06:00' },
            { from: '12:00', to: '14:00' }
          ]
        }
      ],
      weight: 2,
      description: 'Φρούρηση θαλάμων επί 24ώρου βάσεως (2 άτομα ανά 2ωρη βάρδια - 8 άτομα σύνολο).',
      hasSpecialWeekendSwaps: true,
      active: true
    },
    {
      id: 'duty-skopia',
      name: 'Σκοπιά Κεντρική Πύλη',
      shortName: 'Σκοπιά',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'],
      armsRequired: 'Ένοπλος',
      slots: 8,
      type: 'Βάρδιες',
      timePresetType: 'ROLLING_CYCLE',
      shiftHours: '2ωρες κυλιόμενες: 14:00-16:00, 22:00-00:00, 06:00-08:00 (4 θέσεις × 2 άτομα = 8 σύνολο)',
      slotDefinitions: [
        {
          slotIndex: 1,
          groupIndex: 1,
          groupName: '1η Θέση',
          label: '1η Θέση - Σκοπός 1 (14:00-16:00, 22:00-00:00, 06:00-08:00)',
          intervals: [
            { from: '14:00', to: '16:00' },
            { from: '22:00', to: '00:00' },
            { from: '06:00', to: '08:00' }
          ]
        },
        {
          slotIndex: 2,
          groupIndex: 1,
          groupName: '1η Θέση',
          label: '1η Θέση - Σκοπός 2 (14:00-16:00, 22:00-00:00, 06:00-08:00)',
          intervals: [
            { from: '14:00', to: '16:00' },
            { from: '22:00', to: '00:00' },
            { from: '06:00', to: '08:00' }
          ]
        },
        {
          slotIndex: 3,
          groupIndex: 2,
          groupName: '2η Θέση',
          label: '2η Θέση - Σκοπός 1 (16:00-18:00, 00:00-02:00, 08:00-10:00)',
          intervals: [
            { from: '16:00', to: '18:00' },
            { from: '00:00', to: '02:00' },
            { from: '08:00', to: '10:00' }
          ]
        },
        {
          slotIndex: 4,
          groupIndex: 2,
          groupName: '2η Θέση',
          label: '2η Θέση - Σκοπός 2 (16:00-18:00, 00:00-02:00, 08:00-10:00)',
          intervals: [
            { from: '16:00', to: '18:00' },
            { from: '00:00', to: '02:00' },
            { from: '08:00', to: '10:00' }
          ]
        },
        {
          slotIndex: 5,
          groupIndex: 3,
          groupName: '3η Θέση',
          label: '3η Θέση - Σκοπός 1 (18:00-20:00, 02:00-04:00, 10:00-12:00)',
          intervals: [
            { from: '18:00', to: '20:00' },
            { from: '02:00', to: '04:00' },
            { from: '10:00', to: '12:00' }
          ]
        },
        {
          slotIndex: 6,
          groupIndex: 3,
          groupName: '3η Θέση',
          label: '3η Θέση - Σκοπός 2 (18:00-20:00, 02:00-04:00, 10:00-12:00)',
          intervals: [
            { from: '18:00', to: '20:00' },
            { from: '02:00', to: '04:00' },
            { from: '10:00', to: '12:00' }
          ]
        },
        {
          slotIndex: 7,
          groupIndex: 4,
          groupName: '4η Θέση',
          label: '4η Θέση - Σκοπός 1 (20:00-22:00, 04:00-06:00, 12:00-14:00)',
          intervals: [
            { from: '20:00', to: '22:00' },
            { from: '04:00', to: '06:00' },
            { from: '12:00', to: '14:00' }
          ]
        },
        {
          slotIndex: 8,
          groupIndex: 4,
          groupName: '4η Θέση',
          label: '4η Θέση - Σκοπός 2 (20:00-22:00, 04:00-06:00, 12:00-14:00)',
          intervals: [
            { from: '20:00', to: '22:00' },
            { from: '04:00', to: '06:00' },
            { from: '12:00', to: '14:00' }
          ]
        }
      ],
      weight: 2,
      description: 'Ένοπλη φύλαξη κεντρικής πύλης επί 24ώρου βάσεως (2 άτομα ανά 2ωρη βάρδια - 8 άτομα σύνολο).',
      hasSpecialWeekendSwaps: true,
      active: true
    },
    {
      id: 'duty-dekaneis',
      name: 'Δεκανείς Αλλαγής',
      shortName: 'Δεκανείς',
      category: 'Στρατιώτης',
      allowedRanks: ['ΔΚΑΣ', 'ΥΠΔΚΑΣ', 'ΣΤΡ'],
      armsRequired: 'Ένοπλος',
      slots: 2,
      type: 'Βάρδιες',
      timePresetType: 'CUSTOM',
      shiftHours: '14:00-00:00 & 00:00-14:00 (2 άτομα)',
      slotDefinitions: [
        {
          slotIndex: 1,
          groupIndex: 1,
          groupName: '1η Βάρδια',
          label: '14:00 - 00:00',
          intervals: [
            { from: '14:00', to: '00:00' }
          ]
        },
        {
          slotIndex: 2,
          groupIndex: 2,
          groupName: '2η Βάρδια',
          label: '00:00 - 14:00',
          intervals: [
            { from: '00:00', to: '14:00' }
          ]
        }
      ],
      weight: 2,
      description: 'Δεκανείς αλλαγής σκοπών (14:00-00:00 και 00:00-14:00).',
      hasSpecialWeekendSwaps: false,
      active: true
    },
    {
      id: 'duty-yparchifylakas',
      name: 'Υπαρχιφύλακας',
      shortName: 'Υπαρχ/κας',
      category: 'Στρατιώτης',
      allowedRanks: ['ΔΚΑΣ', 'ΥΠΔΚΑΣ', 'ΣΤΡ'],
      armsRequired: 'Ένοπλος',
      slots: 1,
      type: 'Βάρδιες',
      timePresetType: 'CUSTOM',
      shiftHours: '14:00 - 06:00',
      slotDefinitions: [
        {
          slotIndex: 1,
          groupIndex: 1,
          groupName: 'Υπαρχιφύλακας',
          label: '14:00 - 06:00',
          intervals: [
            { from: '14:00', to: '06:00' }
          ]
        }
      ],
      weight: 2,
      description: 'Υπαρχιφύλακας στρατοπέδου / κεντρικής πύλης (14:00-06:00).',
      hasSpecialWeekendSwaps: false,
      active: true
    },
    {
      id: 'duty-am',
      name: 'ΑΜ',
      shortName: 'ΑΜ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'],
      armsRequired: 'Οποιοσδήποτε',
      slots: 3,
      type: 'Βάρδιες',
      timePresetType: 'CUSTOM',
      shiftHours: '14:00-22:00 (1 άτομο) & 06:00-14:00 (2 άτομα)',
      slotDefinitions: [
        {
          slotIndex: 1,
          groupIndex: 1,
          label: '14:00 - 22:00',
          intervals: [
            { from: '14:00', to: '22:00' }
          ]
        },
        {
          slotIndex: 2,
          groupIndex: 2,
          label: '06:00 - 14:00 (Άτομο 1)',
          intervals: [
            { from: '06:00', to: '14:00' }
          ]
        },
        {
          slotIndex: 3,
          groupIndex: 2,
          label: '06:00 - 14:00 (Άτομο 2)',
          intervals: [
            { from: '06:00', to: '14:00' }
          ]
        }
      ],
      weight: 1.5,
      description: 'Υπηρεσία ΑΜ (14:00-22:00 και 06:00-14:00).',
      hasSpecialWeekendSwaps: false,
      active: true
    },
    {
      id: 'duty-estiatoria',
      name: 'Εστιατόρια',
      shortName: 'Εστ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ'],
      armsRequired: 'Άοπλος',
      slots: 10,
      type: 'Βάρδιες',
      timePresetType: 'RESTAURANT_CYCLE',
      shiftHours: '16:00-22:00 & 05:20-16:00 επομ. (10 άτομα)',
      slotDefinitions: Array.from({ length: 10 }, (_, i) => ({
        slotIndex: i + 1,
        groupIndex: 1,
        groupName: '',
        label: `16:00-22:00 & 05:20-16:00 (επομ.) - Άτομο ${i + 1}`,
        intervals: [
          { from: '16:00', to: '22:00' },
          { from: '05:20', to: '16:00' }
        ]
      })),
      weight: 1.5,
      description: 'Προετοιμασία εστιατορίων, διανομή συσσιτίου και καθαριότητα (16:00-22:00 και 05:20-16:00 επομένης - 10 άτομα).',
      hasSpecialWeekendSwaps: true,
      active: true
    },
    {
      id: 'duty-artoklivanos',
      name: 'Αρτοκλίβανος',
      shortName: 'Αρτ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ'],
      armsRequired: 'Οποιοσδήποτε',
      slots: 4,
      type: 'Βάρδιες',
      timePresetType: 'CUSTOM',
      shiftHours: '06:50 - 14:00 επομ. (4 άτομα)',
      slotDefinitions: Array.from({ length: 4 }, (_, i) => ({
        slotIndex: i + 1,
        label: `Αρτοκλίβανος 06:50-14:00 (Άτομο ${i + 1})`,
        intervals: [
          { from: '06:50', to: '14:00' }
        ]
      })),
      weight: 1.5,
      description: 'Παραγωγή, ψήσιμο άρτου μονάδας και προετοιμασία: 06:50 έως 14:00 επομένης (4 άτομα).',
      hasSpecialWeekendSwaps: true,
      active: true
    },
    {
      id: 'duty-epifylaki',
      name: 'Επιφυλακή',
      shortName: 'Επιφ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'],
      armsRequired: 'Οποιοσδήποτε',
      slots: 5,
      type: 'Ημερήσια',
      timePresetType: 'STANDBY',
      shiftHours: 'Χωρίς ωράριο (Επιφυλακή - 5 άτομα)',
      slotDefinitions: Array.from({ length: 5 }, (_, i) => ({
        slotIndex: i + 1,
        groupIndex: i + 1,
        groupName: `Επιφυλακή ${i + 1}`,
        label: `Επιφυλακή ${i + 1}`,
        intervals: []
      })),
      weight: 1,
      description: 'Επιφυλακή εντός μονάδας για αντικατάσταση σε περίπτωση ανάγκης ή κωλύματος (5 άτομα).',
      hasSpecialWeekendSwaps: false,
      active: true
    },
    {
      id: 'duty-xenokratis',
      name: 'Ξενοκράτης',
      shortName: 'Ξενοκρ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'],
      armsRequired: 'Οποιοσδήποτε',
      slots: 5,
      type: 'Ημερήσια',
      timePresetType: 'STANDBY',
      shiftHours: 'Χωρίς ωράριο (Ξενοκράτης - 5 άτομα)',
      slotDefinitions: Array.from({ length: 5 }, (_, i) => ({
        slotIndex: i + 1,
        groupIndex: i + 1,
        groupName: `Ξενοκράτης ${i + 1}`,
        label: `Ξενοκράτης ${i + 1}`,
        intervals: []
      })),
      weight: 1,
      description: 'Ομάδα αντιμετώπισης εκτάκτων αναγκών / φυσικών καταστροφών Σχεδίου Ξενοκράτης (5 άτομα).',
      hasSpecialWeekendSwaps: false,
      active: true
    },
    {
      id: 'duty-kathariotites',
      name: 'Καθαριότητες',
      shortName: 'Καθ',
      category: 'Στρατιώτης',
      allowedRanks: ['ΣΤΡ', 'ΥΠΔΚΑΣ', 'ΔΚΑΣ'],
      armsRequired: 'Άοπλος',
      slots: 8,
      type: 'Βάρδιες',
      timePresetType: 'CUSTOM',
      shiftHours: '14:00-15:00, 20:00-21:00, 06:30-07:30 επομ. (8 άτομα)',
      slotDefinitions: [
        {
          slotIndex: 1,
          label: 'Τουαλέτες (Άτομο 1)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        },
        {
          slotIndex: 2,
          label: 'Τουαλέτες (Άτομο 2)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        },
        {
          slotIndex: 3,
          label: 'Λουτρά / Νιπτήρες (Άτομο 1)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        },
        {
          slotIndex: 4,
          label: 'Λουτρά / Νιπτήρες (Άτομο 2)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        },
        {
          slotIndex: 5,
          label: 'Σκάλες / Προθάλαμος / Θάλαμοι / Διάδρομος (Άτομο 1)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        },
        {
          slotIndex: 6,
          label: 'Σκάλες / Προθάλαμος / Θάλαμοι / Διάδρομος (Άτομο 2)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        },
        {
          slotIndex: 7,
          label: 'Προαύλιος Χώρος / Εξωτερικές Σκάλες (Άτομο 1)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        },
        {
          slotIndex: 8,
          label: 'Προαύλιος Χώρος / Εξωτερικές Σκάλες (Άτομο 2)',
          intervals: [
            { from: '14:00', to: '15:00' },
            { from: '20:00', to: '21:00' },
            { from: '06:30', to: '07:30' }
          ]
        }
      ],
      weight: 1,
      description: 'Γενική καθαριότητα χώρων (Τουαλέτες, Λουτρά/Νιπτήρες, Σκάλες/Προθάλαμος/Θάλαμοι/Διάδρομος, Προαύλιος Χώρος/Εξωτερικές Σκάλες) - 8 άτομα σύνολο.',
      hasSpecialWeekendSwaps: true,
      active: true
    }
  ],
  leaves: [
    {
      id: 'leave-1',
      personId: 'p-8',
      personName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΣΤΑΥΡΟΣ',
      type: 'Άδεια',
      startDate: '2026-09-26',
      endDate: '2026-10-02',
      reason: 'Διαταγή 43/2026',
      status: 'Ενεργή'
    },
    {
      id: 'leave-2',
      personId: 'p-12',
      personName: 'ΑΘΑΝΑΣΙΑΔΗΣ ΗΛΙΑΣ',
      type: 'Ελεύθερος Υπηρεσίας (ΕΥ)',
      startDate: '2026-09-25',
      endDate: '2026-09-28',
      reason: 'Γνωμάτευση 401 ΓΣΝΑ',
      status: 'Ενεργή'
    }
  ],
  soldierRecords: [],
  schedules: [],
  scheduleTemplates: [
    {
      id: 'tpl-kenthivas-standard',
      name: 'Πρότυπο Υπηρεσιών ΚΕΝ ΘΗΒΑΣ (ΚΕΠΒ)',
      description: 'Επίσημο πλήρες πρόγραμμα: Οπλοφύλακας, Θαλαμοφύλακας, Σκοπιά Κεντρική Πύλη, Δεκανείς, Υπαρχιφύλακας, ΑΜ, Εστιατόρια, Αρτοκλίβανος, Επιφυλακή, Ξενοκράτης, Καθαριότητες',
      dutyTypeIds: [
        'duty-oplofylakas',
        'duty-thalamofylakas',
        'duty-skopia',
        'duty-dekaneis',
        'duty-yparchifylakas',
        'duty-am',
        'duty-estiatoria',
        'duty-artoklivanos',
        'duty-epifylaki',
        'duty-xenokratis',
        'duty-kathariotites'
      ],
      isDefaultWeekday: true,
      isDefaultWeekend: true
    },
    {
      id: 'tpl-weekday-standard',
      name: 'Καθημερινό Πλήρες Πρόγραμμα',
      description: 'Πλήρης σύνθεση σκοπιών, θαλάμων, οπλοφυλακίου, καθαριοτήτων & εστιατορίων για καθημερινές ημέρες',
      dutyTypeIds: [
        'duty-oplofylakas',
        'duty-thalamofylakas',
        'duty-skopia',
        'duty-dekaneis',
        'duty-yparchifylakas',
        'duty-estiatoria',
        'duty-artoklivanos',
        'duty-kathariotites'
      ],
      isDefaultWeekday: false,
      isDefaultWeekend: false
    },
    {
      id: 'tpl-weekend-standard',
      name: 'Πρόγραμμα Σαββατοκύριακου & Αργιών',
      description: 'Σύνθεση υπηρεσιών για Σαββατοκύριακα με ειδικές εναλλαγές και κάλυψη θέσεων εξόδου',
      dutyTypeIds: [
        'duty-oplofylakas',
        'duty-thalamofylakas',
        'duty-skopia',
        'duty-dekaneis',
        'duty-yparchifylakas',
        'duty-estiatoria',
        'duty-artoklivanos'
      ],
      isDefaultWeekday: false,
      isDefaultWeekend: false
    },
    {
      id: 'tpl-reduced-security',
      name: 'Μειωμένη Δύναμη (Βασική Ασφάλεια)',
      description: 'Ελάχιστη επάνδρωση ασφαλείας μονάδας (οπλοφύλακας, θαλαμοφύλακας, σκοπιά & εστιατόρια)',
      dutyTypeIds: [
        'duty-oplofylakas',
        'duty-thalamofylakas',
        'duty-skopia',
        'duty-estiatoria'
      ],
      isDefaultWeekday: false,
      isDefaultWeekend: false
    },
    {
      id: 'tpl-alert-readiness',
      name: 'Αυξημένη Ετοιμότητα / Επιφυλακή',
      description: 'Σύνθεση αυξημένης επιφυλακής με πλήρη επάνδρωση και ενισχυμένο προσωπικό ασφαλείας',
      dutyTypeIds: [
        'duty-oplofylakas',
        'duty-thalamofylakas',
        'duty-skopia',
        'duty-dekaneis',
        'duty-yparchifylakas',
        'duty-am',
        'duty-estiatoria',
        'duty-artoklivanos',
        'duty-epifylaki',
        'duty-xenokratis',
        'duty-kathariotites'
      ],
      isDefaultWeekday: false,
      isDefaultWeekend: false
    }
  ],
  dailyExodouchoiPlans: {}
};

export const DEFAULT_SCHEDULE_TEMPLATES: ScheduleTemplate[] = DEFAULT_APP_DATA.scheduleTemplates || [];

export const DEFAULT_DUTY_TYPES: DutyType[] = DEFAULT_APP_DATA.dutyTypes || [];

export const GREEK_RANKS = [
  { full: 'ΣΤΡΑΤΙΩΤΗΣ', short: 'ΣΤΡ', category: 'Κληρωτός' },
  { full: 'ΥΠΟΔΕΚΑΝΕΑΣ', short: 'ΥΠΔΚΑΣ', category: 'Κληρωτός' },
  { full: 'ΔΕΚΑΝΕΑΣ', short: 'ΔΚΑΣ', category: 'Κληρωτός' },
  { full: 'ΛΟΧΙΑΣ', short: 'ΛΧΙΑΣ', category: 'Κληρωτός' },
  { full: 'ΕΠΙΛΟΧΙΑΣ', short: 'ΕΠΛΧΙΑΣ', category: 'Υπαξιωματικός' },
  { full: 'ΑΡΧΙΛΟΧΙΑΣ', short: 'ΑΡΧΛΧΙΑΣ', category: 'Υπαξιωματικός' },
  { full: 'ΑΝΘΥΠΑΣΠΙΣΤΗΣ', short: 'ΑΝΘΣΤΗΣ', category: 'Υπαξιωματικός' },
  { full: 'ΔΟΚΙΜΟΣ ΕΦΕΔΡΟΣ ΑΞΙΩΜΑΤΙΚΟΣ', short: 'ΔΕΑ', category: 'Αξιωματικός' },
  { full: 'ΑΝΘΥΠΟΛΟΧΑΓΟΣ', short: 'ΑΝΘΛΓΟΣ', category: 'Αξιωματικός' },
  { full: 'ΥΠΟΛΟΧΑΓΟΣ', short: 'ΥΠΛΓΟΣ', category: 'Αξιωματικός' },
  { full: 'ΛΟΧΑΓΟΣ', short: 'ΛΓΟΣ', category: 'Αξιωματικός' },
  { full: 'ΤΑΓΜΑΤΑΡΧΗΣ', short: 'ΤΧΗΣ', category: 'Αξιωματικός' },
  { full: 'ΑΝΤΙΣΥΝΤΑΓΜΑΤΑΡΧΗΣ', short: 'ΑΝΧΗΣ', category: 'Αξιωματικός' },
  { full: 'ΣΥΝΤΑΓΜΑΤΑΡΧΗΣ', short: 'ΣΧΗΣ', category: 'Αξιωματικός' },
  { full: 'ΤΑΞΙΑΡΧΟΣ', short: 'ΤΑΞΧΟΣ', category: 'Αξιωματικός' },
  { full: 'ΥΠΟΣΤΡΑΤΗΓΟΣ', short: 'ΥΠΓΟΣ', category: 'Αξιωματικός' },
  { full: 'ΑΝΤΙΣΤΡΑΤΗΓΟΣ', short: 'ΑΝΤΓΟΣ', category: 'Αξιωματικός' },
  { full: 'ΣΤΡΑΤΗΓΟΣ', short: 'ΣΤΓΟΣ', category: 'Αξιωματικός' }
];

export function normalizeRank(rankShortOrFull: string): { rank: string; rankShort: string; category: string } {
  if (!rankShortOrFull) {
    return { rank: 'ΣΤΡΑΤΙΩΤΗΣ', rankShort: 'ΣΤΡ', category: 'Κληρωτός' };
  }
  const raw = rankShortOrFull.trim();
  const upper = raw.toUpperCase();
  const stripped = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Exact match by full or short
  const exact = GREEK_RANKS.find(r => 
    r.short === upper || 
    r.full === upper || 
    r.short.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === stripped ||
    r.full.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === stripped
  );
  if (exact) {
    return { rank: exact.full, rankShort: exact.short, category: exact.category };
  }

  // Legacy mappings
  const legacyMap: Record<string, string> = {
    'ΣΤΡ': 'ΣΤΡ',
    'ΥΠΔΝΕΑΣ': 'ΥΠΔΚΑΣ',
    'ΔΝΕΑΣ': 'ΔΚΑΣ',
    'ΛΧΙΑΣ': 'ΛΧΙΑΣ',
    'ΕΠΧΙΑΣ': 'ΕΠΛΧΙΑΣ',
    'ΕΠΛΧΙΑΣ': 'ΕΠΛΧΙΑΣ',
    'ΑΡΧΙΑΣ': 'ΑΡΧΛΧΙΑΣ',
    'ΑΡΧΛΧΙΑΣ': 'ΑΡΧΛΧΙΑΣ',
    'ΑΝΘΣΤΗΣ': 'ΑΝΘΣΤΗΣ',
    'ΔΕΑ': 'ΔΕΑ',
    'ΑΝΘΛΓΟΣ': 'ΑΝΘΛΓΟΣ',
    'ΥΠΛΓΟΣ': 'ΥΠΛΓΟΣ',
    'ΛΓΟΣ': 'ΛΓΟΣ',
    'ΤΧΗΣ': 'ΤΧΗΣ',
    'ΑΝΧΗΣ': 'ΑΝΧΗΣ',
    'ΣΧΗΣ': 'ΣΧΗΣ',
    'ΤΑΞΧΟΣ': 'ΤΑΞΧΟΣ',
    'ΥΠΓΟΣ': 'ΥΠΓΟΣ',
    'ΑΝΤΓΟΣ': 'ΑΝΤΓΟΣ',
    'ΣΤΓΟΣ': 'ΣΤΓΟΣ'
  };

  const targetShort = legacyMap[stripped] || legacyMap[upper];
  if (targetShort) {
    const match = GREEK_RANKS.find(r => r.short === targetShort);
    if (match) return { rank: match.full, rankShort: match.short, category: match.category };
  }

  return { rank: 'ΣΤΡΑΤΙΩΤΗΣ', rankShort: 'ΣΤΡ', category: 'Κληρωτός' };
}

export const GREEK_CORPS = [
  'ΠΖ',
  'ΤΘ',
  'ΠΒ',
  'ΜΧ',
  'ΔΒ',
  'ΑΣ',
  'ΤΧ',
  'ΕΜ',
  'ΥΠ',
  'ΥΓ'
];

export const SPECIALTIES = GREEK_CORPS;

export const COMPANIES = [
  '1ος Λόχος',
  '2ος Λόχος',
  '3ος Λόχος',
  'Λόχος Υποστηρίξεως (ΛΥΠ)',
  'Λόχος Διοικήσεως (ΛΔ)',
  '1ο Επιτελικό Γραφείο',
  '2ο/3ο Επιτελικό Γραφείο',
  '4ο Επιτελικό Γραφείο'
];
