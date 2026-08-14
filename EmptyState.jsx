import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-4', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}