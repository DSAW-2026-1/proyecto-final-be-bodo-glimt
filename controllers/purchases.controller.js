const pool = require('../config/db');
const { createOrderForProduct } = require('./orders.controller');

async function createPurchase(req, res) {
  const buyerId = req.user.id;
  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const p = await client.query('SELECT id, price, seller_id, active FROM products WHERE id = $1', [productId]);
    if (!p.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const prod = p.rows[0];
    if (!prod.active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Producto no disponible' });
    }
    if (String(prod.seller_id) === String(buyerId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No puedes comprar tu propio producto' });
    }

    const ins = await client.query(
      `INSERT INTO purchases (buyer_id, product_id, seller_id, price) VALUES ($1, $2, $3, $4) RETURNING id, buyer_id, product_id, seller_id, price, created_at`,
      [buyerId, productId, prod.seller_id, prod.price]
    );

    const { orderId } = await createOrderForProduct(client, {
      userId: buyerId,
      productId,
      sellerId: prod.seller_id,
      price: prod.price,
      quantity: 1,
    });

    await client.query('COMMIT');

    return res.status(201).json({ purchase: ins.rows[0], orderId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[createPurchase]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

async function getUserPurchases(req, res) {
  const { id } = req.params;
  if (req.user.id !== id) return res.status(403).json({ error: 'Sin permiso' });

  try {
    const rows = await pool.query(
      `SELECT pu.id, pu.price, pu.created_at, pu.product_id, pr.title AS product_title, pr.image_urls, pu.seller_id, u.name AS seller_name
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       JOIN users u ON u.id = pu.seller_id
       WHERE pu.buyer_id = $1
       ORDER BY pu.created_at DESC
       LIMIT 200`,
      [id]
    );
    return res.status(200).json({ purchases: rows.rows });
  } catch (err) {
    console.error('[getUserPurchases]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { createPurchase, getUserPurchases };
