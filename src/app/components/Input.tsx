import { InputHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
      )}
      <input
        className={cn(
          'w-full h-10 px-3 rounded-lg',
          'bg-input-background border border-input-border',
          'text-foreground placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'transition-all duration-200',
          icon && 'pl-10',
          className
        )}
        {...props}
      />
    </div>
  );
}
