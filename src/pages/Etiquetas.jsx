import { db } from '@/lib/db';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { QrCode, Printer, CheckSquare, Square, Maximize2, Search, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import AssetQRCode from '@/components/AssetQRCode';
import AssetBarcode from '@/components/AssetBarcode';

export default function Etiquetas() {
  const [searchParams] = useSearchParams();
  const { categories, locations, settings, user } = useApp();
  const [assets, setAssets] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [q, setQ] = useState('');
  const [fromNum, setFromNum] = useState('');
  const [toNum, setToNum] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterLoc, setFilterLoc] = useState('all');
  const [size, setSize] = useState('50x30');
  const [showName, setShowName] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showNumber, setShowNumber] = useState(true);
  const [showVariant, setShowVariant] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await db.entities.Asset.list('-asset_number');
        setAssets(list.filter((a) => a.status !== 'disposed'));
        const idsParam = searchParams.get('ids');
        const batchIdParam = searchParams.get('batch_id');
        if (idsParam) {
          setSelected(new Set(idsParam.split(',').filter(Boolean)));
        } else if (batchIdParam) {
          setSelected(new Set(list.filter((a) => a.batch_id === batchIdParam).map((a) => a.id)));
        }
      } catch (e) { setAssets([]); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!assets) return [];
    const term = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (filterCat !== 'all' && a.category_id !== filterCat) return false;
      if (filterLoc !== 'all' && a.location_id !== filterLoc) return false;
      if (fromNum && a.asset_number < fromNum) return false;
      if (toNum && a.asset_number > toNum) return false;
      if (term) {
        const hay = [a.asset_number, a.name, a.variant, a.brand, a.model].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [assets, filterCat, filterLoc, fromNum, toNum, q]);

  // Unidades de um mesmo lote viram uma única linha selecionável (com opção
  // de expandir) em vez de despejar centenas de linhas soltas na lista —
  // do contrário fica impossível achar um lote ou patrimônio específico.
  const rows = useMemo(() => {
    const groups = new Map();
    const result = [];
    for (const a of filtered) {
      if (!a.batch_id) { result.push(a); continue; }
      let group = groups.get(a.batch_id);
      if (!group) {
        group = { isBatch: true, id: a.batch_id, batch_id: a.batch_id, name: a.name, category_name: a.category_name, location_name: a.location_name, units: [] };
        groups.set(a.batch_id, group);
        result.push(group);
      }
      group.units.push(a);
    }
    return result;
  }, [filtered]);

  const toggle = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExpand = (batchId) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(batchId)) next.delete(batchId); else next.add(batchId);
    return next;
  });

  const toggleBatch = (group) => {
    const allSelected = group.units.every((u) => selected.has(u.id));
    setSelected((s) => {
      const next = new Set(s);
      group.units.forEach((u) => (allSelected ? next.delete(u.id) : next.add(u.id)));
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((a) => a.id)));
  const clearAll = () => setSelected(new Set());

  const applyRange = () => {
    setSelected(new Set(filtered.map((a) => a.id)));
    toast.success(`${filtered.length} patrimônios selecionados`);
  };

  const selectedAssets = assets ? assets.filter((a) => selected.has(a.id)) : [];
  const appUrl = window.location.origin;

  const handlePrint = () => {
    if (selectedAssets.length === 0) { toast.error('Selecione ao menos um patrimônio'); return; }
    window.print();
  };

  if (!assets) return <Layout><div className="h-40 rounded bg-muted animate-pulse" /></Layout>;

  return (
    <Layout>
      <div className="hidden print:block" ref={printRef}>
        <PrintSheet assets={selectedAssets} settings={settings} appUrl={appUrl} size={size} showName={showName} showCategory={showCategory} showLogo={showLogo} showQR={showQR} showBarcode={showBarcode} showNumber={showNumber} showVariant={showVariant} />
      </div>

      <PageHeader title="Etiquetas" description="Selecione patrimônios e gere etiquetas para impressão">
        <Button onClick={handlePrint} disabled={selectedAssets.length === 0}><Printer className="w-4 h-4 mr-2" /> Imprimir ({selectedAssets.length})</Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, nome ou lote..." className="pl-9" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>De</Label><Input value={fromNum} onChange={(e) => setFromNum(e.target.value.toUpperCase())} placeholder="PAT-000001" /></div>
              <div><Label>Até</Label><Input value={toNum} onChange={(e) => setToNum(e.target.value.toUpperCase())} placeholder="PAT-000050" /></div>
              <div><Label>Categoria</Label><Select value={filterCat} onValueChange={setFilterCat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Local</Label><Select value={filterLoc} onValueChange={setFilterLoc}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={applyRange}>Selecionar filtrados</Button>
              <Button size="sm" variant="outline" onClick={selectAll}>Selecionar todos</Button>
              <Button size="sm" variant="outline" onClick={clearAll}>Limpar</Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={QrCode} title="Nenhum patrimônio" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {rows.map((r) => r.isBatch ? (
                <div key={r.id} className="divide-y divide-border">
                  <div className="flex items-center gap-2 p-3 bg-muted/30">
                    <button onClick={() => toggleBatch(r)} className="text-primary">
                      {r.units.every((u) => selected.has(u.id)) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    <button type="button" onClick={() => toggleExpand(r.batch_id)} className="text-muted-foreground shrink-0">
                      {expanded.has(r.batch_id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0"><Layers className="w-3.5 h-3.5" /> Lote</span>
                    <span className="text-sm flex-1 truncate">
                      <span className="font-medium">{r.name}</span>{' '}
                      <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">{r.units.length} unidades</span>
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">{r.category_name} · {r.location_name}</span>
                  </div>
                  {expanded.has(r.batch_id) && r.units.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 pl-12">
                      <button onClick={() => toggle(u.id)} className="text-primary">
                        {selected.has(u.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                      </button>
                      <span className="font-mono text-xs w-24">{u.asset_number}</span>
                      <span className="text-sm flex-1 truncate">{u.variant || '-'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div key={r.id} className="flex items-center gap-3 p-3">
                  <button onClick={() => toggle(r.id)} className="text-primary">
                    {selected.has(r.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <span className="font-mono text-xs w-24">{r.asset_number}</span>
                  <span className="text-sm flex-1 truncate">{r.name}{r.variant && <span className="text-muted-foreground"> · {r.variant}</span>}</span>
                  <span className="text-xs text-muted-foreground hidden sm:block">{r.category_name} · {r.location_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold mb-3">Configuração da etiqueta</h3>
            <div className="space-y-3">
              <div><Label>Tamanho</Label><Select value={size} onValueChange={setSize}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50x25">50x25 mm</SelectItem><SelectItem value="50x30">50x30 mm</SelectItem><SelectItem value="60x30">60x30 mm</SelectItem><SelectItem value="70x30">70x30 mm</SelectItem></SelectContent></Select></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> Logo</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showQR} onChange={(e) => setShowQR(e.target.checked)} /> QR Code</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showBarcode} onChange={(e) => setShowBarcode(e.target.checked)} /> Código de barras</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showNumber} onChange={(e) => setShowNumber(e.target.checked)} /> Número</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Nome do patrimônio</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showVariant} onChange={(e) => setShowVariant(e.target.checked)} /> Variante</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showCategory} onChange={(e) => setShowCategory(e.target.checked)} /> Categoria</label>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Preview</h3>
              {selectedAssets[0] && (
                <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
                  <Maximize2 className="w-4 h-4 mr-1" /> Ampliar
                </Button>
              )}
            </div>
            <div className="flex justify-center">
              {selectedAssets[0] ? (
                <LabelPreview asset={selectedAssets[0]} settings={settings} appUrl={appUrl} size={size} showName={showName} showCategory={showCategory} showLogo={showLogo} showQR={showQR} showBarcode={showBarcode} showNumber={showNumber} showVariant={showVariant} />
              ) : (
                <p className="text-sm text-muted-foreground">Selecione um patrimônio</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Preview da etiqueta</DialogTitle></DialogHeader>
          <div className="flex justify-center py-6 overflow-auto">
            {selectedAssets[0] && (
              <LabelPreview asset={selectedAssets[0]} settings={settings} appUrl={appUrl} size={size} showName={showName} showCategory={showCategory} showLogo={showLogo} showQR={showQR} showBarcode={showBarcode} showNumber={showNumber} showVariant={showVariant} scale={4} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

const DIM = { '50x25': {w:50,h:25}, '50x30':{w:50,h:30}, '60x30':{w:60,h:30}, '70x30':{w:70,h:30} };

function LabelPreview({ asset, settings, appUrl, size, showName, showCategory, showLogo, showQR, showBarcode, showNumber, showVariant, forPrint = false, scale = 1 }) {
  const dim = DIM[size] || DIM['50x30'];
  const qrUrl = `${appUrl}/p/${asset.asset_number}`;
  // Ao ampliar (scale > 1), recalcula cada tamanho interno (fonte, QR,
  // código de barras) na mesma proporção do tamanho da caixa — amplia de
  // verdade em vez de dar "zoom" com CSS transform, que só deixava mais
  // visível um estouro de texto que já existia (nome da igreja não cabia
  // na altura fixa, só não aparecia por ser pequeno demais pra notar).
  const s = forPrint ? 1 : scale;
  const style = forPrint
    ? { width: `${dim.w}mm`, height: `${dim.h}mm` }
    : { width: `${dim.w * 3 * s}px`, height: `${dim.h * 3 * s}px` };

  return (
    <div
      className="label bg-white text-black border border-slate-300 flex flex-col items-center justify-center overflow-hidden"
      style={{ ...style, padding: '1mm' }}
    >
      {showLogo && settings?.church_logo_url && <img src={settings.church_logo_url} alt="" style={{ height: `${12 * s}px`, marginBottom: `${1 * s}px` }} className="object-contain" />}
      <p style={{ fontSize: `${7 * s}px`, lineHeight: 1.3, marginBottom: `${1.5 * s}px` }} className="font-bold text-center w-full truncate">{settings?.church_name || 'Igreja'}</p>
      <div className="flex items-center" style={{ gap: `${4 * s}px` }}>
        {showQR && <AssetQRCode value={qrUrl} size={forPrint ? 40 : 36 * s} />}
        <div className="flex flex-col items-center">
          {showNumber && <p style={{ fontSize: `${8 * s}px`, lineHeight: 1 }} className="font-mono font-bold">{asset.asset_number}</p>}
          {showName && <p style={{ fontSize: `${6 * s}px`, lineHeight: 1.2, maxWidth: `${55 * s}px` }} className="text-center truncate">{asset.name}</p>}
          {showVariant && asset.variant && <p style={{ fontSize: `${6 * s}px`, lineHeight: 1.2, maxWidth: `${55 * s}px` }} className="text-center truncate font-semibold">{asset.variant}</p>}
          {showCategory && <p style={{ fontSize: `${6 * s}px`, lineHeight: 1.2 }}>{asset.category_name}</p>}
        </div>
      </div>
      {showBarcode && <AssetBarcode value={asset.asset_number} height={forPrint ? 18 : 28 * s} fontSize={forPrint ? 6 : 8 * s} width={forPrint ? 1 : Math.max(1, s)} />}
    </div>
  );
}

function PrintSheet({ assets, settings, appUrl, size, ...opts }) {
  const dim = DIM[size] || DIM['50x30'];
  // A4 = 210x297mm. Compute columns based on label width + gap
  const gap = 2;
  const cols = Math.floor((210 - 10) / (dim.w + gap));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${gap}mm`, padding: '5mm' }}>
      {assets.map((a) => (
        <div key={a.id} style={{ breakInside: 'avoid' }}>
          <LabelPreview asset={a} settings={settings} appUrl={appUrl} size={size} forPrint {...opts} />
        </div>
      ))}
    </div>
  );
}