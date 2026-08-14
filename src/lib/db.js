// Backend local: substitui o antigo cliente base44. Persiste tudo em
// localStorage, no navegador. Não é multiusuário nem seguro para produção —
// é o que permite o app funcionar de ponta a ponta sem servidor.

const STORAGE_KEY = 'apascentar_patrimonio_db_v1';

const ENTITY_NAMES = [
  'SystemSettings', 'Category', 'Location', 'Asset', 'AssetMovement',
  'MaintenanceRecord', 'AssetDocument', 'AuditLog', 'Inventory',
  'InventoryItem', 'User',
];

function emptyStore() {
  const collections = {};
  for (const name of ENTITY_NAMES) collections[name] = [];
  return { collections, currentUserId: null, pendingOtp: null, resetTokens: {} };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    const store = emptyStore();
    Object.assign(store, parsed);
    Object.assign(store.collections, parsed.collections);
    return store;
  } catch {
    return emptyStore();
  }
}

function save(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function matches(record, query) {
  return Object.entries(query).every(([k, v]) => record[k] === v);
}

function applySort(records, sort) {
  if (!sort) return records;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  const sorted = [...records].sort((a, b) => {
    const av = a[field], bv = b[field];
    if (av === bv) return 0;
    return av > bv ? 1 : -1;
  });
  return desc ? sorted.reverse() : sorted;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

function makeEntity(name) {
  return {
    async list(sort, limit) {
      const store = load();
      let records = [...store.collections[name]];
      records = applySort(records, sort);
      if (limit) records = records.slice(0, limit);
      return records;
    },
    async filter(query = {}, sort, limit) {
      const store = load();
      let records = store.collections[name].filter((r) => matches(r, query));
      records = applySort(records, sort);
      if (limit) records = records.slice(0, limit);
      return records;
    },
    async get(id) {
      const store = load();
      return store.collections[name].find((r) => r.id === id) || null;
    },
    async create(data) {
      const store = load();
      const record = { id: uid(), ...data, created_date: nowIso(), updated_date: nowIso() };
      store.collections[name].push(record);
      save(store);
      return record;
    },
    async update(id, data) {
      const store = load();
      const list = store.collections[name];
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`${name} ${id} não encontrado`);
      list[idx] = { ...list[idx], ...data, updated_date: nowIso() };
      save(store);
      return list[idx];
    },
    async delete(id) {
      const store = load();
      store.collections[name] = store.collections[name].filter((r) => r.id !== id);
      save(store);
      return { success: true };
    },
  };
}

const entities = {};
for (const name of ENTITY_NAMES) entities[name] = makeEntity(name);

function findUserByEmail(store, email) {
  const target = email.trim().toLowerCase();
  return store.collections.User.find((u) => u.email.toLowerCase() === target) || null;
}

const auth = {
  async me() {
    const store = load();
    const user = store.currentUserId
      ? store.collections.User.find((u) => u.id === store.currentUserId)
      : null;
    if (!user) throw new Error('Não autenticado');
    return sanitizeUser(user);
  },

  async loginViaEmailPassword(email, password) {
    const store = load();
    const user = findUserByEmail(store, email);
    if (!user) throw new Error('E-mail ou senha inválidos');
    const hash = await sha256(password);
    if (hash !== user.password_hash) throw new Error('E-mail ou senha inválidos');
    store.currentUserId = user.id;
    save(store);
    return sanitizeUser(user);
  },

  async register({ email, password }) {
    const store = load();
    if (findUserByEmail(store, email)) throw new Error('Já existe uma conta com este e-mail');
    const password_hash = await sha256(password);
    const isFirstUser = store.collections.User.length === 0;
    const user = {
      id: uid(),
      email: email.trim().toLowerCase(),
      password_hash,
      full_name: '',
      role: isFirstUser ? 'admin' : 'user',
      email_verified: false,
      created_date: nowIso(),
      updated_date: nowIso(),
    };
    store.collections.User.push(user);
    const devOtpCode = String(Math.floor(100000 + Math.random() * 900000));
    store.pendingOtp = { email: user.email, code: devOtpCode };
    save(store);
    return { devOtpCode };
  },

  async verifyOtp({ email, otpCode }) {
    const store = load();
    const pending = store.pendingOtp;
    if (!pending || pending.email !== email.trim().toLowerCase() || pending.code !== otpCode) {
      throw new Error('Código de verificação inválido');
    }
    const user = findUserByEmail(store, email);
    if (!user) throw new Error('Usuário não encontrado');
    user.email_verified = true;
    store.currentUserId = user.id;
    store.pendingOtp = null;
    save(store);
    return { access_token: uid() };
  },

  async resendOtp(email) {
    const store = load();
    const user = findUserByEmail(store, email);
    if (!user) throw new Error('Usuário não encontrado');
    const devOtpCode = String(Math.floor(100000 + Math.random() * 900000));
    store.pendingOtp = { email: user.email, code: devOtpCode };
    save(store);
    return { devOtpCode };
  },

  async setToken() {
    // Sessão é controlada por currentUserId; mantido apenas por compatibilidade de interface.
  },

  async resetPasswordRequest(email) {
    const store = load();
    const user = findUserByEmail(store, email);
    if (!user) return { resetToken: null };
    const resetToken = uid();
    store.resetTokens[resetToken] = { email: user.email, expiresAt: Date.now() + 30 * 60 * 1000 };
    save(store);
    return { resetToken };
  },

  async resetPassword({ resetToken, newPassword }) {
    const store = load();
    const entry = store.resetTokens[resetToken];
    if (!entry || entry.expiresAt < Date.now()) throw new Error('Link de redefinição inválido ou expirado');
    const user = findUserByEmail(store, entry.email);
    if (!user) throw new Error('Usuário não encontrado');
    user.password_hash = await sha256(newPassword);
    delete store.resetTokens[resetToken];
    save(store);
    return { success: true };
  },

  async logout() {
    const store = load();
    store.currentUserId = null;
    save(store);
  },

  redirectToLogin(returnUrl) {
    let query = '';
    try {
      if (returnUrl) {
        const url = new URL(returnUrl, window.location.origin);
        query = `?returnTo=${encodeURIComponent(url.pathname + url.search)}`;
      }
    } catch {
      // ignore malformed returnUrl
    }
    window.location.href = `/login${query}`;
  },

  async loginWithProvider() {
    throw new Error('Login com Google não está disponível no modo local. Use e-mail e senha.');
  },
};

const users = {
  async inviteUser(email, role) {
    const store = load();
    if (findUserByEmail(store, email)) throw new Error('Já existe uma conta com este e-mail');
    const user = {
      id: uid(),
      email: email.trim().toLowerCase(),
      password_hash: null,
      full_name: '',
      role: role || 'user',
      email_verified: false,
      invited: true,
      created_date: nowIso(),
      updated_date: nowIso(),
    };
    store.collections.User.push(user);
    save(store);
    return sanitizeUser(user);
  },
};

const integrations = {
  Core: {
    UploadFile({ file }) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ file_url: reader.result });
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.readAsDataURL(file);
      });
    },
  },
};

function apiError(message) {
  const error = new Error(message);
  error.response = { data: { error: message } };
  return error;
}

async function createAsset(payload) {
  let user;
  try {
    user = await auth.me();
  } catch {
    throw apiError('Não autorizado');
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    throw apiError('Sem permissão para cadastrar patrimônio');
  }

  const settingsList = await entities.SystemSettings.list();
  const settings = settingsList[0] || null;
  const prefix = settings?.asset_prefix || 'PAT';
  const digits = settings?.digit_count || 6;
  const seq = settings?.next_asset_sequence || 1;
  const asset_number = `${prefix}-${String(seq).padStart(digits, '0')}`;

  const asset = await entities.Asset.create({
    asset_number,
    name: payload.name,
    description: payload.description || '',
    category_id: payload.category_id || '',
    category_name: payload.category_name || '',
    brand: payload.brand || '',
    model: payload.model || '',
    serial_number: payload.serial_number || '',
    location_id: payload.location_id || '',
    location_name: payload.location_name || '',
    responsible_person: payload.responsible_person || '',
    acquisition_date: payload.acquisition_date || null,
    acquisition_value: payload.acquisition_value || 0,
    supplier: payload.supplier || '',
    invoice_number: payload.invoice_number || '',
    status: payload.status || 'active',
    condition: payload.condition || 'good',
    notes: payload.notes || '',
    photo_url: payload.photo_url || '',
  });

  if (settings) {
    await entities.SystemSettings.update(settings.id, { next_asset_sequence: seq + 1 });
  }

  await entities.AuditLog.create({
    action: 'asset_create',
    entity_type: 'Asset',
    entity_id: asset.id,
    entity_label: asset_number,
    new_data: asset,
    user_name: user.full_name || user.email,
  });

  return { data: { asset } };
}

const FUNCTIONS = { createAsset };

const functions = {
  async invoke(name, payload) {
    const fn = FUNCTIONS[name];
    if (!fn) throw apiError(`Função desconhecida: ${name}`);
    return fn(payload);
  },
};

export const db = { auth, entities, integrations, functions, users };
export default db;
