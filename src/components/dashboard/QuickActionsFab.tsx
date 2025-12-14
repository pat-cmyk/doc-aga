import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, Milk, Heart, Activity } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { hapticImpact } from '@/lib/haptics';

interface QuickActionsFabProps {
  onRecordMilk?: () => void;
  onRecordHealth?: () => void;
  onLogActivity?: () => void;
}

const actions = [
  { id: 'milk', label: 'Record Milk', icon: Milk, color: 'text-blue-500' },
  { id: 'health', label: 'Record Health', icon: Heart, color: 'text-red-500' },
  { id: 'activity', label: 'Log Activity', icon: Activity, color: 'text-green-500' },
];

export function QuickActionsFab({ 
  onRecordMilk, 
  onRecordHealth, 
  onLogActivity 
}: QuickActionsFabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleToggle = () => {
    hapticImpact('light');
    setIsExpanded(!isExpanded);
  };

  const handleAction = (actionId: string) => {
    hapticImpact('medium');
    setIsExpanded(false);
    
    switch (actionId) {
      case 'milk':
        onRecordMilk?.();
        break;
      case 'health':
        onRecordHealth?.();
        break;
      case 'activity':
        onLogActivity?.();
        break;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`fixed z-40 ${
        isMobile ? 'bottom-24 left-4' : 'bottom-6 left-6'
      }`}
    >
      {/* Action buttons - animate in when expanded */}
      <div 
        className={`flex flex-col-reverse gap-2 mb-2 transition-all duration-200 ${
          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {actions.map((action, index) => (
          <Button
            key={action.id}
            onClick={() => handleAction(action.id)}
            variant="secondary"
            className={`
              h-12 gap-2 shadow-lg justify-start pl-3 pr-4
              ${isExpanded ? 'animate-slide-up' : ''}
            `}
            style={{
              animationDelay: isExpanded ? `${index * 50}ms` : '0ms',
              animationFillMode: 'backwards'
            }}
          >
            <action.icon className={`h-4 w-4 ${action.color}`} />
            <span className="text-sm font-medium">{action.label}</span>
          </Button>
        ))}
      </div>

      {/* Main FAB button */}
      <Button
        onClick={handleToggle}
        size="lg"
        className={`
          h-14 w-14 rounded-full shadow-lg
          bg-gradient-to-br from-primary to-primary/80
          hover:from-primary/90 hover:to-primary/70
          transition-transform duration-200
          ${isExpanded ? 'rotate-45' : 'rotate-0'}
        `}
        aria-label={isExpanded ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
