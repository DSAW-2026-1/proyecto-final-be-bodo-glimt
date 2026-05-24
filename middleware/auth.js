const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { getJwtSecret } = require('../config/jwt');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = raw.trim();

  if (!token) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (err) {
    const msg =
      err.name === 'TokenExpiredError'
        ? 'Sesión expirada, vuelve a iniciar sesión'
        : 'Token inválido o expirado';
    return res.status(401).json({ error: msg });
  }

  if (!payload.id) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const bl = await pool.query('SELECT 1 FROM token_blacklist WHERE token = $1', [token]);
    if (bl.rowCount > 0) {
      return res.status(401).json({ error: 'Sesión cerrada, vuelve a iniciar sesión' });
    }
  } catch (err) {
    // 42P01 = tabla token_blacklist aún no creada (se crea al arrancar con migrate)
    if (err.code !== '42P01') {
      console.error('[authenticate] blacklist:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  try {
    const user = await pool.query('SELECT status FROM users WHERE id = $1', [payload.id]);
    if (!user.rows[0]) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    if (user.rows[0].status === 'suspendido') {
      return res.status(403).json({ error: 'Cuenta suspendida' });
    }
  } catch (err) {
    console.error('[authenticate] user lookup:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  req.user = payload;
  req.token = token;
  next();
}

function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    next();
  };
}

module.exports = { authenticate, authorizeRole };
