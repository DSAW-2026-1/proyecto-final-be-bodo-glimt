const pool = require('../config/db');

async function createReview(req, res) {
  const reviewerId = req.user.id;
  const { id: sellerId } = req.params;
  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 0 || r > 5) return res.status(400).json({ error: 'Rating inválido' });
  if (sellerId === reviewerId) return res.status(400).json({ error: 'No puedes reseñarte a ti mismo' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE id = $1', [sellerId]);
    if (!exists.rowCount) return res.status(404).json({ error: 'Vendedor no encontrado' });

    const ins = await pool.query(
      `INSERT INTO reviews (reviewer_id, seller_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, reviewer_id, seller_id, rating, comment, created_at`,
      [reviewerId, sellerId, r, comment || null]
    );

    return res.status(201).json({ review: ins.rows[0] });
  } catch (err) {
    console.error('[createReview]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getReviews(req, res) {
  const { id: sellerId } = req.params;
  try {
    const rows = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.id AS reviewer_id, u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.seller_id = $1
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [sellerId]
    );

    const avg = await pool.query('SELECT AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*)::int AS total FROM reviews WHERE seller_id = $1', [sellerId]);

    return res.status(200).json({ reviews: rows.rows, average: avg.rows[0].avg_rating ? Number(avg.rows[0].avg_rating) : null, total: avg.rows[0].total });
  } catch (err) {
    console.error('[getReviews]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { createReview, getReviews };
