const pool = require('../config/db');
const { paginate } = require('../utils/paginate');

/**
 * TKT-14: Historial de compras del usuario autenticado.
 * GET /orders?page=1&limit=20
 */
async function listOrders(req, res) {
  const userId = req.user.id;
  const { page, limit, offset } = paginate(req.query);

  if (
    (req.query.page && (!Number.isInteger(Number(req.query.page)) || Number(req.query.page) < 1)) ||
    (req.query.limit && (!Number.isInteger(Number(req.query.limit)) || Number(req.query.limit) < 1))
  ) {
    return res.status(400).json({ error: 'Params inválidos' });
  }

  try {
    const totalR = await pool.query('SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1', [userId]);
    const total = totalR.rows[0].total;

    const ordersR = await pool.query(
      `SELECT id, status, total, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const orders = [];
    for (const row of ordersR.rows) {
      const itemsR = await pool.query(
        `SELECT oi.product_id, oi.seller_id, oi.price, oi.quantity, p.title
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1`,
        [row.id]
      );
      orders.push({
        orderId: row.id,
        status: row.status,
        total: Number(row.total),
        createdAt: row.created_at,
        items: itemsR.rows.map((i) => ({
          productId: i.product_id,
          sellerId: i.seller_id,
          title: i.title,
          price: Number(i.price),
          quantity: i.quantity,
        })),
      });
    }

    return res.status(200).json({ total, page, limit, orders });
  } catch (err) {
    console.error('[listOrders]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * Crea una orden de un solo producto (flujo simplificado de compra directa).
 * Usado desde purchases.controller.
 */
async function createOrderForProduct(client, { userId, productId, sellerId, price, quantity = 1 }) {
  const total = Number(price) * quantity;
  const orderIns = await client.query(
    `INSERT INTO orders (user_id, status, total)
     VALUES ($1, 'entregada', $2)
     RETURNING id`,
    [userId, total]
  );
  const orderId = orderIns.rows[0].id;
  await client.query(
    `INSERT INTO order_items (order_id, product_id, seller_id, price, quantity)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, productId, sellerId, price, quantity]
  );
  return { orderId, total };
}

module.exports = { listOrders, createOrderForProduct };
