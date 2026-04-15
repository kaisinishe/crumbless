import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; // 👈 IMPORT TRANSLATION HOOK

export default function SalesChart({ data }) {
  const { t } = useTranslation(); // 👈 INITIALIZE HOOK
  const [timeframe, setTimeframe] = useState('Week');
  
  const activeData = data[timeframe] || [];
  const maxSales = Math.max(...activeData.map(d => d.sales), 1);

  // 👈 FIXED: We keep the internal key in English, but translate the visual label
  const timeframes = [
    { key: 'Week', label: t('tf_week', 'Week') },
    { key: 'Month', label: t('tf_month', 'Month') },
    { key: 'Year', label: t('tf_year', 'Year') },
    { key: 'All', label: t('tf_all', 'All') }
  ];

  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground m-0 tracking-tight">
          {t('sales_overview', 'Sales Overview')} {/* 👈 TRANSLATED TITLE */}
        </h3>
        
        <div className="flex bg-muted/50 p-1.5 rounded-xl border border-border shrink-0">
          {timeframes.map(tf => (
            <button 
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                timeframe === tf.key 
                  ? 'bg-card text-primary shadow-sm border border-border/50' 
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex items-end justify-between h-48 sm:h-56 border-b border-border/50 min-w-max gap-2 px-1 pt-10">
          {activeData.map((d, i) => (
            <div key={i} className="flex flex-col items-center justify-end gap-2 group w-10 sm:w-14 h-full">
              <div className="w-full flex-1 flex items-end">
                <div 
                  className="w-full bg-[#9DC183] rounded-t-md sm:rounded-t-xl group-hover:bg-primary transition-colors cursor-pointer relative min-h-[4px]"
                  style={{ height: `${(d.sales / maxSales) * 100}%` }}
                >
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap shadow-md">
                    {d.sales}
                  </span>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-2 uppercase tracking-wider whitespace-nowrap truncate w-full text-center shrink-0">
                {/* 👈 FIXED: Dynamically looks up "chart_lbl_mon", etc. Falls back to original text for numbers. */}
                {t(`chart_lbl_${d.label.toLowerCase()}`, d.label)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}