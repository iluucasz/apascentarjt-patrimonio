const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { ArrowLeftRight } from 'lucide-react';
import { formatDateTime, MOVEMENT_LABELS } from '@/lib/format';

export default function Movimentacoes() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => { try { setItems(await db.entities.AssetMovement.list('-created_date', 200)); } catch (e) { setItems([]); } })();
  }, []);

  return (
    <Layout>
      <PageHeader title="Movimentações" description="Histórico completo de movimentações de patrimônios" />
      {items === null ? (
        <div className="space-y-2">{Array.from({length:6}).map((_,i)=><div key={i} className="h-14 rounded bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação registrada" />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {items.map((m) => (
            <Link key={m.id} to={`/p/${m.asset_number}`} className="flex items-center justify-between gap-3 p-4 border-b border-border last:border-0 hover:bg-accent/30">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate"><span className="font-mono">{m.asset_number}</span> · {m.asset_name}</p>
                <p className="text-xs text-muted-foreground">{MOVEMENT_LABELS[m.movement_type]}: {m.from_location_name || '-'} → {m.to_location_name || '-'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{formatDateTime(m.created_date)}</p>
                <p className="text-xs text-muted-foreground">Por {m.moved_by_name || '-'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}