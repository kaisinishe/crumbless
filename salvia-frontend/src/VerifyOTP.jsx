import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from './api';

export default function VerifyOTP() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState(location.state?.email || '');
  const [otpCode, setOtpCode] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (email) {
      setMessage("A verification code was sent to your email.");
    }
  }, [email]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    
    try {
      await api.post('/verify-otp', { email, otp_code: otpCode });
      alert("✅ Account successfully verified! You can now log in.");
      navigate('/'); 
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed. Please check the code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Please enter your Email Address first.");
      return;
    }
    setError('');
    setMessage('Sending new code...');
    setIsLoading(true);
    
    try {
      await api.post('/resend-otp', { email });
      setMessage("✅ A new code has been sent!");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend code.");
      setMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col items-center justify-center p-4 sm:p-6">
      
      <div className="w-full max-w-md bg-card border border-border rounded-[2rem] shadow-xl p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-primary tracking-tight mb-2">🌿 salvia.</h1>
          <h2 className="text-xl font-extrabold text-foreground mt-4">Verify Your Account</h2>
          <p className="text-sm text-muted-foreground mt-2 font-medium">
            Enter the 6-digit code we sent you to unlock your account.
          </p>
        </div>
        
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm font-bold p-4 rounded-xl mb-6 flex items-center gap-3">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}
        
        {message && !error && (
          <div className="bg-primary/10 text-primary text-sm font-bold p-4 rounded-xl mb-6 flex items-center gap-3">
            <span className="text-lg">📩</span> {message}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-5">
          
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">Email Address</label>
            <input 
              type="email" 
              placeholder="e.g., test@salvia.md" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full p-4 bg-input-background border border-border rounded-xl font-medium outline-primary transition-all focus:shadow-sm text-foreground" 
            />
          </div>
          
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 ml-1">6-Digit Code</label>
            <input 
              type="text" 
              placeholder="000000" 
              maxLength="6"
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} 
              required 
              className="w-full p-4 text-center text-2xl tracking-[0.5em] bg-input-background border border-border rounded-xl font-black outline-primary transition-all focus:shadow-sm text-foreground" 
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading || otpCode.length !== 6}
            className="w-full py-4 mt-2 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-md cursor-pointer disabled:opacity-70 flex justify-center items-center"
          >
            {isLoading ? 'Verifying...' : 'Verify Account'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-center border-t border-border pt-6">
          <button 
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-2"
          >
            Didn't receive a code? Resend
          </button>
          
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-2"
          >
            ← Back to Login
          </button>
        </div>

      </div>
    </div>
  );
}