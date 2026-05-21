const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const productsRoutes = require('./routes/products.routes');
const conversationsRoutes = require('./routes/conversations.routes');
const purchasesRoutes = require('./routes/purchases.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sabana-market', tickets: 'TKT-14–TKT-20' });
});

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/products', productsRoutes);
app.use('/conversations', conversationsRoutes);
app.use('/purchases', purchasesRoutes);
app.use('/users', reviewsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

const pool = require('./config/db');
const { mapPgError, unwrapDriverError } = require('./utils/pgErrors');

app.listen(PORT, () => {
  console.log(`Sabana Market API http://localhost:${PORT}`);
  pool
    .query('SELECT 1')
    .then(() => console.log('Base de datos: conexión OK'))
    .catch((err) => {
      const m = mapPgError(err);
      const e = unwrapDriverError(err);
      console.error('Base de datos:', m ? m.message : e.message || err.message);
    });
});
