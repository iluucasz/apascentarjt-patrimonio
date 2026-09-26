import React from 'react';
import { locationTree } from '@/lib/locations';

// Lista de locais com checkbox, em ordem de árvore. Marcar um local já inclui
// os sublocais dele (regra aplicada no backend), então os filhos de um local
// marcado aparecem marcados e travados.
export default function LocationPicker({ locations, value, onChange }) {
  const selected = new Set(value);
  const tree = locationTree(locations);
  const byId = new Map(locations.map((l) => [l.id, l]));

  const coveredByParent = (l) => {
    const seen = new Set();
    let parentId = l.parent_location_id;
    while (parentId && !seen.has(parentId)) {
      if (selected.has(parentId)) return true;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parent_location_id;
    }
    return false;
  };

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange([...next]);
  };

  if (locations.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum local cadastrado.</p>;
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-2 space-y-0.5">
      {tree.map(({ location: l, depth }) => {
        const inherited = coveredByParent(l);
        return (
          <label
            key={l.id}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/50 ${inherited ? 'text-muted-foreground' : 'cursor-pointer'}`}
            style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
          >
            <input type="checkbox" checked={inherited || selected.has(l.id)} disabled={inherited} onChange={() => toggle(l.id)} />
            <span className="truncate">{l.name}</span>
            {!l.parent_location_id && <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-auto">Filial</span>}
          </label>
        );
      })}
    </div>
  );
}
