import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  ...props
}) => {
  const base = [
    'inline-flex items-center justify-center rounded-lg font-medium',
    'transition-all duration-150 ease-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--bg-base)]',
    'active:scale-95 active:brightness-90',
    'select-none cursor-pointer',
  ].join(' ');

  const variants: Record<string, string> = {
    primary:   'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white focus:ring-[var(--accent)] shadow-sm',
    secondary: 'bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] focus:ring-[var(--accent)]',
    danger:    'bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-900/60 focus:ring-red-700',
    success:   'bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-900/50 focus:ring-emerald-700',
    ghost:     'bg-transparent hover:bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:ring-[var(--accent)]',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className} disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>Processing...</span>
        </>
      ) : children}
    </button>
  );
};
