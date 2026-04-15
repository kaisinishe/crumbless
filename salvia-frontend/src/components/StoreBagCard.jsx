import React from 'react';
import { useTranslation } from 'react-i18next'; // 👈 IMPORT TRANSLATION HOOK

export default function StoreBagCard({ bag, type, onUpdateQuantity, onEdit, onDelete, onRelist, historyItems }) {
  const { t } = useTranslation(); // 👈 INITIALIZE HOOK

  // 👈 ADD TRANSLATOR HELPER (Case-insensitive)
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

  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateShort = (dateString) => new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const isSoldOut = bag.quantity_available === 0;

  let badgeClass = '';
  let badgeText = '';
  
  // 👈 ADDED TRANSLATION TO BADGES
  if (type === 'active') {
    badgeClass = 'bg-[#E8F0E4] text-primary';
    badgeText = t('status_active', 'Active');
  } else if (isSoldOut) {
    badgeClass = 'bg-primary/10 text-primary';
    badgeText = t('status_sold_out', 'Sold Out');
  } else {
    badgeClass = 'bg-destructive/10 text-destructive';
    badgeText = t('status_expired', 'Expired');
  }

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-5 mb-4 sm:mb-5 border border-border flex flex-col shadow-sm hover:shadow-md transition-shadow">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 w-full">
        
        <div className="w-full sm:w-24 h-40 sm:h-24 shrink-0 bg-muted rounded-xl border border-border flex items-center justify-center overflow-hidden">
          {bag.image_url ? (
            <img src={bag.image_url} alt={bag.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">🌿</span>
          )}
        </div>

        <div className="flex-1 w-full">
          <div className="flex justify-between items-start mb-1.5 gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-foreground m-0 tracking-tight leading-tight">{bag.name || t('new_bag', "Surprise Bag")}</h3>
            
            {!historyItems && (
              <span className={`text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${badgeClass}`}>
                {badgeText}
              </span>
            )}
          </div>
          
          {/* 👈 FIXED: Translated the category & dietary tags here */}
          <p className="text-muted-foreground text-xs sm:text-sm font-medium m-0 mb-3">{translateTags(bag.categorical_tags)}</p>
          
          {!historyItems ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-xs sm:text-sm text-foreground">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">📅 {formatDateShort(bag.pickup_start)}</div>
                <div className="flex items-center gap-1.5 font-bold">⏰ {formatTime(bag.pickup_start)} - {formatTime(bag.pickup_end)}</div>
              </div>
              
              <div className="flex items-center justify-between w-full sm:w-auto mt-1 sm:mt-0 ml-auto gap-4">
                <div className="text-primary font-black text-sm sm:text-base">{bag.discounted_price} MDL</div>
              </div>
            </div>
          ) : (
             <div className="text-primary font-black text-sm sm:text-base">{bag.discounted_price} MDL</div>
          )}
        </div>

        {/* ACTIONS FOR SINGLE BAG */}
        {!historyItems && (
          <div className="flex flex-row sm:flex-col items-center justify-between w-full sm:w-auto gap-3 sm:ml-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-border">
            {type === 'active' ? (
              <>
                <div className="flex items-center gap-1 sm:gap-2 border border-border rounded-xl bg-card p-1 shadow-inner w-full sm:w-auto justify-center">
                  <button onClick={() => onUpdateQuantity(bag.id, -1)} className="p-2 sm:p-2 text-xl font-bold bg-muted hover:bg-border/50 rounded-lg cursor-pointer transition-colors w-10 h-10 flex items-center justify-center">-</button>
                  <span className="text-xl sm:text-2xl font-black w-8 sm:w-10 text-center text-foreground">{bag.quantity_available}</span>
                  <button onClick={() => onUpdateQuantity(bag.id, 1)} className="p-2 sm:p-2 text-xl font-bold bg-muted hover:bg-border/50 rounded-lg cursor-pointer transition-colors w-10 h-10 flex items-center justify-center">+</button>
                </div>
                <button onClick={() => onEdit(bag)} className="w-full sm:w-full px-4 py-2.5 bg-muted text-foreground rounded-xl font-bold text-sm hover:bg-border/50 cursor-pointer transition-colors text-center">{t('edit_btn', 'Edit')}</button>
              </>
            ) : (
              <>
                {isSoldOut ? (
                  <div className="flex flex-col items-center justify-center w-full sm:w-auto bg-primary/5 rounded-xl py-2 px-4 border border-primary/20">
                    <div className="text-2xl sm:text-4xl font-black text-primary/60 leading-none">🎉</div>
                    <p className='text-[10px] font-bold text-primary/80 m-0 uppercase tracking-widest mt-1'>{t('status_sold_out', 'Sold Out')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full sm:w-auto bg-destructive/5 rounded-xl py-2 px-4 border border-destructive/10">
                    <div className="text-2xl sm:text-4xl font-black text-destructive/40 leading-none">{bag.quantity_available}</div>
                    <p className='text-[10px] font-bold text-destructive/60 m-0 uppercase tracking-widest mt-1'>{t('unpicked', 'Unpicked')}</p>
                  </div>
                )}
                
                <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                    <button onClick={() => onRelist(bag)} className="flex-1 sm:w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 cursor-pointer shadow-sm">{t('relist_btn', 'Relist')}</button>
                    <button onClick={() => onDelete(bag.id)} className="flex-1 sm:w-full px-4 py-2.5 bg-destructive/10 text-destructive rounded-xl font-bold text-sm hover:bg-destructive/20 cursor-pointer">{t('delete', 'Delete')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* INDIVIDUAL EVENTS HISTORY LIST */}
      {historyItems && (
        <div className="w-full mt-5 border-t border-border pt-4 flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest m-0 mb-3">{t('history', 'History')} ({historyItems.length} {t('records', 'records')})</p>
            <div className="flex flex-col gap-2">
              
              {historyItems.length === 0 ? (
                <div className="text-sm text-muted-foreground px-2 py-1 italic">{t('waiting_pickups', 'Waiting for customer pickups...')}</div>
              ) : (
                historyItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-muted/30 p-3 sm:px-4 rounded-lg border border-border/50 gap-3">
                    
                    <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-foreground">
                      <div className="font-bold text-muted-foreground hidden sm:block">📅 {formatDateShort(item.date)}</div>
                      
                      {item.type === 'sale' ? (
                         <div className="font-medium">
                           <span className="text-muted-foreground mr-1">⏰ {t('picked_up_at', 'Picked up at')}</span> 
                           {formatTime(item.date)}
                         </div>
                      ) : (
                         <div className="font-medium text-muted-foreground">
                           ⏰ {t('expired_at', 'Expired at')} {formatTime(item.date)}
                         </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {item.type === 'sale' && (
                        <span className="bg-primary/10 text-primary px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                          🎉 {t('picked_up_badge', 'Picked Up')}
                        </span>
                      )}
                      {item.type === 'expired' && (
                        <span className="bg-destructive/10 text-destructive px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                          ⚠️ {item.quantity} {t('unpicked', 'Unpicked')}
                        </span>
                      )}
                    </div>
                    
                  </div>
                ))
              )}

            </div>
          </div>
          
          <div className="pt-2 flex gap-3">
            <button onClick={() => onRelist(bag)} className="flex-1 px-4 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm cursor-pointer">
               + {t('relist_bag', 'Relist this Bag')}
            </button>
            <button onClick={() => onDelete(bag.id)} className="px-6 py-3.5 bg-destructive/10 text-destructive rounded-xl font-bold text-sm hover:bg-destructive/20 transition-colors shadow-sm cursor-pointer">
               {t('delete', 'Delete')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}