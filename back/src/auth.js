const crypto = require('crypto');
const { HttpError } = require('./errors');

const ROLES = ['profesor', 'administrador', 'laboratorio', 'alumno'];
const DURACION_HORAS = Number(process.env.SESION_HORAS || 10);

// Secreto para firmar los tokens. Si no está en .env se genera uno al arrancar
// (las sesiones se pierden al reiniciar el servidor).
let SECRETO = process.env.SESSION_SECRET;
if (!SECRETO || SECRETO.length < 16) {
  SECRETO = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] SESSION_SECRET no está definido en .env; se usa uno temporal.');
}

// ---------- Contraseñas (scrypt) ----------
function cifrarPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `scrypt$${sal}$${hash}`;
}

function verificarPassword(password, guardado) {
  const [alg, sal, hash] = String(guardado || '').split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const calculado = crypto.scryptSync(password, sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

// ---------- Token firmado (HMAC) ----------
const b64 = (s) => Buffer.from(s).toString('base64url');

function firmarToken(usuario) {
  const payload = b64(JSON.stringify({
    id: usuario.id, usuario: usuario.usuario, nombre: usuario.nombre,
    rol: usuario.rol, exp: Date.now() + DURACION_HORAS * 3600 * 1000,
  }));
  const firma = crypto.createHmac('sha256', SECRETO).update(payload).digest('base64url');
  return `${payload}.${firma}`;
}

function verificarToken(token) {
  const [payload, firma] = String(token || '').split('.');
  if (!payload || !firma) return null;
  const esperada = crypto.createHmac('sha256', SECRETO).update(payload).digest();
  const recibida = Buffer.from(firma, 'base64url');
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) return null;
  try {
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return datos.exp > Date.now() ? datos : null;
  } catch (_) {
    return null;
  }
}

// ---------- Middlewares ----------
// Con token válido: usuario verificado (laboratorista con contraseña).
// Sin token: profesor y administrador todavía entran solo con su nombre (Nivel 2 tendrá contraseña);
// esos usuarios solo pueden consultar.
function leerUsuario(req, _res, next) {
  const auth = req.get('Authorization') || '';
  const datos = auth.startsWith('Bearer ') ? verificarToken(auth.slice(7)) : null;
  if (datos) {
    req.usuario = { ...datos, verificado: true };
  } else {
    const rol = String(req.get('X-Rol') || '').toLowerCase();
    const nombre = decodeURIComponent(String(req.get('X-Usuario') || '')).trim();
    req.usuario = ['profesor', 'administrador'].includes(rol) && nombre ? { rol, nombre, verificado: false } : null;
  }
  next();
}

// Las acciones que modifican datos (y todo el Nivel 2) exigen sesión con contraseña
function requiereRol(...roles) {
  return (req, _res, next) => {
    if (!req.usuario?.verificado) return next(new HttpError(401, 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.'));
    if (!roles.includes(req.usuario.rol)) return next(new HttpError(403, 'Tu rol no tiene permiso para esta acción'));
    next();
  };
}

// Cualquier rol, pero con sesión verificada (usuario con contraseña)
const requiereSesion = requiereRol(...ROLES);

// Atajos de permisos del Nivel 2: el administrador puede hacer todo lo del laboratorista
const LAB = ['laboratorio', 'administrador'];

module.exports = { ROLES, LAB, requiereSesion, cifrarPassword, verificarPassword, firmarToken, leerUsuario, requiereRol };
