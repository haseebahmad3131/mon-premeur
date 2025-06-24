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
  profileImageUrl?: string;
  powerBiUrl?: string;
  lastLogin: string;
  lastLoginIp?: string;
  loginCount7Days: number;
  createdAt: string;
  loginHistory: LoginHistoryEntry[];
  group?: string; // Groupe d'entreprises (optionnel) - pour les PDG et leurs employés
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
  password: string;
  name: string;
  company: string;
  role: User['role'];
  profileImage?: File;
  powerBiUrl?: string;
  group?: string; // Groupe d'entreprises (optionnel) - pour les PDG et leurs employés
}

export interface UpdateUserData extends Partial<User> {
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