const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function getUser(req, res) {
  const { id } = req.params;
  if (req.user.id !== id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, name, career, photo_url, reputation, role, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const u = result.rows[0];
    return res.status(200).json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        career: u.career,
        photoUrl: u.photo_url,
        reputation: u.reputation != null ? Number(u.reputation) : null,
        role: u.role,
        createdAt: u.created_at,
      },
    });
  } catch (err) {
    console.error('[getUser]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  if (req.user.id !== id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  const { name, career, photoUrl } = req.body;
  if (name !== undefined && String(name).trim() === '') {
    return res.status(400).json({ error: 'Nombre inválido' });
  }

  try {
    const exists = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (!exists.rowCount) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const fields = [];
    const vals = [];
    let i = 1;

    if (name !== undefined) {
      fields.push(`name = $${i++}`);
      vals.push(String(name).trim());
    }
    if (career !== undefined) {
      fields.push(`career = $${i++}`);
      vals.push(career ? String(career).trim() : null);
    }
    if (photoUrl !== undefined) {
      fields.push(`photo_url = $${i++}`);
      vals.push(photoUrl ? String(photoUrl).trim() : null);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'Sin datos para actualizar' });
    }

    fields.push(`updated_at = NOW()`);
    vals.push(id);

    const q = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, name, career, photo_url, reputation, role, updated_at`;
    const result = await pool.query(q, vals);
    const u = result.rows[0];

    return res.status(200).json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        career: u.career,
        photoUrl: u.photo_url,
        reputation: u.reputation != null ? Number(u.reputation) : null,
        role: u.role,
        updatedAt: u.updated_at,
      },
    });
  } catch (err) {
    console.error('[updateUser]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function becomeSeller(req, res) {
  const { id } = req.params;
  if (req.user.id !== id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  try {
    const r = await pool.query('SELECT role, email FROM users WHERE id = $1', [id]);
    if (!r.rowCount) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (r.rows[0].role === 'seller') {
      return res.status(400).json({ error: 'Ya eres vendedor' });
    }

    const email = r.rows[0].email;

    await pool.query(`UPDATE users SET role = 'seller', updated_at = NOW() WHERE id = $1`, [id]);

    const token = jwt.sign(
      { id, email, role: 'seller' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.status(200).json({
      id,
      role: 'seller',
      message: 'Ahora eres vendedor',
      token,
    });
  } catch (err) {
    console.error('[becomeSeller]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getUser, updateUser, becomeSeller };
