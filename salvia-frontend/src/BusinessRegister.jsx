import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google'; // 👈 NEW
import api from './api';

export default function BusinessRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); 
  
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // 👈 NEW: Tell the backend we are trying to create a BUSINESS account
      const response = await api.post('/auth/google', { 
        token: credentialResponse.credential,
        intended_role: "company_admin" 
      });
      
      // Successfully created and logged in via Google! Send them to the dashboard.
      localStorage.setItem('access_token', response.data.access_token);
      navigate('/hq/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || "Google Login failed.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await api.post('/companies/register', { email, password, name });
      navigate('/verify', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px] z-0 pointer-events-none"></div>

      <div className="w-full max-w-md bg-card border border-border rounded-[2rem] shadow-xl p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500 relative z-10">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-secondary tracking-tight mb-2">Crumbless for business</h1>
          <h2 className="text-xl font-extrabold text-foreground mt-4">Partner with us</h2>
          <p className="text-sm text-muted-foreground mt-2 font-medium">
            Turn your surplus food into revenue and reach new customers.
          </p>
        </div>
        
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm font-bold p-4 rounded-xl mb-6 flex items-center gap-3">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}

        {/* 👈 NEW: Google Sign-In Button for Businesses */}
        <div className="mb-6 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login was unsuccessful')}
              theme="outline"
              size="large"
              shape="pill"
              text="signup_with"
              width="300"
            />
        </div>

        <div className="flex items-center gap-3 mb-6">
           <div className="h-px bg-border flex-1"></div>
           <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">OR EMAIL</span>
           <div className="h-px bg-border flex-1"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">Business Name</label>
            <input 
              type="text" placeholder="e.g., La Plăcinte HQ" 
              value={name} onChange={(e) => setName(e.target.value)} required 
              className="w-full p-4 bg-input-background border border-border rounded-xl font-medium outline-secondary transition-all focus:shadow-sm text-foreground" 
            />
          </div>
          
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">Work Email</label>
            <input 
              type="email" placeholder="contact@hq.md" 
              value={email} onChange={(e) => setEmail(e.target.value)} required 
              className="w-full p-4 bg-input-background border border-border rounded-xl font-medium outline-secondary transition-all focus:shadow-sm text-foreground" 
            />
          </div>
          
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">Admin Password</label>
            <input 
              type="password" placeholder="••••••••" 
              value={password} onChange={(e) => setPassword(e.target.value)} required 
              className="w-full p-4 bg-input-background border border-border rounded-xl font-medium outline-secondary transition-all focus:shadow-sm text-foreground" 
            />
          </div>

          <button 
            type="submit" disabled={isLoading}
            className="w-full py-4 mt-2 bg-secondary text-secondary-foreground rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-md cursor-pointer disabled:opacity-70 flex justify-center items-center"
          >
            {isLoading ? 'Setting up...' : 'Create Business Account'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <Link to="/" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-2">
            ← Back to Standard Login
          </Link>
        </div>

      </div>
    </div>
  );
}