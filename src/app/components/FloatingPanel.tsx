import { ReactNode, useState } from 'react';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface FloatingPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
  closable?: boolean;
  onClose?: () => void;
  headerRight?: ReactNode;
}

export function FloatingPanel({
  title,
  children,
  className,
  defaultCollapsed = false,
  closable = false,
  onClose,
  headerRight,
}: FloatingPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        'bg-[var(--panel-background)] backdrop-blur-xl border border-[var(--panel-border)] rounded-lg shadow-2xl',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <div className="flex items-center gap-1">
          {headerRight}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-secondary/50 rounded transition-colors"
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
          {closable && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-destructive/20 text-destructive rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}
