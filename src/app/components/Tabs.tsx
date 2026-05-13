import { ReactNode, useState } from 'react';
import { cn } from '../lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex gap-1 border-b border-border/50 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>
      <div>
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
