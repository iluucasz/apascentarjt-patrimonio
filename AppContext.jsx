const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const value = {
    user,
    setUser,
    settings,
    setSettings,
    categories,
    locations,
    loading,
    refresh,
    locationName: (id) => locations.find((l) => l.id === id)?.name || '-',
    categoryName: (id) => categories.find((c) => c.id === id)?.name || '-'
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}