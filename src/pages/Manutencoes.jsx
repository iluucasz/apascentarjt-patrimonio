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
import { formatDate, formatCurrency, MAINTENANCE_LABELS, MAINTENANCE_STYLES } from '@/lib/format';
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
      <PageHeader title="Manutenções" description="Acompanhe as manutenções dos patrimônios" />
      {items === null ? (
        <div className="space-y-2">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 rounded bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhuma manutenção registrada" />
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/p/${m.asset_number}`} className="text-sm font-medium hover:underline"><span className="font-mono">{m.asset_number}</span> · {m.asset_name}</Link>
                  <p className="text-sm text-foreground mt-1">{m.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{m.provider || '-'} · {formatDate(m.start_date)}{m.end_date ? ` → ${formatDate(m.end_date)}` : ''}{canViewFinancials(user) && m.cost ? ` · ${formatCurrency(m.cost)}` : ''}</p>
                  {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${MAINTENANCE_STYLES[m.status]}`}>{MAINTENANCE_LABELS[m.status]}</span>
                  {m.status === 'open' && canMaintainAsset(user) && <Button size="sm" variant="outline" onClick={() => finish(m)}><CheckCircle2 className="w-4 h-4 mr-1" /> Concluir</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}