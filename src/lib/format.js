// Formatação pt-BR
export function formatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

// Datas sem hora (colunas date, ex.: "2026-10-15"): formata direto do texto.
// new Date("2026-10-15") é meia-noite UTC, que no Brasil vira o dia anterior.
export function formatDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
}

// Hoje no fuso local, no formato do input date (aaaa-mm-dd).
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Paleta semântica única do app: fundo suave + texto escuro (contraste AA) + ponto.
// Todo status/condição usa um destes tons, para as cores combinarem entre telas.
export const TONES = {
  green: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-700/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/25',
  teal: 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-700/20 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-400/25',
  blue: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-700/20 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/25',
  amber: 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-700/25 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/25',
  orange: 'bg-orange-50 text-orange-900 ring-1 ring-inset ring-orange-700/25 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-400/25',
  red: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-700/20 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-400/25',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/30',
  dark: 'bg-zinc-200 text-zinc-800 ring-1 ring-inset ring-zinc-600/25 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-500/30',
};

// Cor sólida de cada tom (pontos, barras, números de destaque).
export const TONE_SOLID = {
  green: 'bg-emerald-600',
  teal: 'bg-teal-600',
  blue: 'bg-sky-600',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-600',
  slate: 'bg-slate-400',
  dark: 'bg-zinc-600',
};

// Texto colorido legível sobre fundo claro (números de destaque).
export const TONE_TEXT = {
  green: 'text-emerald-700',
  teal: 'text-teal-700',
  blue: 'text-sky-700',
  amber: 'text-amber-700',
  orange: 'text-orange-700',
  red: 'text-red-700',
  slate: 'text-slate-600',
  dark: 'text-zinc-700',
};

const toneMap = (m) => Object.fromEntries(Object.entries(m).map(([k, t]) => [k, TONES[t]]));

export const STATUS_LABELS = {
  active: 'Ativo',
  maintenance: 'Manutenção',
  loaned: 'Emprestado',
  storage: 'Em estoque',
  disposed: 'Baixado',
  lost: 'Perdido'
};

export const STATUS_TONES = { active: 'green', maintenance: 'amber', loaned: 'blue', storage: 'slate', disposed: 'dark', lost: 'red' };
export const STATUS_STYLES = toneMap(STATUS_TONES);

export const CONDITION_LABELS = {
  new: 'Novo',
  excellent: 'Excelente',
  good: 'Bom',
  fair: 'Regular',
  poor: 'Ruim',
  damaged: 'Danificado'
};

export const CONDITION_TONES = { new: 'teal', excellent: 'green', good: 'blue', fair: 'amber', poor: 'orange', damaged: 'red' };
export const CONDITION_STYLES = toneMap(CONDITION_TONES);

export const MOVEMENT_LABELS = {
  transfer: 'Transferência',
  loan: 'Empréstimo',
  return: 'Retorno',
  allocation: 'Alocação'
};

export const MAINTENANCE_LABELS = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada'
};

export const MAINTENANCE_TONES = { open: 'amber', in_progress: 'blue', completed: 'green', cancelled: 'slate' };
export const MAINTENANCE_STYLES = toneMap(MAINTENANCE_TONES);

export const INVENTORY_STATUS_LABELS = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado'
};

export const INV_ITEM_LABELS = {
  pending: 'Pendente',
  found: 'Encontrado',
  misplaced: 'Unidade incorreta',
  not_found: 'Não encontrado'
};

export const INV_ITEM_TONES = { pending: 'slate', found: 'green', misplaced: 'amber', not_found: 'red' };
export const INV_ITEM_STYLES = toneMap(INV_ITEM_TONES);

export const INVENTORY_STATUS_TONES = { draft: 'slate', in_progress: 'blue', completed: 'green', cancelled: 'red' };
export const INVENTORY_STATUS_STYLES = toneMap(INVENTORY_STATUS_TONES);

export const DISPOSED_REASON_LABELS = {
  descarte: 'Descarte',
  venda: 'Venda',
  doacao: 'Doação',
  perda: 'Perda',
  roubo: 'Roubo',
  outro: 'Outro'
};

export const DOC_TYPE_LABELS = {
  nota_fiscal: 'Nota fiscal',
  manual: 'Manual',
  garantia: 'Garantia',
  orcamento: 'Orçamento',
  documento: 'Documento',
  outros: 'Outros'
};