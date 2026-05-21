const pool = require('../config/db');

async function createConversation(req, res) {
  const buyerId = req.user.id;
  const { sellerId, productId } = req.body || {};
  if (!sellerId) return res.status(400).json({ error: 'sellerId requerido' });
  if (sellerId === buyerId) return res.status(400).json({ error: 'No puedes iniciar conversación contigo mismo' });

  try {
    // Check if users exist
    const users = await pool.query('SELECT id FROM users WHERE id = ANY($1::uuid[])', [[buyerId, sellerId]]);
    if (users.rowCount < 2) return res.status(404).json({ error: 'Usuario(s) no encontrado(s)' });

    // If conversation exists for same buyer/seller/product, return it
    const existsSql = `SELECT id FROM conversations WHERE buyer_id = $1 AND seller_id = $2 AND ((product_id IS NULL AND $3 IS NULL) OR product_id = $3) LIMIT 1`;
    const ex = await pool.query(existsSql, [buyerId, sellerId, productId || null]);
    if (ex.rowCount) return res.status(200).json({ conversation: { id: ex.rows[0].id } });

    const ins = await pool.query(
      `INSERT INTO conversations (buyer_id, seller_id, product_id) VALUES ($1, $2, $3) RETURNING id, buyer_id, seller_id, product_id, created_at`,
      [buyerId, sellerId, productId || null]
    );
    return res.status(201).json({ conversation: ins.rows[0] });
  } catch (err) {
    console.error('[createConversation]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listConversations(req, res) {
  const uid = req.user.id;
  try {
    const rows = await pool.query(
      `SELECT c.id, c.buyer_id, c.seller_id, c.product_id, c.created_at,
              (SELECT jsonb_build_object('id', m.sender_id, 'text', m.text, 'createdAt', m.created_at)
               FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM conversations c
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY GREATEST(COALESCE((SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id), c.created_at)) DESC
       LIMIT 200`,
      [uid]
    );
    return res.status(200).json({ conversations: rows.rows });
  } catch (err) {
    console.error('[listConversations]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listMessages(req, res) {
  const uid = req.user.id;
  const { id } = req.params;
  try {
    const conv = await pool.query('SELECT buyer_id, seller_id FROM conversations WHERE id = $1', [id]);
    if (!conv.rowCount) return res.status(404).json({ error: 'Conversación no encontrada' });
    const c = conv.rows[0];
    if (c.buyer_id !== uid && c.seller_id !== uid) return res.status(403).json({ error: 'Sin permiso' });

    const msgs = await pool.query('SELECT id, sender_id, text, read, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [id]);
    return res.status(200).json({ messages: msgs.rows });
  } catch (err) {
    console.error('[listMessages]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function sendMessage(req, res) {
  const uid = req.user.id;
  const { id } = req.params; // conversation id
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Texto requerido' });
  try {
    const conv = await pool.query('SELECT buyer_id, seller_id FROM conversations WHERE id = $1', [id]);
    if (!conv.rowCount) return res.status(404).json({ error: 'Conversación no encontrada' });
    const c = conv.rows[0];
    if (c.buyer_id !== uid && c.seller_id !== uid) return res.status(403).json({ error: 'Sin permiso' });

    const ins = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text) VALUES ($1, $2, $3) RETURNING id, sender_id, text, read, created_at`,
      [id, uid, String(text).trim()]
    );

    // update conversation updated_at
    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);

    return res.status(201).json({ message: ins.rows[0] });
  } catch (err) {
    console.error('[sendMessage]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { createConversation, listConversations, listMessages, sendMessage };
