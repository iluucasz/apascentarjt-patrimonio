// Categorias padrão para patrimônio de igreja. Insere direto no Postgres
// (não é mock) — pula qualquer nome que já exista, então é seguro rodar
// mais de uma vez. Rodar com: npm run db:seed-categories

import pg from 'pg';

const CATEGORIES = [
  ['Instrumentos Musicais', 'Violões, teclados, bateria, microfones de instrumento, etc.'],
  ['Equipamentos de Som', 'Mesas de som, caixas de som, amplificadores, microfones, cabos'],
  ['Áudio e Vídeo / Projeção', 'Projetores, telões, câmeras, monitores'],
  ['Equipamentos de Transmissão', 'Streaming ao vivo, capturadoras, encoders'],
  ['Iluminação', 'Refletores, spots, mesas de luz'],
  ['Móveis', 'Cadeiras, mesas, armários, púlpito, bancos'],
  ['Eletrodomésticos', 'Geladeira, fogão, micro-ondas, bebedouro'],
  ['Informática e Eletrônicos', 'Computadores, notebooks, impressoras, roteadores'],
  ['Climatização', 'Ar-condicionado, ventiladores'],
  ['Veículos', 'Carros, vans e outros veículos da igreja'],
  ['Utensílios de Cozinha', 'Panelas, talheres, louças, utensílios de copa'],
  ['Materiais de Limpeza', 'Aspiradores, equipamentos e materiais de limpeza'],
  ['Decoração', 'Itens decorativos, plantas, arranjos'],
  ['Segurança', 'Câmeras, alarmes, extintores'],
  ['Ferramentas e Manutenção', 'Ferramentas manuais e elétricas para manutenção predial'],
  ['Papelaria e Escritório', 'Materiais de escritório, impressos, suprimentos administrativos'],
  ['Ministério Infantil', 'Brinquedos, materiais pedagógicos e didáticos'],
  ['Vestimentas e Paramentos', 'Vestes litúrgicas, faixas, uniformes'],
  ['Material Bibliográfico', 'Bíblias, hinários, livros'],
  ['Estrutura e Eventos', 'Tendas, andaimes, palcos, grades, estruturas móveis'],
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL não configurada.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    let created = 0;
    for (const [name, description] of CATEGORIES) {
      const existing = await client.query('select id from categories where lower(name) = lower($1)', [name]);
      if (existing.rows[0]) continue;
      await client.query('insert into categories (name, description, active) values ($1, $2, true)', [name, description]);
      created++;
    }
    console.log(`${created} categoria(s) criada(s), ${CATEGORIES.length - created} já existiam.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Falha ao popular categorias:', err.message);
  process.exit(1);
});
