import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; 
import { 
  LayoutDashboard, Package, Settings, LogOut, TrendingUp, ShoppingBag, 
  XCircle, Star, QrCode, Plus, Calendar, Clock, PackageX, ShieldCheck, 
  Camera, Loader2, X, Image as ImageIcon, Ticket, MapPin, Lock
} from 'lucide-react';
import api from './api';
import StoreBagCard from './components/StoreBagCard';
import StatCard from './components/StatCard';
import SalesChart from './components/SalesChart';
import LanguageSwitcher from './components/LanguageSwitcher';

const FOOD_CATEGORIES = ['Bakery', 'Meals', 'Groceries', 'Drinks'];
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Halal', 'Kosher'];
const ALLERGEN_CONTAINS = ['Contains Gluten', 'Contains Lactose', 'Contains Nuts', 'Contains Eggs', 'Contains Soy'];

export default function StoreDashboard() {
  const { t } = useTranslation();
  
  const MENU_ITEMS = [
    { id: 'Dashboard', label: t('menu_dashboard', 'Dashboard'), icon: LayoutDashboard },
    { id: 'Inventory', label: t('menu_inventory', 'Inventory'), icon: Package },
    { id: 'Profile', label: t('menu_profile', 'Profile'), icon: Settings },
    { id: 'Legal', label: t('menu_legal', 'Legal'), icon: ShieldCheck }
  ];

  const translateTags = (tagsString) => {
    if (!tagsString) return "";
    const map = {
      'bakery': t('dietary_bakery', 'Bakery'),
      'meals': t('dietary_meals', 'Meals'),
      'groceries': t('dietary_groceries', 'Groceries'),
      'drinks': t('dietary_drinks', 'Drinks'),
      'vegetarian': t('dietary_vegetarian', 'Vegetarian'),
      'vegan': t('dietary_vegan', 'Vegan'),
      'halal': t('dietary_halal', 'Halal'),
      'kosher': t('dietary_kosher', 'Kosher'),
      'contains gluten': t('contains_gluten', 'Contains Gluten'),
      'contains lactose': t('contains_lactose', 'Contains Lactose'),
      'contains nuts': t('contains_nuts', 'Contains Nuts'),
      'contains eggs': t('contains_eggs', 'Contains Eggs'),
      'contains soy': t('contains_soy', 'Contains Soy')
    };
    return tagsString.split(',').map(tag => {
      const clean = tag.trim().toLowerCase();
      return map[clean] || tag.trim();
    }).join(', ');
  };

  const [activeTab, setActiveTab] = useState('Inventory'); 
  const [refreshKey, setRefreshKey] = useState(0); 
  const [activeBags, setActiveBags] = useState([]);
  const [pastBags, setPastBags] = useState([]); 
  const [storeOrders, setStoreOrders] = useState([]); 
  const [chartData, setChartData] = useState({ Week: [], Month: [], Year: [], All: [] });
  
  const [storeProfile, setStoreProfile] = useState({ name: '', email: '', address_text: '', has_password: true });
  
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false); 
  
  const [storeStats, setStoreStats] = useState({ total_revenue: 0, bags_sold: 0, canceled_orders: 0, rating: 0 });

  const [showModal, setShowModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false); 
  const [pickupCode, setPickupCode] = useState("");              
  
  const [editingBagId, setEditingBagId] = useState(null);
  const [modalData, setModalData] = useState({
    name: "", description: "", categorical_tags: [], items_included: "", image_url: "", 
    pickup_start: "", pickup_end: "", original_price: "", discounted_price: "",
  });

  const navigate = useNavigate();

  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateShort = (dateString) => new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });

  useEffect(() => { 
    if (activeTab === 'Inventory') fetchInventory(); 
    if (activeTab === 'Dashboard') fetchStats(); 
    if (activeTab === 'Profile') fetchProfile(); 
  }, [activeTab]);

  useEffect(() => {
    const timer = setInterval(() => setRefreshKey(prev => prev + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const completedOrders = storeOrders.filter(o => o.status === 'completed');
    const now = new Date();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0,0,0,0);
    const weekData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({ label: day, sales: 0 }));
    const dayToIndex = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }; 

    const currentMonthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthData = Array.from({length: currentMonthDays}, (_, i) => ({ label: `${i + 1}`, sales: 0 }));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const yearData = monthNames.map(m => ({ label: m, sales: 0 }));

    const allDataMap = {};

    completedOrders.forEach(order => {
      const dateToUse = order.completed_at || order.purchased_at || order.pickup_start;
      const d = new Date(dateToUse); 
      const year = d.getFullYear();

      if (!allDataMap[year]) allDataMap[year] = 0;
      allDataMap[year]++;

      if (year === now.getFullYear()) {
        yearData[d.getMonth()].sales++;
        if (d.getMonth() === now.getMonth()) monthData[d.getDate() - 1].sales++;
      }

      if (d >= startOfWeek) weekData[dayToIndex[d.getDay()]].sales++;
    });

    const allData = Object.keys(allDataMap).sort().map(y => ({ label: y, sales: allDataMap[y] }));
    if (allData.length === 0) allData.push({ label: now.getFullYear().toString(), sales: 0 });

    setChartData({ Week: weekData, Month: monthData, Year: yearData, All: allData });
  }, [storeOrders]);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const bagRes = await api.get('/inventory/store');
      const now = new Date();
      
      setActiveBags(
        bagRes.data
          .filter(bag => bag.quantity_available > 0 && new Date(bag.pickup_end) > now)
          .sort((a, b) => b.id - a.id)
      );
      
      const historyBags = bagRes.data.filter(bag => 
        bag.quantity_available === 0 || 
        new Date(bag.pickup_end) <= now || 
        (bag.sold_count && bag.sold_count > 0)
      );
      
      const grouped = historyBags.reduce((acc, bag) => {
        const key = bag.name || "Surprise Bag";
        if (!acc[key]) acc[key] = { ...bag, historyItems: [] };
        
        if (bag.sales_history && bag.sales_history.length > 0) {
          bag.sales_history.forEach(sale => {
            if (sale.status === 'completed') {
              acc[key].historyItems.push({ id: `sale-${sale.order_id}`, type: 'sale', date: sale.completed_at || sale.purchased_at });
            }
          });
        }
        
        const isPast = bag.quantity_available === 0 || new Date(bag.pickup_end) <= now;
        if (isPast && bag.quantity_available > 0) {
          acc[key].historyItems.push({ id: `expired-${bag.id}`, type: 'expired', date: bag.pickup_end, quantity: bag.quantity_available });
        }
        return acc;
      }, {});

      const pastArray = Object.values(grouped).map(group => {
        group.historyItems.sort((a, b) => new Date(b.date) - new Date(a.date));
        return group;
      });

      setPastBags(pastArray);

      const orderRes = await api.get('/locations/me/orders');
      setStoreOrders(orderRes.data);
    } catch (err) { console.error("Error fetching inventory:", err); }
    finally { setIsLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/locations/me/stats');
      setStoreStats(response.data);
      const orderRes = await api.get('/locations/me/orders');
      setStoreOrders(orderRes.data);
    } catch (err) { console.error("Error fetching stats:", err); }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/locations/me/profile');
      setStoreProfile({
        name: res.data.name || "",
        email: res.data.email || "",
        address_text: res.data.address_text || "",
        has_password: res.data.has_password
      });
    } catch (err) { console.error("Error fetching profile:", err); }
  };

  // 👇 ONLY save the name, ignore address tracking
  const handleSaveProfileInfo = async () => {
    try {
      await api.patch('/locations/me/profile', {
        name: storeProfile.name
      });
      alert(t('profile_success', "Store info updated successfully!"));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update profile.");
    }
  };

  const handleStandalonePasswordChange = async () => {
    if (storeProfile.has_password && !secOldPwd) return alert(t('pwd_current_req', "Please enter your current password."));
    if (!secNewPwd || !secConfirmPwd) return alert(t('pwd_all_req', "Please fill in all password fields."));
    if (secNewPwd !== secConfirmPwd) return alert(t('pwd_no_match', "New passwords do not match!"));
    
    setIsPwdLoading(true);
    try {
      await api.post('/auth/change-password', { old_password: secOldPwd || null, new_password: secNewPwd });
      alert(t('pwd_success', "Password updated securely! Please log back in."));
      localStorage.removeItem('access_token');
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.detail || "Password update failed.");
    } finally {
      setIsPwdLoading(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmail || newEmail === storeProfile.email) return alert(t('email_invalid', "Please enter a valid, different email address."));
    setIsEmailLoading(true);
    try {
      await api.post('/auth/change-email/request', { new_email: newEmail });
      setEmailChangeStep('verifying');
      alert(`${t('verify_code_sent', 'Verification code sent to')} ${newEmail}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to request email change.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailChangeOtp || emailChangeOtp.length !== 6) return alert(t('code_req', "Please enter the full 6-digit code."));
    
    if (wantsPwdChange) {
      if (storeProfile.has_password && !bundledOldPwd) return alert(t('pwd_current_req', "Please enter your current password."));
      if (!bundledNewPwd || !bundledConfirmPwd) return alert(t('pwd_all_req', "Please fill out all password fields."));
      if (bundledNewPwd !== bundledConfirmPwd) return alert(t('pwd_no_match', "New passwords do not match!"));
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
      
      alert(t('account_update_success', "Account credentials successfully updated! For your security, please log back in."));
      localStorage.removeItem('access_token');
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.detail || "Invalid code or verification failed.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyOrder = async () => {
    if (!pickupCode || pickupCode.length !== 6) return alert(t('code_req', "Please enter a valid 6-digit code."));
    await submitVerification(pickupCode);
  };

  const handleQuickVerify = async (code) => {
    if (!window.confirm(t('confirm_mark_pickup', "Mark this order as picked up by the customer?"))) return;
    await submitVerification(code);
  };

  const submitVerification = async (code) => {
    try {
      await api.patch('/orders/verify', { pickup_code: code });
      alert(t('order_completed_success', "Order completed! The customer has received their bag."));
      setShowVerifyModal(false);
      setPickupCode("");
      fetchInventory(); 
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.detail || "Invalid code or already completed.");
    }
  };

  const updateQuantity = async (bagId, delta) => {
    try {
      await api.patch(`/inventory/${bagId}/quantity`, { delta: delta });
      fetchInventory(); 
    } catch (err) { alert(err.response?.data?.detail || "Failed to update quantity."); }
  };

  const deleteBag = async (bagId) => {
    if (!window.confirm(t('confirm_delete_bag', "Delete this bag entirely?"))) return;
    try {
      await api.delete(`/inventory/${bagId}`);
      fetchInventory();
    } catch (err) { alert("Failed to delete bag."); }
  };

  const openModalForCreate = () => {
    setEditingBagId(null);
    setModalData({ 
      name: "", description: "", categorical_tags: [], items_included: "", image_url: "", 
      pickup_start: "", pickup_end: "", original_price: "", discounted_price: "",
    });
    setShowModal(true);
  };

  const openModalForEdit = (bag) => {
    setEditingBagId(bag.id);
    setModalData({
      name: bag.name || "", description: bag.description || "",
      categorical_tags: bag.categorical_tags ? bag.categorical_tags.split(', ').filter(t => t) : [],
      items_included: bag.items_included || "", image_url: bag.image_url || "",
      pickup_start: bag.pickup_start.split('.')[0], pickup_end: bag.pickup_end.split('.')[0],
      original_price: bag.original_price, discounted_price: bag.discounted_price,
    });
    setShowModal(true);
  };

  const handleRelist = (bag) => {
    setEditingBagId(null); 
    setModalData({
      name: bag.name || "", description: bag.description || "",
      categorical_tags: bag.categorical_tags ? bag.categorical_tags.split(', ').filter(t => t) : [],
      items_included: bag.items_included || "", image_url: bag.image_url || "",
      pickup_start: "", pickup_end: "",
      original_price: bag.original_price, discounted_price: bag.discounted_price,
    });
    setShowModal(true);
  };

  const toggleCategory = (cat) => {
    setModalData(prev => ({
      ...prev,
      categorical_tags: prev.categorical_tags.includes(cat) ? prev.categorical_tags.filter(t => t !== cat) : [...prev.categorical_tags, cat]
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const response = await api.post('/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setModalData({ ...modalData, image_url: response.data.image_url });
    } catch (err) {
      alert("Failed to upload image. Make sure the backend is running.");
    } finally {
      setIsUploading(false);
    }
  };

  const validateAndSave = async () => {
    const start = new Date(modalData.pickup_start);
    const end = new Date(modalData.pickup_end);
    if (!modalData.name) return alert(t('err_req_name', "Please enter a Bag Name."));
    if (end <= start) return alert(t('err_req_time', "Pickup Finish Time must be strictly after the Start Time."));
    if (start < new Date()) return alert(t('err_req_past', "Pickup window cannot start in the past."));
    if (!modalData.categorical_tags.length) return alert(t('err_req_cat', "Please select at least one category."));

    const payload = { ...modalData, categorical_tags: modalData.categorical_tags.join(', ') };

    try {
      if (editingBagId) await api.patch(`/inventory/${editingBagId}`, payload);
      else await api.post('/inventory/register-bag', { ...payload, quantity_available: 1 });
      
      setShowModal(false);
      fetchInventory();
    } catch (err) { alert(err.response?.data?.detail || "Save failed."); }
  };

  const currentNow = new Date();
  const activeReservations = storeOrders.filter(o => o.status === 'reserved' && new Date(o.pickup_end) > currentNow);
  const canceledOrMissedOrders = storeOrders.filter(o => o.status === 'cancelled' || (o.status === 'reserved' && new Date(o.pickup_end) <= currentNow));

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-background font-sans overflow-hidden">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border text-foreground flex-col p-6 space-y-10 shrink-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary m-0">Crumbless</h1>
        <nav className="flex-1 space-y-3 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 text-left py-3.5 px-4 rounded-2xl font-bold cursor-pointer transition-colors ${
                  activeTab === item.id ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={20} strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        <div className="mt-auto mb-4">
           <LanguageSwitcher />
        </div>

        <button onClick={() => { localStorage.removeItem('access_token'); navigate('/'); }} className="w-full flex items-center gap-3 text-left py-3.5 px-4 rounded-2xl font-bold text-destructive hover:bg-destructive/10 cursor-pointer transition-colors mt-auto">
          <LogOut size={20} strokeWidth={2} />
          {t('menu_logout', 'Log out')}
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 pb-24 md:pb-12 relative">
        
        {/* --- MOBILE HEADER --- */}
        <div className="md:hidden flex justify-between items-center mb-6">
          <h1 className="text-2xl font-extrabold text-primary m-0">Crumbless</h1>
          
          <div className="flex items-center gap-3">
             <LanguageSwitcher />
             <button onClick={() => { localStorage.removeItem('access_token'); navigate('/'); }} className="text-sm font-bold text-destructive cursor-pointer p-2 bg-destructive/10 rounded-full">
               <LogOut size={16} strokeWidth={2} />
             </button>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* VIEW: DASHBOARD */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Dashboard' && (
          <div className="animate-in fade-in duration-300 pt-10 sm:pt-0">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-8 m-0">{t('store_dashboard', 'Store Dashboard')}</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard title={t('total_revenue', 'Total Revenue')} value={`${storeStats.total_revenue} MDL`} label={t('all_time', 'All time')} icon={<TrendingUp size={24} className="text-primary" />} />
              <StatCard title={t('bags_sold', 'Bags Sold')} value={storeStats.bags_sold} label={t('all_time', 'All time')} icon={<ShoppingBag size={24} className="text-primary" />} />
              <StatCard title={t('canceled_orders', 'Canceled Orders')} value={storeStats.canceled_orders || 0} label={t('missed_pickups', 'Missed pickups')} icon={<XCircle size={24} className="text-destructive" />} />
              <StatCard title={t('rating', 'Rating')} value={storeStats.rating} label={t('customer_satisfaction', 'Customer satisfaction')} icon={<Star size={24} className="text-yellow-500 fill-yellow-500" />} />
            </div>

            <SalesChart data={chartData} />
          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VIEW: INVENTORY */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Inventory' && (
          <div className="animate-in fade-in duration-300 pt-10 sm:pt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-10">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight m-0">{t('inventory_orders', 'Inventory & Orders')}</h2>
              
              <div className="flex w-full sm:w-auto gap-3">
                <button onClick={() => setShowVerifyModal(true)} className="flex items-center justify-center flex-1 sm:flex-none bg-card text-foreground px-6 py-3.5 rounded-full font-bold text-sm sm:text-base hover:bg-muted transition-colors shadow-sm cursor-pointer border border-border">
                  <QrCode size={18} className="mr-2 shrink-0" /> {t('enter_code', 'Enter Code')}
                </button>
                <button onClick={openModalForCreate} className="flex items-center justify-center flex-1 sm:flex-none bg-primary text-primary-foreground px-6 py-3.5 rounded-full font-bold text-sm sm:text-base hover:bg-primary/90 transition-colors shadow-sm cursor-pointer">
                  <Plus size={18} className="mr-2 shrink-0" /> {t('create_bag', 'Create Bag')}
                </button>
              </div>
            </div>

            {isLoading ? (
              <p className="text-center text-muted-foreground py-10 font-medium">{t('loading_data', 'Loading Data...')}</p>
            ) : (
              <>
                {activeReservations.length > 0 && (
                  <div className="mb-12">
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-4 m-0 tracking-tight">{t('active_reservations', 'Active Reservations')}</h3>
                    <div className="space-y-4">
                      {activeReservations.map(order => {
                        return (
                          <div key={order.order_id} className="bg-card border-2 border-amber-500/40 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-6">
                            <div>
                              <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-3 shadow-sm">{t('awaiting_pickup', 'Awaiting Pickup')}</span>
                              <h4 className="text-xl sm:text-2xl font-extrabold m-0 tracking-tight">{t('order', 'Order')} #{order.order_id}</h4>
                              <p className="text-muted-foreground font-medium m-0 mt-1">{translateTags(order.categorical_tags)}</p>
                              
                              <div className="text-sm font-bold text-foreground mt-3 flex flex-wrap items-center gap-4">
                                <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-muted-foreground" /> {formatDateShort(order.pickup_start)}</span>
                                <span className="flex items-center"><Clock size={14} className="mr-1.5 text-muted-foreground" /> {formatTime(order.pickup_start)} - {formatTime(order.pickup_end)}</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                              <div className="text-center bg-muted/50 py-3 px-6 rounded-3xl border border-border w-full sm:w-auto">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest m-0 mb-1">{t('code', 'Code')}</p>
                                <p className="text-3xl font-black tracking-widest text-foreground m-0">{order.pickup_code}</p>
                              </div>
                              
                              <button 
                                onClick={() => handleQuickVerify(order.pickup_code)} 
                                className={`w-full sm:w-auto px-8 py-4 rounded-full font-bold shadow-sm transition-colors shrink-0 text-base bg-primary text-white hover:bg-primary/90 cursor-pointer`}
                              >
                                {t('mark_received', 'Mark Received')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-12 border-t border-border pt-8">
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-6 m-0 tracking-tight">{t('available_bags', 'Available Bags')}</h3>
                  {activeBags.length === 0 && (
                    <div className="text-center py-12 bg-card border border-border rounded-3xl">
                      <PackageX size={48} strokeWidth={1.5} className="text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground font-medium">{t('no_active_bags', 'No active surprise bags. Create one above!')}</p>
                    </div>
                  )}
                  {activeBags.map(bag => (
                    <StoreBagCard key={bag.id} bag={bag} type="active" onUpdateQuantity={updateQuantity} onEdit={openModalForEdit} />
                  ))}
                </div>

                {pastBags.length > 0 && (
                  <div className="mb-12 border-t border-border pt-8">
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground opacity-80 mb-2 m-0 tracking-tight">{t('past_bags', 'Past Bags')}</h3>
                    <p className="text-muted-foreground text-sm mb-6 mt-0">{t('relist_msg', 'These bags are sold out or expired. Relist them for a new day.')}</p>
                    {pastBags.map(group => (
                      <StoreBagCard 
                        key={group.id} 
                        bag={group} 
                        type="expired" 
                        historyItems={group.historyItems} 
                        onRelist={handleRelist} 
                        onDelete={deleteBag} 
                      />
                    ))}
                  </div>
                )}

                {canceledOrMissedOrders.length > 0 && (
                  <div className="border-t border-border pt-8">
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground opacity-80 mb-4 m-0 tracking-tight">{t('canceled_missed_reservations', 'Canceled & Missed')}</h3>
                    <div className="space-y-4">
                      {canceledOrMissedOrders.map(order => {
                        const isMissed = order.status === 'reserved';
                        
                        return (
                          <div key={order.order_id} className="bg-muted/30 border border-border p-5 rounded-3xl flex justify-between items-center opacity-70">
                            <div>
                              <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-3">
                                {isMissed ? t('missed', 'Missed') : t('canceled', 'Canceled')}
                              </span>
                              <h4 className="text-lg font-extrabold m-0 line-through">{t('order', 'Order')} #{order.order_id}</h4>
                              <p className="text-sm font-medium m-0 mt-1">{translateTags(order.categorical_tags)}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-bold uppercase tracking-widest m-0 mb-1 text-muted-foreground">{t('code', 'Code')}</p>
                               <p className="text-xl font-black tracking-widest m-0 line-through text-muted-foreground">{order.pickup_code}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VIEW: PROFILE & SECURITY */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Profile' && (
          <div className="animate-in fade-in duration-300 max-w-2xl pt-10 sm:pt-0">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-8 m-0">{t('store_profile', 'Store Profile')}</h2>
            
            {/* GENERAL INFO (Map completely removed, locked down to HQ) */}
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
              <h3 className="text-xl font-bold mb-6 text-foreground">{t('general_info', 'General Info')}</h3>
              
              <div className="space-y-5 mb-6">
                <div>
                  <label className="block text-sm font-bold mb-2">{t('store_name', 'Store Name')}</label>
                  <input type="text" value={storeProfile.name} onChange={e => setStoreProfile({...storeProfile, name: e.target.value})} className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary" />
                </div>

                {/* Read-Only Locked Address */}
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                    {t('physical_address', 'Physical Address & Location')} <Lock size={14} className="text-muted-foreground" />
                  </label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      value={storeProfile.address_text} 
                      disabled 
                      className="w-full pl-11 pr-4 py-3.5 bg-muted/50 border border-border rounded-2xl font-medium text-muted-foreground cursor-not-allowed" 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{t('address_readonly_warning', 'Store location is managed by HQ. Please contact your administrator to request an address change.')}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <button onClick={handleSaveProfileInfo} className="bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-bold shadow-sm cursor-pointer hover:bg-primary/90 transition-colors">
                  {t('save_info', 'Save Info')}
                </button>
              </div>
            </div>

            {/* SECURITY */}
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
                <ShieldCheck className="text-primary" size={24} strokeWidth={2} /> {t('account_security', 'Account Security')}
              </h3>
              
              {/* Standalone Password Change */}
              <div className="bg-muted/30 border border-border rounded-3xl p-6 mb-8">
                <h4 className="text-sm font-bold mb-4 text-foreground">{t('change_pwd', 'Change Password')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {storeProfile.has_password && (
                    <input type="password" placeholder={t('curr_pwd', 'Current Password')} value={secOldPwd} onChange={e => setSecOldPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm" />
                  )}
                  <input type="password" placeholder={t('new_pwd', 'New Password')} value={secNewPwd} onChange={e => setSecNewPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm" />
                  <input type="password" placeholder={t('confirm_pwd', 'Confirm New')} value={secConfirmPwd} onChange={e => setSecConfirmPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm" />
                </div>
                <button onClick={handleStandalonePasswordChange} disabled={isPwdLoading} className="px-6 py-3 bg-card border border-border text-foreground rounded-full font-bold text-sm hover:bg-muted transition-colors cursor-pointer">
                  {isPwdLoading ? <Loader2 size={16} className="animate-spin inline" /> : t('update_pwd', 'Update Password')}
                </button>
              </div>

              {/* Email Change Flow */}
              <div className="bg-muted/30 border border-border rounded-3xl p-6">
                <h4 className="text-sm font-bold mb-2 text-foreground">{t('change_email', 'Change Login Email')}</h4>
                <p className="text-sm text-muted-foreground mb-5">{t('curr_email', 'Current Email')}: <span className="font-bold text-foreground">{storeProfile.email}</span></p>

                {emailChangeStep === 'idle' ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="email" placeholder={t('enter_new_email', 'Enter new email address')} value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1 p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm" />
                    <button onClick={handleRequestEmailChange} disabled={isEmailLoading || !newEmail || newEmail === storeProfile.email} className="px-6 py-3.5 bg-card border border-border text-foreground rounded-full font-bold hover:bg-muted transition-colors cursor-pointer text-sm">
                      {isEmailLoading ? <Loader2 size={16} className="animate-spin inline" /> : t('req_change', 'Request Change')}
                    </button>
                  </div>
                ) : (
                  <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                     <p className="text-sm font-bold text-primary mb-3">{t('enter_code_sent', 'Enter the 6-digit code sent to')} {newEmail}</p>
                     
                     <div className="flex flex-col sm:flex-row gap-3 mb-5">
                       <input type="text" placeholder="000000" maxLength="6" value={emailChangeOtp} onChange={e => setEmailChangeOtp(e.target.value.replace(/\D/g, ''))} className="flex-1 p-3.5 text-center text-xl tracking-widest bg-white border border-primary/30 rounded-2xl font-black outline-primary" />
                       <button onClick={handleVerifyEmailChange} disabled={isEmailLoading || emailChangeOtp.length !== 6} className="px-6 py-3.5 bg-primary text-white rounded-full font-bold shadow-sm cursor-pointer hover:bg-primary/90 transition-colors text-sm">
                         {isEmailLoading ? <Loader2 size={16} className="animate-spin inline" /> : t('verify_update', 'Verify & Update')}
                       </button>
                       <button onClick={() => { setEmailChangeStep('idle'); setEmailChangeOtp(''); setNewEmail(''); setWantsPwdChange(false); }} className="px-5 py-3.5 bg-card border border-border text-muted-foreground rounded-full font-bold hover:bg-muted transition-colors cursor-pointer text-sm">
                         {t('cancel', 'Cancel')}
                       </button>
                     </div>

                     <label className="flex items-center gap-2 cursor-pointer mb-4 select-none">
                       <input type="checkbox" checked={wantsPwdChange} onChange={e => setWantsPwdChange(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                       <span className="text-sm font-bold text-foreground">{t('want_new_pwd', 'I also want to set a new password')}</span>
                     </label>

                     {wantsPwdChange && (
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
                         {storeProfile.has_password && (
                           <input type="password" placeholder={t('curr_pwd', 'Current Password')} value={bundledOldPwd} onChange={e => setBundledOldPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm" />
                         )}
                         <input type="password" placeholder={t('new_pwd', 'New Password')} value={bundledNewPwd} onChange={e => setBundledNewPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm" />
                         <input type="password" placeholder={t('confirm_pwd', 'Confirm New')} value={bundledConfirmPwd} onChange={e => setBundledConfirmPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm" />
                       </div>
                     )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VIEW: LEGAL */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Legal' && (
          <div className="animate-in fade-in duration-300 pt-10 sm:pt-0">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-8 m-0">{t('menu_legal', 'Legal & Policies')}</h2>
            <div className="bg-card border border-border rounded-3xl p-8 shadow-sm prose prose-sm max-w-none">
              <h3>Terms of Service</h3>
              <p>By listing surplus food on Salvia, you agree to ensure the food is safe for consumption and packed according to local health regulations...</p>
            </div>
          </div>
        )}

      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around p-2 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.05)] pb-safe">
         <button onClick={() => setActiveTab('Dashboard')} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'Dashboard' ? 'text-primary' : 'text-muted-foreground'}`}>
            <LayoutDashboard size={24} className="mb-1" strokeWidth={1.5} />
            <span className="text-[10px] font-bold">{t('menu_dashboard', 'Dashboard')}</span>
         </button>
         <button onClick={() => setActiveTab('Inventory')} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'Inventory' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Package size={24} className="mb-1" strokeWidth={1.5} />
            <span className="text-[10px] font-bold">{t('menu_inventory', 'Inventory')}</span>
         </button>
         <button onClick={() => setActiveTab('Profile')} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'Profile' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Settings size={24} className="mb-1" strokeWidth={1.5} />
            <span className="text-[10px] font-bold">{t('menu_profile', 'Profile')}</span>
         </button>
      </div>

      {/* --- VERIFY PICKUP MODAL --- */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-border animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-extrabold tracking-tight m-0 flex items-center gap-2">
                <Ticket className="text-primary" size={24} /> {t('verify_order', 'Verify Order')}
              </h3>
              <button onClick={() => setShowVerifyModal(false)} className="text-muted-foreground text-2xl hover:text-foreground cursor-pointer bg-transparent border-none">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-muted-foreground text-sm font-medium mb-6">{t('enter_verify_code', "Enter the 6-digit pickup code shown on the customer's phone.")}</p>
            
            <input
              type="text"
              placeholder="e.g., A7B2X9"
              value={pickupCode}
              onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full p-4 text-center text-3xl tracking-widest font-black bg-input-background border border-border rounded-2xl outline-primary mb-6 uppercase focus:shadow-sm transition-all"
            />
            
            <button onClick={handleVerifyOrder} className="w-full py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg hover:bg-primary/90 shadow-sm cursor-pointer transition-colors">
              {t('confirm_pickup', 'Confirm Pickup')}
            </button>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BAG MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm sm:backdrop-blur-md">
          <div className="bg-card rounded-t-3xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-[650px] max-h-[90vh] overflow-y-auto shadow-2xl border border-border animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            
            <div className="sticky top-0 bg-card/95 backdrop-blur-md pb-4 pt-2 -mt-2 mb-4 z-10 flex justify-between items-center border-b border-border/50">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground m-0">{editingBagId ? t('edit_bag', 'Edit Bag') : t('new_bag', 'New Bag')}</h2>
              <button onClick={() => setShowModal(false)} className="bg-transparent border-none flex items-center justify-center text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <X size={28} />
              </button>
            </div>
            
            <div className="space-y-6 pb-6">
              <div>
                <label className="block text-sm font-bold mb-2 text-foreground">{t('bag_name', 'Bag Name')}</label>
                <input type="text" placeholder={t('eg_pastry_box', 'e.g., Midnight Pastry Box')} value={modalData.name} onChange={e => setModalData({...modalData, name: e.target.value})} className="w-full p-3.5 bg-input-background border border-border rounded-2xl outline-primary font-medium transition-all focus:shadow-sm" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-foreground">{t('description', 'Description')}</label>
                <textarea placeholder={t('desc_placeholder', 'Describe the bag to the customer...')} value={modalData.description} onChange={e => setModalData({...modalData, description: e.target.value})} className="w-full p-3.5 bg-input-background border border-border rounded-2xl h-24 resize-none outline-primary transition-all focus:shadow-sm" />
              </div>

              <div className="bg-muted/30 p-5 rounded-3xl border border-border">
                <label className="block text-sm font-bold mb-3 text-foreground">{t('bag_image', 'Bag Image')}</label>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="flex-1 cursor-pointer bg-card border border-border hover:bg-muted transition-colors rounded-2xl p-3 flex justify-center items-center gap-2 text-sm font-bold text-foreground shadow-sm">
                        <Camera size={18} className="text-primary shrink-0" /> {t('choose_file', 'Choose File')}
                        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" />
                    </label>
                    {isUploading && <span className="text-sm text-primary flex items-center gap-2 font-bold justify-center"><Loader2 size={16} className="animate-spin" /> Uploading...</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{t('or_paste_url', 'OR PASTE URL')}</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                  <input type="text" placeholder="https://..." value={modalData.image_url} onChange={e => setModalData({...modalData, image_url: e.target.value})} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
                </div>
                {modalData.image_url && (
                  <div className="mt-5 relative rounded-2xl overflow-hidden border border-border shadow-sm group bg-muted flex justify-center items-center h-48">
                    <img src={modalData.image_url} alt="Preview" className="h-full w-full object-cover" />
                    <button onClick={() => setModalData({...modalData, image_url: ""})} className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors border-none cursor-pointer" title="Remove Image">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-muted/10 p-5 rounded-3xl border border-border space-y-6">
                
                <div>
                  <label className="block text-sm font-bold mb-3 text-foreground">{t('category', 'Category')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {FOOD_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => toggleCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer border ${modalData.categorical_tags.includes(cat) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-card text-foreground border-border hover:bg-muted'}`}>
                        {t(`dietary_${cat.toLowerCase()}`, cat)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-3 text-foreground">{t('dietary_labels', 'Dietary Labels')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {DIETARY_OPTIONS.map(cat => (
                      <button key={cat} onClick={() => toggleCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer border ${modalData.categorical_tags.includes(cat) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-card text-foreground border-border hover:bg-muted'}`}>
                        {t(`dietary_${cat.toLowerCase()}`, cat)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-3 text-foreground">{t('allergen_warnings', 'Allergen Warnings (Contains)')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {ALLERGEN_CONTAINS.map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => toggleCategory(cat)} 
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer border ${
                          modalData.categorical_tags.includes(cat) 
                            ? 'bg-destructive/90 text-white border-destructive shadow-sm' 
                            : 'bg-card text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {t(cat.toLowerCase().replace(' ', '_'), cat)}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-muted/30 p-5 rounded-3xl border border-border">
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground">{t('pickup_starts', 'Pickup Starts')}</label>
                  <input type="datetime-local" value={modalData.pickup_start} onChange={e => setModalData({...modalData, pickup_start: e.target.value})} className="w-full p-3.5 bg-card border border-border rounded-2xl outline-primary shadow-sm text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground">{t('pickup_finishes', 'Pickup Finishes')}</label>
                  <input type="datetime-local" value={modalData.pickup_end} onChange={e => setModalData({...modalData, pickup_end: e.target.value})} className="w-full p-3.5 bg-card border border-border rounded-2xl outline-primary shadow-sm text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground">{t('original_price', 'Original (MDL)')}</label>
                  <input type="number" value={modalData.original_price} onChange={e => setModalData({...modalData, original_price: e.target.value})} className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-bold text-lg sm:text-xl outline-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-primary">{t('discounted_price', 'Discounted (MDL)')}</label>
                  <input type="number" value={modalData.discounted_price} onChange={e => setModalData({...modalData, discounted_price: e.target.value})} className="w-full p-3.5 bg-primary/5 border border-primary/30 rounded-2xl font-black text-lg sm:text-xl text-primary outline-primary" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border mt-8">
                <button onClick={() => setShowModal(false)} className="w-full sm:w-auto px-6 py-3.5 bg-card border border-border text-foreground rounded-full font-bold hover:bg-muted cursor-pointer order-2 sm:order-1">{t('cancel', 'Cancel')}</button>
                <button onClick={validateAndSave} className="w-full sm:w-auto px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-bold hover:bg-primary/90 cursor-pointer shadow-sm order-1 sm:order-2">{editingBagId ? t('save_changes', "Save Changes") : t('activate_bag', "Activate Bag")}</button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}