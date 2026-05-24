const pool = require('../config/db');
const { paginate } = require('../utils/paginate');

/**
 * TKT-15: Crear o reutilizar conversación comprador–vendedor por producto.
 * POST /conversations  { productId }  o  { sellerId, productId? }
 */
async function createConversation(req, res) {
  const buyerId = req.user.id;
  let { productId, sellerId } = req.body || {};

  try {
    if (productId) {
      const p = await pool.query(
        'SELECT id, seller_id, active FROM products WHERE id = $1',
        [productId]
      );
      if (!p.rowCount) return res.status(404).json({ error: 'Producto no disponible' });
      if (!p.rows[0].active) return res.status(404).json({ error: 'Producto no disponible' });
      sellerId = p.rows[0].seller_id;
    }

    if (!sellerId) return res.status(400).json({ error: 'productId o sellerId requerido' });
    if (String(sellerId) === String(buyerId)) {
      return res.status(400).json({ error: 'Auto-conversación' });
    }

    const users = await pool.query('SELECT id FROM users WHERE id = $1 OR id = $2', [buyerId, sellerId]);
    if (users.rowCount < 2) return res.status(404).json({ error: 'Usuario(s) no encontrado(s)' });

    const ex = await pool.query(
      `SELECT id, product_id, buyer_id, seller_id, created_at
       FROM conversations
       WHERE buyer_id = $1 AND seller_id = $2
         AND (($3::uuid IS NULL AND product_id IS NULL) OR product_id = $3)
       LIMIT 1`,
      [buyerId, sellerId, productId || null]
    );

    if (ex.rowCount) {
      const row = ex.rows[0];
      return res.status(200).json({
        existing: true,
        conversationId: row.id,
        productId: row.product_id,
        buyerId: row.buyer_id,
        sellerId: row.seller_id,
        createdAt: row.created_at,
        conversation: { id: row.id },
      });
    }

    const ins = await pool.query(
      `INSERT INTO conversations (buyer_id, seller_id, product_id)
       VALUES ($1, $2, $3)
       RETURNING id, product_id, buyer_id, seller_id, created_at`,
      [buyerId, sellerId, productId || null]
    );
    const row = ins.rows[0];
    return res.status(201).json({
      conversationId: row.id,
      productId: row.product_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      createdAt: row.created_at,
      conversation: row,
    });
  } catch (err) {
    console.error('[createConversation]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * TKT-18: Listar conversaciones del usuario con resumen.
 * GET /conversations
 */
async function listConversations(req, res) {
  const uid = req.user.id;
  try {
    const rows = await pool.query(
      `SELECT c.id AS "conversationId",
              CASE WHEN c.buyer_id = $1 THEN su.name ELSE bu.name END AS "otherUser",
              p.title AS "productTitle",
              c.product_id AS "productId",
              lm.content AS "lastMessage",
              lm.sent_at AS "lastMessageAt",
              c.buyer_id,
              c.seller_id,
              c.created_at
       FROM conversations c
       JOIN users bu ON bu.id = c.buyer_id
       JOIN users su ON su.id = c.seller_id
       LEFT JOIN products p ON p.id = c.product_id
       LEFT JOIN LATERAL (
         SELECT text AS content, created_at AS sent_at
         FROM messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC
         LIMIT 1
       ) lm ON TRUE
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY COALESCE(lm.sent_at, c.updated_at, c.created_at) DESC`,
      [uid]
    );

    const conversations = rows.rows.map((r) => ({
      conversationId: r.conversationId,
      id: r.conversationId,
      otherUser: r.otherUser,
      productTitle: r.productTitle,
      productId: r.productId,
      lastMessage: r.lastMessage || '',
      lastMessageAt: r.lastMessageAt,
      last_message: r.lastMessage ? { text: r.lastMessage } : null,
    }));

    return res.status(200).json({ conversations });
  } catch (err) {
    console.error('[listConversations]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function ensureParticipant(conversationId, userId) {
  const conv = await pool.query(
    'SELECT id, buyer_id, seller_id FROM conversations WHERE id = $1',
    [conversationId]
  );
  if (!conv.rowCount) return null;
  const c = conv.rows[0];
  if (String(c.buyer_id) !== String(userId) && String(c.seller_id) !== String(userId)) {
    return false;
  }
  return c;
}

/**
 * TKT-17: Listar mensajes de una conversación (paginado, ASC).
 * GET /conversations/:id/messages
 */
async function listMessages(req, res) {
  const uid = req.user.id;
  const { id } = req.params;
  const { page, limit, offset } = paginate(req.query, { page: 1, limit: 50 });

  try {
    const c = await ensureParticipant(id, uid);
    if (c === false) return res.status(403).json({ error: 'Acceso denegado' });
    if (!c) return res.status(404).json({ error: 'Conversación no encontrada' });

    const msgs = await pool.query(
      `SELECT id AS "messageId", sender_id AS "senderId", text AS content, created_at AS "sentAt"
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const messages = msgs.rows.map((m) => ({
      ...m,
      text: m.content,
      created_at: m.sentAt,
      sender_id: m.senderId,
      id: m.messageId,
    }));

    return res.status(200).json({ conversationId: id, page, limit, messages });
  } catch (err) {
    console.error('[listMessages]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * TKT-16: Enviar mensaje en conversación.
 * POST /conversations/:id/messages  { content } o { text }
 */
async function sendMessage(req, res) {
  const uid = req.user.id;
  const { id } = req.params;
  const raw = req.body?.content ?? req.body?.text;
  const text = raw != null ? String(raw).trim() : '';
  if (!text) return res.status(400).json({ error: 'Mensaje vacío' });

  try {
    const c = await ensureParticipant(id, uid);
    if (c === false) return res.status(403).json({ error: 'No participante' });
    if (!c) return res.status(404).json({ error: 'Conversación no encontrada' });

    const ins = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, text, created_at`,
      [id, uid, text]
    );
    const m = ins.rows[0];

    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);

    return res.status(201).json({
      messageId: m.id,
      senderId: m.sender_id,
      content: m.text,
      sentAt: m.created_at,
      message: m,
    });
  } catch (err) {
    console.error('[sendMessage]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { createConversation, listConversations, listMessages, sendMessage };
