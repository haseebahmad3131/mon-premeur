import React, { useContext, useEffect, useState } from 'react';
import { BarChart3, RotateCw, AlertCircle, ExternalLink, X } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/Button';
import PowerBIEmbed from '../components/PowerBIEmbed';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Interface for the user view data (must match the one in Dashboard.tsx)
interface User {
  id: string;
  email: string;
  name: string;
  company: string;
  role: 'PDG' | 'Dirigeant' | 'Employé' | 'Admin';
  powerBiUrl?: string;
  powerBiUrl2?: string;
  lastLogin: string;
  loginHistory: any[];
}

interface CompanyPowerBILink {
  companyName: string;
  powerBiUrl: string;
}

interface PowerBILink {
  id: string;
  name: string;
  url: string;
  isHtml: boolean;
}

/**
 * Parse JSON string of PowerBI URLs for PDG users
 */
const parseCompanyPowerBILinks = (jsonString: string): CompanyPowerBILink[] => {
  try {
    const parsed = JSON.parse(jsonString);
    return Object.entries(parsed).map(([companyName, powerBiUrl]) => ({
      companyName,
      powerBiUrl: powerBiUrl as string,
    }));
  } catch (error) {
    console.error('Error parsing PowerBI URLs:', error);
    return [];
  }
};

/**
 * Parse Power BI URLs from JSON string - handles both legacy and new formats
 */
const parsePowerBILinks = (jsonString: string): PowerBILink[] => {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Handle legacy format (company name -> URL mapping for PDG)
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed).map(([name, url], index) => ({
        id: `legacy-${index}`,
        name,
        url: url as string,
        isHtml: isHtmlContent(url as string)
      }));
    }
    
    // Handle new format (array of Power BI links)
    if (Array.isArray(parsed)) {
      return parsed.map((link, index) => ({
        id: link.id || `link-${index}`,
        name: link.name || `Dashboard ${index + 1}`,
        url: link.url || '',
        isHtml: link.isHtml || isHtmlContent(link.url || '')
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing Power BI URLs:', error);
    return [];
  }
};

/**
 * Check if content is HTML rather than a URL
 */
const isHtmlContent = (content: string): boolean => {
  if (!content) return false;
  return content.trim().startsWith('<') || 
         content.includes('</') || 
         content.includes('/>');
};

/**
 * Company Card Component for PDG view
 */
const CompanyCard = ({ 
  companyName, 
  powerBiUrl, 
  onSelect 
}: { 
  companyName: string; 
  powerBiUrl: string; 
  onSelect: () => void;
}) => {
  return (
    <div className="bg-card p-6 rounded-lg border border-theme hover:border-primary transition-colors cursor-pointer"
         onClick={onSelect}
         role="button"
         tabIndex={0}
         onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary-color">{companyName}</h3>
        <ExternalLink className="w-5 h-5 text-secondary-color" />
      </div>
      <p className="text-sm text-secondary-color">
        Cliquez pour voir le tableau de bord de {companyName}
      </p>
    </div>
  );
};

/**
 * Power BI Link Card Component for multiple dashboards view
 */
const PowerBILinkCard = ({ 
  link, 
  onSelect 
}: { 
  link: PowerBILink; 
  onSelect: () => void;
}) => {
  return (
    <div className="bg-card p-6 rounded-lg border border-theme hover:border-primary transition-colors cursor-pointer"
         onClick={onSelect}
         role="button"
         tabIndex={0}
         onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary-color">{link.name}</h3>
        <div className="flex items-center gap-2">
          {link.isHtml ? (
            <div className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded">HTML</div>
          ) : (
            <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">URL</div>
          )}
          <ExternalLink className="w-5 h-5 text-secondary-color" />
        </div>
      </div>
      <p className="text-sm text-secondary-color">
        Cliquez pour voir ce tableau de bord Power BI
      </p>
    </div>
  );
};

/**
 * Page d'outil d'analyse avec intégration PowerBI
 */
export default function AnalyticsToolPage() {
  const auth = useContext(AuthContext);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // État pour PowerBI
  const [powerBiContent, setPowerBiContent] = useState<string | undefined>(undefined);
  const [isHtml, setIsHtml] = useState<boolean>(false);
  const [contentError, setContentError] = useState<boolean>(false);
  const [embedKey, setEmbedKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [companyLinks, setCompanyLinks] = useState<CompanyPowerBILink[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyPowerBILink | null>(null);
  
  // New state for multiple Power BI URLs
  const [powerBiLinks, setPowerBiLinks] = useState<PowerBILink[]>([]);
  const [selectedPowerBiLink, setSelectedPowerBiLink] = useState<PowerBILink | null>(null);
  
  // Viewing user state (for admin view as user)
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  
  // URL d'intégration PowerBI d'exemple (utilisée uniquement si l'utilisateur n'en a pas)
  const examplePowerBiEmbed = "https://app.powerbi.com/view?r=eyJrIjoiOGNmYjExMDItZjZkOC00YjM5LWE4OWMtYzAxODM2OTIwNGIwIiwidCI6ImZmMDc2NmVmLTkwNzMtNDgzNy1hMDkwLTM4OGE0ZTM0ZGVhZiJ9";
  
  // Current user (either the admin or the selected user being viewed)
  const currentUser = viewingUser || auth?.user;
  
  /**
   * Load selected user data from localStorage
   */
  useEffect(() => {
    if (auth?.user?.role === 'Admin') {
      const loadSelectedUser = async () => {
        const storedUserId = localStorage.getItem('selectedUserId');
        if (storedUserId) {
          try {
            const userRef = doc(db, 'users', storedUserId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setViewingUser({
                id: userDoc.id,
                name: userData.name || '',
                email: userData.email || '',
                company: userData.company || '',
                role: userData.role || '',
                powerBiUrl: userData.powerBiUrl || '',
                powerBiUrl2: userData.powerBiUrl2 || '',
                lastLogin: userData.lastLogin || '',
                loginHistory: userData.loginHistory || []
              });
            } else {
              // If user no longer exists, clear localStorage
              localStorage.removeItem('selectedUserId');
            }
          } catch (error) {
            console.error('Error loading selected user:', error);
          }
        } else {
          setViewingUser(null);
        }
      };
      
      loadSelectedUser();
    }
  }, [auth?.user?.role]);
  
  /**
   * Reset viewing user if admin logs out
   */
  useEffect(() => {
    if (!auth?.user) {
      setViewingUser(null);
    }
  }, [auth?.user]);
  
  /**
   * Charger le contenu PowerBI lorsque l'utilisateur auth change
   */
  useEffect(() => {
    setIsLoading(true);
    
    const timer = setTimeout(() => {
      if (currentUser?.powerBiUrl) {
        const content = currentUser.powerBiUrl;
        
        // Check if user has multiple simple URLs
        const urls = [currentUser.powerBiUrl, currentUser.powerBiUrl2].filter(Boolean);
        
        if (urls.length > 1) {
          // Create simple Power BI links from multiple URL fields
          const links = urls.map((url, index) => ({
            id: `url-${index + 1}`,
            name: `Dashboard ${index + 1}`,
            url: url!,
            isHtml: isHtmlContent(url!)
          }));
          
          setPowerBiLinks(links);
          setSelectedPowerBiLink(null);
          setCompanyLinks([]);
          setSelectedCompany(null);
          setPowerBiContent(undefined);
          setIsLoading(false);
          return;
        }
        
        // Try to parse as JSON for legacy formats
        if (content.startsWith('{') || content.startsWith('[')) {
          try {
            const parsed = JSON.parse(content);
            
            // Handle legacy PDG company format (object with company names as keys)
            if (currentUser.role === 'PDG' && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const links = parseCompanyPowerBILinks(content);
              setCompanyLinks(links);
              setSelectedCompany(null);
              setPowerBiLinks([]);
              setSelectedPowerBiLink(null);
              setPowerBiContent(undefined);
              setIsLoading(false);
              return;
            }
            
            // Handle legacy array format
            if (Array.isArray(parsed)) {
              const links = parsePowerBILinks(content);
              setPowerBiLinks(links);
              setSelectedPowerBiLink(null);
              setCompanyLinks([]);
              setSelectedCompany(null);
              setPowerBiContent(undefined);
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('Error parsing PowerBI content:', error);
          }
        }
        
        // Regular single PowerBI content handling
        const contentIsHtml = isHtmlContent(content);
        setPowerBiContent(content);
        setIsHtml(contentIsHtml);
        setContentError(false);
        setCompanyLinks([]);
        setPowerBiLinks([]);
        setSelectedCompany(null);
        setSelectedPowerBiLink(null);
      } else {
        setPowerBiContent(examplePowerBiEmbed);
        setIsHtml(false);
        setCompanyLinks([]);
        setPowerBiLinks([]);
        setSelectedCompany(null);
        setSelectedPowerBiLink(null);
      }
      
      setEmbedKey(prev => prev + 1);
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [currentUser]);

  // =============== Gestionnaires d'événements ===============
  
  /**
   * Reset to admin view function
   */
  const resetToAdminView = () => {
    setViewingUser(null);
    // Remove selected user ID from localStorage
    localStorage.removeItem('selectedUserId');
  };
  
  /**
   * Handle company selection for PDG view
   */
  const handleCompanySelect = (company: CompanyPowerBILink) => {
    setSelectedCompany(company);
    setPowerBiContent(company.powerBiUrl);
    setIsHtml(false);
    setContentError(false);
    setEmbedKey(prev => prev + 1);
  };

  /**
   * Handle Power BI link selection for multiple dashboards
   */
  const handlePowerBiLinkSelect = (link: PowerBILink) => {
    setSelectedPowerBiLink(link);
    setPowerBiContent(link.url);
    setIsHtml(link.isHtml);
    setContentError(false);
    setEmbedKey(prev => prev + 1);
  };

  /**
   * Return to company selection
   */
  const handleBackToCompanies = () => {
    setSelectedCompany(null);
    setPowerBiContent(undefined);
  };

  /**
   * Return to Power BI links selection
   */
  const handleBackToPowerBiLinks = () => {
    setSelectedPowerBiLink(null);
    setPowerBiContent(undefined);
  };

  /**
   * Force le rafraîchissement du contenu Power BI
   */
  const refreshPowerBI = () => {
    setContentError(false);
    setIsLoading(true);
    
    setTimeout(() => {
      setEmbedKey(prev => prev + 1);
      setIsLoading(false);
    }, 800);
  };

  /**
   * Ouvre le tableau de bord Power BI dans un nouvel onglet
   */
  const openInNewTab = () => {
    if (!powerBiContent) return;
    
    if (isHtml && powerBiContent.includes('<iframe') && powerBiContent.includes('src=')) {
      const srcMatch = powerBiContent.match(/src=["'](.*?)["']/i);
      if (srcMatch && srcMatch[1]) {
        window.open(srcMatch[1], '_blank', 'noopener,noreferrer');
        return;
      }
    }
    
    if (!isHtml) {
      window.open(powerBiContent, '_blank', 'noopener,noreferrer');
    }
  };

  /**
   * Gère l'erreur de chargement du contenu PowerBI
   */
  const handleContentError = () => {
    setContentError(true);
    setIsLoading(false);
  };

  /**
   * Render company cards for PDG view
   */
  const renderCompanyCards = () => {
    if (companyLinks.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companyLinks.map((company) => (
          <CompanyCard
            key={company.companyName}
            companyName={company.companyName}
            powerBiUrl={company.powerBiUrl}
            onSelect={() => handleCompanySelect(company)}
          />
        ))}
      </div>
    );
  };

  /**
   * Render Power BI link cards for multiple dashboards view
   */
  const renderPowerBiLinkCards = () => {
    if (powerBiLinks.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {powerBiLinks.map((link) => (
          <PowerBILinkCard
            key={link.id}
            link={link}
            onSelect={() => handlePowerBiLinkSelect(link)}
          />
        ))}
      </div>
    );
  };

  /**
   * Rend le contenu Power BI
   */
  const renderPowerBiContent = () => {
    if (!powerBiContent) {
      return (
        <div className="aspect-video bg-card rounded-lg flex flex-col items-center justify-center border border-theme">
          <p className="text-secondary-color mb-3">Aucun dashboard Power BI configuré pour cet utilisateur</p>
          {auth?.user?.role === 'Admin' && (
            <p className="text-sm text-secondary-color">
              Vous pouvez configurer une URL ou du HTML Power BI pour cet utilisateur dans la section utilisateurs.
            </p>
          )}
        </div>
      );
    }

    if (contentError) {
      return (
        <div className="aspect-video bg-red-500/10 rounded-lg flex flex-col items-center justify-center border border-red-500/20">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-red-500 mb-3">Erreur de chargement du contenu Power BI</p>
          <p className="text-xs text-red-500 mb-3 max-w-md text-center">
            Utilisez l'option "Publier sur le web" dans Power BI pour obtenir un code d'intégration valide.
          </p>
          <div className="flex flex-col md:flex-row gap-2 mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              icon={RotateCw}
              onClick={refreshPowerBI}
            >
              Réessayer
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg overflow-hidden bg-card border border-theme">
        {/* La prop key force le composant à se remonter lorsque le contenu change */}
        <PowerBIEmbed 
          key={embedKey}
          powerBiContent={powerBiContent}
          isHtml={isHtml}
          refreshContent={refreshPowerBI}
          openInNewTab={openInNewTab}
        />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* En-tête de la page */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary-color">Outil d'analyse</h1>
            <p className="text-sm text-secondary-color">
              {currentUser?.role === 'PDG' 
                ? "Visualisez les tableaux de bord de toutes vos entreprises"
                : powerBiLinks.length > 0
                  ? "Sélectionnez un tableau de bord à visualiser"
                  : "Visualisez et analysez vos données en temps réel"
              }
            </p>
          </div>
        </div>
        
        {/* Badge "Vue Utilisateur" when admin is viewing another user */}
        {viewingUser && auth?.user?.role === 'Admin' && (
          <div className="flex items-center">
            <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-700/50 mr-2">
              Vue Utilisateur: {viewingUser.name}
            </span>
            <button
              onClick={resetToAdminView}
              className={`text-xs text-primary ${isDark ? '' : 'hover:underline'} flex items-center gap-1`}
            >
              <X className="w-3 h-3" />
              Retour à ma vue
            </button>
          </div>
        )}
      </div>

      {/* Description de l'outil */}
      <div className="bg-card rounded-lg shadow-sm p-6 border border-theme">
        <p className="text-primary-color">
          {currentUser?.role === 'PDG' 
            ? "En tant que PDG, vous avez accès aux tableaux de bord de toutes vos entreprises. Sélectionnez une entreprise ci-dessous pour visualiser ses données."
            : powerBiLinks.length > 0
              ? "Vous avez accès à plusieurs tableaux de bord Power BI. Sélectionnez celui que vous souhaitez visualiser ci-dessous."
              : "Utilisez cet outil d'analyse pour explorer vos données et obtenir des insights précieux sur les performances de votre entreprise et visualiser les leviers de croissance."
          }
        </p>
      </div>

      {/* Main content area */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-theme">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-primary-color">
            {selectedCompany 
              ? `Tableau de bord - ${selectedCompany.companyName}`
              : selectedPowerBiLink
                ? selectedPowerBiLink.name
                : currentUser?.role === 'PDG'
                  ? "Sélectionnez une entreprise"
                  : powerBiLinks.length > 0
                    ? "Sélectionnez un tableau de bord"
                    : "Tableau de bord interactif"
            }
          </h2>
          <div className="flex gap-2">
            {selectedCompany && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToCompanies}
              >
                Retour aux entreprises
              </Button>
            )}
            {selectedPowerBiLink && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToPowerBiLinks}
              >
                Retour aux tableaux de bord
              </Button>
            )}
            {powerBiContent && (
              <Button 
                variant="outline" 
                size="sm" 
                icon={RotateCw}
                onClick={refreshPowerBI}
              >
                Actualiser
              </Button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="aspect-video bg-theme bg-opacity-80 flex items-center justify-center rounded-lg border border-theme">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-3"></div>
              <p className="text-secondary-color">Chargement du tableau de bord...</p>
            </div>
          </div>
        ) : (
          <div className="min-h-[600px]">
            {/* Show company cards for PDG without selection */}
            {currentUser?.role === 'PDG' && !selectedCompany && companyLinks.length > 0
              ? renderCompanyCards()
              /* Show Power BI link cards for users with multiple dashboards */
              : powerBiLinks.length > 0 && !selectedPowerBiLink
                ? renderPowerBiLinkCards()
                /* Show actual Power BI content */
                : renderPowerBiContent()
            }
          </div>
        )}
      </div>
      
      {/* Conseils d'utilisation */}
      {(!currentUser?.role || 
        (currentUser.role !== 'PDG' && powerBiLinks.length === 0) || 
        selectedCompany || 
        selectedPowerBiLink) && powerBiContent && (
        <div className="bg-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="text-md font-semibold text-primary-color mb-3">Conseils d'utilisation</h3>
          <ul className="list-disc list-inside space-y-2 text-secondary-color">
            <li>Utilisez les filtres disponibles dans le tableau de bord pour affiner votre analyse</li>
            <li>Survolez les graphiques pour obtenir plus de détails sur les données</li>
            <li>Cliquez sur les éléments du tableau de bord pour creuser plus profondément dans les données</li>
            <li>Si les données ne s'affichent pas correctement, utilisez le bouton "Actualiser"</li>
          </ul>
        </div>
      )}
    </div>
  );
}