const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { verificarPassword, cifrarPassword, firmarToken, requiereSesion } = require('../auth');

const router = express.Router();

// Bloqueo simple contra fuerza bruta: 5 intentos fallidos => 5 minutos de espera por usuario
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;
const intentos = new Map(); // usuario -> { fallos, hasta }

router.post('/login', async (req, res) => {
  const usuario = String(req.body?.usuario || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!usuario || !password) throw new HttpError(400, 'Escribe tu usuario y contraseña');

  const reg = intentos.get(usuario);
  if (reg?.hasta > Date.now()) {
    const min = Math.ceil((reg.hasta - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos. Espera ${min} minuto(s).`);
  }

  const [rows] = await db.query(
    'SELECT id, usuario, nombre, password_hash, rol, activo FROM usuarios WHERE usuario = ?',
    [usuario],
  );
  const u = rows[0];
  // Mismo mensaje si el usuario no existe o la contraseña es incorrecta
  if (!u || !u.activo || !verificarPassword(password, u.password_hash)) {
    const fallos = (reg?.fallos || 0) + 1;
    intentos.set(usuario, fallos >= MAX_INTENTOS ? { fallos: 0, hasta: Date.now() + BLOQUEO_MS } : { fallos });
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  intentos.delete(usuario);

  const datos = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol.toLowerCase() };
  await db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [u.id]);
  res.json({ data: { token: firmarToken(datos), usuario: datos } });
});

// Perfil: datos de la sesión, conducta, avatar y (si es alumno) grupo y equipo
router.get('/yo', requiereSesion, async (req, res) => {
  const [[u]] = await db.query(
    `SELECT u.id, u.usuario, u.nombre, LOWER(u.rol) AS rol, u.puntos_conducta, u.avatar, u.ultimo_acceso, u.creado,
            a.matricula, a.grupo_id, g.nombre AS grupo, a.equipo_trabajo_id, et.nombre AS equipo_trabajo
       FROM usuarios u
       LEFT JOIN alumnos a ON a.usuario_id = u.id
       LEFT JOIN grupos g ON g.id = a.grupo_id
       LEFT JOIN equipos_trabajo et ON et.id = a.equipo_trabajo_id
      WHERE u.id = ? AND u.activo = 1`,
    [req.usuario.id],
  );
  if (!u) throw new HttpError(401, 'Tu usuario ya no está activo');
  res.json({ data: u });
});

router.post('/password', requiereSesion, async (req, res) => {
  const actual = String(req.body?.actual || '');
  const nueva = String(req.body?.nueva || '');
  if (nueva.length < 8) throw new HttpError(400, 'La contraseña nueva debe tener al menos 8 caracteres');
  const [[u]] = await db.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
  if (!u || !verificarPassword(actual, u.password_hash)) throw new HttpError(401, 'La contraseña actual no es correcta');
  await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [cifrarPassword(nueva), req.usuario.id]);
  res.json({ data: { ok: true } });
});

module.exports = router;
