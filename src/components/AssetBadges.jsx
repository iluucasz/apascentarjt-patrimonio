import React from 'react';
import { STATUS_LABELS, STATUS_STYLES, CONDITION_LABELS, CONDITION_STYLES } from '@/lib/format';
import { cn } from '@/lib/utils';

export function AssetStatusBadge({ status, className = '' }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[status] || STATUS_STYLES.active, className)}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function AssetConditionBadge({ condition, className = '' }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', CONDITION_STYLES[condition] || CONDITION_STYLES.good, className)}>
      {CONDITION_LABELS[condition] || condition}
    </span>
  );
}