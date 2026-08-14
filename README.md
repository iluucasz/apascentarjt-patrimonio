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

## Backend local

Este projeto **não depende de nenhum servidor**. Todos os dados (usuários, patrimônios,
categorias, locais, inventários, etc.) ficam salvos em `localStorage`, no seu navegador,
via `src/lib/db.js`. Isso significa:

- Os dados não são compartilhados entre navegadores/dispositivos diferentes.
- Limpar os dados do site no navegador apaga tudo.
- Login com Google não está disponível (o botão mostra um aviso).
- Não existe envio de e-mail: o código de verificação de cadastro e o link de redefinição
  de senha aparecem diretamente na tela, em vez de chegarem por e-mail.
- O primeiro usuário cadastrado vira administrador automaticamente; os seguintes entram
  como leitor.

Isso é suficiente para usar o app sozinho ou testar o fluxo completo. Para uso real com
várias pessoas/dispositivos, `src/lib/db.js` precisa ser substituído por um backend de
verdade (ex: Supabase, Firebase, API própria) — a interface (`db.auth`, `db.entities.*`)
foi mantida simples de propósito para facilitar essa troca sem reescrever as telas.

## Estrutura do projeto

```
src/
  pages/        páginas roteadas (uma por rota em src/App.jsx)
  components/   componentes compartilhados
  components/ui/ primitivos de UI (shadcn/ui)
  lib/          utilitários, contexto de auth/app, backend local (db.js)
  hooks/        hooks compartilhados
docs/entities/  schema de referência de cada entidade de dados
```
