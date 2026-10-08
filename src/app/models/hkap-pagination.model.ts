/**
 * HKAP Pagination Model
 * Handles dynamic A4 page generation based on content size
 */

export interface HkapPage {
  pageNumber: number;
  type: 'REQUESTS' | 'PENALTIES';
  items: any[];
  isLastPage: boolean;
}

export interface HkapPaginationConfig {
  rowsPerPage: number;
  minRowHeight: number;
  maxRowsPerPage: number;
  enableAutoSplit: boolean;
}

/**
 * Calculate optimal rows per A4 page based on available space
 * A4 Landscape: 210mm height
 * - Top padding: 12mm
 * - Bottom padding: 14mm  
 * - Title: ~12mm
 * - Table header: ~8mm
 * - Signatures: ~55mm
 * Available space for rows: ~109mm
 */
export const DEFAULT_HKAP_CONFIG: HkapPaginationConfig = {
  rowsPerPage: 9,      // Standard 9 rows per page
  minRowHeight: 12,    // minimum row height in mm
  maxRowsPerPage: 12,  // absolute max rows per page
  enableAutoSplit: true
};

/**
 * Calculate how many rows can fit on a page based on available space
 * @param availableHeightMm Total available height in mm (excluding header/footer)
 * @param rowHeightMm Height of each row in mm
 * @returns Maximum number of rows that can fit
 */
export function calculateRowsPerPage(availableHeightMm: number, rowHeightMm: number = 12): number {
  const calculated = Math.floor(availableHeightMm / rowHeightMm);
  return Math.min(calculated, DEFAULT_HKAP_CONFIG.maxRowsPerPage);
}

/**
 * Split records into pages for printing
 * @param records Array of records to split
 * @param rowsPerPage How many rows per page
 * @returns Array of page groups
 */
export function paginateRecords(records: any[], rowsPerPage: number = DEFAULT_HKAP_CONFIG.rowsPerPage): any[][] {
  if (records.length === 0) {
    return [[]]; // Return one empty page
  }

  const pages: any[][] = [];
  for (let i = 0; i < records.length; i += rowsPerPage) {
    pages.push(records.slice(i, i + rowsPerPage));
  }
  return pages;
}

/**
 * Calculate page count needed for records
 */
export function calculatePageCount(recordCount: number, rowsPerPage: number = DEFAULT_HKAP_CONFIG.rowsPerPage): number {
  if (recordCount === 0) return 1;
  return Math.ceil(recordCount / rowsPerPage);
}
