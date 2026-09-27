import React from 'react';
import { Church } from 'lucide-react';
import { cn } from '@/lib/utils';

// Cor do ícone padrão (igreja) legível sobre a cor de fundo escolhida.
function readableOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111827' : '#ffffff';
}

// Quadrado com o logo da igreja/filial. Sem cor definida, usa a cor primária
// do tema (o visual de antes).
export default function BrandMark({ logoUrl, bgColor, className = 'w-9 h-9', iconClassName = 'w-5 h-5' }) {
  return (
    <div
      className={cn('rounded-lg flex items-center justify-center shrink-0 overflow-hidden', !bgColor && 'bg-primary text-primary-foreground', className)}
      style={bgColor ? { backgroundColor: bgColor, color: readableOn(bgColor) } : undefined}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <Church className={iconClassName} />}
    </div>
  );
}
