// Servidor de desenvolvimento local que executa as mesmas functions de api/*
// usando roteamento no estilo Vercel (pastas [dynamic] viram parâmetros).
// Em produção (Vercel), essas mesmas functions rodam nativamente — este
// arquivo existe só para "npm run dev" funcionar sem precisar de `vercel dev`
// (que exige login/link com a conta Vercel).

import http from 'node:http';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.join(__dirname, '..', 'api');
const PORT = process.env.API_PORT || 3001;

// Converte um segmento de pasta/arquivo no padrão de rota da Vercel:
// [name] -> parametro dinamico ":name", [...name] -> catch-all "...name".
function toSegment(name) {
  if (name.startsWith('[...') && name.endsWith(']')) return `...${name.slice(4, -1)}`;
  if (name.startsWith('[') && name.endsWith(']')) return `:${name.slice(1, -1)}`;
  return name;
}

function walk(dir, segments = []) {
  const routes = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      routes.push(...walk(full, [...segments, toSegment(entry)]));
    } else if (entry.endsWith('.js')) {
      const name = entry.slice(0, -3);
      const seg = name === 'index' ? null : toSegment(name);
      routes.push({ segments: seg ? [...segments, seg] : segments, file: full });
    }
  }
  return routes;
}

const routes = walk(API_DIR);

function matchRoute(pathSegments) {
  let best = null;
  let bestLiteralCount = -1;
  for (const route of routes) {
    const rs = route.segments;
    const isCatchAll = rs.length > 0 && rs[rs.length - 1].startsWith('...');
    if (isCatchAll ? pathSegments.length < rs.length : pathSegments.length !== rs.length) continue;

    const params = {};
    let ok = true;
    let literalCount = 0;
    for (let i = 0; i < rs.length; i++) {
      const seg = rs[i];
      if (seg.startsWith('...')) {
        params[seg.slice(3)] = pathSegments.slice(i).map(decodeURIComponent);
      } else if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(pathSegments[i]);
      } else if (seg !== pathSegments[i]) {
        ok = false; break;
      } else {
        literalCount++;
      }
    }
    if (ok && literalCount > bestLiteralCount) {
      best = { route, params };
      bestLiteralCount = literalCount;
    }
  }
  return best;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const handlerCache = new Map();
async function loadHandler(file) {
  if (!handlerCache.has(file)) {
    const mod = await import(pathToFileURL(file).href);
    handlerCache.set(file, mod.default);
  }
  return handlerCache.get(file);
}

const server = http.createServer(async (req, res) => {
  res.status = (code) => { res.statusCode = code; return res; };

  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      res.status(404).end('Not found');
      return;
    }
    const pathSegments = url.pathname.slice(5).split('/').filter(Boolean);
    const match = matchRoute(pathSegments);
    if (!match) {
      res.status(404).setHeader('Content-Type', 'application/json').end(JSON.stringify({ error: 'Rota não encontrada' }));
      return;
    }

    const query = Object.fromEntries(url.searchParams.entries());
    req.query = { ...query, ...match.params };

    const rawBody = await readBody(req);
    req.body = {};
    if (rawBody.length) {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try { req.body = JSON.parse(rawBody.toString('utf8')); } catch { req.body = {}; }
      }
    }

    const handler = await loadHandler(match.route.file);
    await handler(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).setHeader('Content-Type', 'application/json').end(JSON.stringify({ error: err.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`API local em http://localhost:${PORT}/api`);
});
