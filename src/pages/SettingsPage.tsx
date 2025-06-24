import React, { useState, useContext } from 'react';
import { Settings, Key, Sun, Moon, AlertCircle, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { updateUserPassword } from '../lib/users';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function SettingsPage() {
  const { theme, toggleTheme, setTheme } = useTheme();
  const authContext = useContext(AuthContext);
  const isDark = theme === 'dark';

  // État pour le formulaire de changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État pour le sélecteur de thème
  const [themeSuccess, setThemeSuccess] = useState(false);

  /**
   * Change le thème et enregistre la préférence
   */
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    setThemeSuccess(true);
    setTimeout(() => setThemeSuccess(false), 3000);
  };

  /**
   * Gère la soumission du formulaire de changement de mot de passe
   */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    
    // Validation des entrées
    if (!currentPassword) {
      setPasswordError('Veuillez entrer votre mot de passe actuel');
      return;
    }
    
    if (!newPassword) {
      setPasswordError('Veuillez entrer un nouveau mot de passe');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit comporter au moins 8 caractères');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('Utilisateur non connecté');
      }
      
      // Réauthentifier l'utilisateur avant de changer le mot de passe
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Mettre à jour le mot de passe
      await updatePassword(user, newPassword);
      
      // Réinitialiser le formulaire après succès
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      
      // Enregistrer la date de dernière mise à jour dans Firestore
      await updateDoc(doc(getFirestore(), 'users', user.uid), {
        passwordLastUpdated: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Erreur de changement de mot de passe:', error);
      
      // Gérer les différents types d'erreurs Firebase Auth
      if (error.code === 'auth/wrong-password') {
        setPasswordError('Mot de passe actuel incorrect');
      } else if (error.code === 'auth/weak-password') {
        setPasswordError('Le mot de passe est trop faible. Utilisez au moins 8 caractères.');
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordError('Cette opération est sensible et nécessite une authentification récente. Veuillez vous reconnecter.');
      } else {
        setPasswordError(`Erreur: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary-color">Paramètres</h1>
          <p className="text-sm text-secondary-color">Personnalisez votre expérience</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Section de changement de mot de passe */}
        <div className="bg-card rounded-lg border border-theme p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Key className="w-5 h-5 text-secondary" />
            </div>
            <h2 className="text-lg font-semibold text-primary-color">Sécurité</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              />
              <p className="mt-1 text-xs text-secondary-color">
                Minimum 8 caractères
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-color mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-theme border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-primary-color"
              />
            </div>

            {passwordError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-500">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <p className="text-sm text-green-500">Mot de passe modifié avec succès</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              fullWidth
            >
              Mettre à jour le mot de passe
            </Button>
          </form>
        </div>

        {/* Section des préférences de thème */}
        <div className="bg-card rounded-lg border border-theme p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              {isDark ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-primary" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-primary-color">Apparence</h2>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-secondary-color">
              Choisissez le thème de l'interface qui vous convient le mieux
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border ${
                  theme === 'light'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-theme hover:border-primary/30 transition-colors'
                }`}
              >
                <Sun className={`w-10 h-10 mb-2 ${theme === 'light' ? 'text-primary' : 'text-secondary-color'}`} />
                <span className={`text-sm font-medium ${theme === 'light' ? 'text-primary' : 'text-primary-color'}`}>
                  Clair
                </span>
              </button>

              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border ${
                  theme === 'dark'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-theme hover:border-primary/30 transition-colors'
                }`}
              >
                <Moon className={`w-10 h-10 mb-2 ${theme === 'dark' ? 'text-primary' : 'text-secondary-color'}`} />
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-primary' : 'text-primary-color'}`}>
                  Sombre
                </span>
              </button>
            </div>

            {themeSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <p className="text-sm text-green-500">Thème mis à jour avec succès</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-theme">
            <p className="text-sm text-secondary-color">
              Le thème sélectionné sera enregistré et appliqué automatiquement à votre prochaine connexion.
            </p>
          </div>
        </div>
      </div>

      {/* Section des informations du compte */}
      <div className="bg-card rounded-lg border border-theme p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-primary-color">Informations du compte</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-secondary-color mb-1">Nom</p>
            <p className="text-primary-color">{authContext?.user?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-secondary-color mb-1">Email</p>
            <p className="text-primary-color">{authContext?.user?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-secondary-color mb-1">Entreprise</p>
            <p className="text-primary-color">{authContext?.user?.company || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-secondary-color mb-1">Rôle</p>
            <p className="text-primary-color">{authContext?.user?.role || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}