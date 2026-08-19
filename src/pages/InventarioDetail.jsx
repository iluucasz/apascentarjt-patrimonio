import { db } from '@/lib/db';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ScanLine, Keyboard, XCircle, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Play, CheckCheck, Download } from 'lucide-react';
import { formatDateTime, INV_ITEM_LABELS, INV_ITEM_STYLES } from '@/lib/format';

export default function InventarioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, locations } = useApp();
  const [inventory, setInventory] = useState(null);
  const [items, setItems] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const html5QrRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  const load = async () => {
    try {
      const list = await db.entities.Inventory.filter({ id });
      if (list.length === 0) { toast.error('Inventário não encontrado'); navigate('/inventarios'); return; }
      setInventory(list[0]);
      setItems(await db.entities.InventoryItem.filter({ inventory_id: id }, 'asset_number', 1000));
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

  const startInventory = async () => {
    try {
      // snapshot of assets
      let assets;
      if (inventory.all_locations) assets = await db.entities.Asset.list('-asset_number', 2000);
      else assets = await db.entities.Asset.filter({ location_id: inventory.location_id }, '-asset_number', 2000);
      // exclude disposed
      assets = assets.filter((a) => a.status !== 'disposed');
      if (assets.length === 0) { toast.error('Nenhum patrimônio neste local'); return; }
      await db.entities.InventoryItem.bulkCreate(assets.map((a) => ({
        inventory_id: id,
        asset_id: a.id,
        asset_number: a.asset_number,
        asset_name: a.name,
        expected_location_id: a.location_id || '',
        expected_location_name: a.location_name || '',
        status: 'pending'
      })));
      await db.entities.Inventory.update(id, { status: 'in_progress', started_at: new Date().toISOString() });
      await load();
      toast.success('Inventário iniciado');
    } catch (e) { toast.error('Erro ao iniciar'); }
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
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    setLoading(true);
    try {
      const assetList = await db.entities.Asset.filter({ asset_number: code });
      if (assetList.length === 0) {
        setFeedback({ type: 'not_found', code });
        try { navigator.vibrate && navigator.vibrate([100,50,100]); } catch(e){}
        setLoading(false);
        return;
      }
      const asset = assetList[0];
      const item = items.find((i) => i.asset_id === asset.id);
      if (!item) {
        // asset exists but not expected in this inventory
        setFeedback({ type: 'misplaced', code, asset, message: 'Patrimônio encontrado em local diferente' });
        try { navigator.vibrate && navigator.vibrate(100); } catch(e){}
        setLoading(false);
        return;
      }
      if (item.status === 'found' || item.status === 'misplaced') {
        setFeedback({ type: 'already', code, asset });
        setLoading(false);
        return;
      }
      // mark found
      const newStatus = asset.location_id === item.expected_location_id ? 'found' : 'misplaced';
      await db.entities.InventoryItem.update(item.id, {
        status: newStatus,
        scanned_at: new Date().toISOString(),
        scanned_by_name: user?.full_name || user?.email,
        found_location_id: asset.location_id || '',
        found_location_name: asset.location_name || ''
      });
      setFeedback({ type: newStatus === 'found' ? 'found' : 'misplaced', code, asset, item });
      try { navigator.vibrate && navigator.vibrate(100); } catch(e){}
      await load();
    } catch (e) {
      setFeedback({ type: 'error', code });
    } finally {
      setLoading(false);
    }
  }, [items, user]);

  const startScan = async () => {
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
        toast.error('Câmera indisponível. Use HTTPS.');
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
    try {
      // mark remaining pending as not_found
      const pending = items.filter((i) => i.status === 'pending');
      for (const it of pending) {
        await db.entities.InventoryItem.update(it.id, { status: 'not_found' });
      }
      await db.entities.Inventory.update(id, { status: 'completed', finished_at: new Date().toISOString(), summary: stats() });
      await load();
      toast.success('Inventário finalizado');
    } catch (e) { toast.error('Erro ao finalizar'); }
  };

  const exportCsv = () => {
    const rows = [['Número', 'Nome', 'Local esperado', 'Local encontrado', 'Status', 'Escaneado em', 'Por']];
    items.forEach((i) => rows.push([i.asset_number, i.asset_name, i.expected_location_name, i.found_location_name || '', INV_ITEM_LABELS[i.status], i.scanned_at ? formatDateTime(i.scanned_at) : '', i.scanned_by_name || '']));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `inventario-${inventory.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!inventory) return <Layout><div className="h-40 rounded bg-muted animate-pulse" /></Layout>;

  const s = stats();

  return (
    <Layout>
      <PageHeader title={inventory.name} description={`${inventory.location_name || 'Todos os locais'} · ${formatDateTime(inventory.created_date)}`} />

      {inventory.status === 'draft' && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">O inventário está pronto para iniciar. Um snapshot dos patrimônios será gerado.</p>
          <Button className="mt-4" onClick={startInventory}><Play className="w-4 h-4 mr-2" /> Iniciar inventário</Button>
        </div>
      )}

      {inventory.status !== 'draft' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Esperados" value={s.expected} />
            <Stat label="Encontrados" value={s.found} color="text-emerald-600" />
            <Stat label="Pendentes" value={s.pending} color="text-slate-600" />
            <Stat label="Local incorreto" value={s.misplaced} color="text-amber-600" />
          </div>

          {inventory.status === 'in_progress' && !scanning && !feedback && !manual && (
            <div className="max-w-md mx-auto text-center py-6">
              <button onClick={startScan} className="w-full py-8 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg flex flex-col items-center gap-3 active:scale-[0.98] transition-transform">
                <ScanLine className="w-10 h-10" /> Escanear patrimônio
              </button>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setManual(true)}><Keyboard className="w-4 h-4 mr-2" /> Digitar código</Button>
            </div>
          )}

          {scanning && (
            <div className="max-w-md mx-auto">
              <div id="inv-qr-reader" className="w-full rounded-xl overflow-hidden bg-black aspect-[3/4]" />
              <Button variant="outline" className="mt-3 w-full" onClick={stopScan}><XCircle className="w-4 h-4 mr-2" /> Parar</Button>
            </div>
          )}

          {manual && !scanning && !feedback && (
            <form onSubmit={handleManual} className="max-w-md mx-auto space-y-3">
              <Input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Ex: PAT-000127" autoFocus />
              <div className="flex gap-2"><Button type="submit" className="flex-1">Consultar</Button><Button type="button" variant="outline" onClick={() => setManual(false)}>Cancelar</Button></div>
            </form>
          )}

          {loading && <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>}

          {feedback && !loading && (
            <div className="max-w-md mx-auto mb-4">
              {feedback.type === 'found' && (
                <div className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900 rounded-xl p-5">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <p className="font-semibold mt-2">Patrimônio encontrado</p>
                  <p className="font-mono">{feedback.code}</p>
                  <p className="text-muted-foreground">{feedback.asset?.name}</p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => { setFeedback(null); startScan(); }}><RefreshCw className="w-4 h-4 mr-2" /> Escanear outro</Button>
                </div>
              )}
              {feedback.type === 'misplaced' && (
                <div className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900 rounded-xl p-5">
                  <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto" />
                  <p className="font-semibold mt-2">{feedback.message || 'Local incorreto'}</p>
                  <p className="font-mono">{feedback.code}</p>
                  <p className="text-sm text-muted-foreground">Esperado: {feedback.item?.expected_location_name || '-'}</p>
                  <p className="text-sm text-muted-foreground">Encontrado: {feedback.asset?.location_name || '-'}</p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => { setFeedback(null); startScan(); }}><RefreshCw className="w-4 h-4 mr-2" /> Continuar</Button>
                </div>
              )}
              {feedback.type === 'already' && (
                <div className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-900 rounded-xl p-5">
                  <CheckCircle2 className="w-12 h-12 text-blue-600 mx-auto" />
                  <p className="font-semibold mt-2">Esse patrimônio já foi conferido.</p>
                  <p className="font-mono">{feedback.code}</p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => { setFeedback(null); startScan(); }}><RefreshCw className="w-4 h-4 mr-2" /> Continuar</Button>
                </div>
              )}
              {feedback.type === 'not_found' && (
                <div className="border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-900 rounded-xl p-5">
                  <XCircle className="w-12 h-12 text-rose-600 mx-auto" />
                  <p className="font-semibold mt-2">Patrimônio não encontrado</p>
                  <p className="font-mono">{feedback.code}</p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => { setFeedback(null); startScan(); }}><RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente</Button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {inventory.status === 'in_progress' && (
              <Button variant="outline" onClick={finishInventory}><CheckCheck className="w-4 h-4 mr-2" /> Finalizar inventário</Button>
            )}
            <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground"><tr>
                <th className="text-left font-medium px-4 py-2">Número</th>
                <th className="text-left font-medium px-4 py-2">Nome</th>
                <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Esperado</th>
                <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Encontrado</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
              </tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{it.asset_number}</td>
                    <td className="px-4 py-2 truncate max-w-[160px]">{it.asset_name}</td>
                    <td className="px-4 py-2 hidden sm:table-cell text-muted-foreground">{it.expected_location_name || '-'}</td>
                    <td className="px-4 py-2 hidden sm:table-cell text-muted-foreground">{it.found_location_name || '-'}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${INV_ITEM_STYLES[it.status]}`}>{INV_ITEM_LABELS[it.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}

function Stat({ label, value, color = 'text-foreground' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}