import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Search, SlidersHorizontal, MapPin, User, ArrowLeft, Star, Clock, AlertTriangle, Info, Leaf, Utensils, Navigation, X } from 'lucide-react';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';
import api from './api';
import BagCard from './components/BagCard';

// --- CUSTOM ICONS ---
const UserIcon = new L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#556B55" width="36px" height="36px" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.15));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  className: 'custom-user-pin', iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36]
});

const createBagIcon = (imageUrl, hasWarning) => {
  const borderColor = hasWarning ? '#D9534F' : 'white';
  const innerHtml = imageUrl
    ? `<div style="width: 46px; height: 46px; border-radius: 50%; background-image: url('${imageUrl}'); background-size: cover; background-position: center; border: 3px solid ${borderColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>`
    : `<div style="width: 46px; height: 46px; border-radius: 50%; background-color: #E8F0E4; color: #556B55; display: flex; align-items: center; justify-content: center; border: 3px solid ${borderColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></div>`;

  return new L.divIcon({
    html: innerHtml,
    className: 'custom-bag-icon',
    iconSize: [52, 52],
    iconAnchor: [26, 52], 
    popupAnchor: [0, -52] 
  });
};

const createCustomClusterIcon = (cluster) => {
  return new L.divIcon({
    html: `<div style="background-color: #556B55; color: white; border-radius: 50%; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 3px solid white;">${cluster.getChildCount()}</div>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(46, 46, true),
  });
};

function MapUpdater({ center, zoom = 13 }) {
  const map = useMap();
  const lat = center ? center[0] : null;
  const lng = center ? center[1] : null;

  useEffect(() => { 
    if (lat !== null && lng !== null) {
      map.setView([lat, lng], zoom); 
    }
  }, [lat, lng, zoom, map]);
  return null;
}

function MapEventListener({ userLocation, isLocationSet, setZoomWarning, setNearbyBags, refreshTrigger }) {
  const map = useMapEvents({
    moveend: () => fetchBagsInView(),
    zoomend: () => fetchBagsInView(),
  });

  const fetchBagsInView = async () => {
    if (!userLocation) return;
    if (map.getZoom() < 12) {
      setZoomWarning(true);
      setNearbyBags([]); 
      return;
    }
    setZoomWarning(false);
    const bounds = map.getBounds();
    try {
      const response = await api.get(`/bags/bbox?ne_lat=${bounds.getNorthEast().lat}&ne_lon=${bounds.getNorthEast().lng}&sw_lat=${bounds.getSouthWest().lat}&sw_lon=${bounds.getSouthWest().lng}&user_lat=${userLocation[0]}&user_lon=${userLocation[1]}&limit=50`);
      
      let fetchedBags = response.data;
      if (!isLocationSet) {
        fetchedBags = fetchedBags.map(b => ({ ...b, distance_km: undefined }));
      }
      setNearbyBags(fetchedBags);
    } catch (err) { console.error("Error fetching map data:", err); }
  };

  useEffect(() => { if (userLocation) fetchBagsInView(); }, [userLocation, refreshTrigger, isLocationSet]);
  return null;
}

const CHISINAU_SECTORS = [
  { name: "Centru (Downtown)", lat: 47.0250, lon: 28.8300 },
  { name: "Botanica", lat: 46.9833, lon: 28.8667 },
  { name: "Buiucani", lat: 47.0333, lon: 28.7833 },
  { name: "Rîșcani", lat: 47.0500, lon: 28.8500 },
  { name: "Ciocana", lat: 47.0500, lon: 28.8833 },
  { name: "Telecentru", lat: 47.0000, lon: 28.8167 },
];

export default function ClientMap() {
  const { t } = useTranslation(); 

  const [nearbyBags, setNearbyBags] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState(t('set_location', "Set location"));
  const [isLocationSet, setIsLocationSet] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [quickSearch, setQuickSearch] = useState("");
  const [filters, setFilters] = useState({ keywords: "", categories: [], dietary: [], times: [] });
  const [tempFilters, setTempFilters] = useState({ keywords: "", categories: [], dietary: [], times: [] });

  const [zoomWarning, setZoomWarning] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); 
  const [selectedBag, setSelectedBag] = useState(null);

  const navigate = useNavigate();
  const location = useLocation(); 
  const [myOrders, setMyOrders] = useState([]);
  const [showOrders, setShowOrders] = useState(false); 
  const [currentTime, setCurrentTime] = useState(new Date());

  const saveAndSetLocation = (lat, lon, label) => {
    setUserLocation([lat, lon]);
    setLocationLabel(label);
    setIsLocationSet(true);
    
    localStorage.setItem('salvia_user_lat', lat);
    localStorage.setItem('salvia_user_lon', lon);
    localStorage.setItem('salvia_user_label', label);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000); 
    return () => clearInterval(timer);
  }, []);

  const formatPickupWindow = (startStr, endStr) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const now = new Date();
    
    const timeRange = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    let dayLabel = "";
    if (start.toDateString() === now.toDateString()) {
      dayLabel = t('today', "Today");
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      if (start.toDateString() === tomorrow.toDateString()) {
        dayLabel = t('tomorrow', "Tomorrow");
      } else {
        dayLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }
    return `${dayLabel}, ${timeRange}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { navigate('/'); return; }

    const savedLat = localStorage.getItem('salvia_user_lat');
    const savedLon = localStorage.getItem('salvia_user_lon');
    const savedLabel = localStorage.getItem('salvia_user_label');

    if (savedLat && savedLon) {
      setUserLocation([parseFloat(savedLat), parseFloat(savedLon)]);
      setIsLocationSet(true); 
      if (savedLabel) setLocationLabel(savedLabel);
    } else {
      setUserLocation([47.0250, 28.8300]); 
      setIsLocationSet(false); 
      setLocationLabel(t('set_location', "Set location")); 
    }

    api.get('/users/me/impact')
       .then(res => setUserProfile(res.data.user_details))
       .catch(console.error);
  }, [navigate, t]);

  useEffect(() => {
    if (location.state?.openOrders) {
      setShowOrders(true);
      fetchMyOrders();
      window.history.replaceState({}, document.title);
    }
  }, [location.state, navigate]);

  const fetchMyOrders = async () => {
    try {
      const response = await api.get('/orders/me');
      setMyOrders(response.data); 
    } catch (err) { console.error("Error fetching orders:", err); }
  };

  const handleCheckout = async (bagId) => {
    try {
      const response = await api.post('/create-checkout-session', { bag_id: bagId });
      window.location.href = response.data.checkout_url;
    } catch (err) { alert(err.response?.data?.detail || "Checkout failed."); }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm(t('confirm_cancel_order', "Are you sure you want to cancel this order?"))) return;
    try {
      const response = await api.patch(`/orders/${orderId}/cancel`);
      alert(response.data.detail);
      fetchMyOrders();
      setRefreshTrigger(prev => prev + 1); 
    } catch (err) { alert(err.response?.data?.detail || t('cancel_failed', "Failed to cancel.")); }
  };

  const handleLeaveReview = async (orderId, rating) => {
    try {
      await api.post(`/orders/${orderId}/review`, { rating });
      alert(t('review_thanks', "Thank you for your review!"));
      fetchMyOrders(); 
      setRefreshTrigger(prev => prev + 1); 
    } catch (err) {
      alert(err.response?.data?.detail || t('review_failed', "Failed to submit review."));
    }
  };

  const handleUseCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveAndSetLocation(position.coords.latitude, position.coords.longitude, t('current_location', "Current Location"));
          setShowLocationModal(false);
        },
        () => alert(t('location_denied', "Location access denied or failed."))
      );
    }
  };

  const handleAddressSearch = async () => {
    if (!addressQuery) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery + ', Chișinău, Moldova')}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        saveAndSetLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), addressQuery);
        setShowLocationModal(false);
        setAddressQuery(""); 
      } else {
        alert(t('address_not_found', "Address not found."));
      }
    } catch (err) { alert(t('error_searching_address', "Error searching for address.")); } 
    finally { setIsSearching(false); }
  };

  const handleSelectArea = (sector) => {
    saveAndSetLocation(sector.lat, sector.lon, sector.name);
    setShowLocationModal(false);
  };

  const toggleTempFilter = (type, value) => {
    setTempFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value) ? prev[type].filter(item => item !== value) : [...prev[type], value]
    }));
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setQuickSearch(tempFilters.keywords);
    setShowFilterModal(false);
  };

  const clearFilters = () => {
    const empty = { keywords: "", categories: [], dietary: [], times: [] };
    setTempFilters(empty); setFilters(empty); setQuickSearch("");
  };

  const checkWarning = (bag) => {
    if (!userProfile) return false;
    const tags = (bag.categorical_tags || "").toLowerCase();
    
    for (let allergy of userProfile.allergies) {
      const allergenKey = allergy.replace('-Free', '').toLowerCase(); 
      if (tags.includes(`contains ${allergenKey}`)) return true;
    }
    return false;
  };

  const matchesPrefs = (bag) => {
    if (!userProfile || !userProfile.preferences || userProfile.preferences.length === 0) return false;
    const tags = (bag.categorical_tags || "").toLowerCase();
    return userProfile.preferences.some(pref => tags.includes(pref.toLowerCase()));
  };

  const filteredBags = nearbyBags.filter(bag => {
    if (new Date(bag.pickup_end) <= currentTime) return false;

    const searchTerms = quickSearch || filters.keywords;
    if (searchTerms) {
      const query = searchTerms.toLowerCase();
      const matchName = bag.store_name.toLowerCase().includes(query) || (bag.name && bag.name.toLowerCase().includes(query));
      const matchTag = bag.categorical_tags.toLowerCase().includes(query);
      const matchDescription = bag.description && bag.description.toLowerCase().includes(query);

      if (!matchName && !matchTag && !matchDescription) return false;
    }

    if (filters.categories.length > 0 && !filters.categories.some(c => bag.categorical_tags.includes(c))) return false;
    if (filters.dietary.length > 0 && !filters.dietary.some(d => bag.categorical_tags.includes(d))) return false;
    if (filters.times.length > 0) {
      const hour = new Date(bag.pickup_start).getHours();
      const matchesTime = filters.times.some(time => {
        if (time === 'Morning') return hour >= 6 && hour < 12;
        if (time === 'Afternoon') return hour >= 12 && hour < 18;
        if (time === 'Evening') return hour >= 18;
        return false;
      });
      if (!matchesTime) return false;
    }
    return true;
  }).sort((a, b) => {
    const aHasWarning = checkWarning(a);
    const bHasWarning = checkWarning(b);

    if (aHasWarning && !bHasWarning) return 1;
    if (!aHasWarning && bHasWarning) return -1;
    
    const aMatches = matchesPrefs(a);
    const bMatches = matchesPrefs(b);
    
    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;

    return (a.distance_km || 0) - (b.distance_km || 0);
  });

  const filteredOrders = myOrders.filter(order => {
    const searchTerms = quickSearch || filters.keywords;
    if (searchTerms) {
      const query = searchTerms.toLowerCase();
      
      const matchStore = order.store_name?.toLowerCase().includes(query);
      const matchBag = order.bag_name?.toLowerCase().includes(query);
      const matchDesc = order.bag_description?.toLowerCase().includes(query);
      const matchTag = order.categorical_tags?.toLowerCase().includes(query);

      if (!matchStore && !matchBag && !matchDesc && !matchTag) return false;
    }

    if (filters.categories.length > 0 && !filters.categories.some(c => order.categorical_tags?.includes(c))) return false;
    if (filters.dietary.length > 0 && !filters.dietary.some(d => order.categorical_tags?.includes(d))) return false;
    
    return true;
  });

  if (!userLocation) return <div className="flex items-center justify-center h-screen font-bold text-xl text-primary">{t('loading_map', 'Loading Map...')}</div>;

  return (
    <div className="flex flex-col h-screen w-screen font-sans bg-background overflow-hidden">
      
      <header className="bg-card px-4 sm:px-6 py-3 sm:py-4 flex items-center border-b border-border shrink-0 z-20 gap-3 sm:gap-4 shadow-sm w-full">
        
        {!selectedBag ? (
          <div className="relative flex-1 min-w-[120px]">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search size={18} />
            </span>
            <input 
              type="text" 
              placeholder={t('search_placeholder', "Search restaurants or food...")}
              value={quickSearch}
              onChange={(e) => {
                setQuickSearch(e.target.value);
                setFilters(prev => ({...prev, keywords: e.target.value}));
              }}
              className="w-full pl-9 sm:pl-11 pr-4 py-2.5 sm:py-3 rounded-full border border-border/50 bg-input-background focus:outline-primary focus:bg-white transition-colors text-sm font-medium shadow-inner"
            />
          </div>
        ) : (
          <div className="flex-1"></div> 
        )}

        <div className={`flex items-center justify-end gap-3 sm:gap-5 shrink-0 ml-auto ${(!selectedBag) ? 'w-auto' : 'w-full'}`}>
          
          {!selectedBag && (
            <button 
              onClick={() => {
                setTempFilters({ ...filters, keywords: quickSearch });
                setShowFilterModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-card border border-border rounded-full font-semibold text-foreground hover:bg-muted transition-colors text-sm shrink-0 cursor-pointer shadow-sm"
            >
              <SlidersHorizontal size={16} className="text-muted-foreground" />
              <span className="hidden lg:inline">{t('filters', 'Filters')}</span>
              {(filters.categories.length > 0 || filters.dietary.length > 0 || filters.times.length > 0) && (
                <span className="bg-primary text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px]">
                  {filters.categories.length + filters.dietary.length + filters.times.length}
                </span>
              )}
            </button>
          )}

          <button onClick={() => setShowLocationModal(true)} className="flex items-center gap-1.5 sm:gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer bg-transparent hover:bg-muted/50 px-2 sm:px-3 py-2 rounded-full shrink-0">
            <MapPin size={18} className="text-muted-foreground" />
            <span className="truncate max-w-[90px] sm:max-w-[200px] hidden sm:inline">{locationLabel}</span>
            <span className="sm:hidden">Loc</span>
          </button>
          
          <button onClick={() => navigate('/profile')} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground shadow-sm cursor-pointer hover:bg-primary hover:text-white hover:border-primary transition-all overflow-hidden group shrink-0">
            <User size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        
        <div className="w-full md:w-[450px] lg:w-[500px] flex-none bg-background overflow-y-auto z-10 shadow-[4px_0_24px_rgba(0,0,0,0.05)] order-2 md:order-1 h-[55vh] md:h-full border-t md:border-t-0 border-border">
          <div className="p-4 sm:p-6">
            
            {/* --- SLIDING DETAILS PANEL --- */}
            {selectedBag ? (
              <div className="animate-in slide-in-from-right-8 duration-300 pb-10">
                <button onClick={() => setSelectedBag(null)} className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors mb-4 cursor-pointer bg-transparent border-none">
                  <ArrowLeft size={16} /> {t('back', 'Back')}
                </button>

                <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm mb-6">
                  <div className="h-48 w-full bg-muted relative flex items-center justify-center">
                    {selectedBag.image_url ? (
                      <img src={selectedBag.image_url} alt={selectedBag.name} className="w-full h-full object-cover" />
                    ) : (
                      <Leaf size={48} className="text-primary/40" />
                    )}
                    <div className="absolute top-4 right-4 bg-accent text-accent-foreground px-4 py-1.5 rounded-full text-xs font-bold shadow-sm border border-primary/10">
                      {selectedBag.quantity_available} {t('left', 'left')}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex justify-between items-start mb-1">
                      <h2 className="text-2xl font-extrabold text-foreground m-0">{selectedBag.store_name}</h2>
                      <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full border border-border text-xs font-bold text-foreground shrink-0">
                        <Star size={12} fill="currentColor" className="text-yellow-500" />
                        {selectedBag.avg_rating > 0 ? selectedBag.avg_rating.toFixed(1) : t('new', 'New')}
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground text-sm font-medium m-0 mb-3">{selectedBag.name || t('surprise_bag', "Surprise Bag")}</p>

                    <div className="flex flex-wrap gap-2 mb-5">
                      {selectedBag.categorical_tags && selectedBag.categorical_tags.split(', ').filter(Boolean).map((tag, idx) => {
                        const isAllergen = tag.toLowerCase().startsWith('contains');
                        const cleanTag = tag.toLowerCase().replace('-', '_');
                        let translatedTag = tag;
                        if (isAllergen) translatedTag = t(`allergy_${cleanTag.replace('contains ', '')}_free`, tag).replace('-Free', '');
                        else translatedTag = t(`dietary_${cleanTag}`, tag);

                        return (
                          <span key={idx} className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${isAllergen ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                            {translatedTag}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 text-primary font-bold text-sm mb-5 bg-primary/5 p-3 rounded-2xl border border-primary/10">
                       <Clock size={16} /> {formatPickupWindow(selectedBag.pickup_start, selectedBag.pickup_end)}
                    </div>

                    {checkWarning(selectedBag) && (
                      <div className="bg-destructive/10 text-destructive text-sm font-bold p-3 rounded-2xl mb-5 flex items-center gap-2">
                        <AlertTriangle size={18} /> {t('warning_dietary', 'Does not meet your saved dietary preferences.')}
                      </div>
                    )}

                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-3xl font-black text-primary">{selectedBag.discounted_price} MDL</span>
                      <span className="text-muted-foreground line-through font-medium text-lg">{selectedBag.original_price} MDL</span>
                    </div>

                    <div className="bg-muted/30 border border-border rounded-2xl p-4 mb-6 flex gap-3">
                      <Info size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-foreground mb-1">{t('cancellation_policy', 'Cancellation Policy:')}</p>
                        <p className="text-xs text-muted-foreground m-0 leading-relaxed">{t('cancel_policy_short', 'Cancellations less than 1 hr before pickup are non-refundable.')}</p>
                      </div>
                    </div>

                    <button onClick={() => handleCheckout(selectedBag.id)} className="w-full py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer">
                      {t('reserve_pay', 'Reserve & Pay')}
                    </button>
                  </div>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                     <Info size={20} className="text-muted-foreground" />
                     <h3 className="text-lg font-bold m-0">{t('whats_inside', "What's inside?")}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedBag.description || t('default_bag_desc', "This is a Surprise Bag! The contents vary daily based on what's available at the end of the day. You're helping reduce food waste while enjoying quality food at a great price. The exact items are a surprise, but the value is guaranteed.")}
                  </p>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 mb-8">
                   <h3 className="text-lg font-bold mb-4 m-0">{t('pickup_location', 'Pickup Location')}</h3>
                   <p className="text-sm text-muted-foreground font-medium flex items-center gap-2 mb-4">
                     <MapPin size={16} className="text-muted-foreground shrink-0" /> {selectedBag.address_text}
                   </p>
                   
                   <div className="h-40 w-full rounded-2xl overflow-hidden border border-border mb-4 relative z-0">
                     <MapContainer center={[selectedBag.lat, selectedBag.lon]} zoom={15} zoomControl={false} scrollWheelZoom={false} dragging={false} className="h-full w-full">
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        <Marker position={[selectedBag.lat, selectedBag.lon]} icon={createBagIcon(selectedBag.image_url, checkWarning(selectedBag))} />
                     </MapContainer>
                   </div>

                   <a href={`https://www.google.com/maps/dir/?api=1&destination=$${selectedBag.lat},${selectedBag.lon}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3.5 bg-secondary text-secondary-foreground rounded-full font-bold hover:opacity-90 transition-opacity cursor-pointer">
                     <Navigation size={16} /> {t('get_directions', 'Get Directions')}
                   </a>
                </div>
              </div>
            ) : (

              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-6 bg-muted/50 p-1.5 rounded-full border border-border">
                  <div className="flex w-full">
                    <button onClick={() => { setShowOrders(false); setRefreshTrigger(prev => prev + 1); }} className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-colors cursor-pointer ${!showOrders ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-black/5'}`}>{t('nearby_food', 'Nearby Food')}</button>
                    <button onClick={() => { setShowOrders(true); fetchMyOrders(); }} className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-colors cursor-pointer ${showOrders ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-black/5'}`}>{t('my_orders', 'My Orders')}</button>
                  </div>
                </div>

                {!showOrders && (
                  <>
                    {zoomWarning && (
                      <div className="bg-amber-50 text-amber-800 p-3 rounded-2xl mb-4 border border-amber-200 text-center text-sm font-medium flex items-center justify-center gap-2">
                        <AlertTriangle size={16} /> {t('zoom_warning', 'Zoom in closer to search this area.')}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-medium text-muted-foreground m-0">{t('surplus_food_area', 'Surplus food in this area')}</p>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{filteredBags.length} {t('results', 'results')}</span>
                    </div>
                    
                    {filteredBags.length === 0 && !zoomWarning ? (
                      <div className="text-center py-10">
                        <Utensils size={48} className="text-muted-foreground/30 mb-3 mx-auto" />
                        <p className="text-muted-foreground font-medium">{t('no_bags_match', 'No surprise bags match your filters.')}</p>
                      </div>
                    ) : (
                      filteredBags.map((bag) => (
                        <BagCard 
                          key={bag.id} 
                          bag={bag} 
                          onSelect={setSelectedBag} 
                          hasWarning={checkWarning(bag)}
                        />
                      ))
                    )}
                  </>
                )}

                {showOrders && (
                  <>
                    {myOrders.length === 0 ? (
                      <div className="text-center py-10">
                        <Utensils size={48} className="text-muted-foreground/30 mb-3 mx-auto" />
                        <p className="text-muted-foreground font-medium">{t('no_reservations', 'You have no reservations yet.')}</p>
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8 font-medium">{t('no_orders_match', 'No orders match your search.')}</p>
                    ) : (
                      filteredOrders.map(order => {
                        const isMissed = order.status === 'reserved' && new Date(order.pickup_end) <= currentTime;
                        const isReservedActive = order.status === 'reserved' && !isMissed;
                      
                        return (
                          <div key={order.id} className={`bg-card rounded-3xl p-6 mb-4 shadow-sm transition-all ${isReservedActive ? 'border-2 border-primary/50' : 'border border-border opacity-75'}`}>
                            <div className="flex justify-between items-center mb-5">
                              <span className="font-bold text-muted-foreground text-sm">{t('order_hash', 'Order #')}{order.id}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white tracking-widest ${isReservedActive ? 'bg-amber-500' : order.status === 'completed' ? 'bg-primary' : 'bg-destructive/80'}`}>
                                {isMissed ? t('missed', 'MISSED') : t(order.status, order.status).toUpperCase()}
                              </span>
                            </div>
                      
                            <div className="text-center mb-8">
                              <h3 className="text-xs font-bold text-muted-foreground mb-2 tracking-[0.3em]">{t('pickup_code_label', 'PICKUP CODE')}</h3>
                              <h1 className={`text-5xl tracking-[0.2em] font-black m-0 ${isReservedActive ? 'text-primary' : 'text-muted-foreground'} ${isMissed ? 'line-through opacity-50' : ''}`}>
                                {order.pickup_code}
                              </h1>
                            </div>
                      
                            <div className="text-center mb-6">
                              <p className="font-bold text-foreground text-xl mb-1">{order.store_name}</p>
                              <p className="text-md font-bold text-primary mb-1">{order.bag_name || t('surprise_bag', "Surprise Bag")}</p>
                              {order.bag_description && (
                                <p className="text-xs text-muted-foreground mb-3 px-2 sm:px-4 line-clamp-2">
                                  {order.bag_description}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground font-medium flex justify-center items-center gap-1 mt-2">
                                <MapPin size={14} className="text-muted-foreground" /> {order.address_text}
                              </p>
                            </div>
                      
                            {!isMissed && (
                              <a href={`https://www.google.com/maps/dir/?api=1&destination=$${order.lat},${order.lon}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3.5 bg-secondary text-secondary-foreground rounded-full font-bold mb-3 hover:opacity-90 transition-opacity cursor-pointer">
                                <Navigation size={16} /> {t('get_directions', 'Get Directions')}
                              </a>
                            )}
                            
                            {isReservedActive && (
                              <>
                                <button onClick={() => handleCancel(order.id)} className="w-full py-3.5 bg-destructive/10 text-destructive rounded-full font-bold hover:bg-destructive/20 transition-colors cursor-pointer">
                                  {t('cancel_order', 'Cancel Order')}
                                </button>
                                <p className="text-[10px] text-muted-foreground text-center mt-3 font-medium">{t('cancel_policy_short', 'Cancellations less than 1 hr before pickup are non-refundable.')}</p>
                              </>
                            )}
                      
                            {order.status === 'completed' && !order.is_reviewed && (
                              <div className="mt-4 pt-4 border-t border-border text-center bg-accent/30 rounded-2xl p-4">
                                <p className="text-sm font-bold text-primary mb-2">{t('rate_bag', 'Rate your Surprise Bag!')}</p>
                                <div className="flex justify-center gap-3">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} onClick={() => handleLeaveReview(order.id, star)} className="text-muted-foreground hover:text-yellow-500 hover:scale-125 transition-transform cursor-pointer bg-transparent border-none">
                                      <Star size={28} fill="currentColor" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {order.status === 'completed' && order.is_reviewed && (
                              <div className="mt-4 pt-4 border-t border-border text-center flex items-center justify-center gap-2">
                                <Star size={16} fill="currentColor" className="text-yellow-500" />
                                <p className="text-sm font-bold text-muted-foreground m-0">{t('review_submitted', 'Review submitted')}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex-1 relative order-1 md:order-2 h-[45vh] md:h-full shrink-0 z-0">
          <MapContainer center={userLocation} zoom={13} className="h-full w-full outline-none">
            <TileLayer attribution='© <a href="https://carto.com/">CartoDB</a>' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapUpdater center={selectedBag ? [selectedBag.lat, selectedBag.lon] : userLocation} />
            <MapEventListener userLocation={userLocation} isLocationSet={isLocationSet} setZoomWarning={setZoomWarning} setNearbyBags={setNearbyBags} refreshTrigger={refreshTrigger} />

            {isLocationSet && (
              <Marker position={userLocation} icon={UserIcon}>
                <Popup>{t('you_are_here', 'You are here!')}</Popup>
              </Marker>
            )}

            <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={40} iconCreateFunction={createCustomClusterIcon}>
              {filteredBags.map((bag) => (
                <Marker 
                  key={bag.id} 
                  position={[bag.lat, bag.lon]} 
                  icon={createBagIcon(bag.image_url, checkWarning(bag))} 
                  eventHandlers={{ click: () => { setSelectedBag(bag); setShowOrders(false); } }} 
                >
                  <Popup>
                    <div className="font-sans">
                      <strong className="text-lg block mb-1">{bag.store_name}</strong>
                      <span className="text-primary font-bold">{bag.discounted_price} MDL</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      {/* --- MODALS --- */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card rounded-3xl w-full max-w-[400px] p-6 shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3 className="m-0 font-bold text-xl flex items-center gap-2">
                <MapPin size={20} className="text-primary" /> {t('set_location_title', 'Set Location')}
              </h3>
              <button onClick={() => setShowLocationModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent">
                <X size={24} />
              </button>
            </div>

            <button onClick={handleUseCurrentLocation} className="w-full py-3.5 bg-primary text-primary-foreground rounded-full font-bold cursor-pointer mb-6 flex justify-center items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm">
              <Navigation size={18} /> {t('use_current_location', 'Use Current Location')}
            </button>

            <div className="flex items-center gap-3 mb-6">
               <div className="h-px bg-border flex-1"></div>
               <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{t('or', 'OR')}</span>
               <div className="h-px bg-border flex-1"></div>
            </div>

            <div className="flex gap-2 mb-6">
              <input type="text" placeholder={t('address_example', "e.g., str. Puskin 22")} value={addressQuery} onChange={(e) => setAddressQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()} className="flex-1 p-3 rounded-2xl border border-border bg-input-background focus:outline-primary text-sm" />
              <button onClick={handleAddressSearch} disabled={isSearching} className="px-5 bg-secondary text-secondary-foreground rounded-2xl font-bold cursor-pointer hover:opacity-90">
                {isSearching ? '...' : t('find', 'Find')}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {CHISINAU_SECTORS.map((sector) => (
                <button key={sector.name} onClick={() => handleSelectArea(sector)} className="w-full p-3.5 bg-card border border-border rounded-2xl text-left cursor-pointer font-medium hover:bg-muted transition-colors flex items-center gap-3">
                  <MapPin size={16} className="text-muted-foreground" /> {sector.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card rounded-3xl w-full max-w-[500px] p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3 className="m-0 font-bold text-2xl">{t('filters', 'Filters')}</h3>
              <button onClick={() => setShowFilterModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-3">{t('search', 'Search Keywords')}</label>
                <input type="text" placeholder={t('search_filter_example', "e.g., pizza, coffee")} value={tempFilters.keywords} onChange={(e) => setTempFilters({...tempFilters, keywords: e.target.value})} className="w-full p-3.5 rounded-2xl border border-border bg-input-background focus:outline-primary text-sm" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-3">{t('category', 'Category')}</label>
                <div className="flex gap-2 flex-wrap">
                  {['Bakery', 'Meals', 'Groceries', 'Drinks'].map(cat => (
                    <button key={cat} onClick={() => toggleTempFilter('categories', cat)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border cursor-pointer ${tempFilters.categories.includes(cat) ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}>
                      {t(`dietary_${cat.toLowerCase()}`, cat)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-3">{t('dietary', 'Dietary Preferences')}</label>
                <div className="flex gap-2 flex-wrap">
                  {['Vegetarian', 'Vegan'].map(diet => (
                    <button key={diet} onClick={() => toggleTempFilter('dietary', diet)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border cursor-pointer ${tempFilters.dietary.includes(diet) ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}>
                      {t(`dietary_${diet.toLowerCase()}`, diet)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-3">{t('pickup_time_filter', 'Pickup Time')}</label>
                <div className="flex gap-2 flex-wrap">
                  {['Morning', 'Afternoon', 'Evening'].map(time => (
                    <button key={time} onClick={() => toggleTempFilter('times', time)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border cursor-pointer ${tempFilters.times.includes(time) ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}>
                      {time === 'Morning' ? t('time_morning', 'Morning (6-12)') : time === 'Afternoon' ? t('time_afternoon', 'Afternoon (12-18)') : t('time_evening', 'Evening (18-24)')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-border">
              <button onClick={clearFilters} className="flex-1 py-3.5 bg-card border border-border text-foreground rounded-full font-bold cursor-pointer hover:bg-muted">{t('clear_all', 'Clear All')}</button>
              <button onClick={applyFilters} className="flex-1 py-3.5 bg-primary text-white rounded-full font-bold cursor-pointer hover:bg-primary/90 shadow-sm">{t('apply_filters', 'Apply Filters')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}