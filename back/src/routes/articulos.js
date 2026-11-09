// Alta, edición y baja de materiales y equipos (solo laboratorista con sesión)
const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, LAB } = require('../auth');
const { estadoMaterial, estadoEquipo } = require('../estado');
const { texto, textoRequerido, fecha, numeroNoNegativo, opcion } = require('../validacion');

const router = express.Router();
// Las consultas (GET) las atiende routes/inventario.js; aquí solo cambios
const soloLaboratorio = requiereRol(...LAB);
router.use((req, res, next) => (req.method === 'GET' ? next('router') : soloLaboratorio(req, res, next)));

const TIPOS_MATERIAL = ['REACTIVO', 'CONSUMIBLE'];
const ESTADOS_EQUIPO = ['OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO'];

function datosMaterial(b) {
  return {
    nombre: textoRequerido(b.nombre, 120, 'El nombre'),
    tipo: opcion(b.tipo, TIPOS_MATERIAL, 'Tipo'),
    unidad: textoRequerido(b.unidad || 'pza', 20, 'La unidad'),
    stock_minimo: numeroNoNegativo(b.stock_minimo, 'El stock mínimo'),
    fecha_caducidad: fecha(b.fecha_caducidad, false, 'Fecha de caducidad'),
  };
}

function datosEquipo(b) {
  const d = {
    nombre: textoRequerido(b.nombre, 120, 'El nombre'),
    marca: texto(b.marca, 60, 'La marca'),
    modelo: texto(b.modelo, 60, 'El modelo'),
    numero_serie: texto(b.numero_serie, 80, 'El número de serie'),
    estado: opcion(b.estado || 'OPERATIVO', ESTADOS_EQUIPO, 'Estado'),
    ultimo_mantenimiento: fecha(b.ultimo_mantenimiento, false, 'Último mantenimiento'),
    proximo_mantenimiento: fecha(b.proximo_mantenimiento, false, 'Próximo mantenimiento'),
  };
  if (d.ultimo_mantenimiento && d.proximo_mantenimiento && d.proximo_mantenimiento < d.ultimo_mantenimiento) {
    throw new HttpError(400, 'El próximo mantenimiento no puede ser antes del último');
  }
  return d;
}

// Siguiente código consecutivo: MAT-007, EQP-005...
async function siguienteCodigo(conn, tabla, prefijo) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo, ?) AS UNSIGNED)), 0) AS n FROM ${tabla} WHERE codigo LIKE ?`,
    [prefijo.length + 2, `${prefijo}-%`],
  );
  return `${prefijo}-${String(Number(r.n) + 1).padStart(3, '0')}`;
}

// Inserta el artículo con existencia 0 y, si hay existencia inicial, la registra como
// movimiento de ENTRADA (AJUSTE) para que el trigger actualice el stock y quede en el historial.
async function crear({ tabla, prefijo, datos, inicial, movimiento }, usuario) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const codigo = await siguienteCodigo(conn, tabla, prefijo);
    const [r] = await conn.query(`INSERT INTO ${tabla} SET ?`, [{ ...datos, codigo }]);
    if (inicial > 0) {
      await conn.query(`INSERT INTO ${movimiento.tabla} SET ?`, [{
        [movimiento.fk]: r.insertId, tipo: 'ENTRADA', cantidad: inicial, motivo: 'AJUSTE',
        responsable: usuario.nombre, observaciones: 'Inventario inicial (alta del artículo)',
      }]);
    }
    await conn.commit();
    const [[fila]] = await conn.query(`SELECT * FROM ${tabla} WHERE id = ?`, [r.insertId]);
    return fila;
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Otro usuario registró un artículo al mismo tiempo. Intenta de nuevo.');
    throw e;
  } finally {
    conn.release();
  }
}

async function actualizar(tabla, id, datos) {
  const [r] = await db.query(`UPDATE ${tabla} SET ? WHERE id = ? AND activo = 1`, [datos, Number(id) || 0]);
  if (!r.affectedRows) throw new HttpError(404, 'El artículo no existe o está dado de baja');
  const [[fila]] = await db.query(`SELECT * FROM ${tabla} WHERE id = ?`, [Number(id)]);
  return fila;
}

async function darDeBaja(tabla, id) {
  const [r] = await db.query(`UPDATE ${tabla} SET activo = 0 WHERE id = ? AND activo = 1`, [Number(id) || 0]);
  if (!r.affectedRows) throw new HttpError(404, 'El artículo no existe o ya estaba dado de baja');
}

// ---------- Materiales ----------
router.post('/materiales', async (req, res) => {
  const datos = datosMaterial(req.body || {});
  const inicial = numeroNoNegativo(req.body?.stock_inicial, 'La existencia inicial', { entero: datos.unidad === 'pza' });
  const fila = await crear({
    tabla: 'materiales', prefijo: 'MAT', datos, inicial,
    movimiento: { tabla: 'movimientos_materiales', fk: 'material_id' },
  }, req.usuario);
  res.status(201).json({ data: estadoMaterial(fila) });
});

router.put('/materiales/:id', async (req, res) => {
  const fila = await actualizar('materiales', req.params.id, datosMaterial(req.body || {}));
  res.json({ data: estadoMaterial(fila) });
});

router.post('/materiales/:id/baja', async (req, res) => {
  await darDeBaja('materiales', req.params.id);
  res.status(204).end();
});

// ---------- Equipos ----------
router.post('/equipos', async (req, res) => {
  const datos = datosEquipo(req.body || {});
  const inicial = numeroNoNegativo(req.body?.cantidad_inicial, 'La cantidad inicial', { entero: true });
  const fila = await crear({
    tabla: 'equipos', prefijo: 'EQP', datos, inicial,
    movimiento: { tabla: 'movimientos_equipos', fk: 'equipo_id' },
  }, req.usuario);
  res.status(201).json({ data: estadoEquipo(fila) });
});

router.put('/equipos/:id', async (req, res) => {
  const fila = await actualizar('equipos', req.params.id, datosEquipo(req.body || {}));
  res.json({ data: estadoEquipo(fila) });
});

router.post('/equipos/:id/baja', async (req, res) => {
  await darDeBaja('equipos', req.params.id);
  res.status(204).end();
});

module.exports = router;
