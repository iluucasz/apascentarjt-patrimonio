import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Wrench, CheckCircle2 } from 'lucide-react';
import { formatDate, formatCurrency, MAINTENANCE_LABELS, MAINTENANCE_TONES } from '@/lib/format';
import StatusPill from '@/components/StatusPill';
import { canMaintainAsset, canViewFinancials } from '@/lib/permissions';

export default function Manutencoes() {
  const { user } = useApp();
  const [items, setItems] = useState(null);

  const load = async () => {
    try { setItems(await db.entities.MaintenanceRecord.list('-created_date', 200)); }
    catch (e) { setItems([]); }
  };
  useEffect(() => { load(); }, []);

  const finish = async (m) => {
    try {
      await db.entities.MaintenanceRecord.update(m.id, { status: 'completed', end_date: new Date().toISOString().slice(0, 10) });
      if (m.asset_id) await db.entities.Asset.update(m.asset_id, { status: 'active' });
      await load();
      toast.success('Manutenção concluída');
    } catch (e) { toast.error('Erro'); }
  };

  return (
    <Layout>
      <PageHeader title="Manutenções" description="Acompanhe os consertos e revisões dos patrimônios" />
      {items === null ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhuma manutenção registrada" description="Envie um patrimônio para manutenção pela ficha dele." />
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id} className="rounded-2xl border border-border bg-card shadow-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/p/${m.asset_number}`} className="font-bold leading-snug hover:underline underline-offset-4">{m.asset_name} <span className="asset-code ml-1">{m.asset_number}</span></Link>
                  <p className="text-[15px] text-foreground mt-1">{m.description}</p>
                </div>
                <StatusPill tone={MAINTENANCE_TONES[m.status]}>{MAINTENANCE_LABELS[m.status]}</StatusPill>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{m.provider || 'Sem prestador'} · {formatDate(m.start_date)}{m.end_date ? ` → ${formatDate(m.end_date)}` : ''}{canViewFinancials(user) && m.cost ? ` · ${formatCurrency(m.cost)}` : ''}</p>
              {m.notes && <p className="text-sm text-muted-foreground mt-1">{m.notes}</p>}
              {m.status === 'open' && canMaintainAsset(user) && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => finish(m)}><CheckCircle2 /> Concluir manutenção</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
