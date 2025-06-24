/**
 * Custom hook for managing sorting state
 */

import { useState, useCallback } from 'react';
import { SortConfig } from '../types';

/**
 * Hook to manage sorting configuration for tables
 * 
 * @param initialKey - Initial key to sort by
 * @param initialDirection - Initial sort direction
 * @returns Object containing sort config and functions to manage sorting
 */
export function useSort<T>(initialKey: keyof T, initialDirection: 'asc' | 'desc' = 'asc') {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: initialKey as string,
    direction: initialDirection
  });

  /**
   * Toggle sort by key - flips direction if key is already active
   * 
   * @param key - Key to sort by
   */
  const toggleSort = useCallback((key: keyof T) => {
    setSortConfig(prev => ({
      key: key as string,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  /**
   * Sort data array according to current sort configuration
   * 
   * @param data - Array of data to sort
   * @returns Sorted array
   */
  const sortData = useCallback(<U extends Record<string, any>>(data: U[]): U[] => {
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      // Handle strings (case insensitive comparison)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue, 'fr', { sensitivity: 'base' })
          : bValue.localeCompare(aValue, 'fr', { sensitivity: 'base' });
      }
      
      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
      
      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      // Handle date strings
      if (
        typeof aValue === 'string' && 
        typeof bValue === 'string' && 
        !isNaN(Date.parse(aValue)) && 
        !isNaN(Date.parse(bValue))
      ) {
        return sortConfig.direction === 'asc' 
          ? new Date(aValue).getTime() - new Date(bValue).getTime()
          : new Date(bValue).getTime() - new Date(aValue).getTime();
      }
      
      // Default comparison
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortConfig]);

  return {
    sortConfig,
    toggleSort,
    sortData
  };
}