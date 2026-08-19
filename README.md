# Gestão Patrimonial

App para controle de patrimônio: cadastro de bens com numeração automática, QR Code e
código de barras para etiquetas, inventários por local, movimentações, manutenções e
gestão de usuários por papel (administrador / gestor / leitor).

## Rodando o projeto

```bash
npm install
npm run dev
```

Abra a URL impressa pelo Vite (normalmente `http://localhost:5173`).

Outros comandos:

```bash
npm run build      # build de produção em dist/
npm run preview    # serve o build de produção localmente
npm run lint        # eslint
npm run typecheck   # checagem de tipos via jsconfig.json
```

## Backend

O app usa um backend real: **Neon Postgres** para dados e **Vercel Blob** para arquivos
(fotos e documentos). O front-end (`src/lib/db.js`) fala com esse backend via HTTP, em
`/api/*` — Vercel Functions em `api/`. A sessão de login é um cookie httpOnly assinado
(JWT).

Ainda não existe envio de e-mail: o código de verificação de cadastro e o link de
redefinição de senha aparecem diretamente na tela, em vez de chegarem por e-mail. O
primeiro usuário cadastrado vira administrador automaticamente; os seguintes entram como
leitor (podem ser promovidos em Usuários).

### Configuração

1. Crie um `.env` na raiz com `DATABASE_URL` (Neon), `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
   e `AUTH_JWT_SECRET` (qualquer string longa aleatória, usada para assinar a sessão).
2. Aplique o schema no banco: `npm run db:migrate` (roda `db/schema.sql`, idempotente).
3. `npm run dev` — sobe o front (Vite) e a API local juntos (`concurrently`), com proxy de
   `/api` para o servidor local em `scripts/dev-server.js`.

Em produção, é feito deploy na Vercel: a pasta `api/` vira Functions automaticamente, sem
precisar do `scripts/dev-server.js` (que existe só para rodar localmente sem depender do
`vercel dev`/login na Vercel).

## Estrutura do projeto

```
src/
  pages/        páginas roteadas (uma por rota em src/App.jsx)
  components/   componentes compartilhados
  components/ui/ primitivos de UI (shadcn/ui)
  lib/          utilitários, contexto de auth/app, cliente da API (db.js)
  hooks/        hooks compartilhados
api/            Vercel Functions: auth, entidades (CRUD), upload, função createAsset
db/             schema.sql e script de migração (npm run db:migrate)
scripts/        servidor de API local para desenvolvimento (sem depender da Vercel CLI)
docs/entities/  schema de referência de cada entidade de dados
```
