import React, { useState, useContext, useEffect } from 'react';
import { BarChart3, LineChart, Mail, User, AlertCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import ParticleBackground from '../components/ParticleBackground';

function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Rediriger vers le dashboard si l'utilisateur est déjà connecté
  useEffect(() => {
    if (auth?.user) {
      navigate('/dashboard');
    }
  }, [auth?.user, navigate]);
  
  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await auth?.sendMagicLink(email);
      setMagicLinkSent(true);
    } catch (error) {
      console.error('Magic link send error:', error);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await auth?.loginWithEmailPassword(email, password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Admin login error:', error);
    }
  };

  const handleAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await auth?.signupWithEmailPassword(email, password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Admin signup error:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-theme">
      <ParticleBackground />
      
      {/* Header simple - sans bordure */}
      <header className="py-4 px-6">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold gradient-text">Solution 360</h1>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <div className="flex-1 flex flex-col">
        <div className="container mx-auto px-6 py-12 flex flex-col lg:flex-row items-center gap-12 relative z-10">
          <div className="flex-1 space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="gradient-text">Solution 360°</span>
              <br />
              pour votre entreprise
            </h1>
            <p className="text-lg text-secondary-color max-w-xl">
              Plateforme complète d'analyse et de gestion pour optimiser vos performances et prendre des décisions éclairées.
            </p>
          </div>

          {/* Auth Form */}
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h2 className="py-3 text-lg font-medium text-primary-color">
                {isAdmin 
                  ? (isSignup ? 'Inscription Admin' : 'Connexion Admin')
                  : (magicLinkSent ? 'Vérifiez votre email' : 'Connexion')
                }
              </h2>
            </div>

            {auth?.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-500">{auth.error}</p>
              </div>
            )}

            <div className="card-gradient border border-theme rounded-xl p-8">
              {!isAdmin ? (
                // User Magic Link Login
                !magicLinkSent ? (
                  <form onSubmit={handleSendMagicLink} className="space-y-6 formBox">
                    <div className="form-field">
                      <label className="block text-sm font-medium text-primary-color mb-2">
                        Email 
                      </label>
                      <div className="form-field-with-icon">
                        <Mail className="form-field-icon w-5 h-5" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-theme border border-theme rounded-lg text-primary-color focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder="votre@email.com"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-secondary text-white font-medium py-2 rounded-lg hover:opacity-90 transition-opacity"
                      disabled={auth?.isLoading}
                    >
                      {auth?.isLoading ? 'Envoi en cours...' : 'Envoyer le lien de connexion'}
                    </button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setIsAdmin(true)}
                        className="text-sm text-primary hover:underline"
                      >
                        Connexion Admin
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-primary-color">
                        Un lien de connexion a été envoyé à votre adresse email.
                        Veuillez vérifier votre boîte de réception et cliquer sur le lien pour vous connecter.
                      </p>
                    </div>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMagicLinkSent(false);
                          setEmail('');
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        Retour
                      </button>
                    </div>
                  </div>
                )
              ) : (
                // Admin Login/Signup
                <form onSubmit={isSignup ? handleAdminSignup : handleAdminLogin} className="space-y-6 formBox">
                  <div className="form-field">
                    <label className="block text-sm font-medium text-primary-color mb-2">
                      Email 
                    </label>
                    <div className="form-field-with-icon">
                      <Mail className="form-field-icon w-5 h-5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-theme border border-theme rounded-lg text-primary-color focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="admin@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="block text-sm font-medium text-primary-color mb-2">
                      Mot de passe
                    </label>
                    <div className="form-field-with-icon">
                      <Lock className="form-field-icon w-5 h-5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-theme border border-theme rounded-lg text-primary-color focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-primary to-secondary text-white font-medium py-2 rounded-lg hover:opacity-90 transition-opacity"
                    disabled={auth?.isLoading}
                  >
                    {auth?.isLoading 
                      ? (isSignup ? 'Inscription...' : 'Connexion...')
                      : (isSignup ? 'S\'inscrire' : 'Se connecter')
                    }
                  </button>
                  <div className="text-center space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdmin(false);
                        setEmail('');
                        setPassword('');
                      }}
                      className="text-sm text-primary hover:underline block w-fit mx-auto"
                    >
                      Retour à la connexion utilisateur
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="container mx-auto px-6 py-16 relative z-10">
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="gradient-text">Fonctionnalités principales</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card-gradient border border-theme rounded-xl p-6">
              <BarChart3 className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-primary-color mb-2">Analyse avancée</h3>
              <p className="text-secondary-color">Visualisez et analysez vos données en temps réel.</p>
            </div>
            <div className="card-gradient border border-theme rounded-xl p-6">
              <LineChart className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-primary-color mb-2">Suivi des performances</h3>
              <p className="text-secondary-color">Mesurez et optimisez vos indicateurs clés.</p>
            </div>
            <div className="card-gradient border border-theme rounded-xl p-6">
              <User className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-primary-color mb-2">Gestion d'équipe</h3>
              <p className="text-secondary-color">Collaborez efficacement avec votre équipe.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer simple */}
      <footer className="py-4 px-6 text-center relative z-10">
        <p className="text-sm text-secondary-color">© 2023-2025 Solution 360. Tous droits réservés.</p>
      </footer>
    </div>
  );
}

export default HomePage;