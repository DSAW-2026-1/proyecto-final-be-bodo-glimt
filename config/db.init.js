/**
 * npm run db:init
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('./db');
const { runMigrations } = require('./migrate');

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
    await runMigrations(client);
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
