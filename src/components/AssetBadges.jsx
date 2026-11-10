import React from 'react';
import { STATUS_LABELS, STATUS_TONES, CONDITION_LABELS, CONDITION_TONES } from '@/lib/format';
import StatusPill from '@/components/StatusPill';

export function AssetStatusBadge({ status, className = '' }) {
  return <StatusPill tone={STATUS_TONES[status] || 'slate'} className={className}>{STATUS_LABELS[status] || status}</StatusPill>;
}

export function AssetConditionBadge({ condition, className = '' }) {
  return <StatusPill tone={CONDITION_TONES[condition] || 'slate'} className={className}>{CONDITION_LABELS[condition] || condition}</StatusPill>;
}

// Resumo de status/condição das unidades de um lote: um selo por valor
// distinto, com a contagem quando as unidades não estão todas iguais.
export function AssetBadgeSummary({ kind, counts }) {
  const labels = kind === 'status' ? STATUS_LABELS : CONDITION_LABELS;
  const tones = kind === 'status' ? STATUS_TONES : CONDITION_TONES;
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([value, count]) => (
        <StatusPill key={value} tone={tones[value] || 'slate'}>
          {labels[value] || value}{entries.length > 1 ? ` (${count})` : ''}
        </StatusPill>
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
