// Cliente de API: fala com o backend real (Vercel Functions + Neon Postgres + Vercel Blob)
// em /api. Mantém a mesma interface (db.auth, db.entities, db.integrations, db.functions,
// db.users) usada pelas páginas, para não precisar reescrever as telas.

const ENTITY_NAMES = [
  'SystemSettings', 'Category', 'Location', 'Asset', 'AssetMovement',
  'MaintenanceRecord', 'AssetDocument', 'AuditLog', 'Inventory',
  'InventoryItem', 'User',
];

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = null; }
  }

  if (!res.ok) {
    const message = payload?.error || `Erro ${res.status}`;
    const error = new Error(message);
    error.response = { data: { error: message } };
    throw error;
  }
  return payload;
}

function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

function makeEntity(name) {
  return {
    async list(sort, limit) {
      return request(`/entities/${name}/list${qs({ sort, limit })}`);
    },
    async filter(query = {}, sort, limit) {
      return request(`/entities/${name}/filter${qs({ query, sort, limit })}`);
    },
    async get(id) {
      return request(`/entities/${name}/${id}`);
    },
    async create(data) {
      return request(`/entities/${name}`, { method: 'POST', body: data });
    },
    async bulkCreate(dataArray) {
      return request(`/entities/${name}/bulk`, { method: 'POST', body: dataArray });
    },
    async update(id, data) {
      return request(`/entities/${name}/${id}`, { method: 'PUT', body: data });
    },
    async delete(id) {
      return request(`/entities/${name}/${id}`, { method: 'DELETE' });
    },
  };
}

const entities = {};
for (const name of ENTITY_NAMES) entities[name] = makeEntity(name);

const auth = {
  async me() {
    return request('/auth/me');
  },

  async loginViaEmailPassword(email, password) {
    return request('/auth/login', { method: 'POST', body: { email, password } });
  },

  async resetPasswordRequest(email) {
    return request('/auth/reset-password-request', { method: 'POST', body: { email } });
  },

  async resetPassword({ resetToken, newPassword }) {
    return request('/auth/reset-password', { method: 'POST', body: { resetToken, newPassword } });
  },

  async logout() {
    await request('/auth/logout', { method: 'POST' });
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
};

const users = {
  async inviteUser(email, role) {
    return request('/users/invite', { method: 'POST', body: { email, role } });
  },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const dataBase64 = await fileToBase64(file);
      return request('/upload', {
        method: 'POST',
        body: { filename: file.name, contentType: file.type, dataBase64 },
      });
    },
  },
};

const functions = {
  async invoke(name, payload) {
    const path = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    return request(`/functions/${path}`, { method: 'POST', body: payload });
  },
};

export const db = { auth, entities, integrations, functions, users };
export default db;
