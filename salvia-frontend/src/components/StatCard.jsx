import React from 'react';

export default function StatCard({ title, value, label, icon }) {
  return (
    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex justify-between items-start">
      <div>
        <p className="text-muted-foreground font-bold text-sm uppercase tracking-widest mb-1.5">{title}</p>
        <p className="text-3xl sm:text-4xl font-black text-foreground m-0">{value}</p>
        <p className="text-muted-foreground text-sm font-medium mt-1">{label}</p>
      </div>
      <div className="bg-[#E8F0E4] w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl text-primary shadow-inner shrink-0">
        {icon}
      </div>
    </div>
  );
}