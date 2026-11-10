import { db } from '@/lib/db';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusPill from '@/components/StatusPill';
import { ScanLine, Keyboard, XCircle, CheckCircle2, AlertTriangle, Loader2, Play, CheckCheck, Download, RotateCcw, FileText, Share2, Search, Undo2 } from 'lucide-react';
import { formatDateTime, formatDay, INV_ITEM_LABELS, INV_ITEM_TONES, INVENTORY_STATUS_LABELS, INVENTORY_STATUS_TONES, TONE_SOLID, TONES } from '@/lib/format';
import { cn } from '@/lib/utils';

// Resultado de cada leitura do scanner: ícone, cor e título.
const FEEDBACK = {
  found: { tone: 'green', icon: CheckCircle2, title: 'Patrimônio encontrado' },
  misplaced: { tone: 'amber', icon: AlertTriangle, title: 'Unidade incorreta' },
  already: { tone: 'blue', icon: CheckCircle2, title: 'Esse patrimônio já foi conferido' },
  error: { tone: 'red', icon: XCircle, title: 'Não foi possível conferir agora' },
  not_found: { tone: 'red', icon: XCircle, title: 'Patrimônio não encontrado' },
};

export default function InventarioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const [inventory, setInventory] = useState(null);
  const [items, setItems] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  // 'start' | 'finish' | 'reopen' enquanto a ação roda no servidor
  const [working, setWorking] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'finish' | 'reopen'
  const [pdfWorking, setPdfWorking] = useState(null); // 'share' | 'save' enquanto o PDF é gerado
  // Conferência manual: itens marcados na lista, filtro e busca da lista.
  const [selected, setSelected] = useState(() => new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [marking, setMarking] = useState(false);
  const html5QrRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);
  // A câmera fica aberta lendo um código atrás do outro; o callback dela é
  // criado uma vez só, então lê os itens por ref (sempre a lista atual).
  const itemsRef = useRef([]);
  const busyRef = useRef(false);
  itemsRef.current = items;

  const load = async () => {
    try {
      const list = await db.entities.Inventory.filter({ id });
      if (list.length === 0) { toast.error('Inventário não encontrado'); navigate('/inventarios'); return; }
      setInventory(list[0]);
      setItems(await db.entities.InventoryItem.filter({ inventory_id: id }, 'asset_number'));
    } catch (e) {}
  };
  useEffect(() => { load(); }, [id]);

  const stats = () => {
    const expected = items.length;
    const found = items.filter((i) => i.status === 'found').length;
    const misplaced = items.filter((i) => i.status === 'misplaced').length;
    const pending = items.filter((i) => i.status === 'pending').length;
    const notFound = items.filter((i) => i.status === 'not_found').length;
    return { expected, found, misplaced, pending, notFound };
  };

  // O backend tira a "foto" dos patrimônios esperados da unidade (e das salas
  // dela, sem as filiais, que têm inventário próprio) numa única operação.
  const startInventory = async () => {
    setWorking('start');
    try {
      const res = await db.functions.invoke('startInventory', { inventory_id: id });
      await load();
      toast.success(`Inventário iniciado com ${res.data.count} patrimônio${res.data.count === 1 ? '' : 's'}`);
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao iniciar'); }
    finally { setWorking(null); }
  };

  const extractCode = (text) => {
    if (!text) return '';
    const t = text.trim();
    const match = t.match(/\/p\/([A-Z]+-\d+)/i);
    if (match) return match[1].toUpperCase();
    if (/^[A-Z]+-\d+$/i.test(t)) return t.toUpperCase();
    return t;
  };

  const handleScan = useCallback(async (rawCode) => {
    const code = extractCode(rawCode);
    if (!code) return;
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastTimeRef.current < 3000) return;
    if (busyRef.current) return;
    busyRef.current = true;
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    setLoading(true);
    try {
      const assetList = await db.entities.Asset.filter({ asset_number: code });
      if (assetList.length === 0) {
        setFeedback({ type: 'not_found', code });
        try { navigator.vibrate && navigator.vibrate([100,50,100]); } catch(e){}
        return;
      }
      const asset = assetList[0];
      const item = itemsRef.current.find((i) => i.asset_id === asset.id);
      if (!item) {
        // asset exists but not expected in this inventory
        setFeedback({ type: 'misplaced', code, asset, message: 'Este patrimônio não é desta unidade' });
        try { navigator.vibrate && navigator.vibrate([100,50,100]); } catch(e){}
        return;
      }
      if (item.status === 'found' || item.status === 'misplaced') {
        setFeedback({ type: 'already', code, asset });
        return;
      }
      // mark found
      const newStatus = asset.location_id === item.expected_location_id ? 'found' : 'misplaced';
      const updated = await db.entities.InventoryItem.update(item.id, {
        status: newStatus,
        scanned_at: new Date().toISOString(),
        scanned_by_name: user?.full_name || user?.email,
        found_location_id: asset.location_id || '',
        found_location_name: asset.location_name || ''
      });
      setFeedback({ type: newStatus === 'found' ? 'found' : 'misplaced', code, asset, item });
      try { navigator.vibrate && navigator.vibrate(100); } catch(e){}
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setFeedback({ type: 'error', code });
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [user]);

  const startScan = async () => {
    if (html5QrRef.current) return; // câmera já aberta
    setFeedback(null);
    setScanning(true);
    setManual(false);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const qr = new Html5Qrcode('inv-qr-reader');
        html5QrRef.current = qr;
        await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 150 } }, (decoded) => handleScan(decoded), () => {});
      } catch (e) {
        html5QrRef.current = null;
        toast.error('Não foi possível abrir a câmera. Verifique a permissão ou use "Digitar código".');
        setScanning(false);
      }
    }, 100);
  };

  const stopScan = async () => {
    try { if (html5QrRef.current) { await html5QrRef.current.stop(); await html5QrRef.current.clear(); html5QrRef.current = null; } } catch(e){}
    setScanning(false);
  };
  useEffect(() => () => { stopScan(); }, []);

  const handleManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScan(manualCode);
    setManualCode('');
  };

  const finishInventory = async () => {
    setConfirm(null);
    setWorking('finish');
    try {
      await stopScan();
      setManual(false);
      setFeedback(null);
      await db.functions.invoke('finishInventory', { inventory_id: id });
      await load();
      toast.success('Inventário finalizado');
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao finalizar'); }
    finally { setWorking(null); }
  };

  // Concluído -> em andamento de novo: os "não encontrados" voltam a pendentes.
  const reopenInventory = async () => {
    setConfirm(null);
    setWorking('reopen');
    try {
      const res = await db.functions.invoke('reopenInventory', { inventory_id: id });
      await load();
      toast.success(`Inventário reaberto · ${res.data.reopened} ite${res.data.reopened === 1 ? 'm voltou' : 'ns voltaram'} para pendente`);
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao reabrir'); }
    finally { setWorking(null); }
  };

  // PDF do relatório: "Enviar" abre o compartilhar do celular (WhatsApp etc.);
  // "Baixar" salva o arquivo. O menu de compartilhar só existe em alguns aparelhos.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
  const sharePdf = async () => {
    setPdfWorking('share');
    try {
      const { shareInventoryPdf } = await import('@/lib/inventoryPdf');
      const result = await shareInventoryPdf(inventory, items);
      if (result === 'downloaded') toast.success('PDF salvo no aparelho');
    } catch (e) { toast.error('Não foi possível gerar o PDF'); }
    finally { setPdfWorking(null); }
  };
  const savePdf = async () => {
    setPdfWorking('save');
    try {
      const { downloadInventoryPdf } = await import('@/lib/inventoryPdf');
      await downloadInventoryPdf(inventory, items);
    } catch (e) { toast.error('Não foi possível gerar o PDF'); }
    finally { setPdfWorking(null); }
  };

  const visibleItems = items.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || `${i.asset_number} ${i.asset_name}`.toLowerCase().includes(q);
  });
  const canMark = inventory?.status === 'in_progress';
  const toggleOne = (itemId) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
    return next;
  });
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((i) => selected.has(i.id));
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) visibleItems.forEach((i) => next.delete(i.id));
    else visibleItems.forEach((i) => next.add(i.id));
    return next;
  });
  const isMarkable = (i) => i.status === 'pending' || i.status === 'not_found';
  const isUnmarkable = (i) => i.status === 'found' || i.status === 'misplaced';
  const selectedItems = items.filter((i) => selected.has(i.id));
  const markableCount = selectedItems.filter(isMarkable).length;
  const unmarkableCount = selectedItems.filter(isUnmarkable).length;

  // Marca (ou desfaz) os itens selecionados no servidor, de uma vez.
  const markSelected = async (action) => {
    const ids = selectedItems.filter(action === 'found' ? isMarkable : isUnmarkable).map((i) => i.id);
    if (ids.length === 0) return;
    setMarking(true);
    try {
      const res = await db.functions.invoke('markInventoryItems', { inventory_id: id, item_ids: ids, action });
      const byId = new Map(res.data.items.map((i) => [i.id, i]));
      setItems((prev) => prev.map((i) => byId.get(i.id) || i));
      setSelected(new Set());
      const n = res.data.items.length;
      toast.success(action === 'found' ? `${n} ite${n === 1 ? 'm marcado' : 'ns marcados'} como encontrado${n === 1 ? '' : 's'}` : `${n} ite${n === 1 ? 'm voltou' : 'ns voltaram'} para pendente`);
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao marcar itens'); }
    finally { setMarking(false); }
  };

  const exportCsv = () => {
    const rows = [['Número', 'Nome', 'Unidade esperada', 'Unidade encontrada', 'Status', 'Escaneado em', 'Por']];
    items.forEach((i) => rows.push([i.asset_number, i.asset_name, i.expected_location_name, i.found_location_name || '', INV_ITEM_LABELS[i.status], i.scanned_at ? formatDateTime(i.scanned_at) : '', i.scanned_by_name || '']));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `inventario-${inventory.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!inventory) return <Layout><div className="h-10 w-72 rounded-lg bg-muted animate-pulse mb-6" /><div className="h-40 rounded-2xl bg-muted animate-pulse" /></Layout>;

  const s = stats();
  const busyLabel = working === 'finish' ? 'Finalizando o inventário…' : working === 'reopen' ? 'Reabrindo o inventário…' : null;
  const checked = s.expected - s.pending;
  const pct = s.expected ? Math.round((checked / s.expected) * 100) : 0;
  const segments = [
    { key: 'found', n: s.found, label: 'Encontrados', tone: 'green' },
    { key: 'misplaced', n: s.misplaced, label: 'Unidade incorreta', tone: 'amber' },
    { key: 'not_found', n: s.notFound, label: 'Não encontrados', tone: 'red' },
    { key: 'pending', n: s.pending, label: 'Pendentes', tone: 'slate' },
  ];

  return (
    <Layout>
      <PageHeader
        title={inventory.name}
        description={[
          inventory.location_name || 'Todas as unidades',
          inventory.scheduled_date ? `Previsto para ${formatDay(inventory.scheduled_date)}` : `Criado em ${formatDateTime(inventory.created_date)}`,
          inventory.responsible_person ? `Responsável: ${inventory.responsible_person}` : null,
        ].filter(Boolean).join(' · ')}
      >
        <StatusPill tone={INVENTORY_STATUS_TONES[inventory.status] || 'slate'} className="text-sm px-3 py-1">{INVENTORY_STATUS_LABELS[inventory.status] || inventory.status}</StatusPill>
      </PageHeader>
      {inventory.notes && <p className="text-[15px] text-muted-foreground -mt-3 mb-5 whitespace-pre-line max-w-2xl">{inventory.notes}</p>}

      {inventory.status === 'draft' && (
        <div className="rounded-2xl border border-border bg-card shadow-card p-6 sm:p-8 text-center">
          {working === 'start' ? (
            <div className="py-4" role="status" aria-live="polite">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
              <p className="font-bold text-lg mt-3">Gerando a lista de patrimônios esperados…</p>
              <p className="text-[15px] text-muted-foreground mt-1">Pode levar alguns segundos em unidades com muitos itens. Não feche esta página.</p>
            </div>
          ) : (
            <>
              <p className="text-[15px] text-muted-foreground max-w-lg mx-auto">O inventário está pronto para iniciar. Será gerada a lista dos patrimônios esperados nesta unidade (e nas salas dela; as filiais têm inventário próprio).</p>
              <Button size="lg" className="mt-5" onClick={startInventory}><Play /> Iniciar inventário</Button>
            </>
          )}
        </div>
      )}

      {inventory.status !== 'draft' && (
        <>
          {/* Andamento da conferência */}
          <section className="rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6 mb-5" aria-label="Andamento da conferência">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Conferidos</p>
                <p className="mt-1 leading-none tnum"><span className="text-4xl sm:text-5xl font-bold text-primary">{checked}</span><span className="text-xl sm:text-2xl font-semibold text-muted-foreground"> de {s.expected}</span></p>
              </div>
              <p className="text-3xl sm:text-4xl font-bold tnum text-primary">{pct}%</p>
            </div>
            <div className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((g) => `${g.label}: ${g.n}`).join(', ')}>
              {segments.filter((g) => g.key !== 'pending' && g.n > 0).map((g) => (
                <div key={g.key} className={cn('h-full', TONE_SOLID[g.tone])} style={{ width: `${(g.n / s.expected) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {segments.map((g) => (
                <li key={g.key} className="flex items-start gap-2.5">
                  <span className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', TONE_SOLID[g.tone])} aria-hidden="true" />
                  <span><span className="block text-2xl font-bold tnum leading-none">{g.n}</span><span className="block text-sm text-muted-foreground mt-1">{g.label}</span></span>
                </li>
              ))}
            </ul>
          </section>

          {busyLabel && (
            <div className="rounded-2xl border border-border bg-card shadow-card p-6 text-center mb-5" role="status" aria-live="polite">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
              <p className="font-bold text-lg mt-3">{busyLabel}</p>
              <p className="text-[15px] text-muted-foreground mt-1">Não feche esta página.</p>
            </div>
          )}

          {inventory.status === 'completed' && !busyLabel && (
            <div className={cn('rounded-2xl p-5 mb-5 flex flex-wrap items-center justify-between gap-4', TONES.green)}>
              <div className="flex items-center gap-3.5">
                <CheckCircle2 className="w-8 h-8 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold text-lg">Inventário concluído</p>
                  <p className="text-[15px] opacity-90">Finalizado em {formatDateTime(inventory.finished_at)}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setConfirm('reopen')}><RotateCcw /> Reabrir inventário</Button>
            </div>
          )}

          {inventory.status === 'in_progress' && !scanning && !manual && !busyLabel && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] mb-5">
              <Button size="lg" className="h-14 text-base" onClick={startScan}><ScanLine className="!size-6" /> Escanear patrimônio</Button>
              <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setManual(true)}><Keyboard className="!size-5" /> Digitar código</Button>
            </div>
          )}

          {scanning && (
            <div className="max-w-md mx-auto mb-5">
              <div id="inv-qr-reader" className="w-full rounded-2xl overflow-hidden bg-black aspect-[3/4]" />
              <p className="text-sm text-muted-foreground text-center mt-3">Aponte para as etiquetas uma atrás da outra; a câmera continua aberta.</p>
              <Button variant="outline" className="mt-3 w-full" onClick={stopScan}><XCircle /> Parar câmera</Button>
            </div>
          )}

          {manual && !scanning && inventory.status === 'in_progress' && (
            <form onSubmit={handleManual} className="max-w-md mx-auto space-y-3 mb-5 rounded-2xl border border-border bg-card shadow-card p-4">
              <label htmlFor="manual-code" className="block text-sm font-semibold">Código do patrimônio</label>
              <Input id="manual-code" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Ex: PAT-000127" autoFocus autoCapitalize="characters" />
              <div className="flex gap-2"><Button type="submit" className="flex-1">Conferir</Button><Button type="button" variant="outline" onClick={() => { setManual(false); setFeedback(null); }}>Fechar</Button></div>
            </form>
          )}

          {loading && <div className="text-center py-6"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>}

          {feedback && !loading && (() => {
            const f = FEEDBACK[feedback.type];
            const Icon = f.icon;
            return (
              <div className={cn('max-w-md mx-auto mb-5 rounded-2xl p-5 text-center', TONES[f.tone])} role="status" aria-live="polite">
                <Icon className="w-12 h-12 mx-auto" aria-hidden="true" />
                <p className="font-bold text-lg mt-2">{feedback.type === 'misplaced' && feedback.message ? feedback.message : f.title}</p>
                <p className="font-mono text-[15px] mt-1">{feedback.code}</p>
                {feedback.asset?.name && <p className="mt-0.5">{feedback.asset.name}</p>}
                {feedback.type === 'misplaced' && <p className="text-sm mt-0.5 opacity-90">Cadastrado em: {feedback.asset?.location_name || '-'}</p>}
                {feedback.type === 'error' && <p className="text-sm mt-0.5 opacity-90">Verifique a conexão e tente de novo.</p>}
                <Button variant="outline" className="mt-4 w-full bg-card" onClick={() => setFeedback(null)}>OK</Button>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center gap-2">
            {inventory.status === 'in_progress' && (
              <Button variant="outline" onClick={() => setConfirm('finish')} disabled={!!working}>{working === 'finish' ? <Loader2 className="animate-spin" /> : <CheckCheck />} {working === 'finish' ? 'Finalizando…' : 'Finalizar inventário'}</Button>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {canShare && (
                <Button variant="outline" onClick={sharePdf} disabled={!!pdfWorking}>{pdfWorking === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />} {pdfWorking === 'share' ? 'Gerando PDF…' : 'Enviar PDF'}</Button>
              )}
              <Button variant="outline" onClick={savePdf} disabled={!!pdfWorking}>{pdfWorking === 'save' ? <Loader2 className="animate-spin" /> : <FileText />} {pdfWorking === 'save' ? 'Gerando PDF…' : 'Baixar PDF'}</Button>
              <Button variant="outline" onClick={exportCsv}><Download /> CSV</Button>
            </div>
          </div>

          {/* Lista de itens */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-[minmax(0,20rem)_13rem_auto] items-center gap-2">
            <div className="relative">
              <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Número ou nome" aria-label="Buscar na lista" className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(INV_ITEM_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground tnum">{visibleItems.length} de {items.length}</span>
          </div>

          {canMark && selected.size > 0 && (
            <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-20 mt-3 rounded-2xl border border-primary/30 bg-card p-3 shadow-pop flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold mr-auto pl-1">{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span>
              {markableCount > 0 && (
                <Button size="sm" onClick={() => markSelected('found')} disabled={marking}>
                  {marking ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Marcar {markableCount} como encontrado{markableCount === 1 ? '' : 's'}
                </Button>
              )}
              {unmarkableCount > 0 && (
                <Button size="sm" variant="outline" onClick={() => markSelected('pending')} disabled={marking}><Undo2 /> Desmarcar {unmarkableCount}</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={marking}>Limpar</Button>
            </div>
          )}

          {/* Computador: tabela */}
          <div className="hidden md:block table-card mt-3">
            <table>
              <thead>
                <tr>
                  {canMark && (
                    <th className="w-12">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} disabled={visibleItems.length === 0} aria-label="Selecionar todos os itens da lista" />
                    </th>
                  )}
                  <th>Número</th>
                  <th>Nome</th>
                  <th>Esperado</th>
                  <th className="hidden xl:table-cell">Encontrado</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((it) => (
                  <tr key={it.id} className={cn(canMark && 'row-link', selected.has(it.id) && 'bg-accent/60')} onClick={canMark ? () => toggleOne(it.id) : undefined}>
                    {canMark && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(it.id)} onCheckedChange={() => toggleOne(it.id)} aria-label={`Selecionar ${it.asset_number}`} />
                      </td>
                    )}
                    <td><span className="asset-code">{it.asset_number}</span></td>
                    <td className="font-semibold">{it.asset_name}</td>
                    <td className="text-muted-foreground">{it.expected_location_name || '-'}</td>
                    <td className="hidden xl:table-cell text-muted-foreground">{it.found_location_name || '-'}</td>
                    <td><StatusPill tone={INV_ITEM_TONES[it.status]}>{INV_ITEM_LABELS[it.status]}</StatusPill></td>
                  </tr>
                ))}
                {visibleItems.length === 0 && (
                  <tr><td colSpan={canMark ? 6 : 5} className="py-10 text-center text-muted-foreground">Nenhum item encontrado com esse filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <div className="md:hidden mt-3">
            {canMark && visibleItems.length > 0 && (
              <label className="flex items-center gap-3 px-1 pb-3 text-[15px] font-semibold cursor-pointer">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Selecionar todos os itens da lista" />
                Selecionar todos ({visibleItems.length})
              </label>
            )}
            <ul className="space-y-2.5">
              {visibleItems.map((it) => (
                <li key={it.id}>
                  <div
                    role={canMark ? 'button' : undefined}
                    tabIndex={canMark ? 0 : undefined}
                    onClick={canMark ? () => toggleOne(it.id) : undefined}
                    onKeyDown={canMark ? (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOne(it.id); } } : undefined}
                    className={cn('flex items-start gap-3.5 rounded-2xl border bg-card p-3.5 shadow-card', selected.has(it.id) ? 'border-primary/50 bg-accent/60' : 'border-border')}
                  >
                    {canMark && <Checkbox className="mt-0.5" checked={selected.has(it.id)} onCheckedChange={() => toggleOne(it.id)} onClick={(e) => e.stopPropagation()} aria-label={`Selecionar ${it.asset_number}`} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold leading-snug">{it.asset_name}</p>
                        <StatusPill tone={INV_ITEM_TONES[it.status]} className="mt-0.5">{INV_ITEM_LABELS[it.status]}</StatusPill>
                      </div>
                      <p className="asset-code mt-0.5">{it.asset_number}</p>
                      <p className="text-sm text-muted-foreground mt-1">{it.expected_location_name || '-'}{it.found_location_name && it.found_location_name !== it.expected_location_name ? ` → encontrado em ${it.found_location_name}` : ''}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {visibleItems.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhum item encontrado com esse filtro.</p>}
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm === 'finish'}
        onOpenChange={(v) => { if (!v) setConfirm(null); }}
        title="Finalizar inventário?"
        description={s.pending > 0
          ? `${s.pending} ite${s.pending === 1 ? 'm ainda pendente será marcado' : 'ns ainda pendentes serão marcados'} como "não encontrado". Você pode reabrir o inventário depois para conferir de novo.`
          : 'Todos os itens já foram conferidos. Você pode reabrir o inventário depois se precisar.'}
        confirmLabel="Finalizar"
        destructive={false}
        onConfirm={finishInventory}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        onOpenChange={(v) => { if (!v) setConfirm(null); }}
        title="Reabrir inventário?"
        description={`O inventário volta para "em andamento" e ${s.notFound === 1 ? 'o item não encontrado volta' : `os ${s.notFound} itens não encontrados voltam`} a ficar pendente${s.notFound === 1 ? '' : 's'} para você conferir de novo. O que já foi encontrado continua marcado.`}
        confirmLabel="Reabrir"
        destructive={false}
        onConfirm={reopenInventory}
      />
    </Layout>
  );
}
