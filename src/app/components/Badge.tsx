import { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        {
          'bg-secondary text-secondary-foreground': variant === 'default',
          'bg-primary/20 text-primary border border-primary/30': variant === 'primary',
          'bg-success/20 text-success border border-success/30': variant === 'success',
          'bg-warning/20 text-warning border border-warning/30': variant === 'warning',
          'bg-destructive/20 text-destructive border border-destructive/30': variant === 'danger',
          'bg-muted/20 text-muted-foreground border border-border': variant === 'muted',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
