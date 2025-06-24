import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, AlertCircle, Mail, Lock } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/Button';
import ParticleBackground from '../components/ParticleBackground';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Rediriger vers le dashboard si l'utilisateur est déjà connecté
  useEffect(() => {
    if (auth?.user) {
      navigate('/dashboard');
    }
  }, [auth?.user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await auth?.signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-theme flex flex-col justify-center">
      <ParticleBackground />
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-card py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 border border-theme">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 rounded-full p-3">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <h2 className="text-center gradient-text text-2xl font-bold mb-8">
            Solution 360
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 rounded-md flex items-center gap-2 text-red-500 border border-red-500/20">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email" className="block text-sm font-medium text-primary-color mb-2">
                Email
              </label>
              <div className="form-field-with-icon">
                <Mail className="form-field-icon w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-theme border border-theme rounded-lg text-primary-color focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="password" className="block text-sm font-medium text-primary-color mb-2">
                Mot de passe
              </label>
              <div className="form-field-with-icon">
                <Lock className="form-field-icon w-5 h-5" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-theme border border-theme rounded-lg text-primary-color focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={auth?.isLoading}
              >
                {auth?.isLoading ? 'Connexion en cours...' : 'Se connecter'}
              </Button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <Link 
              to="/" 
              className="text-secondary hover:text-primary text-sm transition-colors"
            >
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}