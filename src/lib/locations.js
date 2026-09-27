// Árvore de locais (parent_location_id). Mesma regra do backend
// (api/_lib/scope.js): um local inclui todos os sublocais, em qualquer nível.

export function locationSubtree(locations, rootIds) {
  const children = new Map();
  for (const l of locations) {
    if (!l.parent_location_id) continue;
    if (!children.has(l.parent_location_id)) children.set(l.parent_location_id, []);
    children.get(l.parent_location_id).push(l.id);
  }
  const seen = new Set();
  const stack = [...rootIds];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) || []));
  }
  return seen;
}

// Locais em ordem de árvore (filial, depois seus sublocais), com a profundidade
// de cada um para indentar em listas.
export function locationTree(locations) {
  const byParent = new Map();
  const ids = new Set(locations.map((l) => l.id));
  for (const l of locations) {
    const parent = l.parent_location_id && ids.has(l.parent_location_id) ? l.parent_location_id : '';
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(l);
  }
  const out = [];
  const seen = new Set();
  const walk = (parent, depth) => {
    for (const l of (byParent.get(parent) || []).sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      out.push({ location: l, depth });
      walk(l.id, depth + 1);
    }
  };
  walk('', 0);
  // Locais presos num ciclo de "local pai" não têm raiz; entram no fim.
  for (const l of locations) if (!seen.has(l.id)) out.push({ location: l, depth: 0 });
  return out;
}

// Logo e cor de fundo de um local: o primeiro valor preenchido subindo pela
// árvore (o próprio local, o pai, o avô...), depois a filial principal e por
// fim as configurações do sistema. Logo e cor herdam cada um separadamente.
// locationId vazio = visão geral (principal / configurações).
export function resolveBranding(locations, locationId, settings) {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const chain = [];
  const seen = new Set();
  let current = locationId ? byId.get(locationId) : null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parent_location_id ? byId.get(current.parent_location_id) : null;
  }
  const main = locations.find((l) => l.is_main);
  if (main && !seen.has(main.id)) chain.push(main);
  const pick = (key, fallback) => chain.find((l) => l[key])?.[key] || fallback || '';
  return {
    logoUrl: pick('logo_url', settings?.church_logo_url),
    bgColor: pick('logo_bg_color', settings?.logo_bg_color),
  };
}
