import React, { useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import ParticleBackground from '../components/ParticleBackground';

const VerifyEmailPage: React.FC = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const hasVerified = useRef(false);

  // Separate effect for handling redirection when auth state changes
  useEffect(() => {
    if (auth?.user) {
      console.log('User authenticated, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [auth?.user, navigate]);

  useEffect(() => {
    const verifyMagicLink = async () => {
      // Only run verification once
      if (hasVerified.current) return;
      hasVerified.current = true;

      try {
        // Check if we're on the verify-email page with a magic link
        if (window.location.href.includes('apiKey=')) {
          await auth?.verifyMagicLink();
        }
      } catch (error) {
        console.error('Error verifying magic link:', error);
        // If there's an error but we have a user, still redirect to dashboard
        if (auth?.user) {
          navigate('/dashboard');
        } else {
          // Only redirect to home if we don't have a user
          setTimeout(() => {
            navigate('/');
          }, 3000);
        }
      }
    };

    verifyMagicLink();
  }, [navigate]); // Remove auth from dependencies

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center relative overflow-hidden">
      <ParticleBackground />
      <div className="relative z-10 bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Vérification de l'email
        </h1>
        <div className="text-center">
          <p className="text-gray-300 mb-4">
            {auth?.isLoading 
              ? 'Vérification en cours...'
              : auth?.error 
                ? 'Une erreur est survenue. Vous allez être redirigé vers la page d\'accueil.'
                : auth?.user
                  ? 'Vérification réussie ! Vous allez être redirigé vers le tableau de bord.'
                  : 'Vérification en cours...'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage; 