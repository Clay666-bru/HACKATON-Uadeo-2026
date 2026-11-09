const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, LAB } = require('../auth');
const { estadoMaterial, estadoEquipo } = require('../estado');
const { texto, fecha } = require('../validacion');

const router = express.Router();

// Motivos válidos por tipo (mismas reglas que los CHECK de la base de datos)
const MOTIVOS = {
  material: {
    ENTRADA: ['COMPRA', 'DONACION', 'DEVOLUCION', 'AJUSTE'],
    SALIDA: ['PRACTICA', 'CADUCIDAD', 'DANO', 'AJUSTE'],
  },
  equipo: {
    ENTRADA: ['COMPRA', 'DONACION', 'DEVOLUCION_PRESTAMO', 'REGRESO_MANTENIMIENTO', 'AJUSTE'],
    SALIDA: ['PRESTAMO', 'MANTENIMIENTO', 'BAJA', 'AJUSTE'],
  },
};
const CONDICIONES = ['BUENA', 'CON_DETALLES', 'DANADO'];

router.get('/motivos', requiereRol(...LAB), (_req, res) => res.json({ data: { ...MOTIVOS, condiciones: CONDICIONES } }));

function validarBase(body, clase) {
  const tipo = String(body.tipo || '').toUpperCase();
  const motivo = String(body.motivo || '').toUpperCase();
  if (!MOTIVOS[clase][tipo]) throw new HttpError(400, 'El tipo debe ser ENTRADA o SALIDA');
  if (!MOTIVOS[clase][tipo].includes(motivo)) {
    throw new HttpError(400, `Motivo inválido para ${tipo}. Opciones: ${MOTIVOS[clase][tipo].join(', ')}`);
  }
  const cantidad = Number(body.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new HttpError(400, 'La cantidad debe ser mayor a 0');
  return { tipo, motivo, cantidad };
}

async function obtenerActivo(tabla, id) {
  const [rows] = await db.query(`SELECT * FROM ${tabla} WHERE id = ?`, [Number(id) || 0]);
  if (!rows.length) throw new HttpError(404, 'El artículo no existe');
  if (!rows[0].activo) throw new HttpError(409, 'El artículo está dado de baja');
  return rows[0];
}

// Solo el usuario de laboratorio registra entradas y salidas.
// El stock lo actualizan los triggers de la base de datos.
router.post('/materiales', requiereRol(...LAB), async (req, res) => {
  const b = req.body || {};
  const { tipo, motivo, cantidad } = validarBase(b, 'material');
  const mat = await obtenerActivo('materiales', b.material_id);
  if (mat.unidad === 'pza' && !Number.isInteger(cantidad)) throw new HttpError(400, 'Las piezas deben ser un número entero');
  const solicitante = texto(b.solicitante, 100);
  if (tipo === 'SALIDA' && !solicitante) throw new HttpError(400, 'En una salida indica quién solicita el material');
  if (tipo === 'SALIDA' && cantidad > mat.stock) {
    throw new HttpError(409, `STOCK INSUFICIENTE: hay ${mat.stock} ${mat.unidad} y se piden ${cantidad}`);
  }
  const esEntrada = tipo === 'ENTRADA';

  const [r] = await db.query(
    `INSERT INTO movimientos_materiales
      (material_id, tipo, cantidad, motivo, proveedor, factura, lote, fecha_caducidad,
       solicitante, grupo, practica, responsable, observaciones)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [mat.id, tipo, cantidad, motivo,
      esEntrada ? texto(b.proveedor, 120) : null,
      esEntrada ? texto(b.factura, 40) : null,
      esEntrada ? texto(b.lote, 40) : null,
      esEntrada ? fecha(b.fecha_caducidad) : null,
      solicitante, null, null, // grupo y práctica: no se usan en el control de inventario
      req.usuario.nombre, texto(b.observaciones, 255)],
  );
  const [[actual]] = await db.query('SELECT * FROM materiales WHERE id = ?', [mat.id]);
  res.status(201).json({ data: { movimiento_id: r.insertId, material: estadoMaterial(actual) } });
});

router.post('/equipos', requiereRol(...LAB), async (req, res) => {
  const b = req.body || {};
  const { tipo, motivo, cantidad } = validarBase(b, 'equipo');
  if (!Number.isInteger(cantidad)) throw new HttpError(400, 'La cantidad de equipos debe ser un número entero');
  const eq = await obtenerActivo('equipos', b.equipo_id);
  const persona = texto(b.persona, 100);
  if (tipo === 'SALIDA' && !persona) throw new HttpError(400, 'En una salida indica la persona que recibe el equipo');
  const condicion = b.condicion ? String(b.condicion).toUpperCase() : null;
  if (condicion && !CONDICIONES.includes(condicion)) throw new HttpError(400, 'Condición inválida');
  const esEntrada = tipo === 'ENTRADA';

  const [r] = await db.query(
    `INSERT INTO movimientos_equipos
      (equipo_id, tipo, cantidad, motivo, persona, proveedor, factura, condicion,
       grupo, practica, devolucion_esperada, responsable, observaciones)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [eq.id, tipo, cantidad, motivo, persona,
      esEntrada ? texto(b.proveedor, 120) : null,
      esEntrada ? texto(b.factura, 40) : null,
      condicion, null, null, // grupo y práctica: no se usan en el control de inventario
      motivo === 'PRESTAMO' ? fecha(b.devolucion_esperada, true) : null,
      req.usuario.nombre, texto(b.observaciones, 255)],
  );
  const [[actual]] = await db.query('SELECT * FROM equipos WHERE id = ?', [eq.id]);
  res.status(201).json({ data: { movimiento_id: r.insertId, equipo: estadoEquipo(actual) } });
});

// Historial combinado de materiales y equipos, más reciente primero (solo laboratorio y coordinación)
router.get('/', requiereRol(...LAB), async (req, res) => {
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 100, 1), 500);
  const clase = String(req.query.clase || '').toLowerCase();
  const tipo = String(req.query.tipo || '').toUpperCase();
  const filtroTipo = ['ENTRADA', 'SALIDA'].includes(tipo) ? ' AND mv.tipo = ?' : '';
  const partes = [];
  const params = [];

  if (clase !== 'equipo') {
    partes.push(`SELECT 'material' AS clase, mv.id, mv.fecha_hora, mv.tipo, mv.cantidad, mv.motivo,
        m.codigo, m.nombre, m.unidad, mv.solicitante AS persona, mv.proveedor, mv.responsable, mv.observaciones
      FROM movimientos_materiales mv JOIN materiales m ON m.id = mv.material_id WHERE 1=1${filtroTipo}`);
    if (filtroTipo) params.push(tipo);
  }
  if (clase !== 'material') {
    partes.push(`SELECT 'equipo' AS clase, mv.id, mv.fecha_hora, mv.tipo, mv.cantidad, mv.motivo,
        e.codigo, e.nombre, 'pza' AS unidad, mv.persona, mv.proveedor, mv.responsable, mv.observaciones
      FROM movimientos_equipos mv JOIN equipos e ON e.id = mv.equipo_id WHERE 1=1${filtroTipo}`);
    if (filtroTipo) params.push(tipo);
  }
  const [rows] = await db.query(
    `${partes.join(' UNION ALL ')} ORDER BY fecha_hora DESC, id DESC LIMIT ?`,
    [...params, limite],
  );
  res.json({ data: rows });
});

module.exports = router;
