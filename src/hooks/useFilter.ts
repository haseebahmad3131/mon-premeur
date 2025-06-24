/**
 * Custom hook for managing filter state
 */

import { useState, useCallback } from 'react';
import { FilterConfig } from '../types';

/**
 * Hook to manage filtering for tables
 * 
 * @param initialFilters - Initial filter values
 * @returns Object containing filter state and functions to manage filtering
 */
export function useFilter(initialFilters: FilterConfig = { role: '', company: '', group: '' }) {
  const [filters, setFilters] = useState<FilterConfig>(initialFilters);
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Update a specific filter field
   * 
   * @param field - Field to update
   * @param value - New value for the field
   */
  const updateFilter = useCallback((field: keyof FilterConfig, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Reset all filters to initial values
   */
  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setSearchTerm('');
  }, [initialFilters]);

  /**
   * Apply filters to a dataset
   * 
   * @param data - Array of data to filter
   * @param searchFields - Fields to search in with the search term
   * @returns Filtered array
   */
  const filterData = useCallback(<T extends Record<string, any>>(
    data: T[],
    searchFields: (keyof T)[] = ['name', 'email']
  ): T[] => {
    return data.filter(item => {
      // Search term filtering
      if (searchTerm) {
        const matchesSearch = searchFields.some(field => {
          const value = item[field];
          return typeof value === 'string' && 
            value.toLowerCase().includes(searchTerm.toLowerCase());
        });
        
        if (!matchesSearch) return false;
      }
      
      // Custom filters
      for (const [key, value] of Object.entries(filters)) {
        // Skip empty filter values
        if (!value) continue;
        
        // Handle group filter specially for items that might not have a group property
        if (key === 'group' && value) {
          // If item doesn't have group property or it's different from filter value
          if (!item[key] || String(item[key]) !== value) {
            return false;
          }
          continue;
        }
        
        // Regular filter check
        if (value && String(item[key]) !== value) {
          return false;
        }
      }
      
      return true;
    });
  }, [filters, searchTerm]);

  return {
    filters,
    searchTerm,
    setSearchTerm,
    updateFilter,
    resetFilters,
    filterData
  };
}