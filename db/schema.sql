-- Schema do Gestão Patrimonial (Neon Postgres)
-- Rodar via: npm run db:migrate

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  full_name text not null default '',
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  email_verified boolean not null default false,
  invited boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists system_settings (
  id uuid primary key default gen_random_uuid(),
  church_name text not null default 'Minha Igreja',
  church_logo_url text not null default '',
  asset_prefix text not null default 'PAT',
  next_asset_sequence integer not null default 1,
  digit_count integer not null default 6,
  public_asset_lookup boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  parent_location_id uuid references locations(id) on delete set null,
  parent_location_name text not null default '',
  active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  asset_number text not null,
  name text not null,
  description text not null default '',
  category_id uuid references categories(id) on delete set null,
  category_name text not null default '',
  brand text not null default '',
  model text not null default '',
  serial_number text not null default '',
  location_id uuid references locations(id) on delete set null,
  location_name text not null default '',
  responsible_person text not null default '',
  acquisition_date date,
  acquisition_value numeric(14,2) not null default 0,
  supplier text not null default '',
  invoice_number text not null default '',
  status text not null default 'active' check (status in ('active', 'maintenance', 'loaned', 'storage', 'disposed', 'lost')),
  condition text not null default 'good' check (condition in ('new', 'excellent', 'good', 'fair', 'poor', 'damaged')),
  notes text not null default '',
  photo_url text not null default '',
  archived_at timestamptz,
  disposed_reason text check (disposed_reason in ('descarte', 'venda', 'doacao', 'perda', 'roubo', 'outro')),
  disposed_notes text not null default '',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create unique index if not exists assets_asset_number_key on assets (asset_number);

create table if not exists asset_movements (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  asset_number text not null default '',
  asset_name text not null default '',
  from_location_id uuid references locations(id) on delete set null,
  from_location_name text not null default '',
  to_location_id uuid references locations(id) on delete set null,
  to_location_name text not null default '',
  responsible_person text not null default '',
  movement_type text not null default 'transfer' check (movement_type in ('transfer', 'loan', 'return', 'allocation')),
  notes text not null default '',
  moved_by_name text not null default '',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists maintenance_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  asset_number text not null default '',
  asset_name text not null default '',
  description text not null,
  provider text not null default '',
  start_date date,
  end_date date,
  cost numeric(14,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  notes text not null default '',
  created_by_name text not null default '',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists asset_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  asset_number text not null default '',
  name text not null,
  type text not null default 'documento' check (type in ('nota_fiscal', 'manual', 'garantia', 'orcamento', 'documento', 'outros')),
  file_url text not null,
  uploaded_by_name text not null default '',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  entity_label text not null default '',
  old_data jsonb,
  new_data jsonb,
  user_name text not null default '',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists inventories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_id uuid references locations(id) on delete set null,
  location_name text not null default '',
  all_locations boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  created_by_name text not null default '',
  summary jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventories(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  asset_number text not null default '',
  asset_name text not null default '',
  expected_location_id uuid references locations(id) on delete set null,
  expected_location_name text not null default '',
  found_location_id uuid references locations(id) on delete set null,
  found_location_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'found', 'misplaced', 'not_found')),
  scanned_at timestamptz,
  scanned_by_name text not null default '',
  notes text not null default '',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists asset_movements_asset_id_idx on asset_movements (asset_id);
create index if not exists maintenance_records_asset_id_idx on maintenance_records (asset_id);
create index if not exists asset_documents_asset_id_idx on asset_documents (asset_id);
create index if not exists inventory_items_inventory_id_idx on inventory_items (inventory_id);
create index if not exists inventory_items_asset_id_idx on inventory_items (asset_id);
create index if not exists assets_location_id_idx on assets (location_id);
create index if not exists assets_category_id_idx on assets (category_id);

-- Sessão de autenticação (OTP de cadastro / token de redefinição de senha)
create table if not exists auth_pending_otp (
  email text primary key,
  code text not null,
  expires_at timestamptz not null
);

create table if not exists auth_reset_tokens (
  token uuid primary key default gen_random_uuid(),
  email text not null,
  expires_at timestamptz not null
);
