// Contador de buena conducta y avatares desbloqueables (profesores y alumnos)
const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, LAB } = require('../auth');
const { idParam, AVATARES, nivelPorPuntos } = require('../comun');

const router = express.Router();
const conContador = requiereRol('profesor', 'alumno');

async function resumen(usuarioId) {
  const [[u]] = await db.query('SELECT id, nombre, LOWER(rol) AS rol, puntos_conducta, avatar FROM usuarios WHERE id = ?', [usuarioId]);
  if (!u || !['profesor', 'alumno'].includes(u.rol)) throw new HttpError(404, 'Este usuario no tiene contador de conducta');
  const desbloqueado = nivelPorPuntos(u.puntos_conducta);
  const siguiente = AVATARES.find((a) => a.nivel === desbloqueado + 1);
  const [eventos] = await db.query(
    'SELECT id, delta, motivo, origen, origen_id, fecha FROM conducta_eventos WHERE usuario_id = ? ORDER BY fecha DESC, id DESC LIMIT 100',
    [usuarioId],
  );
  return {
    usuario_id: u.id, nombre: u.nombre, rol: u.rol, puntos: u.puntos_conducta,
    // Si los puntos bajan, el avatar elegido se ajusta al nivel que sigue desbloqueado
    avatar: Math.min(u.avatar, desbloqueado),
    nivel_desbloqueado: desbloqueado,
    siguiente: siguiente ? { ...siguiente, faltan: siguiente.puntos - u.puntos_conducta } : null,
    avatares: AVATARES.map((a) => ({ ...a, imagen: `assets/avatares/nivel-${a.nivel}.svg`, desbloqueado: a.nivel <= desbloqueado })),
    eventos,
  };
}

router.get('/', conContador, async (req, res) => res.json({ data: await resumen(req.usuario.id) }));

router.put('/avatar', conContador, async (req, res) => {
  const nivel = Number(req.body?.nivel);
  if (!AVATARES.some((a) => a.nivel === nivel)) throw new HttpError(400, 'Avatar inválido (1 a 5)');
  const [[u]] = await db.query('SELECT puntos_conducta FROM usuarios WHERE id = ?', [req.usuario.id]);
  const req2 = AVATARES.find((a) => a.nivel === nivel);
  if (nivel > nivelPorPuntos(u.puntos_conducta)) throw new HttpError(403, `Este avatar se desbloquea con ${req2.puntos} puntos de buena conducta`);
  await db.query('UPDATE usuarios SET avatar = ? WHERE id = ?', [nivel, req.usuario.id]);
  res.json({ data: await resumen(req.usuario.id) });
});

// Laboratorio y administración consultan el contador de cualquier profesor o alumno
router.get('/:usuarioId', requiereRol(...LAB), async (req, res) => {
  res.json({ data: await resumen(idParam(req.params.usuarioId, 'usuario')) });
});

module.exports = router;
