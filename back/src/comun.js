// Utilidades compartidas del Nivel 2: transacciones, avisos, conducta y fechas
const db = require('./db');
const { HttpError } = require('./errors');

// Ejecuta fn(conn) dentro de una transacción; deshace todo si algo falla
async function transaccion(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

// Id numérico de la URL
function idParam(v, campo = 'id') {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${campo} inválido`);
  return n;
}

// ---------- Avisos ----------
// destino: id de usuario, lista de ids, o { roles: ['ADMINISTRADOR', ...] }
async function notificar(conn, destino, tipo, titulo, mensaje) {
  let ids;
  if (Array.isArray(destino)) ids = destino;
  else if (typeof destino === 'number') ids = [destino];
  else {
    const [rows] = await conn.query('SELECT id FROM usuarios WHERE activo = 1 AND rol IN (?)', [destino.roles]);
    ids = rows.map((r) => r.id);
  }
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return;
  await conn.query(
    'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje) VALUES ?',
    [ids.map((id) => [id, tipo, titulo.slice(0, 120), mensaje.slice(0, 500)])],
  );
}

// ---------- Buena conducta y avatares ----------
// Los avatares se desbloquean al alcanzar estos puntos (mismos 5 niveles del diseño)
const AVATARES = [
  { nivel: 1, nombre: 'Aprendiz', medalla: 'Bronce', puntos: 0 },
  { nivel: 2, nombre: 'Asistente', medalla: 'Plata', puntos: 5 },
  { nivel: 3, nombre: 'Técnico', medalla: 'Oro', puntos: 10 },
  { nivel: 4, nombre: 'Investigador', medalla: 'Rubí', puntos: 20 },
  { nivel: 5, nombre: 'Director de laboratorio', medalla: 'Platino', puntos: 35 },
];

const nivelPorPuntos = (p) => AVATARES.filter((a) => p >= a.puntos).pop()?.nivel || 1;

// Suma (+1) o resta (-1) puntos y deja el registro del motivo
async function aplicarConducta(conn, usuarioIds, delta, motivo, origen, origenId, registradoPor) {
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  if (!ids.length) return;
  await conn.query(
    'INSERT INTO conducta_eventos (usuario_id, delta, motivo, origen, origen_id, registrado_por) VALUES ?',
    [ids.map((id) => [id, delta, motivo.slice(0, 150), origen, origenId, registradoPor])],
  );
  await conn.query('UPDATE usuarios SET puntos_conducta = puntos_conducta + ? WHERE id IN (?)', [delta, ids]);
}

// ---------- Fechas (hora local del servidor) ----------
const dosDigitos = (n) => String(n).padStart(2, '0');
function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}
function fechaHoraLocal(d = new Date()) {
  return `${fechaLocal(d)} ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}:${dosDigitos(d.getSeconds())}`;
}
function sumarDias(fechaTxt, dias) {
  const d = new Date(`${fechaTxt}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}
// Días completos entre hoy y una fecha YYYY-MM-DD
function diasHasta(fechaTxt) {
  const hoy = new Date(`${fechaLocal()}T00:00:00`);
  return Math.round((new Date(`${fechaTxt}T00:00:00`) - hoy) / 86400000);
}

module.exports = {
  transaccion, idParam, notificar, AVATARES, nivelPorPuntos, aplicarConducta,
  fechaLocal, fechaHoraLocal, sumarDias, diasHasta,
};
