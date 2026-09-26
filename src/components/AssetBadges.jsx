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

// Resumo de status/condição das unidades de um lote: um badge por valor
// distinto, com a contagem quando as unidades não estão todas iguais.
export function AssetBadgeSummary({ kind, counts }) {
  const labels = kind === 'status' ? STATUS_LABELS : CONDITION_LABELS;
  const styles = kind === 'status' ? STATUS_STYLES : CONDITION_STYLES;
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([value, count]) => (
        <span key={value} className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', styles[value] || styles[kind === 'status' ? 'active' : 'good'])}>
          {labels[value] || value}{entries.length > 1 ? ` (${count})` : ''}
        </span>
      ))}
    </div>
  );
}

export function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] || '';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}
