import { db } from '@/lib/db';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { locationSubtree } from '@/lib/locations';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filialId, setFilialId] = useState(() => db.filial.get());

  const loadSettings = useCallback(async () => {
    try {
      const list = await db.entities.SystemSettings.list();
      if (list.length === 0) {
        // create default settings
        const created = await db.entities.SystemSettings.create({
          church_name: 'Minha Igreja',
          asset_prefix: 'PAT',
          next_asset_sequence: 1,
          digit_count: 6,
          public_asset_lookup: false
        });
        setSettings(created);
      } else {
        setSettings(list[0]);
      }
    } catch (e) {
      setSettings(null);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const list = await db.entities.Category.list('name');
      setCategories(list);
    } catch (e) {
      setCategories([]);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const list = await db.entities.Location.list('name');
      setLocations(list);
    } catch (e) {
      setLocations([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadSettings(), loadCategories(), loadLocations()]);
  }, [loadSettings, loadCategories, loadLocations]);

  useEffect(() => {
    (async () => {
      try {
        const u = await db.auth.me();
        setUser(u);
      } catch (e) {
        setUser(null);
      }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // Filiais: locais sem "local pai". A principal (is_main) é a visão geral.
  // Usuário restrito (não admin com allowed_location_ids) só enxerga os locais
  // liberados e os sublocais deles — o backend aplica a mesma regra.
  const restrictedIds = user && user.role !== 'admin' && user.allowed_location_ids?.length ? user.allowed_location_ids : null;
  const mainLocation = locations.find((l) => l.is_main) || null;

  const filialOptions = useMemo(() => {
    const byName = (a, b) => a.name.localeCompare(b.name);
    if (restrictedIds) {
      const own = locations.filter((l) => restrictedIds.includes(l.id)).sort(byName).map((l) => ({ id: l.id, name: l.name }));
      return own.length > 1 ? [{ id: '', name: 'Todos os meus locais', overview: true }, ...own] : own;
    }
    const roots = locations.filter((l) => !l.parent_location_id && l.active !== false && !l.is_main).sort(byName)
      .map((l) => ({ id: l.id, name: l.name }));
    const overview = mainLocation
      ? { id: mainLocation.id, name: mainLocation.name, overview: true, main: true }
      : { id: '', name: 'Todas as filiais', overview: true };
    return [overview, ...roots];
  }, [locations, restrictedIds, mainLocation]);

  const currentFilial = filialOptions.find((o) => o.id === filialId) || filialOptions[0] || null;

  // Filial salva que não existe mais (ou não é mais permitida) volta para a
  // visão geral.
  useEffect(() => {
    if (loading || !currentFilial || currentFilial.id === filialId) return;
    db.filial.set(currentFilial.id);
    setFilialId(currentFilial.id);
  }, [loading, currentFilial, filialId]);

  const setFilial = useCallback((id) => {
    db.filial.set(id);
    setFilialId(id);
  }, []);

  // Locais dentro da visão atual (restrição do usuário + filial escolhida):
  // usados nos filtros e nos cadastros. Movimentações continuam podendo ir para
  // qualquer local (`locations`).
  const scopeLocations = useMemo(() => {
    let ids = restrictedIds ? locationSubtree(locations, restrictedIds) : null;
    if (currentFilial && !currentFilial.overview) {
      const filialIds = locationSubtree(locations, [currentFilial.id]);
      ids = ids ? new Set([...filialIds].filter((id) => ids.has(id))) : filialIds;
    }
    return ids ? locations.filter((l) => ids.has(l.id)) : locations;
  }, [locations, restrictedIds, currentFilial]);

  const value = {
    user,
    setUser,
    settings,
    setSettings,
    categories,
    locations,
    scopeLocations,
    isScoped: scopeLocations !== locations,
    isRestricted: !!restrictedIds,
    filialOptions,
    currentFilial,
    setFilial,
    loading,
    refresh,
    locationName: (id) => locations.find((l) => l.id === id)?.name || '-',
    categoryName: (id) => categories.find((c) => c.id === id)?.name || '-'
  };

  // Trocar de filial remonta as páginas para elas buscarem os dados de novo
  // (o header X-Filial já mudou em db.js).
  return (
    <AppContext.Provider value={value}>
      <React.Fragment key={filialId || 'all'}>{children}</React.Fragment>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}
