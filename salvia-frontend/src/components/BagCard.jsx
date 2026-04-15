import React from 'react';
import { useTranslation } from 'react-i18next'; // 👈 IMPORT TRANSLATION HOOK

export default function BagCard({ bag, onSelect, hasWarning }) {
  const { t } = useTranslation(); // 👈 INITIALIZE HOOK

  // 👈 ADD TRANSLATOR HELPER
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

  const formatPickupWindow = (startStr, endStr) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const now = new Date();
    
    const timeRange = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    let dayLabel = "";
    if (start.toDateString() === now.toDateString()) {
      dayLabel = t('today', "Today"); // 👈 TRANSLATED
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      if (start.toDateString() === tomorrow.toDateString()) {
        dayLabel = t('tomorrow', "Tomorrow"); // 👈 TRANSLATED
      } else {
        dayLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }
    return `${dayLabel}, ${timeRange}`;
  };

  return (
    <div 
      className={`bg-card rounded-2xl p-4 mb-5 flex flex-col sm:flex-row gap-4 sm:gap-5 shadow-sm hover:shadow-md transition-all cursor-pointer group ${hasWarning ? 'border-2 border-destructive' : 'border border-border'}`}
      onClick={() => onSelect(bag)}
    >
      <div className="w-full sm:w-32 h-48 sm:h-32 shrink-0 bg-muted rounded-xl flex items-center justify-center overflow-hidden border border-border/50 relative">
        {bag.image_url ? (
          <img src={bag.image_url} alt={bag.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <span className="text-5xl">🌿</span>
        )}
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1 gap-2">
          <div>
            <h3 className="font-bold text-foreground text-lg m-0 leading-tight">{bag.store_name}</h3>
            {bag.name && <p className="text-foreground text-sm font-medium m-0 mt-0.5">{bag.name}</p>}
            
            {/* Tag Pills */}
            <div className="flex items-center flex-wrap gap-1.5 mt-2.5 mb-1.5">
               {bag.categorical_tags && bag.categorical_tags.split(', ').filter(Boolean).map((tag, idx) => {
                 const isAllergen = tag.toLowerCase().startsWith('contains');
                 
                 // 👈 TRANSLATED THE TAGS!
                 const cleanTag = tag.toLowerCase().replace('-', '_');
                 let translatedTag = tag;
                 if (isAllergen) translatedTag = t(`allergy_${cleanTag.replace('contains ', '')}_free`, tag).replace('-Free', '');
                 else translatedTag = t(`dietary_${cleanTag}`, tag);

                 return (
                   <span key={idx} className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${isAllergen ? 'bg-[#ff9800]/10 text-[#ff9800] border-[#ff9800]/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                     {translatedTag}
                   </span>
                 );
               })}
            </div>

            <div className="flex items-center flex-wrap gap-2">
               <span className="text-xs font-bold text-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                  ⭐ {bag.avg_rating > 0 ? bag.avg_rating.toFixed(1) : t('new', 'New')}
               </span>
               {bag.distance_km !== undefined && (
                 <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                   📍 {bag.distance_km} km
                 </span>
               )}
            </div>
          </div>
          <div className="bg-[#E8F0E4] text-primary px-3 py-1.5 rounded-full text-xs font-black shrink-0 shadow-sm border border-primary/10">
            {bag.quantity_available} {t('left', 'left')} {/* 👈 TRANSLATED */}
          </div>
        </div>

        {hasWarning && (
           <div className="bg-destructive/10 text-destructive text-xs font-bold px-3 py-2 rounded-lg mt-2 flex items-center gap-2">
              <span>⚠️</span> {t('warning_dietary', 'Does not meet your dietary preferences')} {/* 👈 TRANSLATED */}
           </div>
        )}

        <div className="space-y-1.5 mb-4 mt-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <svg className="w-4 h-4 shrink-0 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {formatPickupWindow(bag.pickup_start, bag.pickup_end)}
          </div>
          <div className="flex items-start gap-2 text-muted-foreground text-sm">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="line-clamp-1">{bag.address_text}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-end mt-auto gap-2">
          <span className="text-muted-foreground line-through text-sm font-medium">{bag.original_price} MDL</span>
          <span className="text-primary font-black text-2xl">{bag.discounted_price} MDL</span>
        </div>
      </div>
    </div>
  );
}