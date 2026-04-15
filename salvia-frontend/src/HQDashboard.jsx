import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; 
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from './api';
import L from 'leaflet';
import { 
  LayoutDashboard, Building2, PlusCircle, Settings, ShieldCheck, 
  TrendingUp, ShoppingBag, XCircle, Star, MapPin, CheckCircle, 
  ArrowLeft, Edit2, Calendar, Clock, LogOut, PackageX, Loader2, 
  X, Search, ChevronRight, Trash2
} from 'lucide-react';

import StatCard from './components/StatCard';
import SalesChart from './components/SalesChart';
import StoreBagCard from './components/StoreBagCard';
import LanguageSwitcher from './components/LanguageSwitcher'; 

const AppIcon = new L.divIcon({
  html: `<div style="width: 36px; height: 36px; border-radius: 50%; background-color: #556B55; color: white; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'custom-hq-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
});

function ChangeMapView({ center }) {
  const map = useMap();
  map.setView(center, 15);
  return null;
}

export default function HQDashboard() {
  const { t } = useTranslation(); 

  const MENU_ITEMS = [
    { id: 'Dashboard', label: t('menu_dashboard', 'Dashboard'), icon: LayoutDashboard },
    { id: 'Franchises', label: t('menu_franchises', 'Franchises'), icon: Building2 },
    { id: 'Add Store', label: t('menu_add_store', 'Add Store'), icon: PlusCircle },
    { id: 'Profile', label: t('menu_profile', 'Profile'), icon: Settings },
    { id: 'Legal', label: t('menu_legal', 'Legal & Info'), icon: ShieldCheck }
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

  const [activeTab, setActiveTab] = useState('Dashboard'); 
  const [locations, setLocations] = useState([]);
  
  const [hqStats, setHqStats] = useState({ total_revenue: 0, bags_sold: 0, canceled_orders: 0, rating: 0 });
  const [allOrders, setAllOrders] = useState([]);
  
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeOrders, setStoreOrders] = useState([]);
  const [activeBags, setActiveBags] = useState([]);
  const [pastBags, setPastBags] = useState([]);
  const [storeStats, setStoreStats] = useState({ total_revenue: 0, bags_sold: 0, canceled_orders: 0, rating: 0 });
  
  const [chartData, setChartData] = useState({ Week: [], Month: [], Year: [], All: [] });
  const [chartStoreFilter, setChartStoreFilter] = useState('ALL');

  const navigate = useNavigate();

  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateShort = (dateString) => new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const [storeName, setStoreName] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState([47.0250, 28.8300]); 
  const [confirmedAddress, setConfirmedAddress] = useState('');
  
  const [hqProfile, setHqProfile] = useState({ name: '', email: '', phone: '', has_password: true });

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

  const [showEditModal, setShowEditModal] = useState(false);
  const [editStoreData, setEditStoreData] = useState({ name: '', email: '', address_text: '', password: '', confirmPassword: '' });
  
  const [editPosition, setEditPosition] = useState([47.0250, 28.8300]);
  const [editSearchQuery, setEditSearchQuery] = useState("");

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { navigate('/'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'company_admin') { navigate('/'); return; }
      fetchLocations();
      fetchStats();
      fetchAllOrders();
    } catch (err) { navigate('/'); }
  }, [navigate]);

  useEffect(() => {
    buildChartData(allOrders, chartStoreFilter);
  }, [allOrders, chartStoreFilter]);

  useEffect(() => {
    if (chartStoreFilter !== 'ALL') {
      api.get(`/companies/me/locations/${chartStoreFilter}/stats`)
        .then(res => setStoreStats(res.data))
        .catch(err => console.error("Error fetching filtered store stats:", err));
    }
  }, [chartStoreFilter]);

  useEffect(() => {
    if (activeTab === 'Profile') fetchProfile();
  }, [activeTab]);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/companies/me/locations');
      setLocations(response.data);
    } catch (err) { console.error(err); }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/companies/me/stats');
      setHqStats(response.data);
    } catch (err) { console.error(err); }
  };

  const fetchAllOrders = async () => {
    try {
      const response = await api.get('/companies/me/all_orders');
      setAllOrders(response.data);
    } catch (err) { console.error(err); }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/companies/me/profile');
      setHqProfile({ 
        name: res.data.name || "", 
        email: res.data.email || "",
        phone: res.data.phone || "",
        has_password: res.data.has_password 
      });
    } catch (err) { console.error(err); }
  };

  const handleSaveProfileInfo = async () => {
    try {
      await api.patch('/companies/me/profile', { name: hqProfile.name, phone: hqProfile.phone });
      alert(t('profile_success', "Profile updated successfully!"));
    } catch (err) { 
      alert(t('profile_update_failed', "Failed to update profile.")); 
    }
  };

  const handleStandalonePasswordChange = async () => {
    if (hqProfile.has_password && !secOldPwd) return alert(t('pwd_current_req', "Please enter your current password."));
    if (!secNewPwd || !secConfirmPwd) return alert(t('pwd_all_req', "Please fill in the new password fields."));
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
    if (!newEmail || newEmail === hqProfile.email) return alert(t('email_invalid', "Please enter a valid, different email address."));
    setIsEmailLoading(true);
    try {
      await api.post('/auth/change-email/request', { new_email: newEmail });
      setEmailChangeStep('verifying');
      alert(`${t('verify_code_sent', "Verification code sent to")} ${newEmail}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to request email change.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailChangeOtp || emailChangeOtp.length !== 6) return alert(t('code_req', "Please enter the full 6-digit code."));
    
    if (wantsPwdChange) {
      if (hqProfile.has_password && !bundledOldPwd) return alert(t('pwd_current_req', "Please enter your current password."));
      if (!bundledNewPwd || !bundledConfirmPwd) return alert(t('pwd_all_req', "Please fill in the new password fields."));
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

  const buildChartData = (orders, storeFilter) => {
    const filteredOrders = storeFilter === 'ALL' 
      ? orders.filter(o => o.status === 'completed')
      : orders.filter(o => o.status === 'completed' && o.store_id === parseInt(storeFilter));

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

    filteredOrders.forEach(order => {
      const d = new Date(order.completed_at || order.purchased_at);
      const year = d.getFullYear();

      if (!allDataMap[year]) allDataMap[year] = 0;
      allDataMap[year]++;

      if (year === now.getFullYear()) {
        yearData[d.getMonth()].sales++;
        if (d.getMonth() === now.getMonth()) {
          monthData[d.getDate() - 1].sales++;
        }
      }

      if (d >= startOfWeek) {
        weekData[dayToIndex[d.getDay()]].sales++;
      }
    });

    const allData = Object.keys(allDataMap).sort().map(y => ({ label: y, sales: allDataMap[y] }));
    if (allData.length === 0) allData.push({ label: now.getFullYear().toString(), sales: 0 });

    setChartData({ Week: weekData, Month: monthData, Year: yearData, All: allData });
  };

  const handleAddressSearch = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", Chișinău")}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setConfirmedAddress(data[0].display_name);
      } else {
        alert(t('addr_not_found', "Address not found! Try being more specific."));
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!confirmedAddress) { alert(t('err_req_address', "Please search and confirm an address on the map first.")); return; }
    try {
      await api.post('/locations/register', { name: storeName, email: storeEmail, password: storePassword, address_text: confirmedAddress, lat: position[0], lon: position[1] });
      alert(t('store_created_success', "Store successfully created!"));
      fetchLocations();
      setActiveTab('Franchises');
    } catch (err) { alert(err.response?.data?.detail || "Failed to create store."); }
  };

  const viewStoreDetails = async (store) => {
    setSelectedStore(store);
    setActiveTab('StoreView');
    
    try {
      const [statsRes, invRes, ordersRes] = await Promise.all([
        api.get(`/companies/me/locations/${store.id}/stats`),
        api.get(`/companies/me/locations/${store.id}/inventory`),
        api.get(`/companies/me/locations/${store.id}/orders`)
      ]);
      
      setStoreStats(statsRes.data);
      setStoreOrders(ordersRes.data);

      const now = new Date();
      setActiveBags(invRes.data.filter(bag => bag.quantity_available > 0 && new Date(bag.pickup_end) > now));
      
      const historyBags = invRes.data.filter(bag => 
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
              acc[key].historyItems.push({
                id: `sale-${sale.order_id}`, type: 'sale', date: sale.completed_at || sale.purchased_at
              });
            }
          });
        }
        
        const isPast = bag.quantity_available === 0 || new Date(bag.pickup_end) <= now;
        if (isPast && bag.quantity_available > 0) {
          acc[key].historyItems.push({
            id: `expired-${bag.id}`, type: 'expired', date: bag.pickup_end, quantity: bag.quantity_available
          });
        }
        return acc;
      }, {});

      const pastArray = Object.values(grouped).map(group => {
        group.historyItems.sort((a, b) => new Date(b.date) - new Date(a.date));
        return group;
      });

      setPastBags(pastArray);

    } catch (err) { console.error("Failed to load store view", err); }
  };

  const openEditModal = () => {
    setEditStoreData({
      name: selectedStore.name,
      email: selectedStore.email,
      address_text: selectedStore.address_text,
      password: '', 
      confirmPassword: ''
    });
    setEditPosition([selectedStore.lat || 47.0250, selectedStore.lon || 28.8300]);
    setEditSearchQuery("");
    setShowEditModal(true);
  };

  const handleEditAddressSearch = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(editSearchQuery + ", Chișinău")}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setEditPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setEditStoreData(prev => ({...prev, address_text: data[0].display_name}));
      } else {
        alert(t('addr_not_found', "Address not found! Try being more specific."));
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateStore = async (e) => {
    e.preventDefault();
    if (editStoreData.password && editStoreData.password !== editStoreData.confirmPassword) {
      return alert(t('pwd_no_match', "New passwords do not match!"));
    }
    try {
      const payload = {
        name: editStoreData.name,
        email: editStoreData.email,
        address_text: editStoreData.address_text,
        lat: editPosition[0],
        lon: editPosition[1]
      };
      
      if (editStoreData.password) {
        payload.password = editStoreData.password;
      }
      
      await api.patch(`/companies/me/locations/${selectedStore.id}`, payload);
      alert(t('branch_update_success', "Branch updated successfully!"));
      setShowEditModal(false);
      
      const updatedStore = { ...selectedStore, ...payload };
      setSelectedStore(updatedStore);
      setLocations(locations.map(s => s.id === updatedStore.id ? updatedStore : s));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update branch.");
    }
  };

  // 👇 NEW: Delete Store Handler
  const handleDeleteStore = async (storeId) => {
    if (!window.confirm(t('confirm_delete_branch', "⚠️ Are you absolutely sure you want to permanently delete this branch? All inventory and records will be lost. This cannot be undone."))) {
      return;
    }

    try {
      await api.delete(`/companies/me/locations/${storeId}`);
      alert(t('branch_deleted_success', "Branch deleted successfully."));
      
      // Clean up the UI
      setLocations(locations.filter(s => s.id !== storeId));
      setShowEditModal(false);
      setSelectedStore(null);
      setActiveTab('Franchises');
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete branch.");
    }
  };

  const readOnlyAlert = () => alert(t('hq_readonly', "HQ Dashboard is in read-only mode for inventory. Actions must be performed by the branch manager."));

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-background font-sans overflow-hidden">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border text-foreground flex-col p-6 space-y-10 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary m-0">Crumbless</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 m-0">{t('hq_control', 'HQ Control')}</p>
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button 
                key={item.id} 
                onClick={() => { setActiveTab(item.id); setSelectedStore(null); setChartStoreFilter('ALL'); }}
                className={`w-full flex items-center gap-3 text-left py-3.5 px-4 rounded-2xl font-bold cursor-pointer transition-colors ${
                  (activeTab === item.id || (item.id === 'Franchises' && activeTab === 'StoreView')) 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-primary m-0">Crumbless</h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-primary/70 m-0">{t('hq_control', 'HQ Control')}</p>
          </div>
          
          <div className="flex items-center gap-3">
             <LanguageSwitcher />
             <button onClick={() => { localStorage.removeItem('access_token'); navigate('/'); }} className="text-sm font-bold text-destructive cursor-pointer p-2 bg-destructive/10 rounded-full">
               <LogOut size={16} strokeWidth={2} />
             </button>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* VIEW: HQ DASHBOARD */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Dashboard' && (
          <div className="animate-in fade-in duration-300 pt-10 sm:pt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight m-0">{t('franchise_overview', 'Franchise Overview')}</h2>
              
              <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{t('filter_by', 'Filter Data By')}</label>
                 <select 
                   value={chartStoreFilter} 
                   onChange={(e) => setChartStoreFilter(e.target.value)}
                   className="p-3 bg-card border border-border rounded-full font-bold text-sm outline-primary shadow-sm cursor-pointer w-full sm:max-w-[250px] truncate"
                 >
                   <option value="ALL">{t('all_stores', 'All Stores (Global)')}</option>
                   {locations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard title={t('total_revenue', 'Total Revenue')} value={`${chartStoreFilter === 'ALL' ? hqStats.total_revenue : storeStats.total_revenue || 0} MDL`} label={t('all_time', 'All time')} icon={<TrendingUp size={24} className="text-primary" />} />
              <StatCard title={t('bags_sold', 'Bags Sold')} value={chartStoreFilter === 'ALL' ? hqStats.bags_sold : storeStats.bags_sold || 0} label={t('all_time', 'All time')} icon={<ShoppingBag size={24} className="text-primary" />} />
              <StatCard title={t('canceled_orders', 'Canceled Orders')} value={chartStoreFilter === 'ALL' ? hqStats.canceled_orders : storeStats.canceled_orders || 0} label={t('missed_pickups', 'Missed pickups')} icon={<XCircle size={24} className="text-destructive" />} />
              <StatCard title={t('avg_rating', 'Avg Rating')} value={chartStoreFilter === 'ALL' ? hqStats.rating : storeStats.rating || 0} label={t('customer_satisfaction', 'Customer satisfaction')} icon={<Star size={24} className="text-yellow-500 fill-yellow-500" />} />
            </div>

            <SalesChart data={chartData} />
          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VIEW: FRANCHISES LIST */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Franchises' && (
          <div className="animate-in fade-in duration-300 pt-10 sm:pt-0">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight m-0">{t('my_franchises', 'My Franchises')}</h2>
               <button onClick={() => setActiveTab('Add Store')} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 rounded-full font-bold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer text-sm">
                 <PlusCircle size={18} /> {t('add_branch', 'Add Branch')}
               </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {locations.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-card border border-border rounded-3xl shadow-sm">
                  <Building2 size={48} className="text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-muted-foreground font-medium">{t('no_stores', 'No stores added yet. Add your first branch!')}</p>
                </div>
              ) : (
                locations.map(store => (
                  <div key={store.id} className="bg-card border border-border p-6 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div>
                      <h4 className="text-2xl font-extrabold m-0 mb-2">{store.name}</h4>
                      <p className="text-sm text-muted-foreground font-medium m-0 mb-6 flex items-start gap-1.5">
                        <MapPin size={16} className="shrink-0 mt-0.5" /> {store.address_text}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-5 border-t border-border">
                      <span className="text-xs bg-muted px-3 py-1.5 rounded-full font-bold text-muted-foreground break-all mr-3">{store.email}</span>
                      <button onClick={() => viewStoreDetails(store)} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-card border border-border text-foreground font-bold rounded-full text-sm hover:bg-muted transition-colors cursor-pointer shrink-0">
                        {t('view_stats', 'View Stats')} <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VIEW: STORE DRILL DOWN (MIRRORED STORE DASHBOARD) */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'StoreView' && selectedStore && (
          <div className="animate-in slide-in-from-right-8 duration-300 relative pt-10 sm:pt-0">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <button onClick={() => { setActiveTab('Franchises'); setSelectedStore(null); }} className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0">
                <ArrowLeft size={16} /> {t('back_to_franchises', 'Back to Franchises')}
              </button>
              
              <button onClick={openEditModal} className="text-sm font-bold bg-card border border-border text-foreground hover:bg-muted px-5 py-2.5 rounded-full transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
                <Edit2 size={14} /> {t('edit_branch_details', 'Edit Branch Details')}
              </button>
            </div>
            
            <div className="mb-8">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight m-0 mb-3">{selectedStore.name}</h2>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">{t('hq_readonly_view', 'HQ Read-Only View')}</span>
                <span className="text-xs font-bold text-muted-foreground">{selectedStore.email}</span>
              </div>
            </div>

            {/* Mirrored Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
              <StatCard title={t('total_revenue', 'Total Revenue')} value={`${storeStats.total_revenue} MDL`} label={t('all_time', 'All time')} icon={<TrendingUp size={24} className="text-primary" />} />
              <StatCard title={t('bags_sold', 'Bags Sold')} value={storeStats.bags_sold} label={t('all_time', 'All time')} icon={<ShoppingBag size={24} className="text-primary" />} />
              <StatCard title={t('canceled_orders', 'Canceled Orders')} value={storeStats.canceled_orders || 0} label={t('missed_pickups', 'Missed pickups')} icon={<XCircle size={24} className="text-destructive" />} />
              <StatCard title={t('rating', 'Rating')} value={storeStats.rating} label={t('customer_satisfaction', 'Customer satisfaction')} icon={<Star size={24} className="text-yellow-500 fill-yellow-500" />} />
            </div>

            {/* Mirrored Orders */}
            <div className="mb-12">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-6 m-0 tracking-tight">{t('active_reservations', 'Active Reservations')}</h3>
              {storeOrders.filter(o => o.status === 'reserved').length === 0 ? (
                <p className="text-muted-foreground font-medium bg-muted/30 p-5 rounded-2xl border border-border">{t('no_active_res', 'No active reservations.')}</p>
              ) : (
                <div className="space-y-4 pointer-events-none opacity-80">
                  {storeOrders.filter(o => o.status === 'reserved').map(order => {
                    return (
                      <div key={order.order_id} className="bg-card border-2 border-amber-500/40 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-6">
                        <div>
                          <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mb-3 shadow-sm">{t('awaiting_pickup', 'Awaiting Pickup')}</span>
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mirrored Active Bags */}
            <div className="mb-12 border-t border-border pt-8">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-6 m-0 tracking-tight">{t('available_bags', 'Available Bags')}</h3>
              {activeBags.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-3xl">
                  <PackageX size={48} strokeWidth={1.5} className="text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">{t('no_active_bags', 'No active surprise bags listed.')}</p>
                </div>
              ) : (
                <div onClick={readOnlyAlert} className="cursor-not-allowed">
                  <div className="pointer-events-none opacity-90">
                    {activeBags.map(bag => (
                      <StoreBagCard key={bag.id} bag={bag} type="active" onUpdateQuantity={()=>{}} onEdit={()=>{}} onDelete={()=>{}} onRelist={()=>{}} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mirrored Past Bags */}
            {pastBags.length > 0 && (
              <div className="mb-12 border-t border-border pt-8">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground opacity-80 mb-2 m-0 tracking-tight">{t('past_bags', 'Past Bags')}</h3>
                <p className="text-muted-foreground text-sm mb-6 mt-0">{t('relist_msg', 'These bags are sold out or expired. Relist them for a new day.')}</p>
                <div onClick={readOnlyAlert} className="cursor-not-allowed">
                  <div className="pointer-events-none opacity-90">
                    {pastBags.map(group => (
                      <StoreBagCard key={group.id} bag={group} type="expired" historyItems={group.historyItems} onRelist={()=>{}} onDelete={()=>{}} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Mirrored Canceled */}
            {storeOrders.filter(o => o.status === 'cancelled').length > 0 && (
              <div className="border-t border-border pt-8">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground opacity-80 mb-4 m-0 tracking-tight">{t('canceled_reservations', 'Canceled Reservations')}</h3>
                <div className="space-y-4">
                  {storeOrders.filter(o => o.status === 'cancelled').map(order => (
                    <div key={order.order_id} className="bg-muted/30 border border-border p-5 rounded-3xl flex justify-between items-center opacity-70">
                      <div>
                        <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mb-3">{t('canceled', 'Canceled')}</span>
                        <h4 className="text-lg font-extrabold m-0 line-through">{t('order', 'Order')} #{order.order_id}</h4>
                        <p className="text-sm font-medium m-0 mt-1">{translateTags(order.categorical_tags)}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-bold uppercase tracking-widest m-0 mb-1 text-muted-foreground">{t('code', 'Code')}</p>
                         <p className="text-xl font-black tracking-widest m-0 line-through text-muted-foreground">{order.pickup_code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VIEW: ADD STORE */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Add Store' && (
          <div className="animate-in fade-in duration-300 max-w-4xl pt-10 sm:pt-0">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-8 m-0">{t('add_new_location', 'Add New Location')}</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-xl font-bold mb-6 m-0 flex items-center gap-3">
                  <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black">1</span>
                  {t('pin_location', 'Pin the Location')}
                </h3>
                <form onSubmit={handleAddressSearch} className="flex gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder={t('addr_placeholder', "e.g., strada Pușkin 22")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} required className="w-full pl-9 pr-3 py-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary text-sm shadow-inner" />
                  </div>
                  <button type="submit" className="px-6 bg-card border border-border text-foreground rounded-full font-bold hover:bg-muted shadow-sm cursor-pointer text-sm">{t('search', 'Search')}</button>
                </form>
                
                <div className="h-64 w-full rounded-3xl overflow-hidden border border-border shadow-inner relative z-0">
                  <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <ChangeMapView center={position} />
                    <Marker position={position} icon={AppIcon}><Popup>{t('new_store_location', 'New Store Location')}</Popup></Marker>
                  </MapContainer>
                </div>
                {confirmedAddress && (
                  <div className="mt-5 bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-start gap-3">
                    <CheckCircle size={18} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-foreground m-0 leading-snug">{confirmedAddress}</p>
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-xl font-bold mb-6 m-0 flex items-center gap-3">
                  <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black">2</span>
                  {t('branch_details', 'Branch Details')}
                </h3>
                <form onSubmit={handleCreateStore} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-bold mb-2 text-foreground">{t('branch_name', 'Branch Name')}</label>
                    <input type="text" placeholder="e.g., Botanica Branch" value={storeName} onChange={e => setStoreName(e.target.value)} required className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 text-foreground">{t('manager_email', 'Manager Login Email')}</label>
                    <input type="email" placeholder="contact@branch.md" value={storeEmail} onChange={e => setStoreEmail(e.target.value)} required className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 text-foreground">{t('temp_password', 'Temporary Password')}</label>
                    <input type="password" placeholder="••••••••" value={storePassword} onChange={e => setStorePassword(e.target.value)} required className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" />
                  </div>
                  <div className="pt-6 border-t border-border mt-4">
                    <button type="submit" className="w-full py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer">
                      {t('deploy_store', 'Deploy Store')}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VIEW: HQ PROFILE & SECURITY */}
        {/* --------------------------------------------------------- */}
        {activeTab === 'Profile' && (
          <div className="animate-in fade-in duration-300 max-w-2xl pt-10 sm:pt-0">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-8 m-0">{t('company_profile', 'Company Profile')}</h2>
            
            {/* GENERAL INFO */}
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
              <h3 className="text-xl font-bold mb-6 text-foreground">{t('general_info', 'General Info')}</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold mb-2">{t('company_name', 'Company Name')}</label>
                  <input type="text" value={hqProfile.name} onChange={e => setHqProfile({...hqProfile, name: e.target.value})} className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">{t('contact_phone', 'Contact Phone Number')}</label>
                  <input type="text" placeholder="e.g., +373 60 123 456" value={hqProfile.phone} onChange={e => setHqProfile({...hqProfile, phone: e.target.value})} className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" />
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{t('used_notifications', 'Used exclusively for platform notifications and support outreach.')}</p>
                </div>
                <div className="pt-2">
                  <button onClick={handleSaveProfileInfo} className="bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-bold shadow-sm cursor-pointer hover:bg-primary/90 transition-colors">
                    {t('save_info', 'Save Info')}
                  </button>
                </div>
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
                  {hqProfile.has_password && (
                    <input type="password" placeholder={t('curr_pwd', 'Current Password')} value={secOldPwd} onChange={e => setSecOldPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
                  )}
                  <input type="password" placeholder={t('new_pwd', 'New Password')} value={secNewPwd} onChange={e => setSecNewPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
                  <input type="password" placeholder={t('confirm_pwd', 'Confirm New')} value={secConfirmPwd} onChange={e => setSecConfirmPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
                </div>
                <button onClick={handleStandalonePasswordChange} disabled={isPwdLoading} className="px-6 py-3.5 bg-card border border-border text-foreground rounded-full font-bold text-sm hover:bg-muted transition-colors cursor-pointer shadow-sm">
                  {isPwdLoading ? <Loader2 size={16} className="animate-spin inline" /> : t('update_pwd', 'Update Password')}
                </button>
              </div>

              {/* Email Change Flow */}
              <div className="bg-muted/30 border border-border rounded-3xl p-6">
                <h4 className="text-sm font-bold mb-2 text-foreground">{t('change_email', 'Change Login Email')}</h4>
                <p className="text-sm text-muted-foreground mb-5">{t('curr_email', 'Current Email')}: <span className="font-bold text-foreground">{hqProfile.email}</span></p>

                {emailChangeStep === 'idle' ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="email" placeholder={t('enter_new_email', 'Enter new email address')} value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1 p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
                    <button onClick={handleRequestEmailChange} disabled={isEmailLoading || !newEmail || newEmail === hqProfile.email} className="px-6 py-3.5 bg-card border border-border text-foreground rounded-full font-bold hover:bg-muted transition-colors cursor-pointer text-sm shadow-sm">
                      {isEmailLoading ? <Loader2 size={16} className="animate-spin inline" /> : t('req_change', 'Request Change')}
                    </button>
                  </div>
                ) : (
                  <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                     <p className="text-sm font-bold text-primary mb-3">{t('enter_code_sent', 'Enter the 6-digit code sent to')} {newEmail}</p>
                     
                     <div className="flex flex-col sm:flex-row gap-3 mb-5">
                       <input type="text" placeholder="000000" maxLength="6" value={emailChangeOtp} onChange={e => setEmailChangeOtp(e.target.value.replace(/\D/g, ''))} className="flex-1 p-3.5 text-center text-xl tracking-widest bg-white border border-primary/30 rounded-2xl font-black outline-primary shadow-sm" />
                       <button onClick={handleVerifyEmailChange} disabled={isEmailLoading || emailChangeOtp.length !== 6} className="px-6 py-3.5 bg-primary text-white rounded-full font-bold shadow-sm cursor-pointer hover:bg-primary/90 transition-colors text-sm">
                         {isEmailLoading ? <Loader2 size={16} className="animate-spin inline" /> : t('verify_update', 'Verify & Update')}
                       </button>
                       <button onClick={() => { setEmailChangeStep('idle'); setEmailChangeOtp(''); setNewEmail(''); setWantsPwdChange(false); }} className="px-5 py-3.5 bg-card border border-border text-muted-foreground rounded-full font-bold hover:bg-muted transition-colors cursor-pointer text-sm shadow-sm">
                         {t('cancel', 'Cancel')}
                       </button>
                     </div>

                     <label className="flex items-center gap-2 cursor-pointer mb-4 select-none">
                       <input type="checkbox" checked={wantsPwdChange} onChange={e => setWantsPwdChange(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                       <span className="text-sm font-bold text-foreground">{t('want_new_pwd', 'I also want to set a new password')}</span>
                     </label>

                     {wantsPwdChange && (
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
                         {hqProfile.has_password && (
                           <input type="password" placeholder={t('curr_pwd', 'Current Password')} value={bundledOldPwd} onChange={e => setBundledOldPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
                         )}
                         <input type="password" placeholder={t('new_pwd', 'New Password')} value={bundledNewPwd} onChange={e => setBundledNewPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
                         <input type="password" placeholder={t('confirm_pwd', 'Confirm New')} value={bundledConfirmPwd} onChange={e => setBundledConfirmPwd(e.target.value)} className="w-full p-3.5 bg-white border border-border rounded-2xl outline-primary text-sm shadow-sm" />
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
              <h3>Enterprise Agreement</h3>
              <p>As a franchise owner, you are responsible for ensuring all branches comply with health codes...</p>
            </div>
          </div>
        )}

      </main>

      {/* --------------------------------------------------------- */}
      {/* HQ EDIT BRANCH MODAL */}
      {/* --------------------------------------------------------- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card rounded-3xl w-full max-w-[600px] p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3 className="m-0 font-bold text-2xl">{t('edit_branch_details', 'Edit Branch Details')}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateStore} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">{t('branch_name', 'Branch Name')}</label>
                  <input 
                    type="text" 
                    value={editStoreData.name} 
                    onChange={(e) => setEditStoreData({...editStoreData, name: e.target.value})} 
                    required 
                    className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">{t('manager_email', 'Manager Login Email')}</label>
                  <input 
                    type="email" 
                    value={editStoreData.email} 
                    onChange={(e) => setEditStoreData({...editStoreData, email: e.target.value})} 
                    required 
                    className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-0">{t('email_warning', 'Warning: Changing email immediately alters login credentials.')}</p>

              <div className="border-t border-border pt-4">
                <label className="block text-sm font-bold mb-2">{t('physical_address', 'Address Text & Location')}</label>
                
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Search new address on map..." 
                      value={editSearchQuery} 
                      onChange={(e) => setEditSearchQuery(e.target.value)} 
                      className="w-full pl-9 pr-3 py-3 bg-input-background border border-border rounded-full font-medium outline-primary text-sm shadow-inner" 
                    />
                  </div>
                  <button type="button" onClick={handleEditAddressSearch} className="px-5 bg-card border border-border text-foreground rounded-full font-bold hover:bg-muted shadow-sm cursor-pointer text-sm">
                    {t('search', 'Search')}
                  </button>
                </div>
                
                <div className="h-48 w-full rounded-2xl overflow-hidden border border-border shadow-inner relative z-0 mb-3">
                  <MapContainer center={editPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <ChangeMapView center={editPosition} />
                    <Marker position={editPosition} icon={AppIcon} />
                  </MapContainer>
                </div>

                <input 
                  type="text" 
                  value={editStoreData.address_text} 
                  onChange={(e) => setEditStoreData({...editStoreData, address_text: e.target.value})} 
                  required 
                  className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary text-sm shadow-sm" 
                />
              </div>

              {/* Password Reset Fields */}
              <div className="pt-4 mt-2 border-t border-border">
                <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" /> {t('reset_manager_pwd', 'Reset Manager Password')} <span className="text-muted-foreground font-medium text-xs ml-auto">(Optional)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <input 
                      type="password" 
                      placeholder={t('new_pwd', 'New Password')}
                      value={editStoreData.password} 
                      onChange={(e) => setEditStoreData({...editStoreData, password: e.target.value})} 
                      className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" 
                    />
                  </div>
                  <div>
                    <input 
                      type="password" 
                      placeholder={t('confirm_pwd', 'Confirm Password')}
                      value={editStoreData.confirmPassword} 
                      onChange={(e) => setEditStoreData({...editStoreData, confirmPassword: e.target.value})} 
                      className="w-full p-3.5 bg-input-background border border-border rounded-2xl font-medium outline-primary shadow-sm" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-4 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => handleDeleteStore(selectedStore.id)} 
                  className="px-4 py-3.5 bg-destructive/10 text-destructive rounded-full font-bold cursor-pointer hover:bg-destructive/20 transition-colors flex items-center justify-center shrink-0"
                  title={t('delete_branch', 'Delete Branch')}
                >
                  <Trash2 size={20} />
                </button>
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3.5 bg-card border border-border text-foreground rounded-full font-bold cursor-pointer hover:bg-muted transition-colors">{t('cancel', 'Cancel')}</button>
                <button type="submit" className="flex-1 py-3.5 bg-primary text-white rounded-full font-bold cursor-pointer hover:bg-primary/90 shadow-sm transition-colors">{t('save_override', 'Save Override')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around p-2 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.05)] pb-safe">
         <button onClick={() => { setActiveTab('Dashboard'); setSelectedStore(null); setChartStoreFilter('ALL'); }} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'Dashboard' ? 'text-primary' : 'text-muted-foreground'}`}>
            <LayoutDashboard size={24} className="mb-1" strokeWidth={1.5} />
            <span className="text-[10px] font-bold">HQ</span>
         </button>
         <button onClick={() => { setActiveTab('Franchises'); setSelectedStore(null); }} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'Franchises' || activeTab === 'StoreView' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Building2 size={24} className="mb-1" strokeWidth={1.5} />
            <span className="text-[10px] font-bold">{t('menu_franchises', 'Stores')}</span>
         </button>
         <button onClick={() => { setActiveTab('Add Store'); setSelectedStore(null); }} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'Add Store' ? 'text-primary' : 'text-muted-foreground'}`}>
            <PlusCircle size={24} className="mb-1" strokeWidth={1.5} />
            <span className="text-[10px] font-bold">{t('menu_add_store', 'Add')}</span>
         </button>
         <button onClick={() => { setActiveTab('Profile'); setSelectedStore(null); }} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'Profile' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Settings size={24} className="mb-1" strokeWidth={1.5} />
            <span className="text-[10px] font-bold">{t('menu_profile', 'Profile')}</span>
         </button>
      </div>

    </div>
  );
}