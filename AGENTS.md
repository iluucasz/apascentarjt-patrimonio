# AGENTS.md

## Sobre o projeto

Gestão Patrimonial é um app React (Vite) para controle de patrimônio de igrejas/organizações:
cadastro de bens com numeração automática, QR Code/código de barras, inventários por local,
movimentações, manutenções e permissões por papel (admin / manager / user).

## Stack

- React 18 + React Router + Vite
- Tailwind CSS + Radix UI (componentes em `src/components/ui`, padrão shadcn/ui)
- TanStack Query para cache de dados assíncronos
- Backend: **mock local em `localStorage`** (`src/lib/db.js`) — não há servidor. Ver
  "Backend local" no `README.md` antes de mexer em autenticação ou persistência de dados.

## Estrutura

- `src/pages/`: uma página por rota registrada em `src/App.jsx`.
- `src/components/`: componentes compartilhados entre páginas (`Layout`, `PageHeader`, etc.).
- `src/components/ui/`: primitivos de UI (shadcn/ui) — evite editar sem necessidade real.
- `src/lib/`: utilitários (`format.js`, `permissions.js`, `utils.js`), contexto de auth/app
  (`AuthContext.jsx`, `AppContext.jsx`) e o backend local (`db.js`).
- `src/hooks/`: hooks compartilhados.
- `docs/entities/`: schema (JSON) de cada entidade de dados — referência do modelo, não é
  importado por código.

## Convenções

- Import absoluto via alias `@/` → `src/` (configurado em `jsconfig.json` e `vite.config.js`).
- Todo acesso a dados/autenticação passa por `db` (`import { db } from '@/lib/db'`), nunca
  acesse `localStorage` diretamente fora de `src/lib/db.js`.
- UI e mensagens de usuário em português (pt-BR); nomes de variáveis/funções em inglês.

## Rodando localmente

```bash
npm install
npm run dev
```

Rode `npm run lint` e `npm run typecheck` antes de finalizar mudanças.
