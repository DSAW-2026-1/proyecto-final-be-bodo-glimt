/**
 * npm run db:init
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('./db');

const CREATE_TABLES = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  password    TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  career      TEXT,
  photo_url   TEXT,
  role        TEXT        NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','admin')),
  status      TEXT        NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','suspendido')),
  reputation  NUMERIC(3,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_blacklist (
  token       TEXT        PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  price       NUMERIC(12,2) NOT NULL CHECK (price > 0),
  category    TEXT        NOT NULL,
  state       TEXT        NOT NULL CHECK (state IN ('nuevo','usado')),
  image_urls  TEXT[]      DEFAULT '{}',
  seller_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_seller   ON products(seller_id);
`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function init() {
  let client;
  const connectAttempts = 15;
  for (let a = 1; a <= connectAttempts; a++) {
    try {
      client = await pool.connect();
      break;
    } catch (err) {
      console.log(`Conexión ${a}/${connectAttempts}: ${err.message}`);
      if (a === connectAttempts) {
        console.error('No se pudo conectar a PostgreSQL. ¿Está el contenedor arriba? (docker compose ps)');
        process.exit(1);
      }
      await sleep(1000 * a);
    }
  }

  try {
    console.log('Creando tablas…');
    await client.query(CREATE_TABLES);
    console.log('Tablas listas.');
    console.log('\nEjecuta: npm run dev\n');
  } catch (err) {
    console.error('Error al inicializar:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
