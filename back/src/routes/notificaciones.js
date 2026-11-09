// Avisos de cada usuario (solicitudes, decisiones, conducta y fin de semestre)
const express = require('express');
const db = require('../db');
const { requiereSesion } = require('../auth');
const { idParam } = require('../comun');

const router = express.Router();

router.get('/', requiereSesion, async (req, res) => {
  const soloNoLeidas = req.query.no_leidas ? ' AND leida = 0' : '';
  const [rows] = await db.query(
    `SELECT id, tipo, titulo, mensaje, leida, creada FROM notificaciones WHERE usuario_id = ?${soloNoLeidas} ORDER BY creada DESC, id DESC LIMIT 100`,
    [req.usuario.id],
  );
  const [[n]] = await db.query('SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND leida = 0', [req.usuario.id]);
  res.json({ data: rows, no_leidas: n.n });
});

router.post('/leidas', requiereSesion, async (req, res) => {
  await db.query('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0', [req.usuario.id]);
  res.json({ data: { ok: true } });
});

router.post('/:id/leida', requiereSesion, async (req, res) => {
  await db.query('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?', [idParam(req.params.id), req.usuario.id]);
  res.json({ data: { ok: true } });
});

module.exports = router;
