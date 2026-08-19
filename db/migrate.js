import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL não configurada. Rode com: npm run db:migrate');
    process.exit(1);
  }

  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Schema aplicado com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Falha ao aplicar schema:', err.message);
  process.exit(1);
});
