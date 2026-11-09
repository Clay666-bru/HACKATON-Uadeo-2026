// Manuales de laboratorio: por ahora solo la lista para elegir; el archivo se agregará después
const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, requiereSesion } = require('../auth');
const { textoRequerido, texto } = require('../validacion');
const { idParam } = require('../comun');

const router = express.Router();

router.get('/', requiereSesion, async (_req, res) => {
  const [rows] = await db.query('SELECT id, titulo, descripcion, archivo AS url, orden FROM manuales WHERE activo = 1 ORDER BY orden, titulo');
  // url queda en null hasta que se suba el manual
  res.json({ data: rows });
});

router.post('/', requiereRol('administrador'), async (req, res) => {
  const titulo = textoRequerido(req.body?.titulo, 150, 'El título');
  const [r] = await db.query(
    'INSERT INTO manuales (titulo, descripcion, orden) VALUES (?, ?, ?)',
    [titulo, texto(req.body?.descripcion, 255, 'La descripción'), Number(req.body?.orden) || 0],
  );
  res.status(201).json({ data: { id: r.insertId, titulo, url: null } });
});

router.delete('/:id', requiereRol('administrador'), async (req, res) => {
  const [r] = await db.query('UPDATE manuales SET activo = 0 WHERE id = ?', [idParam(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'El manual no existe');
  res.json({ data: { ok: true } });
});

module.exports = router;
