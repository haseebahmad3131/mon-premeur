import React from 'react';
import { Shield } from 'lucide-react';
import UserManagement from '../components/UserManagement';
import { useTheme } from '../contexts/ThemeContext';

export default function UsersPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary-color">Gestion des Utilisateurs</h1>
          <p className="text-sm text-secondary-color">Gérez les comptes utilisateurs et les permissions</p>
        </div>
      </div>

      <UserManagement />
    </div>
  );
}