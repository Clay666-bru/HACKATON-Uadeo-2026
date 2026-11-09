// Semestre: al iniciarlo se guarda el inventario (inventario_inicio) y empieza la cuenta regresiva.
// Al terminar se guarda el inventario final y se avisa a administración y laboratorio
// que es momento de limpieza y mantenimiento.
const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, LAB } = require('../auth');
const { texto, fecha } = require('../validacion');
const { transaccion, notificar, fechaHoraLocal, idParam } = require('../comun');

const router = express.Router();
const lab = requiereRol(...LAB);

// Copia el inventario activo en inventario_inicio o inventario_fin
async function guardarInventario(conn, tabla, semestreId) {
  await conn.query(
    `INSERT INTO ${tabla} (semestre_id, clase, articulo_id, codigo, nombre, cantidad, unidad, estado)
     SELECT ?, 'MATERIAL', id, codigo, nombre, stock, unidad, tipo FROM materiales WHERE activo = 1
     UNION ALL
     SELECT ?, 'EQUIPO', id, codigo, nombre, cantidad, 'pza', estado FROM equipos WHERE activo = 1`,
    [semestreId, semestreId],
  );
}

function conCuenta(s) {
  if (!s) return null;
  const restante = Math.max(0, Math.floor((new Date(s.fin.replace(' ', 'T')) - Date.now()) / 1000));
  return { ...s, segundos_restantes: s.estado === 'ACTIVO' ? restante : 0 };
}

const SQL = `SELECT s.id, s.nombre, s.inicio, s.fin, s.estado, s.finalizado, u.nombre AS iniciado_por,
       (SELECT COUNT(*) FROM inventario_inicio i WHERE i.semestre_id = s.id) AS articulos_inicio,
       (SELECT COUNT(*) FROM inventario_fin f WHERE f.semestre_id = s.id) AS articulos_fin
  FROM semestres s JOIN usuarios u ON u.id = s.iniciado_por`;

router.get('/actual', lab, async (_req, res) => {
  const [[activo]] = await db.query(`${SQL} WHERE s.estado = 'ACTIVO' ORDER BY s.id DESC LIMIT 1`);
  const [[ultimo]] = activo ? [[null]] : await db.query(`${SQL} ORDER BY s.id DESC LIMIT 1`);
  res.json({ data: conCuenta(activo || null), ultimo: conCuenta(ultimo || null) });
});

router.get('/', lab, async (_req, res) => {
  const [rows] = await db.query(`${SQL} ORDER BY s.id DESC`);
  res.json({ data: rows.map(conCuenta) });
});

// Botón "Iniciar semestre": fin = fecha (YYYY-MM-DD, termina a las 23:59:59) o fecha y hora
router.post('/iniciar', lab, async (req, res) => {
  const b = req.body || {};
  const conHora = /[T ]\d{2}:\d{2}/.test(String(b.fin || ''));
  const finTxt = fecha(b.fin, conHora, 'La fecha de fin del semestre');
  if (!finTxt) throw new HttpError(400, 'Selecciona la fecha de fin del semestre');
  const fin = conHora ? (finTxt.length === 16 ? finTxt + ':00' : finTxt) : `${finTxt} 23:59:59`;
  const ahora = fechaHoraLocal();
  if (fin <= ahora) throw new HttpError(400, 'La fecha de fin debe ser posterior a hoy');
  const nombre = texto(b.nombre, 60, 'El nombre') || `Semestre ${ahora.slice(0, 10)} a ${fin.slice(0, 10)}`;

  const id = await transaccion(async (conn) => {
    const [[activo]] = await conn.query("SELECT id, fin FROM semestres WHERE estado = 'ACTIVO' LIMIT 1 FOR UPDATE");
    if (activo) throw new HttpError(409, `Ya hay un semestre en curso (termina el ${activo.fin.slice(0, 10)})`);
    const [r] = await conn.query(
      'INSERT INTO semestres (nombre, inicio, fin, iniciado_por) VALUES (?, ?, ?, ?)',
      [nombre, ahora, fin, req.usuario.id],
    );
    await guardarInventario(conn, 'inventario_inicio', r.insertId);
    await notificar(conn, { roles: ['ADMINISTRADOR', 'LABORATORIO'] }, 'SEMESTRE', 'Semestre iniciado',
      `${req.usuario.nombre} inició "${nombre}". Termina el ${fin.slice(0, 10)}; se guardó el inventario inicial.`);
    return r.insertId;
  });
  const [[s]] = await db.query(`${SQL} WHERE s.id = ?`, [id]);
  res.status(201).json({ data: conCuenta(s) });
});

// Cierra un semestre activo: guarda el inventario final y avisa que toca limpieza y mantenimiento.
// adelantadoPor: nombre de quien lo finalizó antes de tiempo (si no, terminó la cuenta regresiva).
async function cerrarSemestre(conn, s, adelantadoPor = null) {
  const set = adelantadoPor
    ? "estado = 'FINALIZADO', finalizado = NOW(), fin = GREATEST(NOW(), inicio + INTERVAL 1 SECOND)"
    : "estado = 'FINALIZADO', finalizado = NOW()";
  const [r] = await conn.query(`UPDATE semestres SET ${set} WHERE id = ? AND estado = 'ACTIVO'`, [s.id]);
  if (!r.affectedRows) return false; // otro proceso ya lo cerró
  await guardarInventario(conn, 'inventario_fin', s.id);
  await notificar(conn, { roles: ['ADMINISTRADOR', 'LABORATORIO'] }, 'MANTENIMIENTO', 'Fin de semestre: limpieza y mantenimiento',
    `${adelantadoPor ? `${adelantadoPor} finalizó` : 'Terminó'} "${s.nombre}". Es momento de hacer la limpieza y el mantenimiento del laboratorio. Ya puedes generar la comparación de inventario.`);
  return true;
}

async function semestreActivo(conn, id) {
  const [[s]] = await conn.query('SELECT id, nombre, estado FROM semestres WHERE id = ? FOR UPDATE', [id]);
  if (!s) throw new HttpError(404, 'El semestre no existe');
  if (s.estado !== 'ACTIVO') throw new HttpError(409, `Este semestre ya está ${s.estado === 'CANCELADO' ? 'cancelado' : 'finalizado'}`);
  return s;
}

// Botón "Finalizar ahora": termina la cuenta regresiva hoy, con inventario final y aviso
router.post('/:id/finalizar', lab, async (req, res) => {
  const id = idParam(req.params.id);
  await transaccion(async (conn) => cerrarSemestre(conn, await semestreActivo(conn, id), req.usuario.nombre));
  const [[s]] = await db.query(`${SQL} WHERE s.id = ?`, [id]);
  res.json({ data: conCuenta(s) });
});

// Botón "Cancelar semestre": detiene la cuenta regresiva sin cerrar el semestre (no hay inventario final
// ni aviso de mantenimiento) y deja libre para iniciar otro. Queda en el historial como cancelado.
router.post('/:id/cancelar', lab, async (req, res) => {
  const id = idParam(req.params.id);
  await transaccion(async (conn) => {
    const s = await semestreActivo(conn, id);
    await conn.query("UPDATE semestres SET estado = 'CANCELADO', finalizado = NOW() WHERE id = ?", [id]);
    await notificar(conn, { roles: ['ADMINISTRADOR', 'LABORATORIO'] }, 'SEMESTRE', 'Semestre cancelado',
      `${req.usuario.nombre} canceló "${s.nombre}". Ya se puede iniciar un semestre nuevo.`);
  });
  const [[s]] = await db.query(`${SQL} WHERE s.id = ?`, [id]);
  res.json({ data: conCuenta(s) });
});

// Revisa cada minuto si terminó la cuenta regresiva
async function revisarSemestres() {
  const [vencidos] = await db.query("SELECT id, nombre FROM semestres WHERE estado = 'ACTIVO' AND fin <= NOW()");
  for (const s of vencidos) {
    const cerrado = await transaccion((conn) => cerrarSemestre(conn, s));
    if (cerrado) console.log(`[semestre] "${s.nombre}" finalizado; se avisó a administración y laboratorio.`);
  }
}

function iniciarRevision() {
  const revisar = () => revisarSemestres().catch((e) => console.error('[semestre]', e.code || e.message));
  revisar();
  setInterval(revisar, 60 * 1000).unref();
}

module.exports = { router, iniciarRevision, revisarSemestres };
