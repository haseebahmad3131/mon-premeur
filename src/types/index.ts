/**
 * Type definitions for the application
 * This file centralizes all type definitions used across the application
 */

// Authentication and user related types
export interface User {
  id: string;
  email: string;
  name: string;
  company: string;
  role: 'PDG' | 'Dirigeant' | 'Employé' | 'Admin';
  group?: string;
  powerBiUrl?: string;
  powerBiUrl2?: string;
  profileImageUrl?: string;
  lastLogin: string;
  loginHistory: LoginHistoryEntry[];
}

export interface LoginHistoryEntry {
  timestamp: string;
  ipAddress: string;
  status: 'success' | 'failed';
  reason?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Company related types
export interface Company {
  id: string;
  name: string;
  allowedIps: string[];
  createdAt: string;
  updatedAt: string;
  group?: string; // Groupe auquel appartient l'entreprise (optionnel)
  logoUrl?: string; // URL du logo de l'entreprise
}

// Group related types
export interface Group {
  name: string; 
  logoUrl?: string; // URL du logo du groupe
}

// Dashboard related types
export interface DashboardStats {
  activeUsers: number;
  totalLogins: number;
  averageSessionTime: string;
  lastSync: string;
}

// User management related types
export interface NewUser {
  email: string;
  name: string;
  company: string;
  role: 'PDG' | 'Dirigeant' | 'Employé' | 'Admin';
  group?: string;
  powerBiUrl?: string;
  powerBiUrl2?: string;
  password?: string;
}

export interface UpdateUserData {
  name: string;
  company: string;
  role: 'PDG' | 'Dirigeant' | 'Employé' | 'Admin';
  group?: string;
  powerBiUrl?: string;
  powerBiUrl2?: string;
  profileImage?: File;
}

export interface UpdateCompanyData extends Partial<Company> {
  logo?: File; // Fichier du logo à uploader
}

// Table sorting and filtering types
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  role: string;
  company: string;
  group?: string; // Ajout du filtre par groupe
}