import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './login';
import VerifyOTP from './VerifyOTP'; // 👈 NEW: Import the verification screen
import BusinessRegister from './BusinessRegister';
import ClientMap from './ClientMap';
import HQDashboard from './HQDashboard';
import StoreDashboard from './StoreDashboard';
import PaymentSuccess from './PaymentSuccess';
import ClientProfile from './ClientProfile'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* 👈 NEW: Route for the OTP screen */}
        <Route path="/verify" element={<VerifyOTP />} /> 
        <Route path="/business/register" element={<BusinessRegister />} />
        <Route path="/map" element={<ClientMap />} />
        <Route path="/hq/dashboard" element={<HQDashboard />} />
        <Route path="/store/dashboard" element={<StoreDashboard />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/profile" element={<ClientProfile />} />
      </Routes>
    </BrowserRouter>
  );
}