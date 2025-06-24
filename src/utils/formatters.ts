/**
 * Utility functions for formatting data
 */

/**
 * Format a date string into a localized date string
 * 
 * @param dateString - ISO date string to format
 * @param locale - Locale to use for formatting (defaults to 'fr-FR')
 * @returns Formatted date string
 */
export function formatDate(dateString: string, locale = 'fr-FR'): string {
  if (!dateString) return '';
  
  try {
    return new Date(dateString).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Calculate the difference between two dates in days
 * 
 * @param date1 - First date as string or Date
 * @param date2 - Second date as string or Date (defaults to current date)
 * @returns Number of days between the dates
 */
export function daysBetween(date1: string | Date, date2: string | Date = new Date()): number {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  
  // Calculate difference in milliseconds and convert to days
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format a string to be used in URL slugs or IDs
 * 
 * @param text - Text to slugify
 * @returns Slugified text
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}