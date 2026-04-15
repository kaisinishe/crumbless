import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-2 bg-muted/50 p-1.5 rounded-xl border border-border w-fit">
      {['en', 'ro', 'ru'].map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            i18n.resolvedLanguage === lng || i18n.language === lng
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:bg-muted-foreground/10'
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}