import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from './api';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id'); 
  const bagId = searchParams.get('bag_id');
  
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [pickupCode, setPickupCode] = useState('');
  const hasAttempted = useRef(false); 

  useEffect(() => {
    const verifyAndCreateOrder = async () => {
      if (hasAttempted.current) return;
      hasAttempted.current = true;

      if (!sessionId || !bagId) {
        setStatus('error');
        return;
      }

      try {
        const response = await api.post('/orders/confirm-payment', { 
            session_id: sessionId, 
            bag_id: parseInt(bagId) 
        });
        
        setPickupCode(response.data.pickup_code);
        setStatus('success');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };

    verifyAndCreateOrder();
  }, [sessionId, bagId]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans">
      <div className="bg-card border border-border p-8 sm:p-10 rounded-3xl shadow-xl max-w-md w-full text-center">
        
        {status === 'processing' && (
          <div className="animate-in fade-in duration-500">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-extrabold mb-2 text-foreground">Verifying Payment...</h2>
            <p className="text-muted-foreground font-medium">Please don't close this window.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-in zoom-in-95 duration-300">
            <div className="bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">❌</div>
            <h2 className="text-2xl font-extrabold text-destructive mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-8 font-medium">We couldn't verify your transaction. No order was created.</p>
            <button onClick={() => navigate('/map')} className="w-full bg-secondary text-secondary-foreground py-3.5 rounded-xl font-bold hover:opacity-90 transition-opacity">
              Return to Map
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="bg-[#E8F0E4] w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner">✅</div>
            <h2 className="text-3xl font-extrabold mb-2 text-foreground tracking-tight">Order Confirmed!</h2>
            <p className="text-muted-foreground mb-8 font-medium">Show this code at the store to collect your Surprise Bag.</p>
            
            <div className="bg-muted/30 border border-border rounded-2xl p-6 mb-8 shadow-sm">
              <p className="text-xs font-black text-muted-foreground mb-2 tracking-[0.3em] uppercase">Your Pickup Code</p>
              <p className="text-5xl sm:text-6xl font-black text-primary tracking-widest m-0">{pickupCode}</p>
            </div>

            {/* 👈 NEW: Added state to the navigation payload */}
            <button onClick={() => navigate('/map', { state: { openOrders: true } })} className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer">
              Go to My Orders
            </button>
          </div>
        )}

      </div>
    </div>
  );
}