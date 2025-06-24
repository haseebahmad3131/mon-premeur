/**
 * Fournisseur de contexte d'authentification
 * Gère l'état d'authentification utilisateur dans toute l'application
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword as firebaseSignIn,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInWithCustomToken,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { 
  doc, 
  updateDoc, 
  arrayUnion, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  DocumentData,
  query,
  where
} from 'firebase/firestore';
import { getIpAddress } from '../lib/api';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { AuthState, User } from '../types';

/**
 * Définition du type de contexte Auth
 */
export interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createUser: (email: string, password: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: () => Promise<void>;
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  signupWithEmailPassword: (email: string, password: string) => Promise<void>;
}

// Créer le contexte auth avec une valeur par défaut null
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Hook personnalisé pour accéder au contexte auth
 * @returns Le contexte auth
 * @throws Erreur si utilisé en dehors d'un AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé au sein d\'un AuthProvider');
  }
  return context;
}

/**
 * Composant fournisseur d'authentification
 * 
 * @param props - Props du composant
 * @returns Composant fournisseur
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // Gérer les changements d'état d'auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await loadUserData(user);
        } catch (error) {
          console.error('Error fetching user data:', error);
          
          // Vérifier les erreurs liées au réseau
          const errorMessage = (error as Error).message || '';
          if (errorMessage.includes('offline') || errorMessage.includes('network')) {
            setAuthState({
              user: null,
              isLoading: false,
              error: 'Problème de connexion Internet. Vérifiez votre connexion et réessayez.',
            });
          } else {
            setAuthState({
              user: null,
              isLoading: false,
              error: 'Impossible de charger les données utilisateur. Veuillez réessayer.',
            });
          }
        }
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          error: null,
        });
      }
    });

    // Nettoyage de l'abonnement
    return () => unsubscribe();
  }, []);

  /**
   * Charger les données utilisateur depuis Firestore
   * 
   * @param firebaseUser - Objet utilisateur Firebase
   */
  const loadUserData = async (firebaseUser: FirebaseUser) => {
    try {
      // Obtenir les données utilisateur depuis Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Créer un objet utilisateur de base même si tous les champs ne sont pas présents
        const userProfile: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: userData.role || 'user',
          name: userData.name || 'Utilisateur',
          company: userData.company || '',
          powerBiUrl: userData.powerBiUrl || '',
          profileImageUrl: userData.profileImageUrl || '',
          lastLogin: firebaseUser.metadata.lastSignInTime || new Date().toISOString(),
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          lastLoginIp: userData.lastLoginIp || '',
          loginCount7Days: userData.loginCount7Days || 0,
          loginHistory: userData.loginHistory || []
        };
        
        setAuthState({
          user: userProfile,
          isLoading: false,
          error: null,
        });
      } else {
        // Créer un document utilisateur par défaut s'il n'existe pas
        const defaultUser: Omit<User, 'id'> = {
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Utilisateur',
          company: '',
          role: 'Employé',
          lastLogin: firebaseUser.metadata.lastSignInTime || new Date().toISOString(),
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          lastLoginIp: '',
          loginCount7Days: 0,
          loginHistory: []
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), defaultUser);
        
        setAuthState({
          user: { id: firebaseUser.uid, ...defaultUser },
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Error in loadUserData:', error);
      throw error;
    }
  };

  /**
   * Se connecter avec email et mot de passe
   * 
   * @param email - Email utilisateur
   * @param password - Mot de passe utilisateur
   */
  const signIn = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));
      
      // Tenter de se connecter avec Firebase Auth
      const userCredential = await firebaseSignIn(auth, email, password);
      
      // Obtenir l'adresse IP - gérer le cas où cela pourrait échouer
      let ipAddress = '';
      try {
        ipAddress = await getIpAddress();
      } catch (ipError) {
        console.error('Error fetching IP address:', ipError);
        ipAddress = 'inconnu';
      }
      
      // Essayer d'obtenir les données utilisateur depuis Firestore
      try {
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Ignorer la vérification des restrictions IP s'il y a des problèmes de connexion
          try {
            await validateIpRestrictions(userData, ipAddress);
          } catch (restrictionError) {
            console.error('IP restriction error:', restrictionError);
            setAuthState({
              user: null,
              isLoading: false,
              error: (restrictionError as Error).message,
            });
            await firebaseSignOut(auth);
            throw restrictionError;
          }
          
          // Mettre à jour l'historique de connexion
          const now = new Date().toISOString();
          try {
            await updateLoginHistory(userRef, userData, ipAddress, now);
          } catch (historyError) {
            console.error('Error updating login history:', historyError);
            // Continuer malgré cette erreur
          }
        } else {
          // Créer un enregistrement utilisateur par défaut s'il n'en existe pas
          const now = new Date().toISOString();
          const defaultUserData = {
            email: userCredential.user.email || '',
            name: userCredential.user.displayName || 'Utilisateur',
            company: '',
            role: 'Employé',
            lastLogin: now,
            lastLoginIp: ipAddress,
            loginCount7Days: 1,
            createdAt: now,
            updatedAt: now,
            loginHistory: [{
              timestamp: now,
              ipAddress,
              status: 'success'
            }]
          };
          
          try {
            await setDoc(userRef, defaultUserData);
          } catch (createError) {
            console.error('Error creating default user data:', createError);
            // Continuer malgré cette erreur
          }
        }
      } catch (firestoreError) {
        console.error('Error accessing Firestore after login:', firestoreError);
        // Continuer le processus de connexion même si les opérations Firestore échouent
      }
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = (error as Error).message;
      
      // Fournir des messages d'erreur conviviaux
      if (errorMessage.includes('network') || errorMessage.includes('offline')) {
        errorMessage = 'Problème de connexion Internet. Vérifiez votre connexion et réessayez.';
      } else if (errorMessage.includes('wrong-password') || errorMessage.includes('user-not-found')) {
        errorMessage = 'Email ou mot de passe incorrect.';
      } else if (errorMessage.includes('too-many-requests')) {
        errorMessage = 'Trop de tentatives de connexion. Veuillez réessayer plus tard.';
      } else if (errorMessage.includes('user-disabled')) {
        errorMessage = 'Ce compte a été désactivé. Contactez l\'administrateur.';
      }
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  };

  /**
   * Valider les restrictions IP pour les utilisateurs employés
   * 
   * @param userData - Données utilisateur provenant de Firestore
   * @param ipAddress - Adresse IP actuelle
   */
  const validateIpRestrictions = async (userData: DocumentData, ipAddress: string) => {
    // Vérifier la restriction IP uniquement pour les employés (comparaison insensible à la casse)
    if (userData.role?.toLowerCase() === 'employé') {
      try {
        // Obtenir les données de l'entreprise
        const companiesRef = collection(db, 'companies');
        const companiesSnapshot = await getDocs(companiesRef);
        const companyDoc = companiesSnapshot.docs.find(
          doc => doc.data().name.toLowerCase() === userData.company.toLowerCase()
        );
        
        if (companyDoc) {
          const companyData = companyDoc.data();
          if (companyData.allowedIps?.length > 0 && !companyData.allowedIps.includes(ipAddress)) {
            const errorMessage = `Accès refusé: Votre IP (${ipAddress}) n'est pas autorisée pour cette entreprise. Les IPs autorisées sont: ${companyData.allowedIps.join(', ')}.`;
            
            // Journaliser la tentative échouée
            const userRef = doc(db, 'users', userData.id);
            try {
              await updateDoc(userRef, {
                loginHistory: arrayUnion({
                  timestamp: new Date().toISOString(),
                  ipAddress,
                  status: 'failed',
                  reason: errorMessage
                })
              });
            } catch (e) {
              console.error('Failed to log IP restriction violation:', e);
            }
            
            throw new Error(errorMessage);
          }
        } else {
          console.warn(`Company not found: ${userData.company}`);
          // Ne pas bloquer l'utilisateur dans ce cas - problème de configuration de l'entreprise
        }
      } catch (error) {
        // Ne lever que les erreurs spécifiques à l'IP, sinon juste journaliser et continuer
        if ((error as Error).message.includes('Accès refusé')) {
          throw error;
        }
        console.error('Error checking IP restrictions:', error);
      }
    }
  };

  /**
   * Mettre à jour l'historique de connexion pour un utilisateur
   * 
   * @param userRef - Référence au document utilisateur
   * @param userData - Données utilisateur provenant de Firestore
   * @param ipAddress - Adresse IP actuelle
   * @param timestamp - Horodatage de connexion
   */
  const updateLoginHistory = async (userRef: ReturnType<typeof doc>, userData: DocumentData, ipAddress: string, timestamp: string) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Obtenir l'historique de connexion existant
      const loginHistory = userData.loginHistory || [];
      
      // Compter les connexions au cours des 7 derniers jours
      const loginCount7Days = loginHistory.filter(
        (entry: { timestamp: string }) => 
        new Date(entry.timestamp) > sevenDaysAgo
      ).length + 1; // Inclure la connexion actuelle
      
      await updateDoc(userRef, {
        lastLogin: timestamp,
        lastLoginIp: ipAddress,
        loginCount7Days,
        loginHistory: arrayUnion({
          timestamp,
          ipAddress,
          status: 'success'
        })
      });
    } catch (error) {
      console.error('Error updating login history:', error);
      // Ne pas lever l'erreur - c'est une opération non critique
    }
  };

  /**
   * Déconnecter l'utilisateur actuel
   */
  const signOut = async () => {
    try {
      // Store the current user's role before signing out
      const currentUserRole = authState.user?.role;
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Clear the auth state
      setAuthState({
        user: null,
        isLoading: false,
        error: null,
      });

      // If the user was not an admin, reload the page
      if (currentUserRole !== 'Admin') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthState(prev => ({
        ...prev,
        error: "Problème lors de la déconnexion. Veuillez réessayer.",
      }));
      throw error;
    }
  };

  /**
   * Créer un nouvel utilisateur avec email et mot de passe
   * 
   * @param email - Email utilisateur
   * @param password - Mot de passe utilisateur
   */
  const createUser = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Create user error:', error);
      
      let errorMessage = (error as Error).message;
      
      // Fournir des messages d'erreur conviviaux
      if (errorMessage.includes('email-already-in-use')) {
        errorMessage = 'Cette adresse email est déjà utilisée.';
      } else if (errorMessage.includes('weak-password')) {
        errorMessage = 'Le mot de passe est trop faible. Utilisez au moins 6 caractères.';
      } else if (errorMessage.includes('invalid-email')) {
        errorMessage = 'Adresse email invalide.';
      } else if (errorMessage.includes('network') || errorMessage.includes('offline')) {
        errorMessage = 'Problème de connexion Internet. Vérifiez votre connexion et réessayez.';
      }
      
      setAuthState(prev => ({
        ...prev,
        error: errorMessage,
      }));
      
      throw error;
    }
  };

  /**
   * Envoyer un email de réinitialisation de mot de passe
   * 
   * @param email - Email de l'utilisateur
   */
  const sendPasswordResetEmail = async (email: string) => {
    try {
      setAuthState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      // Configuration de l'action code settings pour l'email personnalisé
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true
      };

      await firebaseSendPasswordResetEmail(auth, email, actionCodeSettings);
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error sending password reset email:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Une erreur est survenue lors de l\'envoi de l\'email de réinitialisation. Veuillez réessayer.'
      }));
      throw error;
    }
  };

  /**
   * Envoyer un lien de connexion magique à l'email de l'utilisateur
   * 
   * @param email - Email de l'utilisateur
   */
  const sendMagicLink = async (email: string) => {
    console.log('Context: Sending magic link to:', email);
    try {
      setAuthState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      // Validate email
      if (!email || !email.includes('@')) {
        throw new Error('Invalid email address');
      }

      // Check if user exists in Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Aucun compte trouvé avec cette adresse email. Veuillez contacter votre administrateur pour créer un compte.');
      }
      console.log('Context: User found in Firestore');
      // Configure the action code settings
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true
      };

      // Send the magic link
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);

      // Save the email for verification
      window.localStorage.setItem('emailForSignIn', email);
      
      console.log('Context: Magic link sent successfully');
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      console.error('Context: Error sending magic link:', error);
      let errorMessage = 'An error occurred while sending the magic link.';
      
      if (error instanceof Error) {
        if (error.message.includes('invalid-email')) {
          errorMessage = 'Invalid email address.';
        } else if (error.message.includes('network') || error.message.includes('offline')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  };

  /**
   * Vérifier le lien magique et connecter l'utilisateur
   */
  const verifyMagicLink = async () => {
    console.log('Context: Verifying magic link');
    try {
      setAuthState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      // Check if the link is a sign-in link
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        throw new Error('Invalid magic link');
      }

      console.log('link is valid');

      // Get the email from localStorage
      console.log('getting email from localStorage');
      let email = window.localStorage.getItem('emailForSignIn');
      console.log('email', email);
      // if (!email) {
      //   throw new Error('Email not found. Please try the magic link again.');
      // }

      // Sign in with the magic link
      console.log('signing in with the magic link:', window.location.href);
      const result = await signInWithEmailLink(auth, email, window.location.href);

      // Clear the email from localStorage
      window.localStorage.removeItem('emailForSignIn');

      // Get IP address
      let ipAddress = '';
      try {
        ipAddress = await getIpAddress();
      } catch (ipError) {
        console.error('Error fetching IP address:', ipError);
        ipAddress = 'inconnu';
      }

      // Get user data from Firestore
      const userRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        //todo: uncomment this when we have a way to validate ip restrictions
        // try {
        //   await validateIpRestrictions(userData, ipAddress);
        // } catch (restrictionError) {
        //   console.error('IP restriction error:', restrictionError);
        //   setAuthState({
        //     user: null,
        //     isLoading: false,
        //     error: (restrictionError as Error).message,
        //   });
        //   await firebaseSignOut(auth);
        //   throw restrictionError;
        // }
        
        // Update login history
        const now = new Date().toISOString();
        await updateLoginHistory(userRef, userData, ipAddress, now);

        // Set the user in auth state
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: null,
          user: {
            id: result.user.uid,
            email: result.user.email || '',
            name: userData.name || 'Utilisateur',
            company: userData.company || '',
            role: userData.role || 'Employé',
            lastLogin: now,
            createdAt: userData.createdAt || now,
            lastLoginIp: ipAddress,
            loginCount7Days: userData.loginCount7Days || 1,
            loginHistory: userData.loginHistory || [{
              timestamp: now,
              ipAddress,
              status: 'success'
            }]
          }
        }));
      } else {
        throw new Error('User data not found. Please contact your administrator.');
      }

      console.log('Context: Magic link verified successfully');
    } catch (error) {
      console.error('Context: Error verifying magic link:', error);
      let errorMessage = 'An error occurred while verifying the magic link.';
      
      if (error instanceof Error) {
        if (error.message.includes('invalid-link')) {
          errorMessage = 'Invalid or expired magic link.';
        } else if (error.message.includes('network') || error.message.includes('offline')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  };

  // Valeur du contexte auth
  const value: AuthContextType = {
    ...authState,
    signIn,
    signOut,
    createUser,
    sendPasswordResetEmail,
    sendMagicLink,
    verifyMagicLink,
    loginWithEmailPassword: signIn, // Reuse existing signIn for admin login
    signupWithEmailPassword: createUser, // Reuse existing createUser for admin signup
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };