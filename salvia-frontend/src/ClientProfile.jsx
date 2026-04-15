import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // 👈 NEW: Import translation hook
import api from './api';
import LanguageSwitcher from './components/LanguageSwitcher'; // 👈 NEW: Import switcher

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Halal', 'Kosher'];
const ALLERGY_OPTIONS = ['Gluten-Free', 'Lactose-Free', 'Nut-Free', 'Sugar-Free'];

const SUPPORT_EMAIL = "salvia.helpdesk@gmail.com";
const EMAIL_PROMPTS = [
  { label: "The store was closed", subject: "Store Closed During Pickup", text: "Hi Salvia Support,\n\nI went to pick up my order but the store was closed. Can you assist me with a refund?" },
  { label: "Dietary label mismatch", subject: "Dietary Issue with Order", text: "Hi Salvia Support,\n\nMy Surprise Bag contained items that didn't match the dietary labels shown in the app." },
  { label: "I need a refund", subject: "Refund Request", text: "Hi Salvia Support,\n\nI need help processing a refund for my recent order. Order details:" },
  { label: "Other questions", subject: "General Support Question", text: "Hi Salvia Support,\n\nI have a question regarding: " }
];

const FAQS = [
  { q: "What is a Surprise Bag?", a: "A Surprise Bag contains unsold, perfectly good surplus food from local stores and restaurants at the end of the day. The exact contents are a surprise, but the value is always guaranteed!" },
  { q: "When do I pick up my food?", a: "Each bag has a specific 'Pickup Window' (e.g., 18:00 - 20:00). You must arrive at the store within this exact timeframe to claim your order." },
  { q: "Can I cancel my reservation?", a: "Yes, you can cancel your order directly from the 'My Orders' tab on the map up to 1 hour before the pickup window begins for a full refund." },
  { q: "What if I have food allergies?", a: "You can set your dietary preferences and allergies in your Profile. Bags that contain your allergens will show a red warning icon. However, since kitchens handle various ingredients, cross-contamination is always a risk. When in doubt, ask the store staff during pickup." }
];

export default function ClientProfile() {
  const { t } = useTranslation(); // 👈 NEW: Initialize translation function
  const [impact, setImpact] = useState(null);
  const [fetchError, setFetchError] = useState(false); 
  const [activeTab, setActiveTab] = useState('Account'); 
  
  const [supportView, setSupportView] = useState('menu'); 
  const [myOrders, setMyOrders] = useState([]); 
  const [reportData, setReportData] = useState({ order_id: "", reason: "", details: "" });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [secOldPwd, setSecOldPwd] = useState('');
  const [secNewPwd, setSecNewPwd] = useState('');
  const [secConfirmPwd, setSecConfirmPwd] = useState('');
  const [isPwdLoading, setIsPwdLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailChangeStep, setEmailChangeStep] = useState("idle"); 
  const [emailChangeOtp, setEmailChangeOtp] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [wantsPwdChange, setWantsPwdChange] = useState(false);
  const [bundledOldPwd, setBundledOldPwd] = useState('');
  const [bundledNewPwd, setBundledNewPwd] = useState('');
  const [bundledConfirmPwd, setBundledConfirmPwd] = useState('');

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', preferences: [], allergies: [], has_password: true
  });

  useEffect(() => {
    fetchImpactData();
    fetchPastOrders();
  }, []);

  const fetchImpactData = async () => {
    try {
      const response = await api.get('/users/me/impact');
      setImpact(response.data);
      setFormData({
        name: response.data.user_details.name || '',
        phone: response.data.user_details.phone || '',
        email: response.data.user_details.email || '',
        preferences: response.data.user_details.preferences || [],
        allergies: response.data.user_details.allergies || [],
        has_password: response.data.user_details.has_password
      });
    } catch (err) { 
      console.error("Error fetching impact:", err); 
      if (err.response?.status !== 401) {
        setFetchError(true);
      }
    }
  };

  const fetchPastOrders = async () => {
    try {
      const response = await api.get('/orders/me');
      setMyOrders(response.data);
    } catch (err) { 
      console.error("Error fetching orders for report dropdown:", err); 
    }
  };

  const handleSaveProfile = async () => {
    try {
      await api.patch('/users/me/profile', {
        name: formData.name,
        phone: formData.phone,
        preferences: formData.preferences.join(','),
        allergies: formData.allergies.join(',')
      });
      alert("✅ Profile updated successfully!");
      fetchImpactData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update profile.");
    }
  };

  const handleStandalonePasswordChange = async () => {
    if (formData.has_password && !secOldPwd) return alert("Please enter your current password.");
    if (!secNewPwd || !secConfirmPwd) return alert("Please fill in all password fields.");
    if (secNewPwd !== secConfirmPwd) return alert("New passwords do not match!");
    
    setIsPwdLoading(true);
    try {
      await api.post('/auth/change-password', { old_password: secOldPwd || null, new_password: secNewPwd });
      alert("✅ Password updated securely! Please log back in.");
      localStorage.removeItem('access_token');
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.detail || "Password update failed.");
    } finally {
      setIsPwdLoading(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmail || newEmail === formData.email) return alert("Please enter a valid, different email address.");
    setIsEmailLoading(true);
    try {
      await api.post('/auth/change-email/request', { new_email: newEmail });
      setEmailChangeStep('verifying');
      alert(`Verification code sent to ${newEmail}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to request email change.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailChangeOtp || emailChangeOtp.length !== 6) return alert("Please enter the full 6-digit code.");
    
    if (wantsPwdChange) {
      if (formData.has_password && !bundledOldPwd) return alert("Please enter your current password.");
      if (!bundledNewPwd || !bundledConfirmPwd) return alert("Please fill out all password fields.");
      if (bundledNewPwd !== bundledConfirmPwd) return alert("New passwords do not match!");
    }

    setIsEmailLoading(true);
    try {
      await api.post('/auth/change-email/verify', { 
        new_email: newEmail, 
        otp_code: emailChangeOtp,
        change_password: wantsPwdChange,
        old_password: bundledOldPwd || null,
        new_password: bundledNewPwd || null
      });
      
      alert("✅ Account credentials successfully updated! For your security, please log back in.");
      localStorage.removeItem('access_token');
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.detail || "Invalid code or verification failed.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    try {
      await api.post('/support/report', reportData);
      alert("✅ Your report has been submitted to Salvia HQ and the store. We will investigate immediately.");
      setSupportView('menu');
      setReportData({ order_id: "", reason: "", details: "" });
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to send report. Check backend connection!");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const toggleArrayItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item) 
        ? prev[field].filter(i => i !== item) 
        : [...prev[field], item]
    }));
  };

  // 👈 FIXED: Wrapped menu labels in t()
  const menuItems = [
    { id: 'Account', label: t('menu_account', 'Account Details'), icon: '👤' },
    { id: 'Impact', label: t('menu_impact', 'My Impact'), icon: '🌍' },
    { id: 'Notifications', label: t('menu_notifications', 'Notifications'), icon: '🔔' },
    { id: 'Support', label: t('menu_support', 'Customer Support'), icon: '💬' },
    { id: 'Friends', label: t('menu_friends', 'Invite Friends'), icon: '🎁' },
    { id: 'Legal', label: t('menu_legal', 'Legal & Info'), icon: '📜' }
  ];

  if (fetchError) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-10 text-center font-bold">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-xl text-destructive mb-4">Failed to load profile data.</h2>
      <button onClick={() => navigate('/map')} className="px-6 py-2 bg-primary text-white rounded-xl">Return to Map</button>
    </div>
  );

  if (!impact) return <div className="p-10 text-center font-bold">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-background font-sans pb-24">
      
      <header className="bg-card border-b border-border p-4 sm:p-6 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/map')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl cursor-pointer hover:bg-border transition-colors">←</button>
          <h1 className="text-2xl font-black tracking-tight m-0">{t('my_salvia', 'My Salvia')}</h1>
        </div>
        <LanguageSwitcher /> {/* 👈 NEW: Added Language Switcher here */}
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <aside className="space-y-2">
          {menuItems.map(item => (
            <button 
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSupportView('menu'); }}
              className={`w-full text-left p-4 rounded-2xl font-bold flex items-center gap-3 transition-all cursor-pointer ${activeTab === item.id ? 'bg-primary text-white shadow-md' : 'bg-card text-foreground hover:bg-muted border border-border'}`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button 
            onClick={() => { 
              localStorage.removeItem('access_token'); 
              localStorage.removeItem('salvia_user_lat');
              localStorage.removeItem('salvia_user_lon');
              localStorage.removeItem('salvia_user_label');
              navigate('/'); 
            }}
            className="w-full text-left p-4 rounded-2xl font-bold flex items-center gap-3 bg-destructive/10 text-destructive mt-10 cursor-pointer"
          >
            <span>🚪</span> {t('menu_logout', 'Log Out')}
          </button>
        </aside>

        <main className="md:col-span-2">
          
          {activeTab === 'Impact' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black mb-6 m-0">{t('environmental_impact', 'Environmental Impact')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#E8F0E4] p-8 rounded-3xl border-2 border-primary/20">
                  <p className="text-primary font-black text-xs uppercase tracking-widest mb-2">{t('food_rescued', 'Food Rescued')}</p>
                  <p className="text-5xl font-black text-foreground m-0">{impact.meals_saved}</p>
                  <p className="text-sm font-medium text-primary mt-2">{t('meals_saved', 'Meals saved from waste')}</p>
                </div>
                <div className="bg-primary p-8 rounded-3xl text-white shadow-xl">
                  <p className="text-white/70 font-black text-xs uppercase tracking-widest mb-2">{t('co2e_prevented', 'CO2e Prevented')}</p>
                  <p className="text-5xl font-black m-0">{impact.co2_saved} kg</p>
                  <p className="text-sm font-medium text-white/80 mt-2">{t('co2_equivalent', 'Equivalent to charging 300 phones')}</p>
                </div>
                <div className="bg-card border border-border p-8 rounded-3xl md:col-span-2">
                  <p className="text-muted-foreground font-black text-xs uppercase tracking-widest mb-2">{t('money_saved', 'Money Saved')}</p>
                  <p className="text-5xl font-black text-foreground m-0">{impact.money_saved} MDL</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Account' && (
            <div className="animate-in fade-in duration-300 bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-2xl font-black mb-8 m-0">{t('personal_info', 'Personal Information')}</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-muted-foreground uppercase mb-2">{t('full_name', 'Full Name')}</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-input-background border border-border rounded-xl font-bold outline-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-muted-foreground uppercase mb-2">{t('phone', 'Phone')}</label>
                    <input type="text" placeholder="+373..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-input-background border border-border rounded-xl font-bold outline-primary" />
                  </div>
                </div>
                
                <hr className="border-border my-8" />
                
                <h3 className="text-xl font-black mb-2 m-0">{t('dietary_prefs', 'Dietary Preferences & Health')}</h3>
                <p className="text-sm text-muted-foreground mb-6">{t('dietary_warning', 'Bags that do not meet these requirements will show a red warning indicator on the map.')}</p>
                
                <div className="mb-6">
                  <label className="block text-xs font-black text-muted-foreground uppercase mb-2">{t('dietary_prefs', 'Dietary Preferences')}</label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_OPTIONS.map(pref => (
                      <button key={pref} onClick={() => toggleArrayItem('preferences', pref)} className={`px-4 py-2 border rounded-full text-sm font-bold transition-colors cursor-pointer ${formData.preferences.includes(pref) ? 'bg-primary border-primary text-white shadow-sm' : 'bg-white border-border hover:bg-muted text-foreground'}`}>
                        {t(`dietary_${pref.toLowerCase()}`, pref)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase mb-2">{t('allergies', 'Allergies & Intolerances')}</label>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGY_OPTIONS.map(allergy => (
                      <button key={allergy} onClick={() => toggleArrayItem('allergies', allergy)} className={`px-4 py-2 border rounded-full text-sm font-bold transition-colors cursor-pointer ${formData.allergies.includes(allergy) ? 'bg-destructive border-destructive text-white shadow-sm' : 'bg-white border-border hover:bg-muted text-foreground'}`}>
                        {t(`allergy_${allergy.toLowerCase().replace('-', '_')}`, allergy)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 pb-2">
                  <button onClick={handleSaveProfile} className="w-full sm:w-auto bg-primary text-white px-10 py-4 rounded-2xl font-black shadow-lg hover:bg-primary/90 transition-all cursor-pointer">{t('save_profile', 'Save Profile Changes')}</button>
                </div>

                <hr className="border-border my-8" />
                
                <h3 className="text-xl font-black mb-6 m-0 flex items-center gap-2">🛡️ {t('account_security', 'Account Security')}</h3>

                <div className="bg-muted/10 border border-border rounded-2xl p-5 mb-8">
                  <h4 className="text-sm font-bold mb-4 text-foreground">{t('change_pwd', 'Change Password')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {formData.has_password && (
                      <input type="password" placeholder={t('curr_pwd', 'Current Password')} value={secOldPwd} onChange={e => setSecOldPwd(e.target.value)} className="w-full p-3 bg-white border border-border rounded-lg outline-primary text-sm" />
                    )}
                    <input type="password" placeholder={t('new_pwd', 'New Password')} value={secNewPwd} onChange={e => setSecNewPwd(e.target.value)} className="w-full p-3 bg-white border border-border rounded-lg outline-primary text-sm" />
                    <input type="password" placeholder={t('confirm_pwd', 'Confirm New')} value={secConfirmPwd} onChange={e => setSecConfirmPwd(e.target.value)} className="w-full p-3 bg-white border border-border rounded-lg outline-primary text-sm" />
                  </div>
                  <button onClick={handleStandalonePasswordChange} disabled={isPwdLoading} className="px-6 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer">
                    {isPwdLoading ? t('updating', 'Updating...') : t('update_pwd', 'Update Password')}
                  </button>
                </div>

                <div className="bg-muted/10 border border-border rounded-2xl p-5">
                  <h4 className="text-sm font-bold mb-2 text-foreground">{t('change_email', 'Change Login Email')}</h4>
                  <p className="text-sm text-muted-foreground mb-4">{t('curr_email', 'Current Email')}: <span className="font-bold text-foreground">{formData.email}</span></p>

                  {emailChangeStep === 'idle' ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input type="email" placeholder={t('enter_new_email', 'Enter new email address')} value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1 p-3 bg-white border border-border rounded-lg outline-primary text-sm" />
                      <button onClick={handleRequestEmailChange} disabled={isEmailLoading || !newEmail || newEmail === formData.email} className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer text-sm">
                        {isEmailLoading ? t('sending', 'Sending...') : t('req_change', 'Request Change')}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-primary/5 border border-primary/20 p-5 rounded-xl animate-in slide-in-from-top-2 duration-200">
                       <p className="text-sm font-bold text-primary mb-3">{t('enter_code_sent', 'Enter the 6-digit code sent to')} {newEmail}</p>
                       
                       <div className="flex flex-col sm:flex-row gap-3 mb-5">
                         <input type="text" placeholder="000000" maxLength="6" value={emailChangeOtp} onChange={e => setEmailChangeOtp(e.target.value.replace(/\D/g, ''))} className="flex-1 p-3 text-center text-xl tracking-widest bg-white border border-primary/30 rounded-lg font-black outline-primary" />
                         <button onClick={handleVerifyEmailChange} disabled={isEmailLoading || emailChangeOtp.length !== 6} className="px-6 py-3 bg-primary text-white rounded-lg font-bold shadow-sm cursor-pointer hover:bg-primary/90 transition-colors text-sm">
                           {isEmailLoading ? t('verifying', 'Verifying...') : t('verify_update', 'Verify & Update')}
                         </button>
                         <button onClick={() => { setEmailChangeStep('idle'); setEmailChangeOtp(''); setNewEmail(''); setWantsPwdChange(false); }} className="px-4 py-3 bg-muted text-muted-foreground rounded-lg font-bold hover:bg-border/50 transition-colors cursor-pointer text-sm">
                           {t('cancel', 'Cancel')}
                         </button>
                       </div>

                       <label className="flex items-center gap-2 cursor-pointer mb-4 select-none">
                         <input type="checkbox" checked={wantsPwdChange} onChange={e => setWantsPwdChange(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                         <span className="text-sm font-bold text-foreground">{t('want_new_pwd', 'I also want to set a new password')}</span>
                       </label>

                       {wantsPwdChange && (
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
                           {formData.has_password && (
                             <input type="password" placeholder={t('curr_pwd', 'Current Password')} value={bundledOldPwd} onChange={e => setBundledOldPwd(e.target.value)} className="w-full p-3 bg-white border border-border rounded-lg outline-primary text-sm" />
                           )}
                           <input type="password" placeholder={t('new_pwd', 'New Password')} value={bundledNewPwd} onChange={e => setBundledNewPwd(e.target.value)} className="w-full p-3 bg-white border border-border rounded-lg outline-primary text-sm" />
                           <input type="password" placeholder={t('confirm_pwd', 'Confirm New')} value={bundledConfirmPwd} onChange={e => setBundledConfirmPwd(e.target.value)} className="w-full p-3 bg-white border border-border rounded-lg outline-primary text-sm" />
                         </div>
                       )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {activeTab === 'Support' && (
            <div className="animate-in fade-in duration-300">
              
              <div className="flex items-center gap-4 mb-6">
                {supportView !== 'menu' && (
                  <button onClick={() => setSupportView('menu')} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-xl cursor-pointer hover:bg-muted transition-colors">←</button>
                )}
                <h2 className="text-3xl font-black m-0">{t('menu_support', 'Customer Support')}</h2>
              </div>

              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm min-h-[400px]">
                
                {supportView === 'menu' && (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <div className="p-8 text-center border-b border-border">
                      <div className="text-5xl mb-4">👋</div>
                      <h3 className="text-xl font-bold mb-2">{t('how_help', 'How can we help?')}</h3>
                      <p className="text-muted-foreground max-w-xs mx-auto m-0">{t('support_hours', 'Our support team is online from 09:00 to 21:00 daily.')}</p>
                    </div>
                    <div className="p-4 space-y-3">
                      <button onClick={() => setSupportView('chat')} className="w-full p-5 bg-muted/50 hover:bg-primary/10 rounded-xl text-left font-bold flex justify-between items-center group cursor-pointer transition-colors border border-transparent hover:border-primary/20">
                        <span className="flex items-center gap-3"><span className="text-xl">✉️</span> {t('email_support', 'Email Support')}</span> 
                        <span className="group-hover:translate-x-1 transition-transform text-primary font-black">→</span>
                      </button>
                      <button onClick={() => setSupportView('faq')} className="w-full p-5 bg-muted/50 hover:bg-primary/10 rounded-xl text-left font-bold flex justify-between items-center group cursor-pointer transition-colors border border-transparent hover:border-primary/20">
                         <span className="flex items-center gap-3"><span className="text-xl">📖</span> {t('faq', 'How it works (FAQ)')}</span> 
                         <span className="group-hover:translate-x-1 transition-transform text-primary font-black">→</span>
                      </button>
                      <button onClick={() => setSupportView('report')} className="w-full p-5 bg-destructive/5 hover:bg-destructive/10 rounded-xl text-left font-bold flex justify-between items-center group cursor-pointer transition-colors border border-transparent hover:border-destructive/20 text-destructive">
                         <span className="flex items-center gap-3"><span className="text-xl">⚠️</span> {t('report_issue', 'Report a Store Issue')}</span> 
                         <span className="group-hover:translate-x-1 transition-transform text-destructive font-black">→</span>
                      </button>
                    </div>
                  </div>
                )}

                {supportView === 'chat' && (
                  <div className="p-8 animate-in slide-in-from-right-4 duration-300">
                    <h3 className="text-xl font-bold mb-2">{t('what_need', 'What do you need help with?')}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{t('select_email_opt', 'Select an option below to send an email directly to our support team.')}</p>
                    <div className="space-y-3">
                      {EMAIL_PROMPTS.map((prompt, idx) => (
                        <a 
                          key={idx}
                          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(prompt.subject)}&body=${encodeURIComponent(prompt.text)}`}
                          className="block w-full p-4 bg-white border border-border rounded-xl text-left font-bold hover:bg-primary/10 hover:border-primary/30 transition-colors shadow-sm text-foreground decoration-transparent"
                        >
                          {prompt.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {supportView === 'faq' && (
                  <div className="p-8 animate-in slide-in-from-right-4 duration-300">
                    <h3 className="text-xl font-bold mb-6">{t('faq_title', 'Frequently Asked Questions')}</h3>
                    <div className="space-y-4">
                      {FAQS.map((faq, idx) => (
                        <details key={idx} className="group bg-white border border-border rounded-xl shadow-sm overflow-hidden cursor-pointer">
                          <summary className="p-4 font-bold text-foreground list-none flex justify-between items-center outline-none">
                            {faq.q}
                            <span className="text-primary group-open:rotate-45 transition-transform text-xl">+</span>
                          </summary>
                          <div className="p-4 pt-0 text-sm text-muted-foreground leading-relaxed border-t border-border mt-2 bg-muted/20">
                            {faq.a}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {supportView === 'report' && (
                  <div className="p-8 animate-in slide-in-from-right-4 duration-300">
                    <h3 className="text-xl font-bold mb-2 text-destructive">{t('report_issue', 'Report an Issue')}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{t('report_desc', 'Your report will be sent directly to Salvia HQ and the store management for immediate review.')}</p>
                    
                    <form onSubmit={handleReportSubmit} className="space-y-5">
                      <div>
                        <label className="block text-xs font-black text-muted-foreground uppercase mb-2">{t('which_order', 'Which order was this regarding?')}</label>
                        <select 
                          required
                          value={reportData.order_id}
                          onChange={(e) => setReportData({...reportData, order_id: e.target.value})}
                          className="w-full p-3.5 bg-input-background border border-border rounded-xl outline-primary font-medium"
                        >
                          <option value="" disabled>{t('select_order', 'Select a past order...')}</option>
                          {myOrders.length === 0 && <option disabled>{t('no_orders', 'No recent orders found.')}</option>}
                          {myOrders.map(o => (
                            <option key={o.id} value={o.id}>
                              Order #{o.id} - {o.store_name} ({new Date().toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-muted-foreground uppercase mb-2">{t('what_happened', 'What happened?')}</label>
                        <select 
                          required
                          value={reportData.reason}
                          onChange={(e) => setReportData({...reportData, reason: e.target.value})}
                          className="w-full p-3.5 bg-input-background border border-border rounded-xl outline-primary font-medium"
                        >
                          <option value="" disabled>{t('select_reason', 'Select a reason...')}</option>
                          <option value="Store was closed">{t('rsn_closed', 'Store was closed during pickup')}</option>
                          <option value="Food quality issue">{t('rsn_quality', 'Food was spoiled or unsafe')}</option>
                          <option value="Allergy violation">{t('rsn_allergy', 'Bag contained listed allergens')}</option>
                          <option value="Staff behavior">{t('rsn_staff', 'Unprofessional staff behavior')}</option>
                          <option value="Other">{t('rsn_other', 'Other issue')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-muted-foreground uppercase mb-2">{t('describe_issue', 'Please describe the issue')}</label>
                        <textarea 
                          required
                          placeholder={t('provide_details', 'Provide as much detail as possible...')}
                          value={reportData.details}
                          onChange={(e) => setReportData({...reportData, details: e.target.value})}
                          className="w-full p-3.5 bg-input-background border border-border rounded-xl h-32 resize-none outline-primary font-medium"
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={isSubmittingReport}
                        className="w-full py-4 bg-destructive text-white rounded-xl font-bold text-lg hover:bg-destructive/90 transition-colors shadow-sm cursor-pointer disabled:opacity-70"
                      >
                        {isSubmittingReport ? t('sending_report', 'Sending Report...') : t('submit_report', 'Submit Official Report')}
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>
          )}

          {['Notifications', 'Friends', 'Legal'].includes(activeTab) && (
            <div className="bg-card border border-border rounded-3xl p-20 text-center">
              <p className="text-4xl mb-4">🚧</p>
              <h3 className="text-xl font-bold m-0">{t('coming_soon', `${activeTab} coming soon`)}</h3>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}