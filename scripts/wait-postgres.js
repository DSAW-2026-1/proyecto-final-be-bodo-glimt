/**
 * Espera hasta que PostgreSQL acepte consultas reales (SELECT 1).
 * Solo abrir el puerto TCP no basta: el contenedor puede reiniciar el socket
 * antes de que el servidor esté listo → "Connection terminated unexpectedly".
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sabana_market',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  connectionTimeoutMillis: 8000,
});

const maxAttempts = parseInt(process.env.DB_WAIT_ATTEMPTS || '60', 10);
const delayMs = parseInt(process.env.DB_WAIT_DELAY_MS || '1000', 10);

(async () => {
  process.stdout.write(
    `Esperando PostgreSQL (${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '5432'}, db=${process.env.DB_NAME || 'sabana_market'})...\n`
  );

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await pool.query('SELECT 1');
      process.stdout.write('PostgreSQL listo para consultas SQL.\n');
      await pool.end();
      process.exit(0);
    } catch (err) {
      process.stdout.write(`  intento ${i}/${maxAttempts}: ${err.message}\n`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  try {
    await pool.end();
  } catch (_) {}
  process.stderr.write(
    'Timeout: revisa Docker (docker compose ps), usuario/clave en .env y que DB_NAME exista.\n'
  );
  process.exit(1);
})();
