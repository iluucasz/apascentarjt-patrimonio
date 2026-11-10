import React from 'react';
import { TONES, TONE_SOLID } from '@/lib/format';
import { cn } from '@/lib/utils';

// Selo de status: ponto colorido + texto. O ponto garante que a informação não
// dependa só da cor do fundo (acessibilidade) e dá o ritmo visual das listas.
export default function StatusPill({ tone = 'slate', children, dot = true, className = '' }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone] || TONES.slate, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_SOLID[tone] || TONE_SOLID.slate)} aria-hidden="true" />}
      {children}
    </span>
  );
}
