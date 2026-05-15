const pool = require('../config/db');

/** Listado mínimo para que el frontend muestre el catálogo (complemento práctico de TKT-06/07). */
async function listProducts(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS n FROM products WHERE active = TRUE`
    );
    const total = countResult.rows[0].n;

    const rows = await pool.query(
      `SELECT p.id, p.title, p.description, p.price, p.category, p.state, p.image_urls,
              p.seller_id, p.created_at, p.updated_at,
              u.name AS seller_name
       FROM products p
       JOIN users u ON u.id = p.seller_id
       WHERE p.active = TRUE
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.status(200).json({
      total,
      page,
      limit,
      products: rows.rows,
    });
  } catch (err) {
    console.error('[listProducts]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function createProduct(req, res) {
  const { title, description, price, category, state, imageUrls } = req.body;
  const sellerId = req.user.id;

  const p = Number(price);
  if (!title || !description || !category || !state || !Number.isFinite(p) || p <= 0) {
    return res.status(400).json({ error: 'Campos requeridos' });
  }

  if (!['nuevo', 'usado'].includes(state)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  let imgs = [];
  if (Array.isArray(imageUrls)) imgs = imageUrls.map(String).filter(Boolean);
  else if (typeof imageUrls === 'string' && imageUrls.trim()) imgs = [imageUrls.trim()];

  try {
    const result = await pool.query(
      `INSERT INTO products (title, description, price, category, state, image_urls, seller_id)
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7)
       RETURNING id, title, seller_id, created_at`,
      [String(title).trim(), String(description).trim(), p, String(category).trim(), state, imgs, sellerId]
    );

    const row = result.rows[0];
    return res.status(201).json({
      product: {
        id: row.id,
        title: row.title,
        sellerId: row.seller_id,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    console.error('[createProduct]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateProduct(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  try {
    const cur = await pool.query(
      `SELECT seller_id FROM products WHERE id = $1 AND active = TRUE`,
      [id]
    );
    if (!cur.rowCount) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (cur.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const sets = [];
    const vals = [];
    let i = 1;

    if (body.title !== undefined) {
      sets.push(`title = $${i++}`);
      vals.push(String(body.title).trim());
    }
    if (body.description !== undefined) {
      sets.push(`description = $${i++}`);
      vals.push(String(body.description).trim());
    }
    if (body.price !== undefined) {
      const p = Number(body.price);
      if (!Number.isFinite(p) || p <= 0) {
        return res.status(400).json({ error: 'Precio inválido' });
      }
      sets.push(`price = $${i++}`);
      vals.push(p);
    }
    if (body.category !== undefined) {
      sets.push(`category = $${i++}`);
      vals.push(String(body.category).trim());
    }
    if (body.state !== undefined) {
      if (!['nuevo', 'usado'].includes(body.state)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      sets.push(`state = $${i++}`);
      vals.push(body.state);
    }
    if (body.imageUrls !== undefined) {
      let imgs = [];
      if (Array.isArray(body.imageUrls)) imgs = body.imageUrls.map(String).filter(Boolean);
      else if (typeof body.imageUrls === 'string' && body.imageUrls.trim()) imgs = [body.imageUrls.trim()];
      sets.push(`image_urls = $${i++}`);
      vals.push(imgs);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Sin datos para actualizar' });
    }

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    const q = `UPDATE products SET ${sets.join(', ')} WHERE id = $${i}
               RETURNING id, title, description, price, category, state, image_urls, seller_id, updated_at`;
    const result = await pool.query(q, vals);
    const row = result.rows[0];

    return res.status(200).json({
      product: {
        id: row.id,
        title: row.title,
        description: row.description,
        price: Number(row.price),
        category: row.category,
        state: row.state,
        imageUrls: row.image_urls,
        sellerId: row.seller_id,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('[updateProduct]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listProducts, createProduct, updateProduct };
