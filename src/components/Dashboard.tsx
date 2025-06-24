/**
 * Dashboard component
 * Main dashboard view with stats, team activity tracking, and Power BI integration
 */

import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import { 
  BarChart3, Video, LogIn, Users, AlertTriangle, Clock, RefreshCw, 
  Calendar, ChevronDown, ChevronUp, RotateCw, 
  History, CalendarClock, UserCog, X, Filter,
  User
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import * as Dialog from '@radix-ui/react-dialog';
import { collection, query, where, orderBy, limit, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

import type { DashboardStats } from '../types';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/Button';
import { formatDate } from '../utils/formatters';
import { db } from '../lib/firebase';
import { Modal } from './ui/Modal';

// Types utilisés pour le tableau de bord
interface Connection {
  id: string;
  ip: string;
  timestamp: Date;
}

interface TeamConnection {
  date: string;
  formattedDate: string;
  [key: string]: string | number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  company: string;
  role: 'PDG' | 'Dirigeant' | 'Employé' | 'Admin';
  lastConnection: Date;
  status: 'En ligne' | 'Hors ligne' | 'Inactif';
}

interface UserViewData {
  id: string;
  name: string;
  email: string;
  company: string;
  role: 'PDG' | 'Dirigeant' | 'Employé' | 'Admin';
  powerBiUrl?: string;
  lastLogin: string;
  loginHistory: any[];
}

type Period = '2m' | '1m' | '15d' | '7d';

// Constantes pour les données du tableau de bord
const periods = [
  { id: '2m', label: '2 derniers mois' },
  { id: '1m', label: 'Dernier mois' },
  { id: '15d', label: '15 derniers jours' },
  { id: '7d', label: 'Dernière semaine' }
] as const;

const roleColors = {
  'PDG': '#FF7E1B',      // Orange 
  'Dirigeant': '#00B1E5', // Bleu
  'Employé': '#00E6CA',   // Turquoise
  'Admin': '#6366F1'     // Violet
};

const statusColors = {
  'En ligne': '#22C55E',
  'Hors ligne': '#6366F1',
  'Inactif': '#DC2626'
};

// Statistiques fictives pour l'affichage initial
const mockStats: DashboardStats = {
  activeUsers: 127,
  totalLogins: 1432,
  averageSessionTime: '24m',
  lastSync: '2 minutes ago',
};

/**
 * Tooltip personnalisé pour le graphique de connexions
 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-theme rounded-lg p-3">
        <p className="text-primary-color font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value} connexions
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Formate la dernière connexion avec un format convivial
 */
function formatLastConnection(date: Date) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const connectionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const timeStr = date.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: 'Europe/Paris' 
  });

  if (connectionDate.getTime() === startOfDay.getTime()) {
    return `Aujourd'hui à ${timeStr}`;
  } else if (connectionDate.getTime() === startOfDay.getTime() - 86400000) {
    return `Hier à ${timeStr}`;
  } else {
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    });
    const formattedDate = formatter.format(date);
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  }
}

/**
 * Formate une date de connexion complète
 */
function formatConnectionDate(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  }).format(date);
}

/**
 * Formate une date pour le graphique
 */
function formatGraphDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

/**
 * Calcule le temps de session moyen à partir de l'historique de connexion
 */
const calculateAverageSessionTime = (loginHistory: any[]): string => {
  if (!loginHistory || loginHistory.length < 2) {
    return 'N/A';
  }

  // Dans une implémentation réelle, vous auriez des heures de fin de session
  // Pour l'instant, nous utiliserons une valeur indicative basée sur le nombre de connexions
  const avgMinutes = Math.min(30, 5 + (loginHistory.length * 2));
  return `${avgMinutes}m`;
};

/**
 * Calcule les jours actifs à partir de l'historique de connexion
 */
const calculateActiveDays = (loginHistory: any[]): number => {
  if (!loginHistory || loginHistory.length === 0) {
    return 0;
  }

  // Créer un ensemble de dates uniques à partir de l'historique de connexion
  const uniqueDates = new Set();
  loginHistory.forEach(entry => {
    const date = new Date(entry.timestamp).toDateString();
    uniqueDates.add(date);
  });

  return uniqueDates.size;
};

/**
 * Formate le temps écoulé depuis une date
 */
const getTimeElapsed = (dateString: string): string => {
  if (!dateString) return 'Jamais';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `${diffMinutes} minutes`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} heures`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} jours`;
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} mois`;
};

/**
 * Filtre les données par période
 */
const filterDataByPeriod = (data: TeamConnection[], period: Period) => {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case '2m':
      startDate.setMonth(now.getMonth() - 2);
      break;
    case '1m':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case '15d':
      startDate.setDate(now.getDate() - 15);
      break;
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
  }

  return data.filter(item => new Date(item.date) >= startDate);
};

/**
 * Composant Dashboard affichant les analyses et l'activité de l'équipe
 */
export default function Dashboard() {
  // =============== État et contexte ===============
  const auth = useContext(AuthContext);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Statistiques
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Nouvelles fonctionnalités
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showAllConnections, setShowAllConnections] = useState(false);
  const [teamConnections, setTeamConnections] = useState<TeamConnection[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1m');
  
  // Fonctionnalité Admin - Vue d'un autre utilisateur
  const [isUserSwitcherOpen, setIsUserSwitcherOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserViewData | null>(null);
  const [allUsers, setAllUsers] = useState<UserViewData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  // Date formatée pour l'entête
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);
  
  // Utilisateur actuellement affiché (soit l'admin connecté, soit l'utilisateur sélectionné)
  const currentUser = viewingUser || auth?.user;
  
  // Prénom de l'utilisateur
  const firstName = currentUser?.name?.split(' ')[0] || '';
  
  // =============== Hooks d'effet ===============

  /**
   * Charger les données de l'utilisateur actuel
   */
  useEffect(() => {
    if (currentUser) {
      // Récupérer les statistiques spécifiques à l'utilisateur 
      fetchUserStats(currentUser);
    }
  }, [currentUser]);

  /**
   * Charger les données des membres de l'équipe et leurs connexions
   */
  useEffect(() => {
    if (currentUser?.company) {
      fetchTeamMembers();
      fetchTeamConnections();
    }
  }, [currentUser?.company]);

  /**
   * Charger l'historique des connexions de l'utilisateur
   */
  useEffect(() => {
    if (currentUser?.id) {
      fetchUserConnections();
    }
  }, [currentUser?.id]);

  /**
   * Charger la liste de tous les utilisateurs si l'utilisateur connecté est un admin
   */
  useEffect(() => {
    if (auth?.user?.role === 'Admin') {
      fetchAllUsers();
    }
  }, [auth?.user?.role]);

  /**
   * Réinitialiser l'utilisateur affiché si l'admin se déconnecte
   */
  useEffect(() => {
    if (!auth?.user) {
      setViewingUser(null);
      localStorage.removeItem('selectedUserId');
    }
  }, [auth?.user]);

  /**
   * Restaurer l'utilisateur sélectionné depuis localStorage
   */
  useEffect(() => {
    if (auth?.user?.role === 'Admin' && allUsers.length > 0) {
      const storedUserId = localStorage.getItem('selectedUserId');
      if (storedUserId) {
        const user = allUsers.find(u => u.id === storedUserId);
        if (user) {
          setViewingUser(user);
        } else {
          // If stored user no longer exists, clear the storage
          localStorage.removeItem('selectedUserId');
        }
      }
    }
  }, [allUsers, auth?.user?.role]);

  /**
   * Gérer le paramètre d'URL pour l'utilisateur sélectionné
   */
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId && auth?.user?.role === 'Admin') {
      const user = allUsers.find(u => u.id === userId);
      if (user) {
        setViewingUser(user);
      }
    }
  }, [searchParams, allUsers, auth?.user?.role]);
  
  // =============== Inactivity Timer ===============
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Function to sign out the user
    const handleSignOut = () => {
      if (auth?.signOut) {
        auth.signOut();
      } else if (auth?.firebaseAuth) {
        // fallback if you have direct firebase auth instance
        auth.firebaseAuth.signOut();
      }
      // Optionally, redirect to login page if needed
    };
  console.log(auth);
  
    // Reset inactivity timer
    const resetInactivityTimer = () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      inactivityTimeoutRef.current = setTimeout(handleSignOut, 60 * 60 * 1000); // 1 hour
    };
  
    // Listen for mouse movement
    window.addEventListener('mousemove', resetInactivityTimer);
  
    // Start the timer initially
    resetInactivityTimer();
  
    // Clean up on unmount
    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [auth]);
  
  // =============== Fonctions de chargement des données ===============
  
  /**
   * Récupère les statistiques spécifiques à l'utilisateur à partir des données Firestore
   */
  const fetchUserStats = async (user: any) => {
    try {
      setIsLoading(true);
      
      // Utiliser les données de l'utilisateur de Firestore pour remplir les statistiques
      const userStats: DashboardStats = {
        activeUsers: calculateActiveDays(user.loginHistory || []),
        totalLogins: (user.loginHistory || []).length,
        averageSessionTime: calculateAverageSessionTime(user.loginHistory || []),
        lastSync: getTimeElapsed(user.lastLogin)
      };
      
      setStats(userStats);
    } catch (error) {
      console.error('Error processing user stats:', error);
      // Retour aux données fictives en cas d'erreur
      setStats(mockStats);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Récupère les membres de l'équipe depuis Firestore
   */
  async function fetchTeamMembers() {
    if (!currentUser?.company) return;

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('company', '==', currentUser.company));
      const querySnapshot = await getDocs(q);
      
      const members: TeamMember[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Convertir Timestamp en Date si nécessaire
        const lastLogin = data.lastLogin instanceof Timestamp 
          ? data.lastLogin.toDate() 
          : new Date(data.lastLogin);
        
        const daysSinceLastConnection = Math.ceil(
          Math.abs(new Date().getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
        );

        let status: TeamMember['status'] = 'Hors ligne';
        if (daysSinceLastConnection > 7) {
          status = 'Inactif';
        } else if (daysSinceLastConnection < 1) {
          status = 'En ligne';
        }

        return {
          id: doc.id,
          name: data.name,
          email: data.email,
          company: data.company,
          role: data.role,
          lastConnection: lastLogin,
          status
        };
      });

      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }

  /**
   * Récupère les connexions de l'équipe pour construire le graphique
   */
  async function fetchTeamConnections() {
    if (!currentUser?.company) return;

    try {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const usersRef = collection(db, 'users');
      const teamQuery = query(usersRef, where('company', '==', currentUser.company));
      const teamSnapshot = await getDocs(teamQuery);

      const connectionsData: { [date: string]: { [user: string]: number } } = {};

      for (const teamMember of teamSnapshot.docs) {
        const userData = teamMember.data();
        
        // Si loginHistory existe, l'utiliser pour construire les données de connexion
        if (userData.loginHistory && Array.isArray(userData.loginHistory)) {
          userData.loginHistory.forEach((entry: any) => {
            const timestamp = entry.timestamp instanceof Timestamp 
              ? entry.timestamp.toDate() 
              : new Date(entry.timestamp);
            
            if (timestamp >= twoMonthsAgo) {
              const dateStr = timestamp.toISOString().split('T')[0];
              
              if (!connectionsData[dateStr]) {
                connectionsData[dateStr] = {};
              }
              
              connectionsData[dateStr][userData.name] = (connectionsData[dateStr][userData.name] || 0) + 1;
            }
          });
        }
      }

      const formattedData = Object.entries(connectionsData)
        .map(([date, users]) => ({
          date,
          formattedDate: formatGraphDate(date),
          ...users
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setTeamConnections(formattedData);
    } catch (error) {
      console.error('Error fetching team connections:', error);
    }
  }

  /**
   * Récupère l'historique des connexions de l'utilisateur
   */
  async function fetchUserConnections() {
    if (!currentUser?.id) return;

    try {
      // Récupérer l'historique de connexion
      const userRef = doc(db, 'users', currentUser.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists() && userDoc.data().loginHistory) {
        const loginHistory = userDoc.data().loginHistory;
        
        // Convertir l'historique de connexion en format Connection
        const connectionsList: Connection[] = loginHistory.map((entry: any, index: number) => {
          const timestamp = entry.timestamp instanceof Timestamp 
            ? entry.timestamp.toDate() 
            : new Date(entry.timestamp);
          
          return {
            id: index.toString(),
            ip: entry.ipAddress || 'Inconnue',
            timestamp
          };
        });
        
        // Trier par date décroissante
        connectionsList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        setConnections(connectionsList);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  }

  /**
   * Récupère tous les utilisateurs pour le sélecteur d'admin
   */
  async function fetchAllUsers() {
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      const users: UserViewData[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          company: data.company || '',
          role: data.role || '',
          powerBiUrl: data.powerBiUrl || '',
          lastLogin: data.lastLogin || '',
          loginHistory: data.loginHistory || []
        };
      });
      
      setAllUsers(users);
    } catch (error) {
      console.error('Error fetching all users:', error);
    }
  }

  // =============== Gestionnaires d'événements ===============

  /**
   * Sélectionne un utilisateur pour afficher son tableau de bord
   */
  const handleUserSelect = (user: UserViewData) => {
    setViewingUser(user);
    setIsUserSwitcherOpen(false);
    // Store selected user ID in localStorage
    localStorage.setItem('selectedUserId', user.id);
  };

  /**
   * Revient à l'affichage du tableau de bord de l'admin
   */
  const resetToAdminView = () => {
    setViewingUser(null);
    // Remove selected user ID from localStorage
    localStorage.removeItem('selectedUserId');
  };

  // Filtrer les utilisateurs pour le sélecteur d'utilisateur
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCompany = companyFilter ? user.company === companyFilter : true;
    const matchesRole = roleFilter ? user.role === roleFilter : true;
    
    return matchesSearch && matchesCompany && matchesRole;
  });

  // Liste unique des entreprises pour les filtres
  const companies = [...new Set(allUsers.map(user => user.company))].filter(Boolean);

  // Filtrer les données de connexion par période sélectionnée
  const filteredConnections = filterDataByPeriod(teamConnections, selectedPeriod);
 console.log(User);
  return (
    <div className="space-y-8">
      {/* Bannière de bienvenue avec sélecteur d'utilisateur pour les admins */}
      <div className="bg-card rounded-lg shadow-sm p-6 border border-theme">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex sm:flex-row flex-col items-left sm:items-center gap-4 sm:gap-2">
              <h1 className="text-2xl font-bold text-primary-color">
                Bonjour <span className="gradient-text">{firstName}</span>,
              </h1>
              
              {/* Badge "Vue Utilisateur" quand un admin voit le dashboard d'un autre utilisateur */}
              {viewingUser && auth?.user?.role === 'Admin' && (
                <span className="px-2 py-1 text-xs w-fit font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-700/50">
                  Vue Utilisateur
                </span>
              )}
              
              {/* Bouton pour retourner à la vue admin */}
              {viewingUser && auth?.user?.role === 'Admin' && (
                <button
                  onClick={resetToAdminView}
                  className={`ml-2 text-xs text-primary ${isDark ? '' : 'hover:underline'} flex items-center gap-1`}
                >
                  <X className="w-3 h-3" />
                  Retour à ma vue
                </button>
              )}
            </div>
            <p className="text-lg text-secondary-color">
              {viewingUser 
                ? `Vue du tableau de bord de ${viewingUser.name} (${viewingUser.role})`
                : 'Bienvenue sur votre tableau de bord'
              }
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex sm:flex-row flex-col items-left sm:items-center gap-4">
            {/* Sélecteur d'utilisateur pour les admins */}
            {auth?.user?.role === 'Admin' && (
              <Button
                variant="outline"
                size="sm"
                icon={UserCog}
                onClick={() => setIsUserSwitcherOpen(true)}
              >
                {viewingUser ? 'Changer d\'utilisateur' : 'Voir comme un utilisateur'}
              </Button>
            )}
            <div className="flex items-center text-sm text-secondary-color">
              <CalendarClock className="w-4 h-4 mr-1 text-secondary" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/analytics"
          className={`${
            isDark
              ? "card-gradient border border-theme p-3"
              : "card-gradient border border-theme hover:border-primary/50 transition-colors"
          } rounded-lg font-medium p-3`}
        >
          <BarChart3 className={`w-5 h-5 mr-2 ${isDark ? "text-primary" : "text-red-500"}`} />
          <span className={isDark ? "gradient-text" : " text-primary-color"}>Outil d&apos;analyse</span>
        </Link>
        <button 
          className={`${
            isDark
              ? "card-gradient border border-theme p-3 text-left"
              : "card-gradient border border-theme hover:border-primary/50 transition-colors"
          } rounded-lg font-medium p-3`}
        >
          <Video className={`w-5 h-5 mr-2 ${isDark ? "text-primary" : "text-red-500"}`} />
          <span className={isDark ? "gradient-text" : "text-primary-color"}>Vidéos tutoriels</span>
        </button>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Carte des jours d'activité */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-theme">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-color">Jours d'activité</p>
              <p className="text-2xl font-semibold text-primary-color">
                {isLoading ? '...' : stats.activeUsers}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Carte des connexions totales */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-theme">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-color">Connexions Totales</p>
              <p className="text-2xl font-semibold text-primary-color">
                {isLoading ? '...' : stats.totalLogins}
              </p>
            </div>
            <div className="p-3 bg-secondary/10 rounded-full">
              <BarChart3 className="w-6 h-6 text-secondary" />
            </div>
          </div>
        </div>

        {/* Carte de session moyenne */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-theme">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-color">Durée Moyenne</p>
              <p className="text-2xl font-semibold text-primary-color">
                {isLoading ? '...' : stats.averageSessionTime}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <Clock className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Carte de dernière connexion */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-theme">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-color">Dernière Connexion</p>
              <p className="text-2xl font-semibold text-primary-color">
                {isLoading ? '...' : stats.lastSync}
              </p>
            </div>
            <div className="p-3 bg-secondary/10 rounded-full">
              <RefreshCw className="w-6 h-6 text-secondary" />
            </div>
          </div>
        </div>
      </div>

      {/* Blocs d'analyse et d'activité de l'équipe */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique de connexions de l'équipe */}
        <div className={`${
          (currentUser?.role === 'PDG' || currentUser?.role === 'Dirigeant') 
            ? 'lg:col-span-3' 
            : 'lg:col-span-2'
        } card-gradient border border-theme rounded-xl p-6`}>
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-primary-color">Activite</h2>
          <h2 className="text-lg font-semibold text-primary-color">Votre historique de connexions</h2>
        </div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary-color">Connexions de l&apos;équipe</h2>
              <LogIn className="w-5 h-5 text-primary" />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {periods.map(period => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === period.id
                      ? 'bg-gradient-to-r from-primary to-secondary text-white'
                      : isDark
                        ? 'card-gradient border border-theme hover:border-primary/50'
                        : 'border border-theme hover:border-primary/50'
                  }`}
                >
                  <Calendar className={`w-4 h-4 mr-2 ${
                    selectedPeriod === period.id ? 'text-white' : isDark ? 'text-primary' : ''
                  }`} />
                  <span className={isDark && selectedPeriod !== period.id ? 'gradient-text' : ''}>
                    {period.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {teamConnections.length > 0 ? (
            <div className="h-[300px] mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredConnections}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="var(--border-color)" 
                    opacity={0.5}
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke="var(--text-secondary)"
                    tick={{ fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="var(--text-secondary)"
                    tick={{ fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                    tickFormatter={(value: number) => Math.round(value)}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ stroke: 'var(--border-color)', strokeWidth: 1 }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: '20px',
                      opacity: 0.8,
                      display: 'none'
                    }}
                  />
                  {teamMembers.map((member) => (
                    <Line
                      key={member.id}
                      type="monotone"
                      dataKey={member.name}
                      name={`${member.name} (${member.role})`}
                      stroke={roleColors[member.role]}
                      strokeWidth={2}
                      dot={{ 
                        fill: roleColors[member.role], 
                        r: 4,
                        strokeWidth: 2,
                        stroke: 'var(--bg-card)'
                      }}
                      activeDot={{ 
                        r: 6, 
                        stroke: roleColors[member.role], 
                        strokeWidth: 2,
                        fill: 'var(--bg-card)'
                      }}
                      animationDuration={1500}
                      animationBegin={200}
                      animationEasing="ease-out"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-secondary-color">Aucune donnée de connexion disponible</p>
            </div>
          )}
        </div>

        {/* Activités de l'équipe */}
        <div className="card-gradient border border-theme rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-color">Activités de l&apos;équipe</h2>
            <Users className="w-5 h-5 text-primary" />
          </div>
          {teamMembers.length > 0 ? (
            <div className="space-y-6">
              {teamMembers.map((member, index) => {
                const daysSinceLastConnection = Math.ceil(
                  Math.abs(new Date().getTime() - member.lastConnection.getTime()) / (1000 * 60 * 60 * 24)
                );
                const isInactive = daysSinceLastConnection > 7;

                return (
                  <Dialog.Root key={index} open={selectedUser?.id === member.id} onOpenChange={(open) => setSelectedUser(open ? member : null)}>
                    <Dialog.Trigger asChild>
                      <button 
                        className={`w-full text-left p-4 rounded-lg border ${
                          isInactive ? 'border-red-500/20 bg-red-500/10' : 'border-theme'
                        } ${isDark ? '' : 'hover:border-primary/50'} transition-colors`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 ">
                              <span className="text-sm font-medium text-primary-color">
                                {member.name}
                              </span>
                              <span 
                                className="px-2 py-0.5 text-xs rounded-full"
                                style={{
                                  backgroundColor: `${roleColors[member.role]}20`,
                                  color: roleColors[member.role]
                                }}
                              >
                                {member.role}
                              </span>
                              <span 
                                className="px-2 py-0.5 text-xs rounded-full"
                                style={{
                                  backgroundColor: `${statusColors[member.status]}20`,
                                  color: statusColors[member.status]
                                }}
                              >
                                {member.status}
                              </span>
                            </div>
                            <p className="text-sm text-secondary-color">
                              Dernière connexion : {formatLastConnection(member.lastConnection)}
                            </p>
                          </div>
                          {isInactive ? (
                            <AlertTriangle className="w-5 h-5" style={{ color: statusColors['Inactif'] }} />
                          ) : (
                            <Clock className="w-5 h-5" style={{ color: roleColors[member.role] }} />
                          )}
                        </div>
                        {isInactive && (
                          <p className="mt-2 text-xs" style={{ color: statusColors['Inactif'] }}>
                            Aucune activité depuis plus d&apos;une semaine
                          </p>
                        )}
                      </button>
                    </Dialog.Trigger>
                  </Dialog.Root>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-secondary-color">
              <p>Aucun membre d'équipe trouvé</p>
            </div>
          )}
        </div>

          {/* Historique de connexions */}
          <div className=" lg:col-span-2 card-gradient border border-theme rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-primary-color">Votre historique de connexions</h2>
              <History className="w-5 h-5 text-primary" />
            </div>
            {connections.length > 0 ? (
              <div className="space-y-4">
                {connections.slice(0, showAllConnections ? 20 : 5).map((connection, index) => (
                  <div key={index} className="p-4 border border-theme rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary-color">
                            {formatConnectionDate(connection.timestamp)}
                          </span>
                        </div>
                        <div className="text-sm text-secondary-color">
                          IP: {connection.ip}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setShowAllConnections(!showAllConnections)}
                  className={`flex items-center justify-center w-full text-sm text-primary-color ${isDark ? '' : 'hover:text-primary'} mt-6`}
                >
                  {showAllConnections ? (
                    <>
                      <span className="mr-1">Réduire</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span className="mr-1">Voir vos 20 dernières connexions</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-8 text-center text-secondary-color">
                <p>Aucun historique de connexion disponible</p>
              </div>
            )}
          </div>
      </div>



      {/* Modal de sélection d'utilisateur pour les admins */}
      <Dialog.Root open={isUserSwitcherOpen} onOpenChange={setIsUserSwitcherOpen}>
        <Dialog.Portal>
          <Dialog.Overlay 
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50"
          />
          <Dialog.Content 
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[800px] h-[calc(100vh-50px)] bg-card shadow-2xl z-50 rounded-xl border border-theme overflow-hidden"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card px-6 py-4 border-b border-theme !shadow-none !rounded-[0px]">
              <div className="flex items-center justify-between !px-0">
                <Dialog.Title className="text-xl font-semibold text-primary-color">
                  Sélectionner un utilisateur
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    className={`rounded-lg p-2 ${isDark ? '' : 'hover:bg-theme hover:text-primary-color'}`}
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-6 py-6 space-y-6 h-[calc(100vh-240px)]" >
              {/* Search and Filters */}
              <div className="space-y-5 !pr-[10px]">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Rechercher un utilisateur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-theme/30 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-primary-color placeholder:text-secondary-color/70"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-color/70" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-secondary-color mb-2">Entreprise</label>
                    <select
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                      className="w-full px-4 py-2.5 bg-theme/30 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-primary-color"
                    >
                      <option value="">Toutes les entreprises</option>
                      {companies.map((company, index) => (
                        <option key={index} value={company}>{company}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-secondary-color mb-2">Rôle</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="w-full px-4 py-2.5 bg-theme/30 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-primary-color"
                    >
                      <option value="">Tous les rôles</option>
                      <option value="Admin">Admin</option>
                      <option value="PDG">PDG</option>
                      <option value="Dirigeant">Dirigeant</option>
                      <option value="Employé">Employé</option>
                    </select>
                  </div>
                </div>
                
                {(companyFilter || roleFilter) && (
                  <button
                    onClick={() => {
                      setCompanyFilter('');
                      setRoleFilter('');
                    }}
                    className={`inline-flex items-center px-3 py-1.5 text-sm text-primary ${isDark ? '' : 'hover:text-primary-hover hover:bg-theme/50'} rounded-lg`}
                  >
                    <Filter className="w-4 h-4 mr-1.5" />
                    <span>Réinitialiser les filtres</span>
                  </button>
                )}
              </div>

              {/* Users Table */}
              <div className="mt-8 border border-theme rounded-lg overflow-hidden !pr-[10px]">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-theme/20 border-b border-theme">
                      <th className="px-6 py-3 text-right text-xs font-medium text-secondary-color uppercase tracking-wider"></th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">Nom</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">Entreprise</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-color uppercase tracking-wider">Rôle</th>
                       
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-secondary-color bg-theme/10">
                            Aucun utilisateur trouvé
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id} className={`bg-card ${isDark ? '' : 'hover:bg-theme/20'}`}>
                             <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUserSelect(user)}
                              >
                                Sélectionner
                              </Button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-color">
                              {user.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-color">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-color">
                              {user.company}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.role === 'Admin' 
                                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-700/50' 
                                  : user.role === 'PDG'
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50'
                                  : user.role === 'Dirigeant'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800/90 dark:text-gray-300 border border-gray-200 dark:border-gray-700/50'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                           
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 z-10 bg-card px-6 py-2 border-t border-theme !shadow-none !rounded-[0px]">
              <div className="flex justify-end !px-0">
                <Button
                  variant="outline"
                  onClick={() => setIsUserSwitcherOpen(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}