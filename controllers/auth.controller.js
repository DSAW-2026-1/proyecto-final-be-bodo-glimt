const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendPgOr500 } = require('../utils/pgErrors');

const SALT_ROUNDS = 10;
const ALLOWED_DOMAIN = '@unisabana.edu.co';

async function register(req, res) {
  const { email, password, name, career } = req.body;

  if (!email || !String(email).toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    return res.status(400).json({ error: 'Dominio no institucional' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Contraseña requerida' });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      String(email).toLowerCase(),
    ]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Correo ya registrado' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (email, password, name, career, role)
       VALUES ($1, $2, $3, $4, 'buyer')
       RETURNING id, email, role, created_at`,
      [String(email).toLowerCase(), hash, name, career || null]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name,
        career: career || null,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    return sendPgOr500(res, err, '[register]');
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Campos requeridos' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password, name, role, status FROM users WHERE email = $1',
      [String(email).toLowerCase()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (user.status === 'suspendido') {
      return res.status(403).json({ error: 'Cuenta suspendida' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        career: user.career,
      },
    });
  } catch (err) {
    return sendPgOr500(res, err, '[login]');
  }
}

async function logout(req, res) {
  const token = req.token;

  try {
    const decoded = jwt.decode(token);
    const expiresAt =
      decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO token_blacklist (token, expires_at)
       VALUES ($1, $2)
       ON CONFLICT (token) DO NOTHING`,
      [token, expiresAt]
    );

    return res.status(200).json({ message: 'Sesión cerrada' });
  } catch (err) {
    return sendPgOr500(res, err, '[logout]');
  }
}

module.exports = { register, login, logout };
