import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Home, Users, Settings, LogOut, Sun, Moon, BarChart3, X } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ParticleBackground from './ParticleBackground';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isAdmin = auth?.user?.role === 'Admin';

  const handleLogout = async () => {
    try {
      await auth?.signOut();
      navigate('/'); // Rediriger vers la page d'accueil après déconnexion
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-theme">
      <ParticleBackground />
      
      {/* Header */}
      <header>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-theme rounded-lg lg:hidden transition-colors duration-200"
            >
              <Menu className="w-6 h-6 text-primary-color" />
            </button>
            <h1 className="text-xl font-semibold gradient-text">Solution 360</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-theme hover:text-primary transition-all duration-200 rounded-full"
              aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {isDark ? <Sun className="w-5 h-5 text-secondary" /> : <Moon className="w-5 h-5 text-secondary" />}
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-theme hover:text-primary transition-all duration-200 rounded-full"
              aria-label="Se déconnecter"
            >
              <LogOut className="w-5 h-5 text-primary-color" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            isSidebarOpen ? 'translate-x-0 sideBar ' : '-translate-x-full'
          } fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:shadow-none border-r border-theme`}
        >
          <div className="flex justify-end px-2 py-2 sm:p-4 lg:hidden">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-theme rounded-lg transition-colors duration-200"
              aria-label="Fermer le menu"
            >
              <X className="w-6 h-6 text-primary-color" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                location.pathname === '/dashboard' 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-primary-color hover:bg-primary/5 hover:text-primary hover:translate-x-1'
              }`}
            >
              <Home className={`w-5 h-5 ${location.pathname === '/dashboard' ? 'text-primary' : ''}`} />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/analytics"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                location.pathname === '/analytics' 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-primary-color hover:bg-primary/5 hover:text-primary hover:translate-x-1'
              }`}
            >
              <BarChart3 className={`w-5 h-5 ${location.pathname === '/analytics' ? 'text-primary' : ''}`} />
              <span>Outil d'analyse</span>
            </Link>
            {isAdmin && (
              <Link
                to="/users"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                  location.pathname === '/users' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-primary-color hover:bg-primary/5 hover:text-primary hover:translate-x-1'
                }`}
              >
                <Users className={`w-5 h-5 ${location.pathname === '/users' ? 'text-primary' : ''}`} />
                <span>Users</span>
              </Link>
            )}
            <Link
              to="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                location.pathname === '/settings' 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-primary-color hover:bg-primary/5 hover:text-primary hover:translate-x-1'
              }`}
            >
              <Settings className={`w-5 h-5 ${location.pathname === '/settings' ? 'text-primary' : ''}`} />
              <span>Settings</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 relative z-10 w-full overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}