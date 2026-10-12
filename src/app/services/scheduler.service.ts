import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { 
  Personnel, 
  DutyType, 
  DailySchedule, 
  DutyAssignment, 
  ShiftSlotAssignment, 
  ShiftConflict, 
  Leave,
  WeekendPlan,
  WeekendPreference,
  DailyExodouchoiPlan,
  DailyExodouchoiSoldier,
  getLeaveTypeMeta,
  formatGreekDate,
  normalizeGreek
} from '../models/shift.model';
import { formatIntervalsToString, getDutySlotsForDate, getDayHandoverNote, isSlotConflictingWithDayOff } from '../data/time-presets';

@Injectable({
  providedIn: 'root'
})
export class SchedulerService {
  private storage = inject(StorageService);

  // Check if a date string is weekend (Saturday or Sunday)
  isWeekend(dateStr: string): boolean {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  }

  isFriday(dateStr: string): boolean {
    const d = new Date(dateStr);
    return d.getDay() === 5;
  }

  isSaturday(dateStr: string): boolean {
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getDay() === 6;
  }

  isSunday(dateStr: string): boolean {
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getDay() === 0;
  }

  addDays(dateStr: string, days: number): string {
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getWeekendDates(dateStr: string): { friday: string; saturday: string; sunday: string } {
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay();
    let friOffset = 0;
    if (day === 5) friOffset = 0;
    else if (day === 6) friOffset = -1;
    else if (day === 0) friOffset = -2;
    else {
      friOffset = 5 - day;
    }
    const friday = this.addDays(dateStr, friOffset);
    const saturday = this.addDays(friday, 1);
    const sunday = this.addDays(friday, 2);
    return { friday, saturday, sunday };
  }

  // Get previous date string (YYYY-MM-DD)
  getPreviousDate(dateStr: string): string {
    return this.addDays(dateStr, -1);
  }

  // Check if a person is on leave on a given date
  getPersonLeave(personId: string, dateStr: string): Leave | undefined {
    const leaves = this.storage.leaves();
    return leaves.find(l => 
      l.personId === personId && 
      l.startDate <= dateStr && 
      dateStr <= l.endDate &&
      l.status !== 'Ακυρωμένη'
    );
  }

  // Check if person was on duty the previous day
  servedYesterday(personId: string, dateStr: string): boolean {
    const prevDate = this.getPreviousDate(dateStr);
    const prevSchedule = this.storage.getScheduleForDate(prevDate);
    if (!prevSchedule) return false;

    return prevSchedule.duties.some(d => 
      d.slots.some(s => s.personId === personId)
    );
  }

  // Get next date string (YYYY-MM-DD)
  getNextDate(dateStr: string): string {
    return this.addDays(dateStr, 1);
  }

  // Check if person is on duty the next day
  servedTomorrow(personId: string, dateStr: string): boolean {
    const nextDate = this.getNextDate(dateStr);
    const nextSchedule = this.storage.getScheduleForDate(nextDate);
    if (!nextSchedule) return false;

    return nextSchedule.duties.some(d => 
      d.slots.some(s => s.personId === personId)
    );
  }

  // Calculate days since last duty
  getDaysSinceLastDuty(person: Personnel, targetDateStr: string): number {
    if (!person.lastDutyDate) return 999;
    const target = new Date(targetDateStr).getTime();
    const last = new Date(person.lastDutyDate).getTime();
    const diffDays = Math.floor((target - last) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  }

  // Check eligibility of person for duty
  isEligibleForDuty(person: Personnel, duty: DutyType, targetDateStr: string): { eligible: boolean; reason?: string } {
    if (!person.active) {
      return { eligible: false, reason: 'Μη ενεργό προσωπικό' };
    }

    if (person.status === 'Ελεύθερος Υπηρεσίας' || person.exemptFromAllDuties) {
      return { eligible: false, reason: 'Δεν εκτελεί υπηρεσίες (Πλήρης απαλλαγή)' };
    }

    // Duty eligibility check - only restrict if explicitly limited
    // If eligibleDutyIds is set and does NOT include this duty AND the person
    // doesn't have ALL duties (meaning they are explicitly restricted), filter out.
    if (person.eligibleDutyIds && person.eligibleDutyIds.length > 0) {
      const activeDutyIds = this.storage.activeDutyTypes().map(d => d.id);
      const hasAllDuties = activeDutyIds.every(id => person.eligibleDutyIds!.includes(id));
      // Only filter if the person is explicitly restricted (doesn't have all duties)
      if (!hasAllDuties && !person.eligibleDutyIds.includes(duty.id)) {
        return { eligible: false, reason: `Μη επιλέξιμος για την υπηρεσία "${duty.name}"` };
      }
    }

    // Leave check
    const leave = this.getPersonLeave(person.id, targetDateStr);
    if (leave) {
      const meta = getLeaveTypeMeta(leave.type);
      if (meta.isInformative) {
        // Informative exemptions (Εαρβ, Εξυρ) -> Soldier remains eligible for duty!
      } else if (leave.type === 'Ελεύθερος Ορθοστασίας (ΕΟ)') {
        if (duty.armsRequired === 'Ένοπλος' || duty.name.toLowerCase().includes('σκοπός') || duty.name.toLowerCase().includes('πύλη') || duty.name.toLowerCase().includes('περίπολος')) {
          return { eligible: false, reason: `Ελεύθερος Ορθοστασίας (ΕΟ): Απαγορεύεται καθήκον ορθοστασίας/σκοπού` };
        }
      } else if (leave.type === 'Ελεύθερος Ασκήσεων (ΕΑ)') {
        if (duty.name.toLowerCase().includes('άσκηση') || duty.name.toLowerCase().includes('ασκήσεις')) {
          return { eligible: false, reason: `Ελεύθερος Ασκήσεων (ΕΑ)` };
        }
      } else {
        const catLabel = meta.category === 'ΑΠΩΝ' 
          ? 'Απών εκτός μονάδας' 
          : (meta.category === 'ΚΩΛΥΟΜΕΝΟΣ' ? 'Κωλυόμενος (ΣΤΕΠ)' : 'Ελεύθερος Υπηρεσίας');
        return { eligible: false, reason: `${leave.type} [${catLabel}] (${formatGreekDate(leave.startDate)} έως ${formatGreekDate(leave.endDate)})` };
      }
    }

    // Arms check
    if (duty.armsRequired === 'Ένοπλος' && person.status !== 'Ένοπλος') {
      return { eligible: false, reason: `Απαιτείται Ένοπλος (Κατάσταση: ${person.status})` };
    }

    // Category / Rank check
    if (duty.allowedRanks && duty.allowedRanks.length > 0) {
      const pRankShort = (person.rankShort || '').toUpperCase();
      const hasRank = duty.allowedRanks.some(r => r.toUpperCase() === pRankShort);
      if (!hasRank) {
        return { eligible: false, reason: `Μη συμβατός βαθμός (${person.rankShort})` };
      }
    } else if (duty.category && duty.category !== 'Οποιοσδήποτε' && duty.category !== 'Οπλίτης' && duty.category !== 'Στρατιώτης' && person.category !== duty.category) {
      // Skip category check when duty category is 'Στρατιώτης' (generic catch-all for soldiers)
      return { eligible: false, reason: `Απαιτείται κατηγορία ${duty.category}` };
    }

    // Specialty check
    if (duty.requiredSpecialty) {
      const spec = duty.requiredSpecialty.toLowerCase();
      const personSpec = (person.specialty || '').toLowerCase();
      if (!personSpec.includes(spec)) {
        return { eligible: false, reason: `Απαιτείται ειδικότητα ${duty.requiredSpecialty}` };
      }
    }

    // Weekend Plan Day-Off check (person cannot be assigned on their day off if slots conflict)
    const dates = this.getWeekendDates(targetDateStr);
    const plan = this.storage.getWeekendPlan(dates.friday);
    const day = new Date(targetDateStr).getDay();
    if (plan) {
      const isSatOff = plan.saturdayOffIds?.includes(person.id) ?? false;
      const isSunOff = plan.sundayOffIds?.includes(person.id) ?? false;
      if (day === 6 && isSatOff) {
        const slots = getDutySlotsForDate(duty, targetDateStr);
        if (slots.length > 0 && slots.every(s => isSlotConflictingWithDayOff(s, 6, true, false))) {
          return { eligible: false, reason: 'Εξοδούχος Σαββάτου (έξοδος 12:00)' };
        }
      }
      if (day === 0 && isSunOff) {
        const slots = getDutySlotsForDate(duty, targetDateStr);
        if (slots.length > 0 && slots.every(s => isSlotConflictingWithDayOff(s, 0, false, true))) {
          return { eligible: false, reason: 'Εξοδούχος Κυριακής (έξοδος 10:00)' };
        }
      }
    }

    return { eligible: true };
  }

  // Validate a specific slot assignment for conflicts
  validateSlotAssignment(
    personId: string | null, 
    duty: DutyType, 
    targetDateStr: string, 
    currentDuties: DutyAssignment[], 
    currentDutyIndex: number, 
    currentSlotIndex: number
  ): ShiftConflict | null {
    if (!personId) return null;

    const person = this.storage.personnel().find(p => p.id === personId);
    if (!person) return null;

    // Exemption / Duty eligibility conflict
    if (person.exemptFromAllDuties) {
      return {
        type: 'LEAVE',
        severity: 'ERROR',
        message: `Ο ${person.rankShort} ${person.fullName} έχει απαλλαγή από όλες τις υπηρεσίες.`,
        personId,
        personName: person.fullName
      };
    }

    if (person.eligibleDutyIds && person.eligibleDutyIds.length > 0) {
      const activeDutyIds = this.storage.activeDutyTypes().map(d => d.id);
      const hasAllDuties = activeDutyIds.every(id => person.eligibleDutyIds!.includes(id));
      if (!hasAllDuties && !person.eligibleDutyIds.includes(duty.id)) {
        return {
          type: 'SPECIALTY_MISMATCH',
          severity: 'ERROR',
          message: `Ο ${person.rankShort} ${person.fullName} δεν είναι επιλέξιμος για την υπηρεσία "${duty.name}".`,
          personId,
          personName: person.fullName
        };
      }
    }

    // 1. Leave conflict (Critical)
    const leave = this.getPersonLeave(personId, targetDateStr);
    if (leave) {
      const meta = getLeaveTypeMeta(leave.type);
      if (meta.isInformative) {
        // Informative only (Εαρβ, Εξυρ), no error
      } else if (leave.type === 'Ελεύθερος Ορθοστασίας (ΕΟ)') {
        if (duty.armsRequired === 'Ένοπλος' || duty.name.toLowerCase().includes('σκοπός') || duty.name.toLowerCase().includes('πύλη') || duty.name.toLowerCase().includes('περίπολος')) {
          return {
            type: 'LEAVE',
            severity: 'ERROR',
            message: `Ο ${person.rankShort} ${person.fullName} είναι Ελεύθερος Ορθοστασίας (ΕΟ) (${formatGreekDate(leave.startDate)} έως ${formatGreekDate(leave.endDate)})!`,
            personId,
            personName: person.fullName
          };
        }
      } else {
        const catLabel = meta.category === 'ΑΠΩΝ' 
          ? 'Απών (εκτός μονάδας)' 
          : (meta.category === 'ΚΩΛΥΟΜΕΝΟΣ' ? 'Κωλυόμενος (ΣΤΕΠ)' : 'Ελεύθερος Υπηρεσίας');
        return {
          type: 'LEAVE',
          severity: 'ERROR',
          message: `Ο ${person.rankShort} ${person.fullName} είναι ${leave.type} [${catLabel}] (${formatGreekDate(leave.startDate)} έως ${formatGreekDate(leave.endDate)})!`,
          personId,
          personName: person.fullName
        };
      }
    }

    // 2. Double assignment on the same day (Critical)
    for (let dIdx = 0; dIdx < currentDuties.length; dIdx++) {
      const d = currentDuties[dIdx];
      for (let sIdx = 0; sIdx < d.slots.length; sIdx++) {
        if (dIdx === currentDutyIndex && sIdx === currentSlotIndex) continue;
        if (d.slots[sIdx].personId === personId) {
          return {
            type: 'DOUBLE_ASSIGNMENT',
            severity: 'ERROR',
            message: `Διπλή υπηρεσία! Έχει ήδη ανατεθεί στο πόστο "${d.dutyName}".`,
            personId,
            personName: person.fullName
          };
        }
      }
    }

    // 3. Arms requirement
    if (duty.armsRequired === 'Ένοπλος' && person.status !== 'Ένοπλος') {
      return {
        type: 'ARMS_MISMATCH',
        severity: 'ERROR',
        message: `Το πόστο απαιτεί ένοπλο στρατιώτη (Κατάσταση: ${person.status}).`,
        personId,
        personName: person.fullName
      };
    }

    // 4. Specialty requirement
    if (duty.requiredSpecialty && !(person.specialty || '').toLowerCase().includes(duty.requiredSpecialty.toLowerCase())) {
      return {
        type: 'SPECIALTY_MISMATCH',
        severity: 'WARNING',
        message: `Προειδοποίηση: Το πόστο απαιτεί ειδικότητα ${duty.requiredSpecialty} (Έχει: ${person.specialty || 'Καμία'}).`,
        personId,
        personName: person.fullName
      };
    }

    // 5. Day-off compatibility for cover slots
    // Friday Cover (Saturday 12-14): Person MUST NOT be off on Saturday (must be Εξοδούχος Κυριακής)
    // Saturday Covers (Sunday 10-12 & 12-14): Person MUST NOT be off on Sunday (must be Εξοδούχος Σαββάτου)
    const currentSlot = currentDuties[currentDutyIndex]?.slots[currentSlotIndex];
    if (currentSlot) {
      const dates = this.getWeekendDates(targetDateStr);
      const plan = this.storage.getWeekendPlan(dates.friday);
      const day = new Date(targetDateStr).getDay();

      const isSlot12to14 = (s: ShiftSlotAssignment) => 
        Boolean((s.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && s.intervals.length === 1) ||
        (s.hoursNote?.includes('12:00-14:00') && !s.hoursNote?.includes('20:00')));

      const isSlot10to12 = (s: ShiftSlotAssignment) => 
        Boolean((s.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && s.intervals.length === 1) ||
        (s.hoursNote?.includes('10:00-12:00') && !s.hoursNote?.includes('18:00')));

      if (plan) {
        if (day === 5 && isSlot12to14(currentSlot)) {
          if (plan.saturdayOffIds.includes(personId)) {
            return {
              type: 'LEAVE',
              severity: 'ERROR',
              message: `Προσοχή: Ο ${person.rankShort} ${person.fullName} είναι εξοδούχος Σαββάτου και δεν μπορεί να τοποθετηθεί στην κάλυψη (Απαιτείται: Εξοδούχος Κυριακής).`,
              personId,
              personName: person.fullName
            };
          }
        }

        if (day === 6 && (isSlot10to12(currentSlot) || isSlot12to14(currentSlot))) {
          if (plan.sundayOffIds.includes(personId)) {
            return {
              type: 'LEAVE',
              severity: 'ERROR',
              message: `Προσοχή: Ο ${person.rankShort} ${person.fullName} είναι εξοδούχος Κυριακής και δεν μπορεί να τοποθετηθεί στην κάλυψη (Απαιτείται: Εξοδούχος Σαββάτου).`,
              personId,
              personName: person.fullName
            };
          }
        }

        const isSatOff = plan.saturdayOffIds?.includes(personId) ?? false;
        const isSunOff = plan.sundayOffIds?.includes(personId) ?? false;

        if (day === 6 && isSatOff && isSlotConflictingWithDayOff(currentSlot, 6, true, false)) {
          return {
            type: 'LEAVE',
            severity: 'ERROR',
            message: `Κώλυμα: Ο ${person.rankShort} ${person.fullName} είναι εξοδούχος Σαββάτου (έξοδος 12:00) και δεν μπορεί να εκτελέσει υπηρεσία μετά τις 12:00.`,
            personId,
            personName: person.fullName
          };
        }

        if (day === 0 && isSunOff && isSlotConflictingWithDayOff(currentSlot, 0, false, true)) {
          return {
            type: 'LEAVE',
            severity: 'ERROR',
            message: `Κώλυμα: Ο ${person.rankShort} ${person.fullName} είναι εξοδούχος Κυριακής (έξοδος 10:00) και δεν μπορεί να εκτελέσει υπηρεσία μετά τις 10:00.`,
            personId,
            personName: person.fullName
          };
        }
      }
    }

    // 6. Rest violation / Weekend cover trick note
    if (currentSlot) {
      const trickCheck = this.isWeekendTrickAssignment(personId, duty, targetDateStr, currentSlot);
      if (trickCheck.isTrick) {
        return null;
      }
    }

    if (this.servedYesterday(personId, targetDateStr)) {
      return {
        type: 'REST_VIOLATION',
        severity: 'WARNING',
        message: `Προσοχή: Ο ${person.rankShort} ${person.fullName} εκτέλεσε υπηρεσία και την προηγούμενη ημέρα.`,
        personId,
        personName: person.fullName
      };
    }

    if (this.servedTomorrow(personId, targetDateStr)) {
      return {
        type: 'REST_VIOLATION',
        severity: 'WARNING',
        message: `Προσοχή: Ο ${person.rankShort} ${person.fullName} εκτελεί υπηρεσία και την επόμενη ημέρα.`,
        personId,
        personName: person.fullName
      };
    }

    return null;
  }

  isWeekendTrickAssignment(
    personId: string, 
    duty: DutyType | DutyAssignment, 
    targetDateStr: string, 
    slot: ShiftSlotAssignment
  ): { isTrick: boolean; note?: string } {
    const dutyTypeId = 'dutyTypeId' in duty ? duty.dutyTypeId : duty.id;
    const dutyDef = 'dutyTypeId' in duty ? this.storage.dutyTypes().find(dt => dt.id === dutyTypeId) : duty;
    const dutyName = dutyDef?.name || ('dutyName' in duty ? duty.dutyName : duty.name);
    const preset = dutyDef?.timePresetType;

    const isRolling = preset === 'ROLLING_CYCLE' || 
                      preset === 'GREEK_ARMY_2_6' || 
                      dutyName.includes('Θαλαμοφύλακας') || 
                      dutyName.includes('Οπλοφύλακας');

    const isRestaurant = preset === 'RESTAURANT_CYCLE' || dutyName.includes('Εστιατόρι');
    if (isRestaurant) {
      const day = new Date(targetDateStr).getDay();
      if (day === 1 && slot.intervals?.some(i => i.from === '05:20' && i.to === '16:00') && slot.intervals?.length === 1) {
        return { isTrick: true, note: 'Πρότυπο Εστιατορίων: Ολοκλήρωση υπηρεσίας Παρασκευής.' };
      }
      if (day === 5 && slot.intervals?.some(i => i.from === '16:00' && i.to === '22:00')) {
        return { isTrick: true, note: 'Πρότυπο Εστιατορίων: 1ο μέρος (Συνέχεια Δευτέρα 05:20-16:00).' };
      }
    }

    if (!isRolling) return { isTrick: false };

    const day = new Date(targetDateStr).getDay();
    const dates = this.getWeekendDates(targetDateStr);

    const isSlot12to14 = (s: ShiftSlotAssignment) => 
      Boolean((s.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && s.intervals.length === 1) ||
      (s.hoursNote?.includes('12:00-14:00') && !s.hoursNote?.includes('20:00')));

    const isSlot10to12 = (s: ShiftSlotAssignment) => 
      Boolean((s.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && s.intervals.length === 1) ||
      (s.hoursNote?.includes('10:00-12:00') && !s.hoursNote?.includes('18:00')));

    const isSlotSatPos4Incomplete = (s: ShiftSlotAssignment) => 
      Boolean((s.intervals?.some(i => i.from === '20:00') && s.intervals?.some(i => i.from === '04:00') && s.intervals.length === 2) ||
      (s.hoursNote?.includes('20:00-22:00') && s.hoursNote?.includes('04:00-06:00') && !s.hoursNote?.includes('12:00')));

    const isSlotSunPos3 = (s: ShiftSlotAssignment) => 
      Boolean((s.intervals?.some(i => i.from === '18:00') && s.intervals?.some(i => i.from === '02:00')) ||
      (s.hoursNote?.includes('18:00-20:00') && s.hoursNote?.includes('02:00-04:00')));

    const isSlotSunPos4 = (s: ShiftSlotAssignment) => 
      Boolean((s.intervals?.some(i => i.from === '20:00') && s.intervals?.some(i => i.from === '04:00') && s.intervals.length === 3) ||
      (s.hoursNote?.includes('20:00-22:00') && s.hoursNote?.includes('04:00-06:00') && s.hoursNote?.includes('12:00')));

    // Case 1: Friday Cover 12:00-14:00
    if (day === 5 && isSlot12to14(slot)) {
      return { 
        isTrick: true, 
        note: 'Ειδική εναλλαγή Σ/Κ: Κάλυψη 4ης Θέσης (Εξοδούχος Κ) & 4η Θέση Σαββάτου.' 
      };
    }

    // Case 2: Saturday Position 4 Incomplete
    if (day === 6 && isSlotSatPos4Incomplete(slot)) {
      return { 
        isTrick: true, 
        note: 'Ειδική εναλλαγή Σ/Κ: Κάλυψη 4ης Θέσης (Εξοδούχος Κ) & 4η Θέση Σαββάτου.' 
      };
    }

    // Case 3: Saturday 10:00-12:00 Cover
    if (day === 6 && isSlot10to12(slot)) {
      return { 
        isTrick: true, 
        note: 'Ειδική εναλλαγή Σ/Κ: Κάλυψη 3ης Θέσης (Εξοδούχος Σ) & 3η Θέση Κυριακής.' 
      };
    }

    // Case 4: Saturday 12:00-14:00 Cover
    if (day === 6 && isSlot12to14(slot)) {
      return { 
        isTrick: true, 
        note: 'Ειδική εναλλαγή Σ/Κ: Κάλυψη 4ης Θέσης (Εξοδούχος Σ) & 4η Θέση Κυριακής.' 
      };
    }

    // Case 5: Sunday Position 3
    if (day === 0 && isSlotSunPos3(slot)) {
      return { 
        isTrick: true, 
        note: 'Ειδική εναλλαγή Σ/Κ: Κάλυψη 3ης Θέσης (Εξοδούχος Σ) & 3η Θέση Κυριακής.' 
      };
    }

    // Case 6: Sunday Position 4
    if (day === 0 && isSlotSunPos4(slot)) {
      return { 
        isTrick: true, 
        note: 'Ειδική εναλλαγή Σ/Κ: Κάλυψη 4ης Θέσης (Εξοδούχος Σ) & 4η Θέση Κυριακής.' 
      };
    }

    return { isTrick: false };
  }

  /**
   * Background check for all times, day offs, leaves, and double assignments.
   * Ensures that no soldier is placed in a slot where they are out or ineligible.
   * If an invalid assignment is found, attempts to find an eligible replacement,
   * or clears the slot if none exists. Recalculates exact warnings/errors.
   */
  backgroundCheckSchedule(sched: DailySchedule, targetDateStr: string, plan?: WeekendPlan): void {
    const day = new Date(targetDateStr).getDay();
    const dates = this.getWeekendDates(targetDateStr);
    const wkndPlan = plan || this.storage.getWeekendPlan(dates.friday);
    const allPersonnel = this.storage.activePersonnel();
    const isWknd = this.isWeekend(targetDateStr);

    const isSlot12to14 = (slot: ShiftSlotAssignment) => 
      Boolean((slot.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('12:00-14:00') && !slot.hoursNote?.includes('20:00')));
    const isSlot10to12 = (slot: ShiftSlotAssignment) => 
      Boolean((slot.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('10:00-12:00') && !slot.hoursNote?.includes('18:00')));

    const seenIds = new Set<string>();

    for (let dIdx = 0; dIdx < sched.duties.length; dIdx++) {
      const d = sched.duties[dIdx];
      const dutyDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);

      for (let sIdx = 0; sIdx < d.slots.length; sIdx++) {
        const slot = d.slots[sIdx];

        let isInvalid = false;
        let invalidReason = '';

        if (!slot.personId) {
          isInvalid = true;
          invalidReason = 'Κενή θέση';
        } else {
          // 1. Exists and active
          const person = allPersonnel.find(p => p.id === slot.personId);
          if (!person || !person.active || person.exemptFromAllDuties) {
            isInvalid = true;
            invalidReason = 'Ανενεργός ή απαλλαγή από υπηρεσίες';
          }

          // 2. Double assignment
          if (!isInvalid && seenIds.has(slot.personId)) {
            isInvalid = true;
            invalidReason = 'Διπλή ανάθεση την ίδια ημέρα';
          }

          // 3. Leave / ΕΥ / Hospital
          if (!isInvalid) {
            const leave = this.getPersonLeave(slot.personId, targetDateStr);
            if (leave) {
              const meta = getLeaveTypeMeta(leave.type);
              if (meta.blocksDuty) {
                isInvalid = true;
                invalidReason = `${leave.type}`;
              } else if (leave.type === 'Ελεύθερος Ορθοστασίας (ΕΟ)') {
                if (dutyDef?.armsRequired === 'Ένοπλος' || dutyDef?.name?.toLowerCase().includes('σκοπός') || dutyDef?.name?.toLowerCase().includes('πύλη') || dutyDef?.name?.toLowerCase().includes('περίπολος')) {
                  isInvalid = true;
                  invalidReason = 'Ελεύθερος Ορθοστασίας σε ένοπλη';
                }
              }
            }
          }

          // 4. Day-off departure conflict (Saturday 12:00, Sunday 10:00)
          if (!isInvalid && wkndPlan) {
            const isSatOff = wkndPlan.saturdayOffIds?.includes(slot.personId) ?? false;
            const isSunOff = wkndPlan.sundayOffIds?.includes(slot.personId) ?? false;

            if (isSlotConflictingWithDayOff(slot, day, isSatOff, isSunOff)) {
              isInvalid = true;
              invalidReason = day === 6 
                ? 'Κώλυμα: Εξοδούχος Σαββάτου (έξοδος 12:00)' 
                : 'Κώλυμα: Εξοδούχος Κυριακής (έξοδος 10:00)';
            }

            // Cover specific constraints
            if (!isInvalid && day === 5 && isSlot12to14(slot) && isSatOff) {
              isInvalid = true;
              invalidReason = 'Εξοδούχος Σαββάτου στην κάλυψη Παρασκευής';
            }
            if (!isInvalid && day === 6 && isSlot10to12(slot) && isSunOff) {
              isInvalid = true;
              invalidReason = 'Εξοδούχος Κυριακής στην κάλυψη Σαββάτου 10-12';
            }
            if (!isInvalid && day === 6 && isSlot12to14(slot) && isSunOff) {
              isInvalid = true;
              invalidReason = 'Εξοδούχος Κυριακής στην κάλυψη Σαββάτου 12-14';
            }
          }

          // 5. Duty requirements (Arms & Specialty)
          if (!isInvalid && dutyDef && person) {
            const elig = this.isEligibleForDuty(person, dutyDef, targetDateStr);
            if (!elig.eligible) {
              isInvalid = true;
              invalidReason = elig.reason || 'Μη επιλέξιμος για την υπηρεσία';
            }
          }
        }

        if (isInvalid) {
          const isAssignedElsewhereInSched = (personId: string): boolean => {
            return sched.duties.some((otherDuty, odIdx) => 
              otherDuty.slots.some((otherSlot, osIdx) => 
                otherSlot.personId === personId && !(odIdx === dIdx && osIdx === sIdx)
              )
            );
          };
          const candidates = allPersonnel.filter(p => {
            if (seenIds.has(p.id) || isAssignedElsewhereInSched(p.id)) return false;
            if (p.exemptFromAllDuties || !p.active) return false;
            if (dutyDef) {
              const elig = this.isEligibleForDuty(p, dutyDef, targetDateStr);
              if (!elig.eligible) return false;
            }
            const pLeave = this.getPersonLeave(p.id, targetDateStr);
            if (pLeave) {
              const meta = getLeaveTypeMeta(pLeave.type);
              if (meta.blocksDuty) return false;
              if (pLeave.type === 'Ελεύθερος Ορθοστασίας (ΕΟ)' && (dutyDef?.armsRequired === 'Ένοπλος' || dutyDef?.name?.toLowerCase().includes('σκοπός') || dutyDef?.name?.toLowerCase().includes('πύλη') || dutyDef?.name?.toLowerCase().includes('περίπολος'))) {
                return false;
              }
            }
            if (wkndPlan) {
              const pSatOff = wkndPlan.saturdayOffIds?.includes(p.id) ?? false;
              const pSunOff = wkndPlan.sundayOffIds?.includes(p.id) ?? false;
              if (isSlotConflictingWithDayOff(slot, day, pSatOff, pSunOff)) return false;
              if (day === 5 && isSlot12to14(slot) && pSatOff) return false;
              if (day === 6 && isSlot10to12(slot) && pSunOff) return false;
              if (day === 6 && isSlot12to14(slot) && pSunOff) return false;
            }
            return true;
          });

          if (candidates.length > 0) {
            const chosen = this.pickBestCandidate(candidates, targetDateStr, slot.groupTag, isWknd, wkndPlan, day);
            slot.personId = chosen.candidate.id;
            slot.personName = chosen.candidate.fullName;
            slot.rankShort = chosen.candidate.rankShort;
            slot.company = chosen.candidate.company;
            slot.rotationalGroup = chosen.candidate.rotationalGroup;
            slot.manualOverride = false;
            seenIds.add(chosen.candidate.id);
          } else {
            // No replacement possible: leave blank with error
            slot.personId = null;
            slot.personName = '';
            slot.rankShort = '';
            slot.company = '';
            slot.rotationalGroup = undefined;
            slot.manualOverride = false;
            slot.conflictWarning = 'Δεν βρέθηκε διαθέσιμος στρατιώτης με τα απαιτούμενα κριτήρια.';
            slot.conflictSeverity = 'ERROR';
          }
        } else {
          if (slot.personId) {
            seenIds.add(slot.personId);
          }
        }
      }
    }

    // Pass 2: Recalculate exact conflict warnings for all slots
    for (let dIdx = 0; dIdx < sched.duties.length; dIdx++) {
      const d = sched.duties[dIdx];
      const dutyDef = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
      if (!dutyDef) continue;

      for (let sIdx = 0; sIdx < d.slots.length; sIdx++) {
        const slot = d.slots[sIdx];
        if (!slot.personId) {
          if (!slot.conflictWarning) {
            slot.conflictWarning = 'Δεν βρέθηκε διαθέσιμος στρατιώτης με τα απαιτούμενα κριτήρια.';
            slot.conflictSeverity = 'ERROR';
          }
          continue;
        }

        const conflict = this.validateSlotAssignment(slot.personId, dutyDef, targetDateStr, sched.duties, dIdx, sIdx);
        if (conflict) {
          slot.conflictWarning = conflict.message;
          slot.conflictSeverity = conflict.severity;
        } else {
          const trick = this.isWeekendTrickAssignment(slot.personId, dutyDef, targetDateStr, slot);
          if (trick.isTrick) {
            slot.conflictWarning = undefined;
            slot.conflictSeverity = undefined;
          } else if (this.servedYesterday(slot.personId, targetDateStr)) {
            const p = allPersonnel.find(person => person.id === slot.personId);
            slot.conflictWarning = `Προσοχή: Ο ${p?.rankShort || ''} ${p?.fullName || ''} εκτέλεσε υπηρεσία και την προηγούμενη ημέρα.`;
            slot.conflictSeverity = 'WARNING';
          } else {
            slot.conflictWarning = undefined;
            slot.conflictSeverity = undefined;
          }
        }
      }
    }
  }

  // Enforce absolute invariant: No soldier can ever be assigned to more than 1 slot on the same day
  enforceNoDoubleAssignments(sched: DailySchedule): void {
    const seenIds = new Set<string>();
    for (const d of sched.duties) {
      for (const slot of d.slots) {
        if (!slot.personId) continue;
        if (seenIds.has(slot.personId)) {
          // Double assignment detected! Blank out duplicate slot with error
          slot.personId = null;
          slot.personName = '';
          slot.rankShort = '';
          slot.company = '';
          slot.rotationalGroup = undefined;
          slot.manualOverride = false;
          slot.conflictWarning = 'Δεν βρέθηκε διαθέσιμος στρατιώτης με τα απαιτούμενα κριτήρια.';
          slot.conflictSeverity = 'ERROR';
        } else {
          seenIds.add(slot.personId);
        }
      }
    }
  }

  // Helper to build an empty duties skeleton for a given date
  buildDutiesSkeletonForDate(dateStr: string): DutyAssignment[] {
    const activeDuties = this.storage.activeDutyTypes();
    const prevDate = this.getPreviousDate(dateStr);
    const prevSchedule = this.storage.getScheduleForDate(prevDate);

    let dutiesToInclude: DutyType[] = [];

    // 1. Every next day by default has the duties set on the previous date
    if (prevSchedule && prevSchedule.duties && prevSchedule.duties.length > 0) {
      const prevDutyIds = prevSchedule.duties.map(d => d.dutyTypeId);
      for (const id of prevDutyIds) {
        const found = activeDuties.find(ad => ad.id === id);
        if (found) dutiesToInclude.push(found);
      }
    }

    // 2. If no previous day schedule exists, use the default template for this date
    if (dutiesToInclude.length === 0) {
      const defaultTemplate = this.storage.getDefaultTemplateForDate(dateStr);
      if (defaultTemplate && defaultTemplate.dutyTypeIds.length > 0) {
        for (const id of defaultTemplate.dutyTypeIds) {
          const found = activeDuties.find(ad => ad.id === id);
          if (found) dutiesToInclude.push(found);
        }
      }
    }

    // 3. Fallback to standard baseline duties (KEN THIVAS standard duties)
    if (dutiesToInclude.length === 0) {
      const fallbackIds = [
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
      ];
      for (const id of fallbackIds) {
        const found = activeDuties.find(ad => ad.id === id);
        if (found) dutiesToInclude.push(found);
      }
    }

    if (dutiesToInclude.length === 0) {
      dutiesToInclude = [...activeDuties];
    }

    const getDutyWeight = (d: { weight?: number | null }) => (d.weight !== undefined && d.weight !== null ? d.weight : 1);
    const sortedDuties = [...dutiesToInclude];
    const dutiesAssignments: DutyAssignment[] = [];

    for (const duty of sortedDuties) {
      const slotDefs = getDutySlotsForDate(duty, dateStr);
      const slotsCount = slotDefs.length > 0 ? slotDefs.length : (duty.slots || 1);
      const slots: ShiftSlotAssignment[] = [];

      for (let sIdx = 0; sIdx < slotsCount; sIdx++) {
        const slotDef = slotDefs[sIdx];
        const slotHourNote = this.resolveSlotHoursNote(duty, slotDef, sIdx);
        slots.push({
          slotIndex: sIdx + 1,
          groupIndex: slotDef?.groupIndex,
          personId: null,
          personName: '',
          rankShort: '',
          company: '',
          groupTag: slotDef?.groupTag,
          hoursNote: slotHourNote,
          intervals: slotDef?.intervals ? [...slotDef.intervals] : undefined
        });
      }

      dutiesAssignments.push({
        dutyTypeId: duty.id,
        dutyName: duty.name,
        shortName: duty.shortName,
        category: duty.category,
        weight: getDutyWeight(duty),
        slots
      });
    }

    return dutiesAssignments;
  }

  // Shift Generation Algorithm
  generateDailySchedule(
    targetDateStr: string,
    existingDuties?: DutyAssignment[],
    weekendPlan?: WeekendPlan
  ): DailySchedule {
    const isWknd = this.isWeekend(targetDateStr);
    const day = new Date(targetDateStr).getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    const activeDuties = this.storage.activeDutyTypes();
    const allPersonnel = this.storage.activePersonnel();
    const plan = weekendPlan || this.storage.getWeekendPlan(targetDateStr);

    const assignedPersonIds = new Set<string>();
    const dutiesAssignments: DutyAssignment[] = [];

    // If existingDuties is not passed or empty, build duties skeleton based on previous day or templates
    if (!existingDuties || existingDuties.length === 0) {
      existingDuties = this.buildDutiesSkeletonForDate(targetDateStr);
    }

    // Pre-populate assignedPersonIds with any slots that already have a manual override assignment
    if (existingDuties && existingDuties.length > 0) {
      for (const d of existingDuties) {
        for (const slot of d.slots) {
          if (slot.personId && slot.manualOverride) {
            assignedPersonIds.add(slot.personId);
          }
        }
      }
    }

    // If existing duties are specified for this day, preserve them and fill their empty slots
    if (existingDuties && existingDuties.length > 0) {
      for (const d of existingDuties) {
        const dutyType = this.storage.dutyTypes().find(dt => dt.id === d.dutyTypeId);
        const slots: ShiftSlotAssignment[] = [];

        for (let sIdx = 0; sIdx < d.slots.length; sIdx++) {
          const origSlot = d.slots[sIdx];

          // If manually overridden, retain it
          if (origSlot.personId && origSlot.manualOverride) {
            slots.push({ ...origSlot });
            continue;
          }

          const isSlotCover12 = (origSlot.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && origSlot.intervals.length === 1) ||
                                (origSlot.hoursNote?.includes('12:00-14:00') && !origSlot.hoursNote?.includes('20:00'));
          const isSlotCover10 = (origSlot.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && origSlot.intervals.length === 1) ||
                                (origSlot.hoursNote?.includes('10:00-12:00') && !origSlot.hoursNote?.includes('18:00'));

          const isRestaurantDuty = dutyType?.timePresetType === 'RESTAURANT_CYCLE' || d.dutyTypeId === 'duty-estiatoria';
          const isMonMorningEst = (day === 1) && isRestaurantDuty &&
            origSlot.intervals?.some(i => i.from === '05:20' && i.to === '16:00') &&
            origSlot.intervals?.length === 1;

          let linkedFridayPerson: Personnel | null = null;
          if (isMonMorningEst) {
            const friDateStr = this.addDays(targetDateStr, -3);
            const friSched = this.storage.getScheduleForDate(friDateStr);
            const friDuty = friSched?.duties.find(f => f.dutyTypeId === d.dutyTypeId);
            const friPersonId = friDuty?.slots[sIdx]?.personId;
            if (friPersonId) {
              const p = allPersonnel.find(person => person.id === friPersonId);
              if (p && !assignedPersonIds.has(p.id)) {
                const leave = this.getPersonLeave(p.id, targetDateStr);
                if (!leave || !getLeaveTypeMeta(leave.type).blocksDuty) {
                  linkedFridayPerson = p;
                }
              }
            }
          }

          let candidates = allPersonnel.filter(p => {
            if (assignedPersonIds.has(p.id)) return false;
            if (dutyType) {
              const elig = this.isEligibleForDuty(p, dutyType, targetDateStr);
              if (!elig.eligible) return false;
            }
            const hasExplicitPlan = Boolean(plan && ((plan.saturdayOffIds?.length || 0) > 0 || (plan.sundayOffIds?.length || 0) > 0));
            if (hasExplicitPlan) {
              const isSatOff = plan!.saturdayOffIds?.includes(p.id) ?? false;
              const isSunOff = plan!.sundayOffIds?.includes(p.id) ?? false;
              if (isSlotConflictingWithDayOff(origSlot, day, isSatOff, isSunOff)) return false;
            }
            return true;
          });

          // Enforce weekend cover day-off constraints
          const hasExplicitPlan = Boolean(plan && ((plan.saturdayOffIds?.length || 0) > 0 || (plan.sundayOffIds?.length || 0) > 0));
          if (hasExplicitPlan) {
            if (day === 5 && isSlotCover12) {
              candidates = candidates.filter(p => !plan!.saturdayOffIds.includes(p.id));
            } else if (day === 6 && isSlotCover10) {
              candidates = candidates.filter(p => !plan!.sundayOffIds.includes(p.id));
            } else if (day === 6 && isSlotCover12) {
              candidates = candidates.filter(p => !plan!.sundayOffIds.includes(p.id));
            }
          }

          if (!linkedFridayPerson && candidates.length === 0) {
            slots.push({
              ...origSlot,
              personId: null,
              personName: '',
              rankShort: '',
              company: '',
              conflictWarning: 'Δεν βρέθηκε διαθέσιμος στρατιώτης με τα απαιτούμενα κριτήρια.',
              conflictSeverity: 'ERROR'
            });
            continue;
          }

          const chosen = linkedFridayPerson 
            ? { candidate: linkedFridayPerson, didServeYesterday: false }
            : this.pickBestCandidate(candidates, targetDateStr, origSlot.groupTag, isWknd, plan, day);
          assignedPersonIds.add(chosen.candidate.id);

          let conflictWarn: string | undefined;
          let conflictSev: 'WARNING' | 'ERROR' | 'INFO' | undefined = undefined;
          const trick = this.isWeekendTrickAssignment(chosen.candidate.id, d, targetDateStr, origSlot);
          if (trick.isTrick) {
            conflictWarn = undefined;
            conflictSev = undefined;
          } else if (chosen.didServeYesterday) {
            conflictWarn = `Προσοχή: Ο ${chosen.candidate.rankShort} ${chosen.candidate.fullName} εκτέλεσε υπηρεσία και την προηγούμενη ημέρα.`;
            conflictSev = 'WARNING';
          }

          slots.push({
            ...origSlot,
            personId: chosen.candidate.id,
            personName: chosen.candidate.fullName,
            rankShort: chosen.candidate.rankShort,
            company: chosen.candidate.company,
            rotationalGroup: chosen.candidate.rotationalGroup,
            manualOverride: false,
            conflictWarning: conflictWarn,
            conflictSeverity: conflictSev
          });
        }

        const dutyWeight = d.weight !== undefined && d.weight !== null ? d.weight : (activeDuties.find(ad => ad.id === d.dutyTypeId)?.weight ?? 1);
        dutiesAssignments.push({
          ...d,
          weight: dutyWeight,
          slots
        });
      }
    } else {
      // Create from active duties
      const getWeight = (dt: { weight?: number | null }) => (dt.weight !== undefined && dt.weight !== null ? dt.weight : 1);
      const sortedDuties = [...activeDuties].sort((a, b) => getWeight(b) - getWeight(a));

      for (const duty of sortedDuties) {
        const slotDefs = getDutySlotsForDate(duty, targetDateStr);
        const slotsCount = slotDefs.length > 0 ? slotDefs.length : (duty.slots || 1);
        const slots: ShiftSlotAssignment[] = [];

        for (let sIdx = 0; sIdx < slotsCount; sIdx++) {
          const slotDef = slotDefs[sIdx];
          const slotHourNote = this.resolveSlotHoursNote(duty, slotDef, sIdx);

          const isSlotCover12 = (slotDef?.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && slotDef.intervals.length === 1) ||
                                (slotHourNote?.includes('12:00-14:00') && !slotHourNote?.includes('20:00'));
          const isSlotCover10 = (slotDef?.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && slotDef.intervals.length === 1) ||
                                (slotHourNote?.includes('10:00-12:00') && !slotHourNote?.includes('18:00'));

          const isRestaurantDuty = duty.timePresetType === 'RESTAURANT_CYCLE' || duty.id === 'duty-estiatoria';
          const isMonMorningEst = (day === 1) && isRestaurantDuty &&
            slotDef?.intervals?.some(i => i.from === '05:20' && i.to === '16:00') &&
            slotDef?.intervals?.length === 1;

          let linkedFridayPerson: Personnel | null = null;
          if (isMonMorningEst) {
            const friDateStr = this.addDays(targetDateStr, -3);
            const friSched = this.storage.getScheduleForDate(friDateStr);
            const friDuty = friSched?.duties.find(f => f.dutyTypeId === duty.id);
            const friPersonId = friDuty?.slots[sIdx]?.personId;
            if (friPersonId) {
              const p = allPersonnel.find(person => person.id === friPersonId);
              if (p && !assignedPersonIds.has(p.id)) {
                const leave = this.getPersonLeave(p.id, targetDateStr);
                if (!leave || !getLeaveTypeMeta(leave.type).blocksDuty) {
                  linkedFridayPerson = p;
                }
              }
            }
          }

          let candidates = allPersonnel.filter(p => {
            if (assignedPersonIds.has(p.id)) return false;
            const elig = this.isEligibleForDuty(p, duty, targetDateStr);
            if (!elig.eligible) return false;
            const hasExplicitPlan = Boolean(plan && ((plan.saturdayOffIds?.length || 0) > 0 || (plan.sundayOffIds?.length || 0) > 0));
            if (hasExplicitPlan) {
              const isSatOff = plan!.saturdayOffIds?.includes(p.id) ?? false;
              const isSunOff = plan!.sundayOffIds?.includes(p.id) ?? false;
              if (isSlotConflictingWithDayOff(slotDef, day, isSatOff, isSunOff)) return false;
            }
            return true;
          });

          // Enforce weekend cover day-off constraints:
          const hasExplicitPlan = Boolean(plan && ((plan.saturdayOffIds?.length || 0) > 0 || (plan.sundayOffIds?.length || 0) > 0));
          if (hasExplicitPlan) {
            if (day === 5 && isSlotCover12) {
              candidates = candidates.filter(p => !plan!.saturdayOffIds.includes(p.id));
            } else if (day === 6 && isSlotCover10) {
              candidates = candidates.filter(p => !plan!.sundayOffIds.includes(p.id));
            } else if (day === 6 && isSlotCover12) {
              candidates = candidates.filter(p => !plan!.sundayOffIds.includes(p.id));
            }
          }

          if (!linkedFridayPerson && candidates.length === 0) {
            slots.push({
              slotIndex: sIdx + 1,
              groupIndex: slotDef?.groupIndex,
              personId: null,
              personName: '',
              rankShort: '',
              company: '',
              groupTag: slotDef?.groupTag,
              hoursNote: slotHourNote,
              intervals: slotDef?.intervals ? [...slotDef.intervals] : undefined,
              conflictWarning: 'Δεν βρέθηκε διαθέσιμος στρατιώτης με τα απαιτούμενα κριτήρια.',
              conflictSeverity: 'ERROR'
            });
            continue;
          }

          const chosen = linkedFridayPerson
            ? { candidate: linkedFridayPerson, didServeYesterday: false }
            : this.pickBestCandidate(candidates, targetDateStr, slotDef?.groupTag, isWknd, plan, day);
          assignedPersonIds.add(chosen.candidate.id);

          let conflictWarn: string | undefined;
          let conflictSev: 'WARNING' | 'ERROR' | 'INFO' | undefined = undefined;
          const trick = this.isWeekendTrickAssignment(chosen.candidate.id, duty, targetDateStr, {
            slotIndex: sIdx + 1,
            groupIndex: slotDef?.groupIndex,
            personId: chosen.candidate.id,
            personName: chosen.candidate.fullName,
            hoursNote: slotHourNote,
            intervals: slotDef?.intervals
          });
          if (trick.isTrick) {
            conflictWarn = undefined;
            conflictSev = undefined;
          } else if (chosen.didServeYesterday) {
            conflictWarn = `Προσοχή: Ο ${chosen.candidate.rankShort} ${chosen.candidate.fullName} εκτέλεσε υπηρεσία και την προηγούμενη ημέρα.`;
            conflictSev = 'WARNING';
          }

          slots.push({
            slotIndex: sIdx + 1,
            groupIndex: slotDef?.groupIndex,
            personId: chosen.candidate.id,
            personName: chosen.candidate.fullName,
            rankShort: chosen.candidate.rankShort,
            company: chosen.candidate.company,
            rotationalGroup: chosen.candidate.rotationalGroup,
            groupTag: slotDef?.groupTag,
            hoursNote: slotHourNote,
            intervals: slotDef?.intervals ? [...slotDef.intervals] : undefined,
            conflictWarning: conflictWarn,
            conflictSeverity: conflictSev
          });
        }

        const dutyWeight = duty.weight !== undefined && duty.weight !== null ? duty.weight : 1;
        dutiesAssignments.push({
          dutyTypeId: duty.id,
          dutyName: duty.name,
          shortName: duty.shortName,
          category: duty.category,
          weight: dutyWeight,
          slots
        });
      }
    }

    const schedule: DailySchedule = {
      date: targetDateStr,
      isHolidayOrWeekend: isWknd,
      dayNote: getDayHandoverNote(targetDateStr),
      duties: dutiesAssignments,
      savedAt: new Date().toISOString(),
      weekendPlan: plan
    };

    this.backgroundCheckSchedule(schedule, targetDateStr, plan);
    return schedule;
  }

  // Generates Friday, Saturday, and Sunday in one coordinated batch and derives the weekend day-offs based on the duties set
  generateWeekendSchedules(
    fridayDateStr: string,
    weekendPlan?: WeekendPlan,
    customFridayDuties?: DutyAssignment[]
  ): { friday: DailySchedule; saturday: DailySchedule; sunday: DailySchedule } {
    const dates = this.getWeekendDates(fridayDateStr);
    const allPersonnel = this.storage.personnel();
    let currentPlan = weekendPlan || this.storage.getWeekendPlan(dates.friday);

    const isSlot12to14 = (slot: ShiftSlotAssignment) => 
      Boolean((slot.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('12:00-14:00') && !slot.hoursNote?.includes('20:00')));
    const isSlot10to12 = (slot: ShiftSlotAssignment) => 
      Boolean((slot.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('10:00-12:00') && !slot.hoursNote?.includes('18:00')));
    const isSlotSatPos4Incomplete = (slot: ShiftSlotAssignment) => 
      Boolean((slot.intervals?.some(i => i.from === '20:00') && slot.intervals?.some(i => i.from === '04:00') && slot.intervals.length === 2) ||
      (slot.hoursNote?.includes('20:00-22:00') && slot.hoursNote?.includes('04:00-06:00') && !slot.hoursNote?.includes('12:00')));
    const isSlotSunPos3 = (slot: ShiftSlotAssignment) => 
      Boolean(slot.intervals?.some(i => i.from === '18:00') && slot.intervals?.some(i => i.from === '02:00'));
    const isSlotSunPos4 = (slot: ShiftSlotAssignment) => 
      Boolean(slot.intervals?.some(i => i.from === '20:00') && slot.intervals?.some(i => i.from === '04:00') && slot.intervals.length === 3);

    // Save initial plan if provided
    if (currentPlan) {
      this.storage.saveWeekendPlan(currentPlan);
    }

    // 1. Generate Friday (honoring custom Friday duties if any)
    const friday = this.generateDailySchedule(dates.friday, customFridayDuties, currentPlan);
    if (currentPlan) friday.weekendPlan = currentPlan;
    this.enforceNoDoubleAssignments(friday);

    // 2. Prepare Saturday skeleton
    const satDutiesSkeleton = this.buildDutiesSkeletonForDate(dates.saturday);

    // Generate Saturday (now knows who served Friday)
    const saturday = this.generateDailySchedule(dates.saturday, satDutiesSkeleton, currentPlan);
    if (currentPlan) saturday.weekendPlan = currentPlan;
    this.enforceNoDoubleAssignments(saturday);

    // 3. Prepare Sunday skeleton with Saturday's cover soldiers pre-reserved in Sunday Pos 3 & Pos 4
    const sunDutiesSkeleton = this.buildDutiesSkeletonForDate(dates.sunday);
    saturday.duties.forEach(sDuty => {
      const dutyDef = this.storage.dutyTypes().find(d => d.id === sDuty.dutyTypeId);
      if (!dutyDef) return;
      const isRolling = dutyDef.timePresetType === 'ROLLING_CYCLE' || 
                        dutyDef.timePresetType === 'GREEK_ARMY_2_6' || 
                        dutyDef.name.includes('Θαλαμοφύλακας') || 
                        dutyDef.name.includes('Οπλοφύλακας');
      if (!isRolling) return;

      const sunDuty = sunDutiesSkeleton.find(d => d.dutyTypeId === sDuty.dutyTypeId);
      if (!sunDuty) return;

      // Sat Cover 10:00-12:00 -> Sun Pos 3
      const satCover10Slots = sDuty.slots.filter(isSlot10to12);
      const sunPos3Slots = sunDuty.slots.filter(isSlotSunPos3);
      for (let i = 0; i < satCover10Slots.length; i++) {
        if (satCover10Slots[i].personId && sunPos3Slots[i]) {
          const p = allPersonnel.find(person => person.id === satCover10Slots[i].personId);
          if (p) {
            sunPos3Slots[i].personId = p.id;
            sunPos3Slots[i].personName = p.fullName;
            sunPos3Slots[i].rankShort = p.rankShort;
            sunPos3Slots[i].company = p.company;
            sunPos3Slots[i].rotationalGroup = p.rotationalGroup;
            sunPos3Slots[i].manualOverride = true;
          }
        }
      }

      // Sat Cover 12:00-14:00 -> Sun Pos 4
      const satCover12Slots = sDuty.slots.filter(isSlot12to14);
      const sunPos4Slots = sunDuty.slots.filter(isSlotSunPos4);
      for (let i = 0; i < satCover12Slots.length; i++) {
        if (satCover12Slots[i].personId && sunPos4Slots[i]) {
          const p = allPersonnel.find(person => person.id === satCover12Slots[i].personId);
          if (p) {
            sunPos4Slots[i].personId = p.id;
            sunPos4Slots[i].personName = p.fullName;
            sunPos4Slots[i].rankShort = p.rankShort;
            sunPos4Slots[i].company = p.company;
            sunPos4Slots[i].rotationalGroup = p.rotationalGroup;
            sunPos4Slots[i].manualOverride = true;
          }
        }
      }
    });

    // Generate Sunday (now knows who served Saturday, and has Pos 3/4 soldiers pre-reserved)
    const sunday = this.generateDailySchedule(dates.sunday, sunDutiesSkeleton, currentPlan);
    if (currentPlan) sunday.weekendPlan = currentPlan;
    // Clear temporary manualOverride flag
    sunday.duties.forEach(d => d.slots.forEach(s => { if (isSlotSunPos3(s) || isSlotSunPos4(s)) s.manualOverride = false; }));
    this.backgroundCheckSchedule(sunday, dates.sunday, currentPlan);

    // Synchronize weekend cover slots across Friday, Saturday, and Sunday for rolling cycle duties
    this.syncWeekendLinkedCoverSlots(friday, saturday, sunday);

    // Synchronize Friday restaurant soldiers with Monday morning (05:20 - 16:00)
    this.syncFridayRestaurantToMonday(friday, dates.friday, allPersonnel);

    // Automatically derive and produce the εξοδούχους based on the duties set!
    const derivedPlan = this.deriveWeekendPlanFromSchedules(friday, saturday, sunday);
    friday.weekendPlan = derivedPlan;
    saturday.weekendPlan = derivedPlan;
    sunday.weekendPlan = derivedPlan;

    // Final background check pass: strictly enforce all times, day-offs, leaves, and double assignments on Friday, Saturday, Sunday
    this.backgroundCheckSchedule(friday, dates.friday, derivedPlan);
    this.backgroundCheckSchedule(saturday, dates.saturday, derivedPlan);
    this.backgroundCheckSchedule(sunday, dates.sunday, derivedPlan);

    this.storage.saveSchedule(friday);
    this.storage.saveSchedule(saturday);
    this.storage.saveSchedule(sunday);

    // Automatically synchronize the Daily Exodouchoi plans for Friday, Saturday, and Sunday
    this.generateDailyExodouchoiPlan(dates.friday);
    this.generateDailyExodouchoiPlan(dates.saturday);
    this.generateDailyExodouchoiPlan(dates.sunday);

    return { friday, saturday, sunday };
  }

  /**
   * Produces the weekend pass allocation (Εξοδούχοι Σαββάτου / Εξοδούχοι Κυριακής)
   * based on the actual duties assigned across Friday, Saturday, and Sunday.
   * Also respects personal preferences for personnel without duties.
   */
  deriveWeekendPlanFromSchedules(
    friday: DailySchedule,
    saturday: DailySchedule,
    sunday: DailySchedule
  ): WeekendPlan {
    const dates = this.getWeekendDates(friday.date);
    const activePersonnel = this.storage.activePersonnel();

    const isSlot12to14 = (slot: ShiftSlotAssignment) => 
      Boolean((slot.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('12:00-14:00') && !slot.hoursNote?.includes('20:00')));
    const isSlot10to12 = (slot: ShiftSlotAssignment) => 
      Boolean((slot.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && slot.intervals.length === 1) ||
      (slot.hoursNote?.includes('10:00-12:00') && !slot.hoursNote?.includes('18:00')));

    // 1. Identify personnel with Saturday duties (excluding morning cover soldiers who depart after morning)
    const satDutySoldierIds = new Set<string>();
    saturday.duties.forEach(d => {
      d.slots.forEach(s => {
        if (!s.personId) return;
        // Saturday morning cover slots (10-12, 12-14) leave camp after 12:00/14:00 -> not blocked from Saturday pass
        if (isSlot10to12(s) || isSlot12to14(s)) {
          return;
        }
        satDutySoldierIds.add(s.personId);
      });
    });

    // 2. Identify personnel with Sunday duties
    const sunDutySoldierIds = new Set<string>();
    sunday.duties.forEach(d => {
      d.slots.forEach(s => {
        if (s.personId) sunDutySoldierIds.add(s.personId);
      });
    });

    // 3. Identify personnel who served Friday
    const friDutySoldierIds = new Set<string>();
    friday.duties.forEach(d => {
      d.slots.forEach(s => {
        if (s.personId) friDutySoldierIds.add(s.personId);
      });
    });

    const satOffIds: string[] = [];
    const sunOffIds: string[] = [];
    const inCampIds: string[] = [];

    // Classify each active soldier
    for (const p of activePersonnel) {
      if (p.exemptFromAllDuties) continue;

      const onSat = satDutySoldierIds.has(p.id);
      const onSun = sunDutySoldierIds.has(p.id);
      const onFri = friDutySoldierIds.has(p.id);

      const hasSatPenalty = this.storage.hasActivePenaltyOnDate(p.id, dates.saturday);
      const hasSunPenalty = this.storage.hasActivePenaltyOnDate(p.id, dates.sunday);

      if (hasSatPenalty && hasSunPenalty) {
        // Active penalty on both days: must stay in camp
        inCampIds.push(p.id);
      } else if (onSat && onSun) {
        // Both days on duty
        inCampIds.push(p.id);
      } else if (onSat) {
        // Serving Saturday -> Day off is Sunday!
        if (hasSunPenalty) {
          inCampIds.push(p.id); // Cannot go out Sunday due to penalty
        } else {
          sunOffIds.push(p.id);
        }
      } else if (onSun) {
        // Serving Sunday -> Day off is Saturday!
        if (hasSatPenalty) {
          inCampIds.push(p.id); // Cannot go out Saturday due to penalty
        } else {
          satOffIds.push(p.id);
        }
      } else if (onFri) {
        // Served Friday, free on Saturday & Sunday -> Day off is Saturday
        if (hasSatPenalty) {
          if (hasSunPenalty) {
            inCampIds.push(p.id);
          } else {
            sunOffIds.push(p.id);
          }
        } else {
          satOffIds.push(p.id);
        }
      } else {
        // Free throughout the weekend:
        if (hasSatPenalty && !hasSunPenalty) {
          sunOffIds.push(p.id); // Saturday penalized, Sunday free
        } else if (hasSunPenalty && !hasSatPenalty) {
          satOffIds.push(p.id); // Sunday penalized, Saturday free
        } else {
          // Free throughout and no day-specific penalty blocker: allocate based on preference or balance
          if (p.weekendPreference === 'Σάββατο') {
            satOffIds.push(p.id);
          } else if (p.weekendPreference === 'Κυριακή') {
            sunOffIds.push(p.id);
          } else {
            if (satOffIds.length <= sunOffIds.length) {
              satOffIds.push(p.id);
            } else {
              sunOffIds.push(p.id);
            }
          }
        }
      }
    }

    const plan: WeekendPlan = {
      fridayDate: dates.friday,
      saturdayDate: dates.saturday,
      sundayDate: dates.sunday,
      saturdayOffIds: Array.from(new Set(satOffIds)),
      sundayOffIds: Array.from(new Set(sunOffIds)),
      inCampIds: Array.from(new Set(inCampIds)),
      updatedAt: new Date().toISOString()
    };

    this.storage.saveWeekendPlan(plan);
    return plan;
  }

  deriveWeekendPlanForFriday(fridayDateStr: string): WeekendPlan {
    const dates = this.getWeekendDates(fridayDateStr);
    const fri = this.storage.getScheduleForDate(dates.friday) || { date: dates.friday, isHolidayOrWeekend: false, duties: [] };
    const sat = this.storage.getScheduleForDate(dates.saturday) || { date: dates.saturday, isHolidayOrWeekend: true, duties: [] };
    const sun = this.storage.getScheduleForDate(dates.sunday) || { date: dates.sunday, isHolidayOrWeekend: true, duties: [] };
    return this.deriveWeekendPlanFromSchedules(fri, sat, sun);
  }

  // Synchronizes Friday restaurant half-shift soldiers (16:00-22:00) to Monday morning (05:20-16:00)
  syncFridayRestaurantToMonday(friday: DailySchedule, fridayDateStr: string, allPersonnel: Personnel[]) {
    const mondayDateStr = this.addDays(fridayDateStr, 3);

    const existingMonday = this.storage.getScheduleForDate(mondayDateStr);
    const monday: DailySchedule = existingMonday || {
      date: mondayDateStr,
      isHolidayOrWeekend: false,
      duties: this.buildDutiesSkeletonForDate(mondayDateStr)
    };

    let modified = false;
    friday.duties.forEach(fDuty => {
      const dutyDef = this.storage.dutyTypes().find(d => d.id === fDuty.dutyTypeId);
      if (!dutyDef) return;
      const isRestaurant = dutyDef.timePresetType === 'RESTAURANT_CYCLE' || 
                           dutyDef.id === 'duty-estiatoria' ||
                           dutyDef.name.includes('Εστιατόρι');
      if (!isRestaurant) return;

      const monDuty = monday.duties.find(d => d.dutyTypeId === fDuty.dutyTypeId);
      if (!monDuty) return;

      const friSlots = fDuty.slots.filter(s => s.intervals?.some(i => i.from === '16:00' && i.to === '22:00'));
      const monMorningSlots = monDuty.slots.filter(s => s.intervals?.some(i => i.from === '05:20' && i.to === '16:00') && s.intervals.length === 1);

      for (let i = 0; i < Math.min(friSlots.length, monMorningSlots.length); i++) {
        if (friSlots[i].personId) {
          const person = allPersonnel.find(p => p.id === friSlots[i].personId);
          if (person) {
            monMorningSlots[i].personId = person.id;
            monMorningSlots[i].personName = person.fullName;
            monMorningSlots[i].rankShort = person.rankShort;
            monMorningSlots[i].company = person.company;
            monMorningSlots[i].rotationalGroup = person.rotationalGroup;
            monMorningSlots[i].manualOverride = true;
            monMorningSlots[i].conflictWarning = undefined;
            monMorningSlots[i].conflictSeverity = undefined;
            modified = true;
          }
        }
      }
    });

    if (modified) {
      this.backgroundCheckSchedule(monday, mondayDateStr, undefined);
      this.storage.saveSchedule(monday);
    }
  }

  // Synchronizes the cover slots with their corresponding incomplete slots across the weekend
  syncWeekendLinkedCoverSlots(friday: DailySchedule, saturday: DailySchedule, sunday: DailySchedule) {
    const isSlot12to14 = (slot: ShiftSlotAssignment) => 
      slot.intervals?.some(i => i.from === '12:00' && i.to === '14:00') && slot.intervals.length === 1;
    const isSlot10to12 = (slot: ShiftSlotAssignment) => 
      slot.intervals?.some(i => i.from === '10:00' && i.to === '12:00') && slot.intervals.length === 1;
    const isSlotSatPos4Incomplete = (slot: ShiftSlotAssignment) => 
      slot.intervals?.some(i => i.from === '20:00') && slot.intervals?.some(i => i.from === '04:00') && slot.intervals.length === 2;
    const isSlotSunPos3 = (slot: ShiftSlotAssignment) => 
      slot.intervals?.some(i => i.from === '18:00') && slot.intervals?.some(i => i.from === '02:00');
    const isSlotSunPos4 = (slot: ShiftSlotAssignment) => 
      slot.intervals?.some(i => i.from === '20:00') && slot.intervals?.some(i => i.from === '04:00') && slot.intervals.length === 3;

    friday.duties.forEach(fDuty => {
      const dutyDef = this.storage.dutyTypes().find(d => d.id === fDuty.dutyTypeId);
      if (!dutyDef) return;
      const isRolling = dutyDef.timePresetType === 'ROLLING_CYCLE' || 
                        dutyDef.timePresetType === 'GREEK_ARMY_2_6' || 
                        dutyDef.name.includes('Θαλαμοφύλακας') || 
                        dutyDef.name.includes('Οπλοφύλακας');
      if (!isRolling) return;

      const satDuty = saturday.duties.find(d => d.dutyTypeId === fDuty.dutyTypeId);
      const sunDuty = sunday.duties.find(d => d.dutyTypeId === fDuty.dutyTypeId);
      if (!satDuty || !sunDuty) return;

      // 2. Saturday 10:00-12:00 Cover <=> Sunday Position 3
      const satCover10Slots = satDuty.slots.filter(isSlot10to12);
      const sunPos3Slots = sunDuty.slots.filter(isSlotSunPos3);
      for (let i = 0; i < satCover10Slots.length; i++) {
        if (sunPos3Slots[i] && (sunPos3Slots[i].personId || satCover10Slots[i].personId)) {
          const pId = sunPos3Slots[i].personId || satCover10Slots[i].personId;
          const pName = sunPos3Slots[i].personName || satCover10Slots[i].personName;
          const rShort = sunPos3Slots[i].rankShort || satCover10Slots[i].rankShort;
          const comp = sunPos3Slots[i].company || satCover10Slots[i].company;

          satCover10Slots[i].personId = pId;
          satCover10Slots[i].personName = pName;
          satCover10Slots[i].rankShort = rShort;
          satCover10Slots[i].company = comp;
          satCover10Slots[i].conflictWarning = undefined;
          satCover10Slots[i].conflictSeverity = undefined;

          sunPos3Slots[i].personId = pId;
          sunPos3Slots[i].personName = pName;
          sunPos3Slots[i].rankShort = rShort;
          sunPos3Slots[i].company = comp;
          sunPos3Slots[i].conflictWarning = undefined;
          sunPos3Slots[i].conflictSeverity = undefined;
        }
      }

      // 3. Saturday 12:00-14:00 Cover <=> Sunday Position 4
      const satCover12Slots = satDuty.slots.filter(isSlot12to14);
      const sunPos4Slots = sunDuty.slots.filter(isSlotSunPos4);
      for (let i = 0; i < satCover12Slots.length; i++) {
        if (sunPos4Slots[i] && (sunPos4Slots[i].personId || satCover12Slots[i].personId)) {
          const pId = sunPos4Slots[i].personId || satCover12Slots[i].personId;
          const pName = sunPos4Slots[i].personName || satCover12Slots[i].personName;
          const rShort = sunPos4Slots[i].rankShort || satCover12Slots[i].rankShort;
          const comp = sunPos4Slots[i].company || satCover12Slots[i].company;

          satCover12Slots[i].personId = pId;
          satCover12Slots[i].personName = pName;
          satCover12Slots[i].rankShort = rShort;
          satCover12Slots[i].company = comp;
          satCover12Slots[i].conflictWarning = undefined;
          satCover12Slots[i].conflictSeverity = undefined;

          sunPos4Slots[i].personId = pId;
          sunPos4Slots[i].personName = pName;
          sunPos4Slots[i].rankShort = rShort;
          sunPos4Slots[i].company = comp;
          sunPos4Slots[i].conflictWarning = undefined;
          sunPos4Slots[i].conflictSeverity = undefined;
        }
      }
    });
  }

  private pickBestCandidate(
    candidates: Personnel[],
    targetDateStr: string,
    slotGroupTag: string | undefined,
    isWknd: boolean,
    weekendPlan: WeekendPlan | undefined,
    dayOfWeek: number
  ): { candidate: Personnel; didServeYesterday: boolean } {
    // Prefer soldiers who did NOT serve yesterday if any are available.
    // If no fresh soldiers are available (few personnel), pick from those who served yesterday rather than leaving blank.
    const freshCandidates = candidates.filter(c => !this.servedYesterday(c.id, targetDateStr));
    const pool = freshCandidates.length > 0 ? freshCandidates : candidates;

    const scored = pool.map(c => {
      const didServeYesterday = this.servedYesterday(c.id, targetDateStr) ? 1 : 0;
      const dutyScore = c.dutyScore || 0;
      const wkndScore = c.weekendDutyScore || 0;
      const daysRest = this.getDaysSinceLastDuty(c, targetDateStr);

      // Weekend Plan & Preferences Shift Trick:
      let weekendPlanScore = 0;
      const pref = c.weekendPreference;
      const hasPlanSat = Boolean(weekendPlan && weekendPlan.saturdayOffIds?.includes(c.id));
      const hasPlanSun = Boolean(weekendPlan && weekendPlan.sundayOffIds?.includes(c.id));
      const isSatOff = hasPlanSat || (!hasPlanSat && !hasPlanSun && pref === 'Σάββατο');
      const isSunOff = hasPlanSun || (!hasPlanSat && !hasPlanSun && pref === 'Κυριακή');
      const isCover = slotGroupTag === 'COVER' || slotGroupTag?.includes('Κάλυψη');

      if (dayOfWeek === 5) {
        // Friday
        if (!isCover) {
          // Main Friday shift: Soldiers with Saturday off are assigned to Friday duty!
          if (isSatOff) weekendPlanScore -= 300;
          if (isSunOff) weekendPlanScore += 250; // Reserve Sunday-off soldiers for Saturday main duty
        } else {
          // Coverage shift Saturday (12:00-14:00, bakery, mess hall):
          // Soldiers with Saturday off leave at 12:00 -> CANNOT take these shifts!
          if (isSatOff) weekendPlanScore += 800;
          if (isSunOff) weekendPlanScore -= 400; // In camp Saturday morning
        }
      } else if (dayOfWeek === 6) {
        // Saturday
        if (!isCover) {
          // Main Saturday shift: Soldiers with Sunday off are assigned to Saturday duty!
          if (isSunOff) weekendPlanScore -= 300;
          if (isSatOff) weekendPlanScore += 800; // Saturday day off
        } else {
          // Sunday morning coverage (10-12, 12-14): Soldiers with Sunday off leave morning!
          if (isSunOff) weekendPlanScore += 800;
          if (!isSunOff && !isSatOff) weekendPlanScore -= 300; // In-camp
          else if (isSatOff) weekendPlanScore -= 200; // Returned from Saturday day off
        }
      } else if (dayOfWeek === 0) {
        // Sunday
        if (isSunOff) weekendPlanScore += 800; // Sunday day off!
        if (isSatOff) weekendPlanScore -= 250; // Fresh from Saturday day off
        if (!isSunOff && !isSatOff) weekendPlanScore -= 300; // In-camp
      }

      const score = (didServeYesterday * 50) + (dutyScore * 10) + (isWknd ? wkndScore * 15 : 0) - Math.min(daysRest * 2, 20) + weekendPlanScore;

      return { candidate: c, score, didServeYesterday: !!didServeYesterday };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored[0];
  }

  private resolveSlotHoursNote(duty: DutyType, slotDef: any, slotIndex: number): string {
    if (duty.timePresetType === 'STANDBY' || duty.name.toLowerCase().includes('επιφυλακ')) {
      return slotDef?.label || 'Επιφυλακή';
    }
    if (slotDef) {
      const str = formatIntervalsToString(slotDef.intervals);
      if (slotDef.label) {
        if (slotDef.label.includes(str) || (slotDef.intervals?.length > 0 && slotDef.label.includes(slotDef.intervals[0].from))) {
          return slotDef.label;
        }
        return `${slotDef.label}: ${str}`;
      }
      return str;
    }
    return this.getSlotHourNote(duty, slotIndex);
  }

  private getSlotHourNote(duty: DutyType, slotIndex: number): string {
    if (duty.timePresetType === 'STANDBY' || duty.name.toLowerCase().includes('επιφυλακ')) {
      return duty.slotDefinitions?.[slotIndex]?.label || 'Επιφυλακή';
    }
    if (duty.slotDefinitions && duty.slotDefinitions[slotIndex]) {
      const def = duty.slotDefinitions[slotIndex];
      const str = formatIntervalsToString(def.intervals);
      return def.label ? `${def.label}: ${str}` : str;
    }
    if (duty.type === '24ωρη') {
      return duty.shiftHours || '08:00 - 08:00 (24ωρη)';
    }
    if (duty.type === 'Ημερήσια') {
      return duty.shiftHours || '07:00 - 21:00';
    }
    return duty.shiftHours || `Βάρδια ${slotIndex + 1}`;
  }

  // Apply shifts to personnel statistics (increment duty scores and update lastDutyDate)
  commitScheduleScores(schedule: DailySchedule) {
    const isWknd = schedule.isHolidayOrWeekend;
    const personnel = this.storage.personnel();
    const assignedIds = new Set<string>();

    for (const d of schedule.duties) {
      for (const s of d.slots) {
        if (s.personId) {
          assignedIds.add(s.personId);
        }
      }
    }

    // Capture previous lastDutyDate for each assigned soldier before updating
    const previousLastDutyDates: Record<string, string | undefined> = {};
    for (const person of personnel) {
      if (assignedIds.has(person.id)) {
        previousLastDutyDates[person.id] = person.lastDutyDate;
      }
    }
    schedule.previousLastDutyDates = previousLastDutyDates;

    // Calculate score delta for each soldier based on the weight of the duty they performed
    const allDutyTypes = this.storage.dutyTypes();
    const soldierDutyScoreDelta: Record<string, number> = {};

    for (const d of schedule.duties) {
      let weight = d.weight;
      if (weight === undefined || weight === null) {
        const dutyDef = allDutyTypes.find(dt => dt.id === d.dutyTypeId);
        weight = (dutyDef?.weight !== undefined && dutyDef?.weight !== null) ? dutyDef.weight : 1;
        d.weight = weight;
      }

      for (const slot of d.slots) {
        if (slot.personId) {
          soldierDutyScoreDelta[slot.personId] = (soldierDutyScoreDelta[slot.personId] || 0) + weight;
        }
      }
    }

    const updates = Array.from(assignedIds).map(id => {
      const p = personnel.find(person => person.id === id);
      let newLastDutyDate = schedule.date;
      if (p?.lastDutyDate && p.lastDutyDate > schedule.date) {
        newLastDutyDate = p.lastDutyDate;
      }

      const scoreDelta = soldierDutyScoreDelta[id] !== undefined ? soldierDutyScoreDelta[id] : 1;

      return {
        id,
        dutyScoreDelta: scoreDelta,
        weekendDutyScoreDelta: isWknd ? scoreDelta : 0,
        lastDutyDate: newLastDutyDate
      };
    });

    this.storage.bulkUpdateDutyScores(updates);
  }

  // Rollback shifts from personnel statistics (decrement duty scores and reset lastDutyDate to the correct one)
  rollbackScheduleScores(schedule: DailySchedule) {
    const isWknd = schedule.isHolidayOrWeekend;
    const allPersonnel = this.storage.personnel();
    const allSchedules = this.storage.schedules();
    const allDutyTypes = this.storage.dutyTypes();
    const assignedIds = new Set<string>();

    const soldierDutyScoreDelta: Record<string, number> = {};

    for (const d of schedule.duties) {
      let weight = d.weight;
      if (weight === undefined || weight === null) {
        const dutyDef = allDutyTypes.find(dt => dt.id === d.dutyTypeId);
        weight = (dutyDef?.weight !== undefined && dutyDef?.weight !== null) ? dutyDef.weight : 1;
      }

      for (const s of d.slots) {
        if (s.personId) {
          assignedIds.add(s.personId);
          soldierDutyScoreDelta[s.personId] = (soldierDutyScoreDelta[s.personId] || 0) + weight;
        }
      }
    }

    const updates = Array.from(assignedIds).map(id => {
      const person = allPersonnel.find(p => p.id === id);
      const candidateDates: string[] = [];

      // 1. Check previously captured lastDutyDate from before this schedule was finalized
      if (schedule.previousLastDutyDates && schedule.previousLastDutyDates[id]) {
        candidateDates.push(schedule.previousLastDutyDates[id]!);
      }

      // 2. Check all other stored schedules where this person served (excluding this schedule date)
      for (const otherSched of allSchedules) {
        if (otherSched.date === schedule.date) continue;
        const servedInOther = otherSched.duties?.some(d =>
          d.slots?.some(s => s.personId === id)
        );
        if (servedInOther) {
          candidateDates.push(otherSched.date);
        }
      }

      // 3. Find the latest date among all valid candidates
      const filteredDates = candidateDates.filter(d => d !== schedule.date);
      let correctLastDutyDate: string | undefined = undefined;
      if (filteredDates.length > 0) {
        filteredDates.sort(); // ascending, e.g. ['2026-09-15', '2026-09-22']
        correctLastDutyDate = filteredDates[filteredDates.length - 1];
      }

      // If the soldier currently has a lastDutyDate that is strictly later than schedule.date, keep that later date
      if (person?.lastDutyDate && person.lastDutyDate > schedule.date) {
        correctLastDutyDate = person.lastDutyDate;
      }

      const scoreDelta = soldierDutyScoreDelta[id] !== undefined ? soldierDutyScoreDelta[id] : 1;

      return {
        id,
        dutyScoreDelta: -scoreDelta,
        weekendDutyScoreDelta: isWknd ? -scoreDelta : 0,
        lastDutyDate: correctLastDutyDate || null
      };
    });

    this.storage.bulkUpdateDutyScores(updates);
  }

  /**
   * Generates or updates the daily list of soldiers eligible for evening pass (Εξοδούχοι).
   * Rules:
   * 1. Personnel without active evening duties can go out.
   * 2. Duties on today's sheet scheduled for tomorrow morning (e.g. Αρτοκλίβανος 06:50-14:00 επομ., weekend cover slots) do NOT block tonight's pass.
   * 3. Καθαριότητα on weekdays does NOT count as a blocking duty (soldiers can go out).
   *    On weekends, Καθαριότητα DOES count as duty (soldiers cannot go out).
   * 4. Leaves (Άδεια, Νοσοκομείο, ΣΤΕΠ, Ε.Υ.) and active Penalties (ΣΤ ΕΞΟΔΟΥ, Κ, Φ) block pass.
   * 5. Preserves user manual overrides (manual modifications are respected).
   */
  generateDailyExodouchoiPlan(dateStr: string, existingPlan?: DailyExodouchoiPlan): DailyExodouchoiPlan {
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isWeekend = day === 0 || day === 6;

    const activePersonnel = this.storage.activePersonnel();
    const schedule = this.storage.getScheduleForDate(dateStr);
    const soldierRecords = this.storage.soldierRecords();

    // Check weekend plan if Saturday or Sunday
    const weekendDates = this.getWeekendDates(dateStr);
    const weekendPlan = this.storage.getWeekendPlan(weekendDates.friday);

    const existingMap = new Map<string, DailyExodouchoiSoldier>();
    if (existingPlan && existingPlan.soldiers) {
      existingPlan.soldiers.forEach(s => existingMap.set(s.personId, s));
    }

    const soldiers: DailyExodouchoiSoldier[] = [];

    for (const person of activePersonnel) {
      let isGoingOut = true;
      let hasDutyTonight = false;
      let isOnLeaveTonight = false;
      let hasPenaltyTonight = false;
      let dutyStatusText = 'Χωρίς Υπηρεσία';
      const dutyDetails: string[] = [];

      // 1. Check Leaves & Absences
      const leave = this.getPersonLeave(person.id, dateStr);
      if (leave) {
        const meta = getLeaveTypeMeta(leave.type);
        if (meta.isInformative) {
          // Informative exemption (Εαρβ, Εξυρ) -> Does not block evening pass
          dutyDetails.push(`${leave.type} (Ενημερωτικό)`);
        } else if (leave.type === 'Ελεύθερος Ορθοστασίας (ΕΟ)') {
          dutyDetails.push('Ελεύθερος Ορθοστασίας (ΕΟ)');
        } else if (leave.type === 'Ελεύθερος Ασκήσεων (ΕΑ)') {
          dutyDetails.push('Ελεύθερος Ασκήσεων (ΕΑ)');
        } else if (leave.type === 'Άδεια' || leave.type === 'Εισαγωγή Νοσοκομείο') {
          isOnLeaveTonight = true;
          isGoingOut = false;
          dutyStatusText = `${leave.type} (Απών εκτός μονάδας)`;
        } else if (leave.type === 'Εισαγωγή Στεπ') {
          isOnLeaveTonight = true;
          isGoingOut = false;
          dutyStatusText = 'Κωλυόμενος (ΣΤΕΠ)';
        } else if (leave.type === 'Ελεύθερος Υπηρεσίας (ΕΥ)') {
          isOnLeaveTonight = true;
          isGoingOut = false;
          dutyStatusText = 'Ελεύθερος Υπηρεσίας (ΕΥ)';
        } else {
          isOnLeaveTonight = true;
          isGoingOut = false;
          dutyStatusText = leave.type;
        }
      }

      // 2. Check Duties on Today's Schedule Sheet
      if (!isOnLeaveTonight && schedule && schedule.duties) {
        for (const d of schedule.duties) {
          for (const s of d.slots) {
            if (s.personId === person.id) {
              const normName = normalizeGreek(d.dutyName || '');
              const normShort = normalizeGreek(d.shortName || '');
              const normTag = normalizeGreek(s.groupTag || '');
              const normNote = normalizeGreek(s.hoursNote || '');

              const isCleaning = d.dutyTypeId === 'duty-kathariotites' || 
                                 normName.includes('καθαριοτητ') || 
                                 normShort === 'καθ';

              const isBakery = d.dutyTypeId === 'duty-artoklivanos' || 
                               normName.includes('αρτοκλιβαν') || 
                               normShort === 'αρτ';

              // Cleaning Rule:
              // Weekdays (Mon-Fri) -> Doesn't matter, can go out!
              // Weekends (Sat-Sun) -> Counts as duty, cannot go out!
              if (isCleaning) {
                if (!isWeekend) {
                  // Weekday cleaning: person can still go out
                  dutyDetails.push('Καθαριότητες (Καθημερινή)');
                } else {
                  // Weekend cleaning: blocks evening pass
                  hasDutyTonight = true;
                  isGoingOut = false;
                  dutyStatusText = 'Καθαριότητες (Σ/Κ - Υπηρεσία)';
                }
                continue;
              }

              // Bakery Rule:
              // Shift is 06:50 - 14:00 next day morning. No duty tonight!
              if (isBakery || normNote.includes('επομ')) {
                if (isBakery) {
                  dutyDetails.push('Αρτοκλίβανος (Πρωινό Επομένης 06:50-14:00)');
                  continue;
                }
              }

              // Weekend Cover Slots for Tomorrow:
              // Friday slot 5: Cover 4th pos (Saturday 12:00-14:00)
              if (day === 5 && (s.groupTag === 'COVER' || normTag.includes('καλυψη') || normNote.includes('καλυψη') || (s.intervals?.length === 1 && s.intervals[0].from === '12:00' && s.intervals[0].to === '14:00'))) {
                dutyDetails.push('Κάλυψη 4ης Θέσης (Σάββατο 12:00-14:00)');
                continue;
              }

              // Saturday slots for Sunday cover:
              if (day === 6 && (s.groupTag === 'COVER' || normTag.includes('καλυψη') || normNote.includes('καλυψη'))) {
                dutyDetails.push('Κάλυψη Θέσης (Κυριακή)');
                continue;
              }

              // Monday morning restaurant completion (ends 16:00):
              if (day === 1 && s.intervals?.length === 1 && s.intervals[0].from === '05:20' && s.intervals[0].to === '16:00') {
                dutyDetails.push('Εστιατόρια (Πρωινό Δευτέρας 05:20-16:00)');
                continue;
              }

              // Standard duty that runs tonight (ΘΦ, ΟΠΛ, Εστιατόρια, Επιφυλακή, κ.λπ.)
              hasDutyTonight = true;
              isGoingOut = false;
              const hoursText = s.hoursNote || formatIntervalsToString(s.intervals || []);
              dutyStatusText = `${d.dutyName}${hoursText && hoursText !== 'Χωρίς ωράριο' ? ` (${hoursText})` : ''}`;
              break;
            }
          }
          if (hasDutyTonight) break;
        }
      }

      // 3. Check Penalties (Στέρηση Εξόδου, Κράτηση, Φυλάκιση)
      // "if someone has στ εξοδου that means that he must no go out if he has a day off. Only then it counts a punishment day passed"
      if (!isOnLeaveTonight) {
        const activePenalties = this.storage.getActivePenaltiesForPerson(person.id, dateStr);

        if (activePenalties.length > 0) {
          hasPenaltyTonight = true;
          isGoingOut = false; // Strictly prevented from going out
          const pen = activePenalties[0];
          const prog = this.storage.calculatePenaltyProgress(pen, dateStr);
          const penType = (pen.penaltyType || prog.penaltyType || 'ΣΤ ΕΞΟΔΟΥ').trim();
          const dayNum = Math.min(prog.totalDays, prog.servedDays || 1);

          if (!hasDutyTonight) {
            // Day off in camp: serving the punishment!
            dutyStatusText = `Στέρηση Εξόδου (${dayNum}η/${prog.totalDays} ημέρα - Μέσα)`;
          } else {
            // Has duty: serves duty, and penalty is noted
            dutyStatusText = `${dutyStatusText} [${penType}: ${dayNum}η/${prog.totalDays}]`;
          }
        }
      }

      // If still eligible to go out, summarize status text
      if (isGoingOut) {
        if (dutyDetails.length > 0) {
          dutyStatusText = `${dutyDetails.join(' & ')} — Εξοδούχος`;
        } else if (weekendPlan && (day === 6 || day === 0)) {
          if (day === 6 && weekendPlan.saturdayOffIds?.includes(person.id)) {
            dutyStatusText = 'Έξοδος Σαββάτου (Πρόγραμμα Σ/Κ)';
          } else if (day === 0 && weekendPlan.sundayOffIds?.includes(person.id)) {
            dutyStatusText = 'Έξοδος Κυριακής (Πρόγραμμα Σ/Κ)';
          } else {
            dutyStatusText = 'Χωρίς Υπηρεσία (Εξοδούχος)';
          }
        } else {
          dutyStatusText = 'Χωρίς Υπηρεσία (Εξοδούχος)';
        }
      }

      // Check existing manual overrides
      const existing = existingMap.get(person.id);
      let manualOverride = false;
      let notes = existing?.notes || '';

      if (existing && existing.manualOverride) {
        isGoingOut = existing.isGoingOut;
        manualOverride = true;
      }

      soldiers.push({
        personId: person.id,
        fullName: person.fullName,
        rankShort: person.rankShort || 'ΣΤΡ',
        asm: person.asm || '-',
        specialty: person.specialty || 'ΠΖ',
        corps: person.corps,
        company: person.company,
        barracksRoom: person.barracksRoom,
        bedNumber: person.bedNumber,
        phone: person.phone,
        isGoingOut,
        dutyStatusText,
        hasDutyTonight,
        isOnLeaveTonight,
        hasPenaltyTonight,
        manualOverride,
        notes
      });
    }

    return {
      date: dateStr,
      soldiers,
      updatedAt: new Date().toISOString()
    };
  }
}
