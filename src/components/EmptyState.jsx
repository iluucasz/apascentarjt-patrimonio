import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="text-[15px] text-muted-foreground mt-1.5 max-w-md">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
