import { db } from '@/lib/db';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AssetStatusBadge } from '@/components/AssetBadges';
import { toast } from 'sonner';
import { ScanLine, Keyboard, RefreshCw, CheckCircle2, XCircle, PackagePlus, Loader2 } from 'lucide-react';

export default function Scanner() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { found: bool, asset, code }
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
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
      <PageHeader title="Scanner" description="Leia QR Code ou código de barras (Code 128) do patrimônio" />

      {!scanning && !result && (
        <div className="max-w-md mx-auto text-center py-8">
          <button onClick={startScan} className="w-full py-8 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg flex flex-col items-center gap-3 active:scale-[0.98] transition-transform">
            <ScanLine className="w-10 h-10" />
            Escanear patrimônio
          </button>
          <p className="text-sm text-muted-foreground mt-4">Aponte para o QR Code ou código de barras</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => setManual(true)}>
            <Keyboard className="w-4 h-4 mr-2" /> Digitar código manualmente
          </Button>
        </div>
      )}

      {scanning && (
        <div className="max-w-md mx-auto">
          <div id="qr-reader" ref={scannerRef} className="w-full rounded-xl overflow-hidden bg-black aspect-[3/4]" />
          <p className="text-center text-sm text-muted-foreground mt-3">Aponte a câmera para o código...</p>
          <Button variant="outline" className="mt-3 w-full" onClick={stopScan}><XCircle className="w-4 h-4 mr-2" /> Parar</Button>
        </div>
      )}

      {manual && !scanning && !result && (
        <form onSubmit={handleManual} className="max-w-md mx-auto space-y-3">
          <Input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Ex: PAT-000127" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Consultar</Button>
            <Button type="button" variant="outline" onClick={() => setManual(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading && (
        <div className="max-w-md mx-auto text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground mt-2">Consultando...</p></div>
      )}

      {result && !loading && (
        <div className="max-w-md mx-auto">
          {result.found ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-5 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <p className="font-semibold mt-2">Patrimônio encontrado</p>
              <p className="font-mono text-lg font-bold mt-1">{result.asset.asset_number}</p>
              <p className="text-muted-foreground">{result.asset.name}</p>
              <div className="flex justify-center mt-2"><AssetStatusBadge status={result.asset.status} /></div>
              <Button className="mt-4 w-full" onClick={() => navigate(`/p/${result.asset.asset_number}`)}>Abrir ficha do patrimônio</Button>
              <Button variant="outline" className="mt-2 w-full" onClick={() => { setResult(null); startScan(); }}><RefreshCw className="w-4 h-4 mr-2" /> Escanear outro</Button>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/20 p-5 text-center">
              <XCircle className="w-12 h-12 text-rose-600 mx-auto" />
              <p className="font-semibold mt-2">Patrimônio não encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">Código lido:</p>
              <p className="font-mono text-lg font-bold">{result.code}</p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => { setResult(null); startScan(); }}><RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente</Button>
              <Button className="mt-2 w-full" onClick={() => navigate('/patrimonios/novo')}><PackagePlus className="w-4 h-4 mr-2" /> Cadastrar patrimônio</Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}