/**
 * Print Template Configuration Model
 * Defines which duties and sections appear in print output
 */

export interface PrintTemplateSection {
  sectionId: string;
  sectionName: string;
  visible: boolean;
  displayOrder: number;
}

export interface PrintTemplateDutyFilter {
  dutyTypeId?: string;
  dutyName?: string;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  visible: boolean;
}

export interface PrintTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  
  // Section visibility and ordering
  sections: {
    guards: PrintTemplateSection;
    cleaning: PrintTemplateSection;
    restaurant: PrintTemplateSection;
    permanentRestaurant: PrintTemplateSection;
    bakery: PrintTemplateSection;
    standby: PrintTemplateSection;
    grafeis: PrintTemplateSection;
    additionalDuties: PrintTemplateSection;
  };

  // Custom filters for additional duties
  additionalDutyFilters: PrintTemplateDutyFilter[];

  // Display options
  showInkSaverToggle: boolean;
  defaultInkSaver: boolean;
  showExtraGuards: boolean;
  showCleaningSupervisor: boolean;
}

export interface PrintTemplateCollection {
  templates: PrintTemplate[];
  defaultTemplateId?: string;
}

/**
 * Pre-defined templates for common use cases
 */
export const DEFAULT_TEMPLATES: PrintTemplate[] = [
  {
    id: 'template-armed-shift',
    name: 'Ένοπλη Υπηρεσία',
    description: 'Διάταξη για ένοπλες βάρδιες με πλήρες εξοπλισμό',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    sections: {
      guards: { sectionId: 'guards', sectionName: 'Φύλακες', visible: true, displayOrder: 1 },
      cleaning: { sectionId: 'cleaning', sectionName: 'Καθαριότητες', visible: true, displayOrder: 2 },
      restaurant: { sectionId: 'restaurant', sectionName: 'Εστιατόρια', visible: true, displayOrder: 3 },
      permanentRestaurant: { sectionId: 'permanentRestaurant', sectionName: 'Μόνιμοι Εστιατόρια', visible: true, displayOrder: 4 },
      bakery: { sectionId: 'bakery', sectionName: 'Αρτοκλίβανος', visible: true, displayOrder: 5 },
      standby: { sectionId: 'standby', sectionName: 'Επιφυλακές', visible: true, displayOrder: 6 },
      grafeis: { sectionId: 'grafeis', sectionName: 'Γραφείς', visible: true, displayOrder: 7 },
      additionalDuties: { sectionId: 'additionalDuties', sectionName: 'Λοιπές Υπηρεσίες', visible: true, displayOrder: 8 }
    },
    additionalDutyFilters: [],
    showInkSaverToggle: true,
    defaultInkSaver: false,
    showExtraGuards: true,
    showCleaningSupervisor: true
  },
  {
    id: 'template-unarmed-shift',
    name: 'Άοπλη Υπηρεσία',
    description: 'Διάταξη για άοπλες βάρδιες χωρίς φύλακες',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    sections: {
      guards: { sectionId: 'guards', sectionName: 'Φύλακες', visible: false, displayOrder: 1 },
      cleaning: { sectionId: 'cleaning', sectionName: 'Καθαριότητες', visible: true, displayOrder: 2 },
      restaurant: { sectionId: 'restaurant', sectionName: 'Εστιατόρια', visible: true, displayOrder: 3 },
      permanentRestaurant: { sectionId: 'permanentRestaurant', sectionName: 'Μόνιμοι Εστιατόρια', visible: true, displayOrder: 4 },
      bakery: { sectionId: 'bakery', sectionName: 'Αρτοκλίβανος', visible: true, displayOrder: 5 },
      standby: { sectionId: 'standby', sectionName: 'Επιφυλακές', visible: false, displayOrder: 6 },
      grafeis: { sectionId: 'grafeis', sectionName: 'Γραφείς', visible: true, displayOrder: 7 },
      additionalDuties: { sectionId: 'additionalDuties', sectionName: 'Λοιπές Υπηρεσίες', visible: true, displayOrder: 8 }
    },
    additionalDutyFilters: [],
    showInkSaverToggle: true,
    defaultInkSaver: false,
    showExtraGuards: false,
    showCleaningSupervisor: true
  },
  {
    id: 'template-minimal',
    name: 'Ελάχιστη Διάταξη',
    description: 'Μόνο ουσιώδεις πληροφορίες - εξοικονόμηση χαρτιού',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    sections: {
      guards: { sectionId: 'guards', sectionName: 'Φύλακες', visible: true, displayOrder: 1 },
      cleaning: { sectionId: 'cleaning', sectionName: 'Καθαριότητες', visible: true, displayOrder: 2 },
      restaurant: { sectionId: 'restaurant', sectionName: 'Εστιατόρια', visible: true, displayOrder: 3 },
      permanentRestaurant: { sectionId: 'permanentRestaurant', sectionName: 'Μόνιμοι Εστιατόρια', visible: false, displayOrder: 4 },
      bakery: { sectionId: 'bakery', sectionName: 'Αρτοκλίβανος', visible: false, displayOrder: 5 },
      standby: { sectionId: 'standby', sectionName: 'Επιφυλακές', visible: false, displayOrder: 6 },
      grafeis: { sectionId: 'grafeis', sectionName: 'Γραφείς', visible: false, displayOrder: 7 },
      additionalDuties: { sectionId: 'additionalDuties', sectionName: 'Λοιπές Υπηρεσίες', visible: false, displayOrder: 8 }
    },
    additionalDutyFilters: [],
    showInkSaverToggle: true,
    defaultInkSaver: true,
    showExtraGuards: false,
    showCleaningSupervisor: true
  }
];
