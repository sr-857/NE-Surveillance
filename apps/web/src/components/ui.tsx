import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<string, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    secondary:
      'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text))] border border-[rgb(var(--border))] hover:bg-brand-50 dark:hover:bg-brand-900',
    ghost: 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

const SEVERITY_STYLES: Record<string, string> = {
  ADVISORY: 'bg-severity-advisory/15 text-severity-advisory border-severity-advisory/40',
  WARNING: 'bg-severity-warning/15 text-severity-warning border-severity-warning/40',
  SEVERE: 'bg-severity-severe/15 text-severity-severe border-severity-severe/40',
};

export function SeverityBadge({ severity }: { severity: 'ADVISORY' | 'WARNING' | 'SEVERE' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[severity]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {severity}
    </span>
  );
}
