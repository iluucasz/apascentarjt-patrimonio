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

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export const STATUS_LABELS = {
  active: 'Ativo',
  maintenance: 'Manutenção',
  loaned: 'Emprestado',
  storage: 'Em estoque',
  disposed: 'Baixado',
  lost: 'Perdido'
};

export const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  loaned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  storage: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  disposed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};

export const CONDITION_LABELS = {
  new: 'Novo',
  excellent: 'Excelente',
  good: 'Bom',
  fair: 'Regular',
  poor: 'Ruim',
  damaged: 'Danificado'
};

export const CONDITION_STYLES = {
  new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  excellent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  fair: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  poor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  damaged: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
};

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

export const MAINTENANCE_STYLES = {
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
};

export const INVENTORY_STATUS_LABELS = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado'
};

export const INV_ITEM_LABELS = {
  pending: 'Pendente',
  found: 'Encontrado',
  misplaced: 'Local incorreto',
  not_found: 'Não encontrado'
};

export const INV_ITEM_STYLES = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  found: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  misplaced: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  not_found: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
};

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