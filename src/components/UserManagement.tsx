/**
 * UserManagement component
 * Comprehensive user and company management interface with filtering, sorting,
 * and CRUD operations for both users and companies
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, Upload, AlertCircle, 
  Building2, SortAsc, SortDesc, Filter, Users, Link, Code,
  LayoutGrid, Image
} from 'lucide-react';
import { getUsers, deleteUser, updateUser, createUser } from '../lib/users';
import { 
  getCompanies, 
  createCompany, 
  updateCompany, 
  deleteCompany, 
  getGroups, 
  updateGroupLogo
} from '../lib/companies';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useSort } from '../hooks/useSort';
import { useFilter } from '../hooks/useFilter';
import { formatDate } from '../utils/formatters';
import { isValidIpAddress } from '../lib/api';
import type { User, NewUser, Company, UpdateUserData, Group, UpdateCompanyData } from '../types';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Check if content is HTML rather than a URL
 */
const isHtmlContent = (content: string): boolean => {
  return content.trim().startsWith('<') || 
         content.includes('</') || 
         content.includes('/>');
};



/**
 * UserManagement component for administration interface
 * Provides functionality to manage users and companies
 */
export default function UserManagement() {
  // =============== State Management ===============
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [newUser, setNewUser] = useState<Partial<NewUser>>({});
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isPowerBiHtml, setIsPowerBiHtml] = useState(false);
  
  // Companies state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editingCompany, setEditingCompany] = useState<Partial<Company> & { 
    allowedIps: string[], 
    logo?: File 
  }>({ allowedIps: [] });
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState('');
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);
  
  // Groups state
  const [groups, setGroups] = useState<string[]>([]);
  const [groupsData, setGroupsData] = useState<Group[]>([]);
  const [newGroup, setNewGroup] = useState('');
  const [groupLogo, setGroupLogo] = useState<File | null>(null);
  const [selectedGroupForLogo, setSelectedGroupForLogo] = useState<string>('');
  const [isGroupLogoModalOpen, setIsGroupLogoModalOpen] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const groupLogoInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Search, filters and sorting
  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [searchCompanyTerm, setSearchCompanyTerm] = useState('');
  const { 
    sortConfig: userSortConfig, 
    toggleSort: toggleUserSort, 
    sortData: sortUserData 
  } = useSort<User>('name');
  
  const { 
    sortConfig: companySortConfig, 
    toggleSort: toggleCompanySort, 
    sortData: sortCompanyData 
  } = useSort<Company>('name');
  
  const { filters, updateFilter } = useFilter();

  // Legacy company-specific Power BI URLs for PDG users (keeping for backward compatibility)
  const [companyPowerBiUrls, setCompanyPowerBiUrls] = useState<{[companyName: string]: string}>({});
  const [editCompanyPowerBiUrls, setEditCompanyPowerBiUrls] = useState<{[companyName: string]: string}>({});

  // =============== Lifecycle Hooks ===============
  
  /**
   * Fetch initial data on component mount
   */
  useEffect(() => {
    fetchInitialData();
  }, []);

  /**
   * Check if editing user's Power BI content is HTML when modal opens
   */
  useEffect(() => {
    if (editingUser?.powerBiUrl) {
      setIsPowerBiHtml(isHtmlContent(editingUser.powerBiUrl));
      
      // Handle legacy PDG company URLs
      if (editingUser.role === 'PDG' && editingUser.group) {
        const groupCompanies = companies.filter(c => c.group === editingUser.group);
        if (groupCompanies.length > 0) {
          try {
            const parsed = JSON.parse(editingUser.powerBiUrl);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
              setEditCompanyPowerBiUrls(parsed);
            }
          } catch {
            // Not JSON, ignore
          }
        }
      }
    } else {
      setIsPowerBiHtml(false);
    }
  }, [editingUser, companies]);

  /**
   * Extract unique groups from users and companies when data changes
   */
  useEffect(() => {
    const userGroups = users
      .filter(user => user.group)
      .map(user => user.group as string);
    
    const companyGroups = companies
      .filter(company => company.group)
      .map(company => company.group as string);
    
    // Combine and deduplicate groups
    const allGroups = [...new Set([...userGroups, ...companyGroups])].filter(Boolean).sort();
    
    setGroups(allGroups);
  }, [users, companies]);



  // =============== Data Operations ===============
  
  /**
   * Fetch users and companies data from the API
   */
  async function fetchInitialData() {
    try {
      setIsLoading(true);
      setError(null);
      
      const [fetchedUsers, fetchedCompanies, fetchedGroups] = await Promise.all([
        getUsers(),
        getCompanies(),
        getGroups()
      ]);
      
      setUsers(fetchedUsers);
      setCompanies(fetchedCompanies);
      setGroupsData(fetchedGroups);
    } catch (err) {
      setError('Échec du chargement des données. Veuillez réessayer.');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Get the logo URL for a group
   */
  const getGroupLogoUrl = (groupName: string): string | undefined => {
    if (!groupName) return undefined;
    const group = groupsData.find(g => g.name === groupName);
    return group?.logoUrl;
  };

  /**
   * Filter users based on search term and selected filters
   */
  const filteredUsers = users.filter(user =>
    (user.email.toLowerCase().includes(searchUserTerm.toLowerCase()) ||
     user.name.toLowerCase().includes(searchUserTerm.toLowerCase())) &&
    (!filters.role || user.role === filters.role) &&
    (!filters.company || user.company === filters.company) &&
    (!filters.group || user.group === filters.group)
  );

  /**
   * Filter companies based on search term and group filter
   */
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchCompanyTerm.toLowerCase()) &&
    (!filters.group || company.group === filters.group)
  );

  // Apply sorting to filtered data
  const sortedUsers = sortUserData(filteredUsers);
  const sortedCompanies = sortCompanyData(filteredCompanies);

  // =============== User CRUD Operations ===============
  
  /**
   * Handle user creation form submission
   * 
   * @param e - Form submission event
   */
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
  
      const requiredFields: (keyof NewUser)[] = ['email', 'name', 'company', 'role'];
      if (newUser?.role === 'Admin') {
        requiredFields.push('password');
      }
  
      // Validate required fields
      for (const field of requiredFields) {
        if (!newUser?.[field]) {
          throw new Error('Veuillez remplir tous les champs obligatoires');
        }
      }
  
      const userData = { ...newUser } as NewUser;
  
      // Handle Power BI URLs - now using simple fields
      // Keep the legacy PDG company-specific URLs for backward compatibility
      if (userData.role === 'PDG' && userData.group) {
        const groupCompanies = companies.filter(c => c.group === userData.group);
  
        if (groupCompanies.length > 0) {
          const missingUrls = groupCompanies.some(c => !companyPowerBiUrls[c.name]);
  
          if (missingUrls) {
            throw new Error('Veuillez fournir une URL Power BI pour chaque entreprise du groupe');
          }
  
          userData.powerBiUrl = JSON.stringify(companyPowerBiUrls);
        }
      }
  
      // Update company group if needed
      if (userData.role === 'PDG' && userData.group) {
        const groupCompanies = companies.filter(c => c.group === userData.group);
  
        for (const company of groupCompanies) {
          if (company.group !== userData.group) {
            await updateCompany(company.id, {
              ...company,
              group: userData.group,
            });
          }
        }
  
        const userCompany = companies.find(c => c.name === userData.company);
        if (userCompany && userCompany.group !== userData.group) {
          await updateCompany(userCompany.id, {
            ...userCompany,
            group: userData.group,
          });
        }
      }
  
      await createUser(userData);
      await fetchInitialData(); // Refresh data
  
      setIsUserModalOpen(false);
      setNewUser({});
      setCompanyPowerBiUrls({});
    } catch (err) {
      setError((err as Error).message);
    }
  };
  

  /**
   * Handle user editing form submission
   * 
   * @param e - Form submission event
   */
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setError(null);
      
      const updateData: UpdateUserData = {
        name: editingUser.name,
        company: editingUser.company,
        role: editingUser.role,
        group: editingUser.group,
        powerBiUrl: editingUser.powerBiUrl,
        powerBiUrl2: editingUser.powerBiUrl2
      };

      // Handle legacy PDG company-specific Power BI URLs for backward compatibility
      if (editingUser.role === 'PDG' && editingUser.group) {
        const groupCompanies = companies.filter(c => c.group === editingUser.group);
        
        // Only validate if there are companies in the group
        if (groupCompanies.length > 0) {
          const missingUrls = groupCompanies.some(c => !editCompanyPowerBiUrls[c.name]);
          
          if (missingUrls) {
            throw new Error('Veuillez fournir une URL Power BI pour chaque entreprise du groupe');
          }
          
          // Store the company Power BI URLs as a JSON string in the user's powerBiUrl field
          updateData.powerBiUrl = JSON.stringify(editCompanyPowerBiUrls);
        }
      }

      // Add image if selected
      if (selectedImage) {
        updateData.profileImage = selectedImage;
      }
      
      // Si l'utilisateur est un PDG et a un groupe assigné
      if (editingUser.role === 'PDG' && editingUser.group) {
        // Trouver toutes les entreprises du groupe
        const groupCompanies = companies.filter(c => c.group === editingUser.group);
        
        // Pour chaque entreprise du groupe, s'assurer qu'elle a le bon groupe assigné
        for (const company of groupCompanies) {
          if (company.group !== editingUser.group) {
            await updateCompany(company.id, { 
              ...company, 
              group: editingUser.group 
            });
          }
        }
        
        // Si l'entreprise de l'utilisateur n'est pas dans le groupe, l'ajouter
        const userCompany = companies.find(c => c.name === editingUser.company);
        if (userCompany && userCompany.group !== editingUser.group) {
          await updateCompany(userCompany.id, { 
            ...userCompany, 
            group: editingUser.group 
          });
        }
      }

      await updateUser(editingUser.id, updateData);
      await fetchInitialData(); // Refresh data
      
      // Reset form and close modal
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      setSelectedImage(null);
      setIsPowerBiHtml(false);
      setEditCompanyPowerBiUrls({});
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /**
   * Handle user deletion with confirmation
   * 
   * @param userId - ID of user to delete
   */
  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        setError(null);
        await deleteUser(userId);
        await fetchInitialData(); // Refresh data
      } catch (err) {
        setError((err as Error).message);
      }
    }
  };

  /**
   * Open user edit modal with user data
   * 
   * @param user - User to edit
   */
  const openEditUserModal = (user: User) => {
    setEditingUser({ ...user }); // Clone to avoid direct state mutation
    setIsPowerBiHtml(user.powerBiUrl ? isHtmlContent(user.powerBiUrl) : false);
    
    // Load company-specific Power BI URLs if user is PDG with a group
    if (user.role === 'PDG' && user.group) {
      const groupCompanies = companies.filter(c => c.group === user.group);
      
      // Only if there are companies in the group
      if (groupCompanies.length > 0 && user.powerBiUrl) {
        try {
          // Try to parse the JSON string of company URLs
          const urls = JSON.parse(user.powerBiUrl);
          setEditCompanyPowerBiUrls(urls);
        } catch (e) {
          // If not valid JSON, initialize with empty values
          const urls = groupCompanies.reduce((acc, company) => ({
            ...acc,
            [company.name]: ''
          }), {});
          setEditCompanyPowerBiUrls(urls);
        }
      }
    }
    
    setIsEditUserModalOpen(true);
  };

  /**
   * Handle selecting a profile image from the file input
   * 
   * @param e - File input change event
   */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  /**
   * Toggle between URL and HTML mode for Power BI content
   */
  const togglePowerBiMode = () => {
    setIsPowerBiHtml(!isPowerBiHtml);
    if (editingUser) {
      setEditingUser({
        ...editingUser,
        powerBiUrl: ''
      });
    }
  };

  // =============== Company CRUD Operations ===============
  
  /**
   * Update all setEditingCompany calls to include allowedIps
   */
  const resetEditingCompany = () => {
    setEditingCompany({ allowedIps: [] });
    setCompanyLogo(null);
  };

  /**
   * Handle selecting a company logo
   */
  const handleCompanyLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setCompanyLogo(e.target.files[0]);
    }
  };

  /**
   * Handle company creation form submission
   * 
   * @param e - Form submission event
   */
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      
      // Validate required fields
      if (!editingCompany?.name) {
        throw new Error('Le nom de l\'entreprise est obligatoire');
      }

      // Validate IP addresses if provided
      if (editingCompany.allowedIps.some(ip => !isValidIpAddress(ip))) {
        throw new Error('Format d\'adresse IP invalide');
      }

      const companyDataToCreate = {
        name: editingCompany.name,
        allowedIps: editingCompany.allowedIps,
        group: editingCompany.group || '' // Explicitly set empty string if no group
      };

      // Pass the logo file to createCompany function
      await createCompany(companyDataToCreate, companyLogo || undefined);
      
      await fetchInitialData(); // Refresh data
      
      // Reset form and close modal
      setIsCompanyModalOpen(false);
      resetEditingCompany();
      setNewIpAddress('');
      setCompanyLogo(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /**
   * Handle company editing form submission
   * 
   * @param e - Form submission event
   */
  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany?.id) return;

    try {
      setError(null);
      
      // Validate IP addresses if provided
      if (editingCompany.allowedIps.some(ip => !isValidIpAddress(ip))) {
        throw new Error('Format d\'adresse IP invalide');
      }
      
      const originalCompany = companies.find(c => c.id === editingCompany.id);
      const groupChanged = originalCompany?.group !== editingCompany.group;
      
      // Create update data with logo if provided
      const updateData: UpdateCompanyData = {
        name: editingCompany.name,
        allowedIps: editingCompany.allowedIps,
        group: editingCompany.group || '', // Explicitly set empty string if no group
        logo: companyLogo || undefined
      };
      
      await updateCompany(editingCompany.id, updateData);
      await fetchInitialData(); // Refresh data
      
      // Reset form and close modal
      setIsEditCompanyModalOpen(false);
      resetEditingCompany();
      setNewIpAddress('');
      setCompanyLogo(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /**
   * Handle company deletion with confirmation
   * 
   * @param companyId - ID of company to delete
   */
  const handleDeleteCompany = async (companyId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette entreprise ?')) {
      try {
        setError(null);
        await deleteCompany(companyId);
        await fetchInitialData(); // Refresh data
      } catch (err) {
        setError((err as Error).message);
      }
    }
  };

  /**
   * Open company edit modal with company data
   * 
   * @param company - Company to edit
   */
  const openEditCompanyModal = (company: Company) => {
    setEditingCompany({ 
      ...company,
      allowedIps: company.allowedIps || [] 
    });
    setCompanyLogo(null);
    setIsEditCompanyModalOpen(true);
  };

  /**
   * Handle selecting a group logo
   */
  const handleGroupLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setGroupLogo(e.target.files[0]);
    }
  };

  /**
   * Open group logo modal
   * 
   * @param groupName - Group to update logo for
   */
  const openGroupLogoModal = (groupName: string) => {
    setSelectedGroupForLogo(groupName);
    setGroupLogo(null);
    setIsGroupLogoModalOpen(true);
  };

  /**
   * Handle group logo update submission
   */
  const handleUpdateGroupLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      
      if (!selectedGroupForLogo) {
        throw new Error("Aucun groupe sélectionné");
      }
      
      if (!groupLogo) {
        throw new Error("Veuillez sélectionner une image de logo");
      }
      
      await updateGroupLogo(selectedGroupForLogo, groupLogo);
      await fetchInitialData(); // Refresh data
      
      setIsGroupLogoModalOpen(false);
      setSelectedGroupForLogo('');
      setGroupLogo(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /**
   * Get the appropriate role badge styling
   * @param role - User role
   * @returns CSS class string for role badge
   */
  const getRoleBadgeStyle = (role: User['role']) => {
    switch (role) {
      case 'Admin':
        return isDark 
          ? 'bg-teal-900/40 text-teal-300 border border-teal-700/50' 
          : 'bg-teal-100 text-teal-800 border border-teal-200';
      case 'PDG':
        return isDark 
          ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50' 
          : 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'Dirigeant':
        return isDark 
          ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50' 
          : 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Employé':
      default:
        return isDark 
          ? 'bg-gray-800/90 text-gray-300 border border-gray-700/50' 
          : 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  /**
   * Ajoute un nouveau groupe s'il n'existe pas déjà
   */
  const handleAddGroup = () => {
    if (!newGroup.trim()) return;
    
    if (!groups.includes(newGroup)) {
      setGroups([...groups, newGroup]);
    }
    
    setNewGroup('');
  };

  /**
   * Handle password reset for a user
   * 
   * @param email - Email of the user to reset password for
   */
  // const handleResetPassword = async (email: string) => {
  //   try {
  //     setError(null);
  //     await sendPasswordResetEmail(email);
  //     alert('Un email de réinitialisation a été envoyé à ' + email);
  //   } catch (err) {
  //     setError((err as Error).message);
  //   }
  // };

  // =============== Component Rendering ===============
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* User Management Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-color" />
            <input
              type="search"
              value={searchUserTerm}
              onChange={(e) => setSearchUserTerm(e.target.value)}
              placeholder="Rechercher des utilisateurs..."
              className="pl-10 pr-4 py-2 bg-theme border border-theme rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={Filter}
              onClick={() => updateFilter('role', filters.role ? '' : 'Admin')}
            >
              Filtres
            </Button>
            
            <Button 
              variant="primary"
              icon={Plus}
              onClick={() => setIsUserModalOpen(true)}
            >
              Ajouter un utilisateur
            </Button>
          </div>
        </div>

        {/* Advanced filters */}
        <AnimatePresence>
          {(filters.role || filters.company || filters.group) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-card p-4 rounded-lg space-y-4 border border-theme"
            >
              <div className="flex flex-wrap gap-4">
                <select
                  value={filters.role}
                  onChange={(e) => updateFilter('role', e.target.value)}
                  className="px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                >
                  <option value="">Tous les rôles</option>
                  <option value="PDG">PDG</option>
                  <option value="Dirigeant">Dirigeant</option>
                  <option value="Employé">Employé</option>
                  <option value="Admin">Admin</option>
                </select>
                
                <select
                  value={filters.company}
                  onChange={(e) => updateFilter('company', e.target.value)}
                  className="px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                >
                  <option value="">Toutes les entreprises</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.name}>{company.name}</option>
                  ))}
                </select>
                
                <select
                  value={filters.group || ''}
                  onChange={(e) => updateFilter('group', e.target.value)}
                  className="px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                >
                  <option value="">Tous les groupes</option>
                  {groups.map((group, idx) => (
                    <option key={idx} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-500/20">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-theme">
          <div className="p-6 border-b border-theme">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold gradient-text">Utilisateurs</h2>
                <p className="text-sm text-secondary-color">Gérer les comptes utilisateurs</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-secondary-color">
              <div className="flex justify-center mb-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
              <p>Chargement des utilisateurs...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-theme">
                <thead className="bg-card">
                  <tr>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider cursor-pointer ${isDark ? '' : 'hover:bg-theme'}`}
                      onClick={() => toggleUserSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Nom
                        {userSortConfig.key === 'name' && (
                          userSortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4 text-primary" /> : <SortDesc className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                      Entreprise
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                      Groupe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                      Rôle
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider cursor-pointer ${isDark ? '' : 'hover:bg-theme'}`}
                      onClick={() => toggleUserSort('lastLogin')}
                    >
                      <div className="flex items-center gap-2">
                        Dernière Connexion
                        {userSortConfig.key === 'lastLogin' && (
                          userSortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4 text-primary" /> : <SortDesc className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                      Power BI
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-secondary-color uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-theme">
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-secondary-color">
                        Aucun utilisateur trouvé
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((user) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        whileHover={{ backgroundColor: isDark ? 'rgba(26, 27, 30, 0.8)' : 'rgba(249, 250, 251, 0.5)' }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-color">
                          <div className="flex items-center">
                            {user.profileImageUrl && (
                              <img
                                src={user.profileImageUrl}
                                alt={user.name}
                                className="w-8 h-8 rounded-full mr-3 object-cover"
                              />
                            )}
                            <span>{user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-color">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-color">
                          <div className="flex items-center">
                            {companies.find(c => c.name === user.company)?.logoUrl && (
                              <img 
                                src={companies.find(c => c.name === user.company)?.logoUrl} 
                                alt={user.company} 
                                className="w-6 h-6 rounded-full mr-2 object-contain"
                              />
                            )}
                            <span>{user.company}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-color">
                          {user.group ? (
                            <div className="flex items-center gap-1 text-primary">
                              {getGroupLogoUrl(user.group) ? (
                                <img 
                                  src={getGroupLogoUrl(user.group)} 
                                  alt={user.group} 
                                  className="w-6 h-6 rounded-full mr-1 object-contain" 
                                />
                              ) : (
                                <LayoutGrid className="w-4 h-4 mr-1" />
                              )}
                              <span>{user.group}</span>
                            </div>
                          ) : (
                            <span className="text-secondary-color">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeStyle(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-color">
                          <div className="flex items-center gap-2">
                            {formatDate(user.lastLogin)}
                            {new Date().getTime() - new Date(user.lastLogin).getTime() > 7 * 24 * 60 * 60 * 1000 && (
                              <AlertCircle 
                                className="w-4 h-4 text-amber-500" 
                                aria-label="Aucune connexion depuis plus de 7 jours" 
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(() => {
                            const urlCount = [user.powerBiUrl, user.powerBiUrl2].filter(Boolean).length;
                            
                            if (urlCount > 0) {
                              return (
                                <div className="flex items-center gap-1 text-primary">
                                  <LayoutGrid className="w-4 h-4" />
                                  <span>{urlCount} URL{urlCount > 1 ? 's' : ''}</span>
                                </div>
                              );
                            } else if (user.powerBiUrl) {
                              // Check for legacy formats
                              try {
                                const parsed = JSON.parse(user.powerBiUrl);
                                if (Array.isArray(parsed)) {
                                  return (
                                    <div className="flex items-center gap-1 text-primary">
                                      <LayoutGrid className="w-4 h-4" />
                                      <span>{parsed.length} dashboard{parsed.length > 1 ? 's' : ''}</span>
                                    </div>
                                  );
                                } else if (typeof parsed === 'object') {
                                  const count = Object.keys(parsed).length;
                                  return (
                                    <div className="flex items-center gap-1 text-primary">
                                      <Building2 className="w-4 h-4" />
                                      <span>{count} entreprise{count > 1 ? 's' : ''}</span>
                                    </div>
                                  );
                                }
                              } catch {
                                // Single URL/HTML
                                return (
                                  <div className="flex items-center gap-1 text-primary">
                                    {isHtmlContent(user.powerBiUrl) ? (
                                      <Code className="w-4 h-4" />
                                    ) : (
                                      <Link className="w-4 h-4" />
                                    )}
                                    <span>Configuré</span>
                                  </div>
                                );
                              }
                            }
                            
                            return <span className="text-secondary-color">Non configuré</span>;
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {/* <button 
                            onClick={() => handleResetPassword(user.email)}
                            className={`text-primary ${isDark ? '' : 'hover:text-primary-hover'} mr-3`}
                            aria-label={`Réinitialiser le mot de passe de ${user.name}`}
                          >
                            <Key className="w-4 h-4" />
                          </button> */}
                          
                          <button 
                            onClick={() => openEditUserModal(user)}
                            className={`text-primary ${isDark ? '' : 'hover:text-primary-hover'} mr-3`}
                            aria-label={`Modifier ${user.name}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className={`text-red-500 ${isDark ? '' : 'hover:text-red-700'} dark:text-red-400`}
                            aria-label={`Supprimer ${user.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Company Management Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-color" />
            <input
              type="search"
              value={searchCompanyTerm}
              onChange={(e) => setSearchCompanyTerm(e.target.value)}
              placeholder="Rechercher des entreprises..."
              className="pl-10 pr-4 py-2 bg-theme border border-theme rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
            />
          </div>
          <div className="flex gap-2">
            {filters.group ? (
              <Button 
                variant="outline"
                icon={X}
                onClick={() => updateFilter('group', '')}
              >
                Effacer le filtre de groupe
              </Button>
            ) : (
              <select
                value={filters.group || ''}
                onChange={(e) => updateFilter('group', e.target.value)}
                className="px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              >
                <option value="">Tous les groupes</option>
                {groups.map((group, idx) => (
                  <option key={idx} value={group}>{group}</option>
                ))}
              </select>
            )}
            
            <Button 
              variant="primary"
              icon={Plus}
              onClick={() => {
                resetEditingCompany();
                setIsCompanyModalOpen(true);
              }}
            >
              Ajouter une entreprise
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-theme">
          <div className="p-6 border-b border-theme">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Building2 className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold gradient-text">Entreprises</h2>
                <p className="text-sm text-secondary-color">Gérer les entreprises, les groupes et leurs logos</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-theme">
              <thead className="bg-card">
                <tr>
                  <th 
                    className={`px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider cursor-pointer ${isDark ? '' : 'hover:bg-theme'}`}
                    onClick={() => toggleCompanySort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Nom de l'entreprise
                      {companySortConfig.key === 'name' && (
                        companySortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4 text-primary" /> : <SortDesc className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                    Logo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                    Groupe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                    Logo du groupe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">
                    Adresses IP autorisées
                  </th>
                  <th 
                    className={`px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider cursor-pointer ${isDark ? '' : 'hover:bg-theme'}`}
                    onClick={() => toggleCompanySort('createdAt')}
                  >
                    <div className="flex items-center gap-2">
                      Date de création
                      {companySortConfig.key === 'createdAt' && (
                        companySortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4 text-primary" /> : <SortDesc className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-secondary-color uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-theme">
                {sortedCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-secondary-color">
                      Aucune entreprise trouvée
                    </td>
                  </tr>
                ) : (
                  sortedCompanies.map((company) => (
                    <motion.tr
                      key={company.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      whileHover={{ backgroundColor: isDark ? 'rgba(26, 27, 30, 0.8)' : 'rgba(249, 250, 251, 0.5)' }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-primary-color">{company.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {company.logoUrl ? (
                          <img 
                            src={company.logoUrl} 
                            alt={`Logo ${company.name}`} 
                            className="w-10 h-10 rounded-full object-contain border border-theme" 
                          />
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            icon={Image}
                            onClick={() => openEditCompanyModal(company)}
                          >
                            Ajouter
                          </Button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-color">
                        {company.group ? (
                          <div className="flex items-center gap-1 text-primary">
                            <LayoutGrid className="w-4 h-4 mr-1" />
                            <span>{company.group}</span>
                          </div>
                        ) : (
                          <span className="text-secondary-color">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {company.group ? (
                          getGroupLogoUrl(company.group) ? (
                            <div className="flex items-center gap-2">
                              <img 
                                src={getGroupLogoUrl(company.group)} 
                                alt={`Logo ${company.group}`}
                                className="w-10 h-10 rounded-full object-contain border border-theme" 
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                icon={Edit2}
                                onClick={() => openGroupLogoModal(company.group!)}
                              >
                                Modifier
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              icon={Image}
                              onClick={() => openGroupLogoModal(company.group!)}
                            >
                              Ajouter
                            </Button>
                          )
                        ) : (
                          <span className="text-secondary-color">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-primary-color">
                          {company.allowedIps?.length > 0 ? (
                            <div className="space-y-1">
                              {company.allowedIps.map((ip, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <span>{ip}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-secondary-color">Non définie</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-color">
                        {formatDate(company.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => openEditCompanyModal(company)}
                          className={`text-primary ${isDark ? '' : 'hover:text-primary-hover'} mr-3`}
                          aria-label={`Modifier ${company.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCompany(company.id)}
                          className={`text-red-500 ${isDark ? '' : 'hover:text-red-700'} dark:text-red-400`}
                          aria-label={`Supprimer ${company.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setNewUser({});
          setCompanyPowerBiUrls({});
        }}
        title="Ajouter un nouvel utilisateur "
        size="md"
      >
        <form onSubmit={handleCreateUser} className="flex flex-col h-[calc(85vh-80px)]">
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            
          <div>
              <label className="block text-sm font-medium text-primary-color mb-1">Rôle</label>
              <select
                value={newUser.role || ''}
                onChange={(e) => {
                  const role = e.target.value as User['role'];
                  let updatedUser = { ...newUser, role };
                  
                  // Si l'utilisateur n'est pas un PDG, on vérifie si son entreprise a un groupe
                  if (role !== 'PDG' && newUser.company) {
                    const selectedCompany = companies.find(c => c.name === newUser.company);
                    if (selectedCompany?.group) {
                      updatedUser.group = selectedCompany.group;
                    } else {
                      // Si l'entreprise n'a pas de groupe, on supprime le groupe de l'utilisateur
                      delete updatedUser.group;
                    }
                  }
                  
                  setNewUser(updatedUser);
                }}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                required
              >
                <option value="">Sélectionner un rôle</option>
                <option value="PDG">PDG</option>
                <option value="Dirigeant">Dirigeant</option>
                <option value="Employé">Employé</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">Email</label>
              <input
                type="email"
                value={newUser.email || ''}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                required
              />
            </div>

           {newUser.role === 'Admin' && <div>
              <label className="block text-sm font-medium text-primary-color mb-1">Mot de passe</label>
              <input
                type="password"
                value={newUser.password || ''}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                required
                minLength={8}
              />
              <p className="mt-1 text-xs text-secondary-color">
                Le mot de passe doit comporter au moins 8 caractères
              </p>
            </div>}

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">Nom</label>
              <input
                type="text"
                value={newUser.name || ''}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">Entreprise</label>
              <select
                value={newUser.company || ''}
                onChange={(e) => {
                  const selectedCompany = companies.find(c => c.name === e.target.value);
                  let updatedUser = { ...newUser, company: e.target.value };
                  
                  // Si l'utilisateur n'est pas un PDG et que l'entreprise a un groupe,
                  // on attribue automatiquement ce groupe à l'utilisateur
                  if (updatedUser.role && updatedUser.role !== 'PDG' && selectedCompany?.group) {
                    updatedUser.group = selectedCompany.group;
                  }
                  
                  setNewUser(updatedUser);
                }}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                required
              >
                <option value="">Sélectionner une entreprise</option>
                {companies.map(company => (
                  <option key={company.id} value={company.name}>{company.name}</option>
                ))}
              </select>
            </div>

            {/* Champ de groupe - visible uniquement pour les PDG ou si l'entreprise est dans un groupe */}
            {(newUser.role === 'PDG' || 
              (newUser.company && companies.find(c => c.name === newUser.company)?.group)) && (
              <div>
                <label className="block text-sm font-medium text-primary-color mb-1">
                  Groupe d'entreprises
                </label>
                <div className="flex gap-2">
                  <select
                    value={newUser.group || ''}
                    onChange={(e) => setNewUser({ ...newUser, group: e.target.value })}
                    className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                  >
                    <option value="">Sélectionner un groupe</option>
                    {groups.map((group, idx) => (
                      <option key={idx} value={group}>{group}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const group = prompt('Nom du nouveau groupe:');
                      if (group && !groups.includes(group)) {
                        setGroups([...groups, group]);
                        setNewUser({ ...newUser, group });
                      }
                    }}
                  >
                    Nouveau
                  </Button>
                </div>
                {newUser.role !== 'PDG' && (
                  <p className="mt-1 text-xs text-secondary-color">
                    {newUser.company && companies.find(c => c.name === newUser.company)?.group ? 
                      `Le groupe est hérité de l'entreprise` : 
                      `Ce champ est généralement réservé aux PDG`}
                  </p>
                )}
              </div>
            )}

            {/* Power BI URLs Section */}
            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                URL Power BI 1 (optionnel)
              </label>
              <input
                type="url"
                value={newUser.powerBiUrl || ''}
                onChange={(e) => setNewUser({ ...newUser, powerBiUrl: e.target.value })}
                placeholder="https://app.powerbi.com/..."
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                URL Power BI 2 (optionnel)
              </label>
              <input
                type="url"
                value={newUser.powerBiUrl2 || ''}
                onChange={(e) => setNewUser({ ...newUser, powerBiUrl2: e.target.value })}
                placeholder="https://app.powerbi.com/..."
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              />
              <p className="mt-1 text-xs text-secondary-color">
                URLs d'intégration des tableaux de bord Power BI (utilisez l'option "Publier sur le web")
              </p>
            </div>



            {/* Show company Power BI URLs section only for PDG with selected group that has companies */}
            {newUser.role === 'PDG' && newUser.group && 
              companies.filter(c => c.group === newUser.group).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-primary-color">
                  URLs Power BI des entreprises du groupe
                </h3>
                <p className="text-sm text-secondary-color">
                  Veuillez fournir une URL Power BI pour chaque entreprise du groupe
                </p>
                {companies
                  .filter(company => company.group === newUser.group)
                  .map(company => (
                    <div key={company.id}>
                      <label className="block text-sm font-medium text-primary-color mb-1">
                        {company.name}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={companyPowerBiUrls[company.name] || ''}
                          onChange={(e) => setCompanyPowerBiUrls(prev => ({
                            ...prev,
                            [company.name]: e.target.value
                          }))}
                          placeholder="https://app.powerbi.com/..."
                          className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={isPowerBiHtml ? Link : Code}
                          onClick={() => {
                            const currentValue = companyPowerBiUrls[company.name] || '';
                            const isCurrentHtml = isHtmlContent(currentValue);
                            if (isCurrentHtml) {
                              // Extract URL from HTML
                              const srcMatch = currentValue.match(/src=["'](.*?)["']/i);
                              if (srcMatch && srcMatch[1]) {
                                setCompanyPowerBiUrls(prev => ({
                                  ...prev,
                                  [company.name]: srcMatch[1]
                                }));
                              }
                            } else {
                              // Convert to HTML
                              setCompanyPowerBiUrls(prev => ({
                                ...prev,
                                [company.name]: `<iframe src="${currentValue}" frameborder="0" allowFullScreen="true"></iframe>`
                              }));
                            }
                          }}
                        >
                          {isPowerBiHtml ? "URL" : "HTML"}
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-theme">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsUserModalOpen(false);
                setNewUser({});
                setCompanyPowerBiUrls({});
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Créer l'utilisateur
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditUserModalOpen}
        onClose={() => {
          setIsEditUserModalOpen(false);
          setEditingUser(null);
          setSelectedImage(null);
          setIsPowerBiHtml(false);
          setEditCompanyPowerBiUrls({});
        }}
        title="Modifier l'utilisateur"
        size="md"
      >
        {editingUser && (
          <form onSubmit={handleEditUser} className="flex flex-col h-[calc(85vh-80px)]">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-color mb-1">Nom</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-color mb-1">Entreprise</label>
                <select
                  value={editingUser.company}
                  onChange={(e) => {
                    const selectedCompany = companies.find(c => c.name === e.target.value);
                    let updatedUser = { ...editingUser, company: e.target.value };
                    
                    // Si l'utilisateur n'est pas un PDG et que l'entreprise a un groupe,
                    // on attribue automatiquement ce groupe à l'utilisateur
                    if (updatedUser.role !== 'PDG' && selectedCompany?.group) {
                      updatedUser.group = selectedCompany.group;
                    } else if (updatedUser.role !== 'PDG') {
                      // Si l'entreprise n'a pas de groupe et que l'utilisateur n'est pas PDG,
                      // on supprime le groupe de l'utilisateur
                      delete updatedUser.group;
                    }
                    
                    setEditingUser(updatedUser);
                  }}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                  required
                >
                  {companies.map(company => (
                    <option key={company.id} value={company.name}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-color mb-1">Rôle</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => {
                    const role = e.target.value as User['role'];
                    let updatedUser = { ...editingUser, role };
                    
                    // Si l'utilisateur change de PDG à non-PDG, on vérifie si son entreprise a un groupe
                    if (editingUser.role === 'PDG' && role !== 'PDG') {
                      const selectedCompany = companies.find(c => c.name === editingUser.company);
                      if (selectedCompany?.group) {
                        updatedUser.group = selectedCompany.group;
                      } else {
                        // Si l'entreprise n'a pas de groupe et que l'utilisateur n'est plus PDG,
                        // on supprime le groupe de l'utilisateur
                        delete updatedUser.group;
                      }
                    }
                    
                    setEditingUser(updatedUser);
                  }}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                  required
                >
                  <option value="PDG">PDG</option>
                  <option value="Dirigeant">Dirigeant</option>
                  <option value="Employé">Employé</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {/* Champ de groupe - visible uniquement pour les PDG ou si l'entreprise est dans un groupe */}
              {(editingUser.role === 'PDG' || 
                (editingUser.company && companies.find(c => c.name === editingUser.company)?.group)) && (
                <div>
                  <label className="block text-sm font-medium text-primary-color mb-1">
                    Groupe d'entreprises
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={editingUser.group || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, group: e.target.value || undefined })}
                      className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                    >
                      <option value="">Aucun groupe</option>
                      {groups.map((group, idx) => (
                        <option key={idx} value={group}>{group}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const group = prompt('Nom du nouveau groupe:');
                        if (group && !groups.includes(group)) {
                          setGroups([...groups, group]);
                          setEditingUser({ ...editingUser, group });
                        }
                      }}
                    >
                      Nouveau
                    </Button>
                  </div>
                  {editingUser.role !== 'PDG' && (
                    <p className="mt-1 text-xs text-secondary-color">
                      {editingUser.company && companies.find(c => c.name === editingUser.company)?.group ? 
                        `Le groupe est hérité de l'entreprise` : 
                        `Ce champ est généralement réservé aux PDG`}
                    </p>
                  )}
                </div>
              )}

              {/* Power BI URLs Section */}
              <div>
                <label className="block text-sm font-medium text-primary-color mb-1">
                  URL Power BI 1 (optionnel)
                </label>
                <input
                  type="url"
                  value={editingUser.powerBiUrl || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, powerBiUrl: e.target.value })}
                  placeholder="https://app.powerbi.com/..."
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-color mb-1">
                  URL Power BI 2 (optionnel)
                </label>
                <input
                  type="url"
                  value={editingUser.powerBiUrl2 || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, powerBiUrl2: e.target.value })}
                  placeholder="https://app.powerbi.com/..."
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                />
              </div>

              <p className="mt-1 text-xs text-secondary-color">
                URLs d'intégration des tableaux de bord Power BI (utilisez l'option "Publier sur le web")
              </p>



              {/* Show Power BI URL field only if:
                  - User is not PDG, OR
                  - User is PDG but no group is selected, OR
                  - User is PDG with a group but the group has no companies */}
              {(editingUser.role !== 'PDG' || 
                !editingUser.group || 
                companies.filter(c => c.group === editingUser.group).length === 0) && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-primary-color">
                      {isPowerBiHtml ? "Code HTML Power BI" : "URL Power BI"}
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      icon={isPowerBiHtml ? Link : Code}
                      onClick={togglePowerBiMode}
                    >
                      {isPowerBiHtml ? "Utiliser une URL" : "Utiliser du HTML"}
                    </Button>
                  </div>

                  {isPowerBiHtml ? (
                    <textarea
                      value={editingUser.powerBiUrl || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, powerBiUrl: e.target.value })}
                      placeholder="<iframe src='https://app.powerbi.com/...'></iframe>"
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                      rows={6}
                    />
                  ) : (
                    <input
                      type="url"
                      value={editingUser.powerBiUrl || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, powerBiUrl: e.target.value })}
                      placeholder="https://app.powerbi.com/..."
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                    />
                  )}
                  
                  <p className="mt-1 text-xs text-secondary-color">
                    {isPowerBiHtml 
                      ? "Code HTML complet pour l'intégration du tableau de bord Power BI" 
                      : "Pour les rapports 'Publier sur le web', utilisez l'URL d'intégration Power BI"}
                  </p>
                  
                  <p className="mt-1 text-xs text-primary">
                    Astuce: Dans Power BI, utilisez "Fichier &gt; Publier sur le web" pour obtenir un code d'intégration, puis extrayez l'URL de l'attribut "src" du code iframe.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-primary-color mb-1">Image de profil</label>
                <div className="flex items-center gap-3">
                  {editingUser.profileImageUrl && (
                    <img
                      src={editingUser.profileImageUrl}
                      alt={editingUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-theme"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    icon={Upload}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choisir une image
                  </Button>
                  {selectedImage && (
                    <span className="text-sm text-secondary-color">{selectedImage.name}</span>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Show company Power BI URLs section only for PDG with selected group that has companies */}
              {editingUser.role === 'PDG' && editingUser.group && 
                companies.filter(c => c.group === editingUser.group).length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-primary-color">
                    URLs Power BI des entreprises du groupe
                  </h3>
                  <p className="text-sm text-secondary-color">
                    Veuillez fournir une URL Power BI pour chaque entreprise du groupe
                  </p>
                  {companies
                    .filter(company => company.group === editingUser.group)
                    .map(company => (
                      <div key={company.id}>
                        <label className="block text-sm font-medium text-primary-color mb-1">
                          {company.name}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={editCompanyPowerBiUrls[company.name] || ''}
                            onChange={(e) => setEditCompanyPowerBiUrls(prev => ({
                              ...prev,
                              [company.name]: e.target.value
                            }))}
                            placeholder="https://app.powerbi.com/..."
                            className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            icon={isPowerBiHtml ? Link : Code}
                            onClick={() => {
                              const currentValue = editCompanyPowerBiUrls[company.name] || '';
                              const isCurrentHtml = isHtmlContent(currentValue);
                              if (isCurrentHtml) {
                                // Extract URL from HTML
                                const srcMatch = currentValue.match(/src=["'](.*?)["']/i);
                                if (srcMatch && srcMatch[1]) {
                                  setEditCompanyPowerBiUrls(prev => ({
                                    ...prev,
                                    [company.name]: srcMatch[1]
                                  }));
                                }
                              } else {
                                // Convert to HTML
                                setEditCompanyPowerBiUrls(prev => ({
                                  ...prev,
                                  [company.name]: `<iframe src="${currentValue}" frameborder="0" allowFullScreen="true"></iframe>`
                                }));
                              }
                            }}
                          >
                            {isPowerBiHtml ? "URL" : "HTML"}
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-theme">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditUserModalOpen(false);
                  setEditingUser(null);
                  setSelectedImage(null);
                  setIsPowerBiHtml(false);
                  setEditCompanyPowerBiUrls({});
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
              >
                Enregistrer les modifications
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Company Modal */}
      <Modal
        isOpen={isCompanyModalOpen}
        onClose={() => {
          setIsCompanyModalOpen(false);
          resetEditingCompany();
          setNewIpAddress('');
          setCompanyLogo(null);
        }}
        title="Ajouter une nouvelle entreprise"
        size="md"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-color mb-1">Nom de l'entreprise</label>
            <input
              type="text"
              value={editingCompany?.name || ''}
              onChange={(e) => setEditingCompany(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-color mb-1">
              Logo de l'entreprise (optionnel)
            </label>
            <div className="flex items-center gap-3">
              {companyLogo && (
                <div className="w-16 h-16 rounded-full border border-theme flex items-center justify-center overflow-hidden bg-white">
                  <img
                    src={URL.createObjectURL(companyLogo)}
                    alt="Aperçu du logo"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                icon={Upload}
                onClick={() => companyLogoInputRef.current?.click()}
              >
                {companyLogo ? "Changer le logo" : "Ajouter un logo"}
              </Button>
              {companyLogo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={X}
                  onClick={() => setCompanyLogo(null)}
                >
                  Supprimer
                </Button>
              )}
            </div>
            <input
              type="file"
              ref={companyLogoInputRef}
              onChange={handleCompanyLogoSelect}
              accept="image/*"
              className="hidden"
            />
            <p className="mt-1 text-xs text-secondary-color">
              Images recommandées : format carré, minimum 200x200px, formats PNG ou SVG pour la transparence
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-color mb-1">
              Groupe d'entreprises (optionnel)
            </label>
            <div className="flex gap-2">
              <select
                value={editingCompany?.group || ''}
                onChange={(e) => setEditingCompany(prev => ({ ...prev, group: e.target.value || undefined }))}
                className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              >
                <option value="">Aucun groupe</option>
                {groups.map((group, idx) => (
                  <option key={idx} value={group}>{group}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const group = prompt('Nom du nouveau groupe:');
                  if (group && group.trim() && !groups.includes(group)) {
                    setGroups([...groups, group]);
                    setEditingCompany(prev => ({ ...prev, group }));
                  }
                }}
              >
                Nouveau
              </Button>
            </div>
            <p className="mt-1 text-xs text-secondary-color">
              Associez cette entreprise à un groupe pour faciliter la gestion des utilisateurs
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-color mb-1">
              Adresses IP autorisées (optionnel)
            </label>
            <div className="space-y-2">
              {editingCompany?.allowedIps?.map((ip, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => {
                      const newIps = [...(editingCompany.allowedIps || [])];
                      newIps[index] = e.target.value;
                      setEditingCompany(prev => ({ ...prev, allowedIps: newIps }));
                    }}
                    className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                    placeholder="ex: 192.168.1.1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={X}
                    onClick={() => {
                      const newIps = [...(editingCompany.allowedIps || [])];
                      newIps.splice(index, 1);
                      setEditingCompany(prev => ({ ...prev, allowedIps: newIps }));
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              ))}
              
              {(!editingCompany?.allowedIps || editingCompany.allowedIps.length < 3) && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newIpAddress}
                    onChange={(e) => setNewIpAddress(e.target.value)}
                    className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                    placeholder="ex: 192.168.1.1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={() => {
                      if (newIpAddress && isValidIpAddress(newIpAddress)) {
                        setEditingCompany(prev => ({
                          ...prev,
                          allowedIps: [...(prev?.allowedIps || []), newIpAddress]
                        }));
                        setNewIpAddress('');
                      }
                    }}
                  >
                    Ajouter
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-secondary-color">
              Limite l'accès des employés à ces adresses IP uniquement (maximum 3)
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCompanyModalOpen(false);
                resetEditingCompany();
                setNewIpAddress('');
                setCompanyLogo(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Créer l'entreprise
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Company Modal */}
      <Modal
        isOpen={isEditCompanyModalOpen}
        onClose={() => {
          setIsEditCompanyModalOpen(false);
          resetEditingCompany();
          setNewIpAddress('');
          setCompanyLogo(null);
        }}
        title="Modifier l'entreprise"
        size="md"
      >
        {editingCompany && (
          <form onSubmit={handleUpdateCompany} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">Nom de l'entreprise</label>
              <input
                type="text"
                value={editingCompany.name || ''}
                onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                Logo de l'entreprise (optionnel)
              </label>
              <div className="flex items-center gap-3">
                {!companyLogo && editingCompany.logoUrl && (
                  <div className="w-16 h-16 rounded-full border border-theme flex items-center justify-center overflow-hidden bg-white">
                    <img
                      src={editingCompany.logoUrl}
                      alt="Logo actuel"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                {companyLogo && (
                  <div className="w-16 h-16 rounded-full border border-theme flex items-center justify-center overflow-hidden bg-white">
                    <img
                      src={URL.createObjectURL(companyLogo)}
                      alt="Aperçu du logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  icon={Upload}
                  onClick={() => companyLogoInputRef.current?.click()}
                >
                  {editingCompany.logoUrl || companyLogo ? "Changer le logo" : "Ajouter un logo"}
                </Button>
                {(editingCompany.logoUrl || companyLogo) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={X}
                    onClick={() => {
                      setCompanyLogo(null);
                      if (editingCompany.logoUrl) {
                        setEditingCompany({
                          ...editingCompany,
                          logoUrl: undefined
                        });
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
              <input
                type="file"
                ref={companyLogoInputRef}
                onChange={handleCompanyLogoSelect}
                accept="image/*"
                className="hidden"
              />
              <p className="mt-1 text-xs text-secondary-color">
                Images recommandées : format carré, minimum 200x200px, formats PNG ou SVG pour la transparence
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                Groupe d'entreprises (optionnel)
              </label>
              <div className="flex gap-2">
                <select
                  value={editingCompany?.group || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, group: e.target.value || undefined })}
                  className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                >
                  <option value="">Aucun groupe</option>
                  {groups.map((group, idx) => (
                    <option key={idx} value={group}>{group}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const group = prompt('Nom du nouveau groupe:');
                    if (group && group.trim() && !groups.includes(group)) {
                      setGroups([...groups, group]);
                      setEditingCompany({ ...editingCompany, group });
                    }
                  }}
                >
                  Nouveau
                </Button>
              </div>
              <p className="mt-1 text-xs text-secondary-color">
                {editingCompany.group ? 
                  `Les employés de cette entreprise seront automatiquement associés à ce groupe` : 
                  `Associez cette entreprise à un groupe pour faciliter la gestion des utilisateurs`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                Adresses IP autorisées (optionnel)
              </label>
              <div className="space-y-2">
                {editingCompany.allowedIps?.map((ip, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ip}
                      onChange={(e) => {
                        const newIps = [...(editingCompany.allowedIps || [])];
                        newIps[index] = e.target.value;
                        setEditingCompany({ ...editingCompany, allowedIps: newIps });
                      }}
                      className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                      placeholder="ex: 192.168.1.1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={X}
                      onClick={() => {
                        const newIps = [...(editingCompany.allowedIps || [])];
                        newIps.splice(index, 1);
                        setEditingCompany({ ...editingCompany, allowedIps: newIps });
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                ))}
                
                {(!editingCompany.allowedIps || editingCompany.allowedIps.length < 3) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newIpAddress}
                      onChange={(e) => setNewIpAddress(e.target.value)}
                      className="flex-1 px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
                      placeholder="ex: 192.168.1.1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={Plus}
                      onClick={() => {
                        if (newIpAddress && isValidIpAddress(newIpAddress)) {
                          setEditingCompany({
                            ...editingCompany,
                            allowedIps: [...(editingCompany.allowedIps || []), newIpAddress]
                          });
                          setNewIpAddress('');
                        }
                      }}
                    >
                      Ajouter
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-secondary-color">
                Limite l'accès des employés à ces adresses IP uniquement (maximum 3)
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditCompanyModalOpen(false);
                  resetEditingCompany();
                  setNewIpAddress('');
                  setCompanyLogo(null);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
              >
                Enregistrer les modifications
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Group Logo Modal */}
      <Modal
        isOpen={isGroupLogoModalOpen}
        onClose={() => {
          setIsGroupLogoModalOpen(false);
          setSelectedGroupForLogo('');
          setGroupLogo(null);
        }}
        title={`Logo pour le groupe "${selectedGroupForLogo}"`}
        size="sm"
      >
        <form onSubmit={handleUpdateGroupLogo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-color mb-2">
              Logo du groupe
            </label>
            <div className="flex flex-col items-center gap-4">
              {groupLogo ? (
                <div className="relative w-32 h-32 rounded-full border-2 border-theme flex items-center justify-center overflow-hidden bg-white">
                  <img
                    src={URL.createObjectURL(groupLogo)}
                    alt="Aperçu du logo"
                    className="max-w-full max-h-full object-contain"
                  />
                  <button 
                    type="button"
                    onClick={() => setGroupLogo(null)}
                    className={`absolute top-1 right-1 bg-red-500/80 ${isDark ? '' : 'hover:bg-red-500'} text-white rounded-full p-1`}
                    aria-label="Supprimer l'image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                getGroupLogoUrl(selectedGroupForLogo) ? (
                  <div className="relative w-32 h-32 rounded-full border-2 border-theme flex items-center justify-center overflow-hidden bg-white">
                    <img
                      src={getGroupLogoUrl(selectedGroupForLogo)}
                      alt="Logo actuel"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full border-2 border-dashed border-theme flex items-center justify-center bg-theme/50">
                    <Image className="w-10 h-10 text-secondary-color opacity-50" />
                  </div>
                )
              )}
              
              <Button
                type="button"
                variant="outline"
                icon={Upload}
                onClick={() => groupLogoInputRef.current?.click()}
                className="w-full"
              >
                {getGroupLogoUrl(selectedGroupForLogo) || groupLogo ? "Changer le logo" : "Sélectionner un logo"}
              </Button>
            </div>
            <input
              type="file"
              ref={groupLogoInputRef}
              onChange={handleGroupLogoSelect}
              accept="image/*"
              className="hidden"
            />
            <p className="mt-3 text-xs text-secondary-color text-center">
              Images recommandées : format carré, minimum 200x200px, formats PNG ou SVG pour la transparence
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsGroupLogoModalOpen(false);
                setSelectedGroupForLogo('');
                setGroupLogo(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!groupLogo}
            >
              {getGroupLogoUrl(selectedGroupForLogo) ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}