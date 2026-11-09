// Renta de batas: el alumno solicita, el laboratorista (o admin) acepta/rechaza y luego concluye
const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, requiereSesion, LAB } = require('../auth');
const { texto, opcion } = require('../validacion');
const { idParam, transaccion, notificar } = require('../comun');

const router = express.Router();
const ESTADOS = ['SOLICITADA', 'RECHAZADA', 'EN_RENTA', 'CONCLUIDA', 'CANCELADA'];

const SQL = `SELECT r.id, r.alumno_id, u.nombre AS alumno, a.matricula, g.nombre AS grupo, r.cantidad, r.talla, r.estado,
       r.solicitada, r.respondida, rp.nombre AS respondio, r.comentario, r.devuelta, rc.nombre AS recibio
  FROM rentas_batas r
  JOIN usuarios u ON u.id = r.alumno_id
  LEFT JOIN alumnos a ON a.usuario_id = r.alumno_id
  LEFT JOIN grupos g ON g.id = a.grupo_id
  LEFT JOIN usuarios rp ON rp.id = r.respondio_id
  LEFT JOIN usuarios rc ON rc.id = r.recibio_id`;

const obtener = async (id) => (await db.query(`${SQL} WHERE r.id = ?`, [id]))[0][0];

// Alumno: sus rentas. Laboratorio/admin: todas (filtro ?estado=)
router.get('/', requiereSesion, async (req, res) => {
  const where = [];
  const params = [];
  if (req.usuario.rol === 'alumno') { where.push('r.alumno_id = ?'); params.push(req.usuario.id); }
  else if (!LAB.includes(req.usuario.rol)) throw new HttpError(403, 'Tu rol no tiene permiso para esta acción');
  if (req.query.estado) { where.push('r.estado = ?'); params.push(opcion(req.query.estado, ESTADOS, 'Estado')); }
  const [rows] = await db.query(
    `${SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY FIELD(r.estado,'SOLICITADA','EN_RENTA') DESC, r.solicitada DESC LIMIT 500`,
    params,
  );
  res.json({ data: rows });
});

router.post('/', requiereRol('alumno'), async (req, res) => {
  const cantidad = Number(req.body?.cantidad ?? 1);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10) throw new HttpError(400, 'La cantidad debe ser de 1 a 10 batas');
  const talla = texto(req.body?.talla, 5, 'La talla');
  const id = await transaccion(async (conn) => {
    const [[activa]] = await conn.query(
      "SELECT id FROM rentas_batas WHERE alumno_id = ? AND estado IN ('SOLICITADA','EN_RENTA') LIMIT 1 FOR UPDATE",
      [req.usuario.id],
    );
    if (activa) throw new HttpError(409, 'Ya tienes una renta de bata pendiente o activa');
    const [r] = await conn.query('INSERT INTO rentas_batas (alumno_id, cantidad, talla) VALUES (?, ?, ?)', [req.usuario.id, cantidad, talla]);
    await notificar(conn, { roles: ['LABORATORIO'] }, 'BATA', 'Nueva solicitud de bata', `${req.usuario.nombre} solicita ${cantidad} bata(s).`);
    return r.insertId;
  });
  res.status(201).json({ data: await obtener(id) });
});

// Cambia de estado solo si sigue en el estado esperado: si el laboratorista ya respondió,
// el administrador recibe 409 con el estado actual (y viceversa).
async function cambiarEstado(id, desde, set, params) {
  const [r] = await db.query(`UPDATE rentas_batas SET ${set} WHERE id = ? AND estado = ?`, [...params, id, desde]);
  if (!r.affectedRows) {
    const actual = await obtener(id);
    if (!actual) throw new HttpError(404, 'La renta no existe');
    throw new HttpError(409, `Esta renta ya está ${actual.estado.replace('_', ' ').toLowerCase()}${actual.respondio ? ` (atendió ${actual.respondio})` : ''}`);
  }
  return obtener(id);
}

router.post('/:id/decision', requiereRol(...LAB), async (req, res) => {
  const id = idParam(req.params.id);
  const decision = opcion(req.body?.decision, ['ACEPTAR', 'RECHAZAR'], 'Decisión');
  const comentario = texto(req.body?.comentario, 255, 'El comentario');
  const estado = decision === 'ACEPTAR' ? 'EN_RENTA' : 'RECHAZADA';
  const renta = await cambiarEstado(id, 'SOLICITADA', 'estado = ?, respondida = NOW(), respondio_id = ?, comentario = ?', [estado, req.usuario.id, comentario]);
  await notificar(db, renta.alumno_id, 'BATA', decision === 'ACEPTAR' ? 'Bata en renta' : 'Solicitud de bata rechazada',
    decision === 'ACEPTAR' ? 'Tu renta de bata fue aceptada. Devuélvela al terminar.' : `Tu solicitud de bata fue rechazada.${comentario ? ' ' + comentario : ''}`);
  res.json({ data: renta });
});

// Al recibir la bata de vuelta se concluye la renta
router.post('/:id/concluir', requiereRol(...LAB), async (req, res) => {
  const renta = await cambiarEstado(idParam(req.params.id), 'EN_RENTA', 'estado = \'CONCLUIDA\', devuelta = NOW(), recibio_id = ?', [req.usuario.id]);
  res.json({ data: renta });
});

router.post('/:id/cancelar', requiereRol('alumno'), async (req, res) => {
  const id = idParam(req.params.id);
  const actual = await obtener(id);
  if (!actual || actual.alumno_id !== req.usuario.id) throw new HttpError(404, 'La renta no existe');
  res.json({ data: await cambiarEstado(id, 'SOLICITADA', 'estado = \'CANCELADA\'', []) });
});

module.exports = router;
