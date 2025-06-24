import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, RotateCw, Bug } from 'lucide-react';
import { Button } from './ui/Button';
import { useTheme } from '../contexts/ThemeContext';

interface PowerBIEmbedProps {
  powerBiContent: string;
  isHtml: boolean;
  refreshContent: () => void;
  openInNewTab: () => void;
}

/**
 * Extrait l'URL d'intégration à partir du HTML ou d'une URL directe
 */
const extractEmbedUrl = (content: string): string | null => {
  // URL directe vers un rapport Power BI
  if (content.includes('powerbi.com') && !content.includes('<iframe')) {
    return content;
  }
  
  // Extraire depuis le HTML d'iframe
  if (content.includes('<iframe') && content.includes('src=')) {
    const srcMatch = content.match(/src=["'](.*?)["']/i);
    if (srcMatch && srcMatch[1]) {
      return srcMatch[1];
    }
  }
  
  return null;
};

/**
 * Composant PowerBIEmbed pour intégrer du contenu PowerBI (HTML ou URL)
 */
export default function PowerBIEmbed({ 
  powerBiContent, 
  isHtml, 
  refreshContent, 
  openInNewTab 
}: PowerBIEmbedProps) {
  // État
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Références
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Réinitialiser le timeout de chargement
  useEffect(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 15000);
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading]);
  
  // Traiter le contenu PowerBI lorsqu'il change
  useEffect(() => {
    if (!powerBiContent) return;
    
    // Réinitialiser l'état pour le nouveau contenu
    setError(null);
    setIsLoading(true);
    
    try {
      if (isHtml) {
        // Contenu HTML (iframe)
        if (containerRef.current) {
          // Nettoyer le conteneur
          containerRef.current.innerHTML = '';
          
          // Ajouter le contenu HTML directement
          const divContainer = document.createElement('div');
          divContainer.className = 'powerbi-html-container';
          divContainer.innerHTML = powerBiContent;
          
          // Traiter tous les iframes pour assurer qu'ils sont bien configurés
          const iframes = divContainer.querySelectorAll('iframe');
          iframes.forEach(iframe => {
            // Ajouter des attributs pour sécurité et performance
            iframe.setAttribute('loading', 'eager');
            iframe.setAttribute('importance', 'high');
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals');
            
            // Assurer que les styles sont appliqués
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.minHeight = '500px';
            iframe.style.border = 'none';
            
            // Gestionnaires d'événements
            iframe.onload = () => {
              setIsLoading(false);
            };
            
            iframe.onerror = () => {
              setError("Erreur de chargement du contenu Power BI");
              setIsLoading(false);
            };
          });
          
          // Ajouter au conteneur
          containerRef.current.appendChild(divContainer);
          
          // Fallback si aucun iframe n'est trouvé
          if (iframes.length === 0) {
            setIsLoading(false);
          }
        }
      } else {
        // URL directe
        const directUrl = powerBiContent;
        
        if (containerRef.current) {
          // Nettoyer le conteneur
          containerRef.current.innerHTML = '';
          
          // Créer l'iframe pour l'URL directe
          const iframe = document.createElement('iframe');
          iframe.className = 'powerbi-iframe';
          iframe.src = directUrl;
          iframe.width = '100%';
          iframe.height = '100%';
          iframe.style.border = 'none';
          iframe.style.minHeight = '500px';
          iframe.style.display = 'block';
          iframe.setAttribute('allowfullscreen', 'true');
          iframe.setAttribute('loading', 'eager');
          iframe.setAttribute('importance', 'high');
          iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals');
          
          iframe.onload = () => {
            setIsLoading(false);
          };
          
          iframe.onerror = () => {
            setError("Le rapport PowerBI n'a pas pu être chargé");
            setIsLoading(false);
          };
          
          containerRef.current.appendChild(iframe);
        }
      }
    } catch (err) {
      setError(`Erreur lors de l'intégration: ${(err as Error).message}`);
      setIsLoading(false);
    }
  }, [powerBiContent, isHtml]);
  
  // UI d'erreur
  if (error) {
    return (
      <div className="aspect-video bg-red-500/10 rounded-lg flex flex-col items-center justify-center p-4 border border-red-500/20">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-500 mb-3">{error}</p>
        <p className="text-xs text-red-400 mb-3 max-w-md text-center">
          Utilisez l'option "Publier sur le web" dans Power BI pour obtenir un code d'intégration valide.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            icon={RotateCw}
            onClick={refreshContent}
          >
            Réessayer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openInNewTab}
            icon={ExternalLink}
          >
            Ouvrir dans un nouvel onglet
          </Button>
        </div>
      </div>
    );
  }

  // Rendu principal du composant
  return (
    <div className="aspect-video relative">
      {/* Conteneur pour le contenu PowerBI */}
      <div 
        ref={containerRef} 
        className="direct-powerbi-container w-full h-full min-h-[500px]"
      />
      
      {/* Overlay de chargement */}
      {isLoading && (
        <div className="absolute inset-0 bg-theme bg-opacity-80 flex items-center justify-center z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-3"></div>
            <p className="text-secondary-color">Chargement du rapport Power BI...</p>
          </div>
        </div>
      )}
    </div>
  );
}