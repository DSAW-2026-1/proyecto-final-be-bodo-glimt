function getJwtSecret() {
  const secret = process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.error('[JWT] JWT_SECRET no está configurado en el servidor. Los tokens fallarán.');
  }
  return 'sabana-market-dev-secret-no-usar-en-produccion';
}

module.exports = { getJwtSecret };
