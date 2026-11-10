import { db } from '@/lib/db';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TONES } from '@/lib/format';
import { AssetStatusBadge } from '@/components/AssetBadges';
import { toast } from 'sonner';
import { ScanLine, Keyboard, RefreshCw, CheckCircle2, XCircle, PackagePlus, Loader2 } from 'lucide-react';
import NovoPatrimonioDialog from '@/components/NovoPatrimonioDialog';

export default function Scanner() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { found: bool, asset, code }
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  const extractCode = (text) => {
    if (!text) return '';
    const t = text.trim();
    // URL pattern /p/PAT-000127
    const match = t.match(/\/p\/([A-Z]+-\d+)/i);
    if (match) return match[1].toUpperCase();
    // direct PAT-000127
    if (/^[A-Z]+-\d+$/i.test(t)) return t.toUpperCase();
    return t;
  };

  const lookup = useCallback(async (rawCode) => {
    const code = extractCode(rawCode);
    if (!code) return;
    // debounce duplicates within 3s
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastTimeRef.current < 3000) return;
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    setLoading(true);
    try {
      const list = await db.entities.Asset.filter({ asset_number: code });
      if (list.length > 0) {
        setResult({ found: true, asset: list[0], code });
        beep(true);
      } else {
        setResult({ found: false, asset: null, code });
        beep(false);
      }
    } catch (e) {
      setResult({ found: false, asset: null, code });
      beep(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const beep = (ok) => {
    try {
      if (navigator.vibrate) navigator.vibrate(ok ? 100 : [100, 50, 100]);
    } catch (e) {}
  };

  const startScan = async () => {
    setResult(null);
    setScanning(true);
    setManual(false);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const qr = new Html5Qrcode('qr-reader');
        html5QrRef.current = qr;
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 }, formatsToSupport: [/* all */] },
          (decoded) => { lookup(decoded); },
          () => {}
        );
      } catch (e) {
        toast.error('Não foi possível acessar a câmera. Use HTTPS e permita o acesso.');
        setScanning(false);
      }
    }, 100);
  };

  const stopScan = async () => {
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.stop();
        await html5QrRef.current.clear();
        html5QrRef.current = null;
      }
    } catch (e) {}
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScan(); };
  }, []);

  const handleManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    lookup(manualCode);
    setManualCode('');
  };

  return (
    <Layout>
      <PageHeader title="Scanner" description="Leia o QR Code ou o código de barras da etiqueta" />

      {!scanning && !result && !manual && (
        <div className="max-w-md mx-auto rounded-3xl border border-border bg-card shadow-card p-6 sm:p-8 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-accent text-primary">
            <ScanLine className="w-12 h-12" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold mt-5">Escanear patrimônio</h2>
          <p className="text-[15px] text-muted-foreground mt-1.5">Aponte a câmera para a etiqueta do item e a ficha abre na hora.</p>
          <Button size="lg" className="mt-6 w-full h-14 text-base" onClick={startScan}><ScanLine className="!size-6" /> Abrir câmera</Button>
          <Button variant="outline" className="mt-3 w-full" onClick={() => setManual(true)}>
            <Keyboard /> Digitar o código
          </Button>
        </div>
      )}

      {scanning && (
        <div className="max-w-md mx-auto">
          <div id="qr-reader" ref={scannerRef} className="w-full rounded-2xl overflow-hidden bg-black aspect-[3/4]" />
          <p className="text-center text-[15px] text-muted-foreground mt-3">Aponte a câmera para o código…</p>
          <Button variant="outline" className="mt-3 w-full" onClick={stopScan}><XCircle /> Parar câmera</Button>
        </div>
      )}

      {manual && !scanning && !result && (
        <form onSubmit={handleManual} className="max-w-md mx-auto space-y-4 rounded-3xl border border-border bg-card shadow-card p-6">
          <div>
            <Label htmlFor="scanner-code">Código do patrimônio</Label>
            <Input id="scanner-code" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Ex: PAT-000127" autoFocus autoCapitalize="characters" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Consultar</Button>
            <Button type="button" variant="outline" onClick={() => setManual(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading && (
        <div className="max-w-md mx-auto text-center py-12" role="status" aria-live="polite"><Loader2 className="w-9 h-9 animate-spin mx-auto text-primary" /><p className="text-[15px] text-muted-foreground mt-3">Consultando…</p></div>
      )}

      {result && !loading && (
        <div className="max-w-md mx-auto" role="status" aria-live="polite">
          {result.found ? (
            <div className={`rounded-3xl p-6 text-center ${TONES.green}`}>
              <CheckCircle2 className="w-14 h-14 mx-auto" aria-hidden="true" />
              <p className="font-bold text-lg mt-2">Patrimônio encontrado</p>
              <p className="font-mono text-2xl font-bold mt-2 tracking-tight">{result.asset.asset_number}</p>
              <p className="text-lg mt-0.5">{result.asset.name}</p>
              <div className="flex justify-center mt-3"><AssetStatusBadge status={result.asset.status} className="bg-card" /></div>
              <Button size="lg" className="mt-5 w-full" onClick={() => navigate(`/p/${result.asset.asset_number}`)}>Abrir ficha do patrimônio</Button>
              <Button variant="outline" className="mt-2 w-full" onClick={() => { setResult(null); startScan(); }}><RefreshCw /> Escanear outro</Button>
            </div>
          ) : (
            <div className={`rounded-3xl p-6 text-center ${TONES.red}`}>
              <XCircle className="w-14 h-14 mx-auto" aria-hidden="true" />
              <p className="font-bold text-lg mt-2">Patrimônio não encontrado</p>
              <p className="text-[15px] mt-1 opacity-90">Código lido</p>
              <p className="font-mono text-2xl font-bold tracking-tight">{result.code}</p>
              <Button variant="outline" className="mt-5 w-full bg-card" onClick={() => { setResult(null); startScan(); }}><RefreshCw /> Tentar novamente</Button>
              <Button className="mt-2 w-full" onClick={() => setNovoOpen(true)}><PackagePlus /> Cadastrar patrimônio</Button>
            </div>
          )}
        </div>
      )}

      <NovoPatrimonioDialog open={novoOpen} onOpenChange={setNovoOpen} />
    </Layout>
  );
}
