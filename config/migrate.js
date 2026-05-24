/**
 * Migraciones idempotentes — se ejecutan al iniciar el servidor (Render/producción).
 */
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

CREATE TABLE IF NOT EXISTS purchases (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price       NUMERIC(12,2) NOT NULL CHECK (price > 0),
  status      TEXT        NOT NULL DEFAULT 'created',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','confirmada','entregada')),
  total       NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID        REFERENCES products(id) ON DELETE SET NULL,
  seller_id   UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  price       NUMERIC(12,2) NOT NULL,
  quantity    INT         NOT NULL CHECK (quantity > 0) DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        REFERENCES products(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT        NOT NULL,
  read            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    UUID        REFERENCES orders(id) ON DELETE SET NULL,
  rating      INT         NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_order_seller_buyer
  ON reviews (seller_id, reviewer_id, order_id)
  WHERE order_id IS NOT NULL;
`;

async function runMigrations(pool) {
  await pool.query(CREATE_TABLES);
}

module.exports = { runMigrations, CREATE_TABLES };
