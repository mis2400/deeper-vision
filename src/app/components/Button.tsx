import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        {
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20': variant === 'primary',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border': variant === 'secondary',
          'bg-transparent hover:bg-secondary/50 text-foreground': variant === 'ghost',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20': variant === 'danger',
          'bg-success text-success-foreground hover:bg-success/90 shadow-lg shadow-success/20': variant === 'success',
        },
        {
          'h-8 px-3 text-xs': size === 'sm',
          'h-10 px-4 text-sm': size === 'md',
          'h-12 px-6 text-base': size === 'lg',
          'h-10 w-10 p-0': size === 'icon',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
