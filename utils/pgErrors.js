/**
 * Mapea errores de node-postgres a respuestas HTTP comprensibles.
 */
function unwrapDriverError(err) {
  if (!err) return err;
  if (err.errors && err.errors[0]) return err.errors[0];
  if (err.cause && err.cause.code) return err.cause;
  return err;
}

function mapPgError(err) {
  const e = unwrapDriverError(err);
  const code = e && e.code;

  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return {
      status: 503,
      message:
        'No hay conexión con PostgreSQL. Inicia el motor (servicio local o Docker), revisa DB_HOST/DB_PORT en .env y vuelve a intentar.',
    };
  }
  if (code === '28P01') {
    return {
      status: 503,
      message:
        'PostgreSQL rechazó el usuario o la contraseña. Revisa DB_USER y DB_PASSWORD en tu archivo .env.',
    };
  }
  if (code === '3D000') {
    return {
      status: 503,
      message:
        'La base de datos indicada en DB_NAME no existe. Créala en PostgreSQL o cambia DB_NAME en .env.',
    };
  }
  if (code === '42P01') {
    return {
      status: 503,
      message:
        'Las tablas no existen. En la carpeta del proyecto ejecuta: npm run db:init',
    };
  }
  if (code === '23505') {
    return { status: 409, message: 'Correo ya registrado' };
  }

  return null;
}

function sendPgOr500(res, err, logPrefix) {
  const mapped = mapPgError(err);
  if (mapped) {
    console.error(logPrefix, unwrapDriverError(err).code || '', unwrapDriverError(err).message || err.message);
    return res.status(mapped.status).json({ error: mapped.message });
  }
  console.error(logPrefix, err);
  const detail =
    process.env.NODE_ENV === 'development' && err.message ? err.message : 'Error interno del servidor';
  return res.status(500).json({ error: detail });
}

module.exports = { mapPgError, sendPgOr500, unwrapDriverError };
