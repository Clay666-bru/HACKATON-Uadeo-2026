const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { HttpError } = require('../errors');
const { estadoMaterial, estadoEquipo } = require('../estado');

const router = express.Router();

const COLS_MAT = 'id, codigo, nombre, tipo, unidad, stock, stock_minimo, fecha_caducidad, activo, creado';
const COLS_EQ = 'id, codigo, nombre, marca, modelo, numero_serie, cantidad, estado, ultimo_mantenimiento, proximo_mantenimiento, activo, creado';

function filtroBusqueda(req, campos) {
  const buscar = String(req.query.buscar || '').trim();
  if (!buscar) return { sql: '', params: [] };
  return {
    sql: ` AND (${campos.map((c) => `${c} LIKE ?`).join(' OR ')})`,
    params: campos.map(() => `%${buscar}%`),
  };
}

router.get('/materiales', async (req, res) => {
  const f = filtroBusqueda(req, ['codigo', 'nombre']);
  let sql = `SELECT ${COLS_MAT} FROM materiales WHERE activo = 1` + f.sql;
  const params = [...f.params];
  if (req.query.tipo) { sql += ' AND tipo = ?'; params.push(String(req.query.tipo).toUpperCase()); }
  const [rows] = await db.query(sql + ' ORDER BY codigo', params);
  res.json({ data: rows.map(estadoMaterial) });
});

router.get('/equipos', async (req, res) => {
  const f = filtroBusqueda(req, ['codigo', 'nombre', 'marca', 'modelo', 'numero_serie']);
  let sql = `SELECT ${COLS_EQ} FROM equipos WHERE activo = 1` + f.sql;
  const params = [...f.params];
  if (req.query.estado) { sql += ' AND estado = ?'; params.push(String(req.query.estado).toUpperCase()); }
  const [rows] = await db.query(sql + ' ORDER BY codigo', params);
  res.json({ data: rows.map(estadoEquipo) });
});

// Busca un artículo por el código leído del QR (sirve para materiales y equipos)
async function buscarPorCodigo(codigo) {
  const [mat] = await db.query(`SELECT ${COLS_MAT} FROM materiales WHERE codigo = ?`, [codigo]);
  if (mat.length) return { clase: 'material', item: estadoMaterial(mat[0]) };
  const [eq] = await db.query(`SELECT ${COLS_EQ} FROM equipos WHERE codigo = ?`, [codigo]);
  if (eq.length) return { clase: 'equipo', item: estadoEquipo(eq[0]) };
  return null;
}

router.get('/codigo/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo).trim().toUpperCase();
  const encontrado = await buscarPorCodigo(codigo);
  if (!encontrado) throw new HttpError(404, `El código ${codigo} no está registrado en el inventario`);
  res.json({ data: encontrado });
});

// Etiqueta QR (PNG) con el código del artículo
router.get('/qr/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo).trim().toUpperCase();
  if (!(await buscarPorCodigo(codigo))) throw new HttpError(404, `El código ${codigo} no está registrado`);
  const png = await QRCode.toBuffer(codigo, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  res.type('png').set('Cache-Control', 'public, max-age=86400').send(png);
});

router.get('/alertas', async (_req, res) => {
  const [mats] = await db.query(`SELECT ${COLS_MAT} FROM materiales WHERE activo = 1`);
  const [eqs] = await db.query(`SELECT ${COLS_EQ} FROM equipos WHERE activo = 1`);
  const alertas = [];
  for (const m of mats.map(estadoMaterial)) {
    for (const a of m.avisos) alertas.push({ ...a, clase: 'material', codigo: m.codigo, nombre: m.nombre });
  }
  for (const e of eqs.map(estadoEquipo)) {
    for (const a of e.avisos) alertas.push({ ...a, clase: 'equipo', codigo: e.codigo, nombre: e.nombre });
  }
  alertas.sort((a, b) => (a.prioridad === b.prioridad ? 0 : a.prioridad === 'alta' ? -1 : 1));
  res.json({ data: alertas });
});

router.get('/resumen', async (_req, res) => {
  const [[mat]] = await db.query(`SELECT COUNT(*) total,
      SUM(tipo = 'REACTIVO') reactivos, SUM(tipo = 'CONSUMIBLE') consumibles,
      SUM(stock <= stock_minimo) stock_bajo,
      SUM(fecha_caducidad IS NOT NULL AND fecha_caducidad < CURDATE()) caducados
    FROM materiales WHERE activo = 1`);
  const [[eq]] = await db.query(`SELECT COUNT(*) total, COALESCE(SUM(cantidad), 0) unidades,
      SUM(estado = 'OPERATIVO') operativos, SUM(estado = 'EN_MANTENIMIENTO') en_mantenimiento,
      SUM(estado = 'FUERA_DE_SERVICIO') fuera_de_servicio
    FROM equipos WHERE activo = 1`);
  const [[mov]] = await db.query(`SELECT
      (SELECT COUNT(*) FROM movimientos_materiales WHERE DATE(fecha_hora) = CURDATE()) +
      (SELECT COUNT(*) FROM movimientos_equipos WHERE DATE(fecha_hora) = CURDATE()) AS hoy`);
  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v || 0)]));
  res.json({ data: { materiales: num(mat), equipos: num(eq), movimientos_hoy: Number(mov.hoy) } });
});

module.exports = { router, buscarPorCodigo };
