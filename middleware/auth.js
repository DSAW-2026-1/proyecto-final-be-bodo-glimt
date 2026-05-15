const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const bl = await pool.query('SELECT 1 FROM token_blacklist WHERE token = $1', [token]);
    if (bl.rowCount > 0) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  } catch {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  try {
    const user = await pool.query('SELECT status FROM users WHERE id = $1', [payload.id]);
    if (!user.rows[0] || user.rows[0].status === 'suspendido') {
      return res.status(403).json({ error: 'Cuenta suspendida' });
    }
  } catch {
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
