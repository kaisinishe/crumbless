import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google'; // 👈 NEW
import api from './api'; 

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleSuccessRoute = (token) => {
    localStorage.setItem('access_token', token);
    localStorage.removeItem('salvia_user_lat');
    localStorage.removeItem('salvia_user_lon');
    localStorage.removeItem('salvia_user_label');
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role === 'company_admin') navigate('/hq/dashboard'); 
    else if (payload.role === 'store_manager') navigate('/store/dashboard'); 
    else navigate('/map');       
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', email); 
        formData.append('password', password);
        const response = await api.post('/login', formData);
        handleSuccessRoute(response.data.access_token);
      } else {
        await api.post('/register', { email, password, name });
        navigate('/verify', { state: { email: email } }); // 👈 FIXED: Uses email
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 👈 NEW: Google Login Handler
const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // 👈 Explicitly tell the backend this is a standard client login
      const response = await api.post('/auth/google', { 
        token: credentialResponse.credential,
        intended_role: "client" 
      });
      handleSuccessRoute(response.data.access_token);
    } catch (err) {
      setError(err.response?.data?.detail || "Google Login failed.");
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col items-center justify-center p-4 sm:p-6">
      
      <div className="w-full max-w-md bg-card border border-border rounded-[2rem] shadow-xl p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-primary tracking-tight mb-2"> Crumbless </h1>
          <h2 className="text-xl font-extrabold text-foreground mt-4">
            {isLogin ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 font-medium">
            {isLogin ? 'Log in to rescue delicious food' : 'Join us in reducing food waste'}
          </p>
        </div>
        
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm font-bold p-4 rounded-xl mb-6 flex items-center gap-3">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}

        {/* 👈 NEW: Google Sign-In Button */}
        <div className="mb-6 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login was unsuccessful')}
              theme="outline"
              size="large"
              shape="pill"
              text={isLogin ? "signin_with" : "signup_with"}
              width="300"
            />
        </div>

        <div className="flex items-center gap-3 mb-6">
           <div className="h-px bg-border flex-1"></div>
           <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">OR EMAIL</span>
           <div className="h-px bg-border flex-1"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {!isLogin && (
            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">Full Name</label>
              <input 
                type="text" placeholder="e.g., Maria Ciobanu" 
                value={name} onChange={(e) => setName(e.target.value)} required 
                className="w-full p-4 bg-input-background border border-border rounded-xl font-medium outline-primary" 
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">Email Address</label>
            <input 
              type="email" placeholder="contact@crumbless.md" 
              value={email} onChange={(e) => setEmail(e.target.value)} required 
              className="w-full p-4 bg-input-background border border-border rounded-xl font-medium outline-primary" 
            />
          </div>
          
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">Password</label>
            <input 
              type="password" placeholder="••••••••" 
              value={password} onChange={(e) => setPassword(e.target.value)} required 
              className="w-full p-4 bg-input-background border border-border rounded-xl font-medium outline-primary" 
            />
          </div>

          <button 
            type="submit" disabled={isLoading}
            className="w-full py-4 mt-2 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-md disabled:opacity-70"
          >
            {isLoading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); setPassword(''); }} 
            className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors bg-transparent border-none p-2 cursor-pointer"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4">For Businesses</p>
          <Link to="/business/register" className="inline-block w-full py-3.5 bg-secondary text-secondary-foreground rounded-xl font-bold text-sm hover:opacity-90 shadow-sm">
            Partner with Crumbless
          </Link>
        </div>

      </div>
    </div>
  );
}