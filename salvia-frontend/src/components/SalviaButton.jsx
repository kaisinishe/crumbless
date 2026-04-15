export default function SalviaButton({ children, onClick, variant = 'primary', className = '' }) {
  const baseStyles = "w-full py-3 px-4 rounded-xl font-bold transition-all duration-200 flex justify-center items-center gap-2";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    secondary: "bg-muted text-foreground border border-border hover:bg-border/50",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "bg-transparent border-2 border-primary text-primary hover:bg-primary/5"
  };

  return (
    <button 
      onClick={onClick} 
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}