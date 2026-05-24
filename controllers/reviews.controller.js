const pool = require('../config/db');
const { paginate } = require('../utils/paginate');

/**
 * TKT-19: Dejar reseña a vendedor (orden entregada).
 * POST /reviews  { sellerId, orderId, rating, comment? }
 */
async function createReview(req, res) {
  const buyerId = req.user.id;
  const { sellerId, orderId, rating, comment } = req.body || {};
  const r = Number(rating);

  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Rating 1-5' });
  }
  if (!sellerId || !orderId) {
    return res.status(400).json({ error: 'Campos requeridos' });
  }
  if (String(sellerId) === String(buyerId)) {
    return res.status(400).json({ error: 'No puedes reseñarte a ti mismo' });
  }

  try {
    const delivered = await pool.query(
      `SELECT 1
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2 AND oi.seller_id = $3 AND o.status = 'entregada'
       LIMIT 1`,
      [orderId, buyerId, sellerId]
    );
    if (!delivered.rowCount) {
      return res.status(403).json({ error: 'Sin compra entregada' });
    }

    const dup = await pool.query(
      'SELECT id FROM reviews WHERE seller_id = $1 AND reviewer_id = $2 AND order_id = $3',
      [sellerId, buyerId, orderId]
    );
    if (dup.rowCount) return res.status(409).json({ error: 'Reseña ya existe' });

    const ins = await pool.query(
      `INSERT INTO reviews (reviewer_id, seller_id, order_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, seller_id, rating, created_at`,
      [buyerId, sellerId, orderId, r, comment || null]
    );
    const row = ins.rows[0];

    const avg = await pool.query(
      'SELECT AVG(rating)::numeric(3,2) AS avg FROM reviews WHERE seller_id = $1',
      [sellerId]
    );
    if (avg.rows[0].avg != null) {
      await pool.query('UPDATE users SET reputation = $1, updated_at = NOW() WHERE id = $2', [
        avg.rows[0].avg,
        sellerId,
      ]);
    }

    return res.status(201).json({
      reviewId: row.id,
      sellerId: row.seller_id,
      rating: row.rating,
      createdAt: row.created_at,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Reseña ya existe' });
    console.error('[createReview]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * TKT-20: Ver reseñas y promedio de un vendedor.
 * GET /reviews?sellerId=uuid
 */
async function listReviewsBySeller(req, res) {
  const sellerId = req.query.sellerId;
  if (!sellerId) return res.status(400).json({ error: 'sellerId requerido' });

  const { page, limit, offset } = paginate(req.query);

  try {
    const stats = await pool.query(
      `SELECT COALESCE(AVG(rating), 0)::numeric(3,1) AS avg, COUNT(*)::int AS total
       FROM reviews WHERE seller_id = $1`,
      [sellerId]
    );

    const rows = await pool.query(
      `SELECT r.rating, r.comment, u.name AS "buyerName", r.created_at AS "createdAt"
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.seller_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [sellerId, limit, offset]
    );

    return res.status(200).json({
      averageRating: Number(stats.rows[0].avg),
      totalReviews: stats.rows[0].total,
      page,
      limit,
      reviews: rows.rows,
    });
  } catch (err) {
    console.error('[listReviewsBySeller]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/** Compatibilidad: POST /users/:id/reviews */
async function createReviewLegacy(req, res) {
  req.body = {
    sellerId: req.params.id,
    orderId: req.body?.orderId,
    rating: req.body?.rating,
    comment: req.body?.comment,
  };
  if (!req.body.orderId) {
    const last = await pool.query(
      `SELECT o.id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1 AND oi.seller_id = $2 AND o.status = 'entregada'
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [req.user.id, req.params.id]
    );
    if (!last.rowCount) return res.status(403).json({ error: 'Sin compra entregada' });
    req.body.orderId = last.rows[0].id;
  }
  return createReview(req, res);
}

/** Compatibilidad: GET /users/:id/reviews */
async function getReviewsLegacy(req, res) {
  const sellerId = req.params.id;
  const { limit, offset } = paginate(req.query);

  try {
    const stats = await pool.query(
      `SELECT COALESCE(AVG(rating), 0)::numeric(3,2) AS avg, COUNT(*)::int AS total
       FROM reviews WHERE seller_id = $1`,
      [sellerId]
    );

    const rows = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.id AS reviewer_id, u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.seller_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [sellerId, limit, offset]
    );

    const avg = stats.rows[0].avg;
    return res.status(200).json({
      reviews: rows.rows,
      average: avg != null && Number(stats.rows[0].total) > 0 ? Number(avg) : null,
      total: stats.rows[0].total,
      averageRating: Number(stats.rows[0].avg),
      totalReviews: stats.rows[0].total,
    });
  } catch (err) {
    console.error('[getReviewsLegacy]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  createReview,
  listReviewsBySeller,
  createReviewLegacy,
  getReviewsLegacy,
};
