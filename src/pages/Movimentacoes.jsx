import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import { formatDateTime, MOVEMENT_LABELS } from '@/lib/format';

export default function Movimentacoes() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => { try { setItems(await db.entities.AssetMovement.list('-created_date', 200)); } catch (e) { setItems([]); } })();
  }, []);

  return (
    <Layout>
      <PageHeader title="Movimentações" description="Tudo que mudou de unidade, empréstimo ou devolução" />
      {items === null ? (
        <div className="space-y-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação registrada" description="Quando um patrimônio mudar de unidade, o histórico aparece aqui." />
      ) : (
        <ul className="rounded-2xl border border-border bg-card shadow-card divide-y divide-border overflow-hidden">
          {items.map((m) => (
            <li key={m.id}>
              <Link to={`/p/${m.asset_number}`} className="flex items-start justify-between gap-4 p-4 sm:px-5 hover:bg-accent/40 transition-colors">
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{m.asset_name} <span className="asset-code ml-1">{m.asset_number}</span></p>
                  <p className="text-[15px] text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">{MOVEMENT_LABELS[m.movement_type]}</span> · {m.from_location_name || '-'} <ArrowRight className="inline w-3.5 h-3.5 -mt-0.5 mx-0.5" aria-hidden="true" /> <span className="text-foreground">{m.to_location_name || '-'}</span>
                  </p>
                </div>
                <div className="text-right shrink-0 text-sm text-muted-foreground">
                  <p className="tnum">{formatDateTime(m.created_date)}</p>
                  <p>Por {m.moved_by_name || '-'}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
