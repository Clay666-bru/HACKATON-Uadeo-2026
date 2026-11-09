// Prácticas de laboratorio: disponibilidad, solicitud del profesor (con reglamento),
// autorización (administrador -> laboratorista), bitácora con incidentes, fotos e historial.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, requiereSesion, LAB } = require('../auth');
const { texto, textoRequerido, fecha, opcion } = require('../validacion');
const { idParam, transaccion, notificar, aplicarConducta, fechaLocal, sumarDias, diasHasta } = require('../comun');
const reglamento = require('../data/reglamento.json');

const router = express.Router();

// Reglas de agenda (reglamento: 7:00 a 20:00 y una semana de anticipación)
const DIAS_ANTICIPACION = 7;
const APERTURA = '07:00';
const CIERRE = '20:00';
// Bloques habituales, tomados de las bitácoras matutina y vespertina
const BLOQUES = [
  ['07:00', '08:30'], ['08:30', '10:00'], ['10:30', '12:00'], ['12:00', '13:30'],
  ['17:00', '18:30'], ['18:30', '20:00'],
];
const OCUPAN = "('PENDIENTE_ADMIN','PENDIENTE_LAB','APROBADA','REALIZADA')";
const ESTADOS = ['PENDIENTE_ADMIN', 'RECHAZADA_ADMIN', 'PENDIENTE_LAB', 'RECHAZADA_LAB', 'APROBADA', 'CANCELADA', 'REALIZADA'];

function hora(v, campo) {
  const s = String(v || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new HttpError(400, `${campo} inválida (usa HH:MM)`);
  return s;
}
const esDiaHabil = (f) => { const d = new Date(`${f}T00:00:00`).getDay(); return d >= 1 && d <= 5; };
const hhmm = (t) => String(t).slice(0, 5);

// ---------- Reglamento ----------
router.get('/reglamento', (_req, res) => res.json({ data: reglamento }));
router.get('/reglamento/archivo', (_req, res) => {
  res.download(path.join(__dirname, '..', '..', '..', 'docs', 'reglamento.docx'), 'Reglamento del laboratorio.docx');
});

// ---------- Disponibilidad del laboratorio ----------
router.get('/disponibilidad', requiereSesion, async (req, res) => {
  const desde = fecha(req.query.desde, false, 'desde') || fechaLocal();
  const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 14, 1), 62);
  const hasta = sumarDias(desde, dias - 1);
  const [ocupadas] = await db.query(
    `SELECT s.id, s.fecha, s.hora_inicio, s.hora_fin, s.estado, g.nombre AS grupo, u.nombre AS profesor
       FROM solicitudes_lab s JOIN grupos g ON g.id = s.grupo_id JOIN usuarios u ON u.id = s.profesor_id
      WHERE s.fecha BETWEEN ? AND ? AND s.estado IN ${OCUPAN} ORDER BY s.fecha, s.hora_inicio`,
    [desde, hasta],
  );
  const minimo = sumarDias(fechaLocal(), DIAS_ANTICIPACION);
  const resultado = [];
  for (let i = 0; i < dias; i++) {
    const f = sumarDias(desde, i);
    if (!esDiaHabil(f)) continue;
    const delDia = ocupadas.filter((o) => o.fecha === f).map((o) => ({ ...o, hora_inicio: hhmm(o.hora_inicio), hora_fin: hhmm(o.hora_fin) }));
    resultado.push({
      fecha: f,
      solicitable: f >= minimo,
      ocupado: delDia,
      bloques: BLOQUES.map(([ini, fin]) => ({
        hora_inicio: ini, hora_fin: fin,
        libre: !delDia.some((o) => o.hora_inicio < fin && o.hora_fin > ini),
      })),
    });
  }
  res.json({ data: { desde, hasta, fecha_minima: minimo, apertura: APERTURA, cierre: CIERRE, dias: resultado } });
});

// ---------- Consultas ----------
const SQL = `SELECT s.id, s.profesor_id, p.nombre AS profesor, s.grupo_id, g.nombre AS grupo, s.materia_id, m.nombre AS materia,
       s.titulo, s.descripcion, s.fecha, TIME_FORMAT(s.hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(s.hora_fin, '%H:%i') AS hora_fin,
       s.num_equipos, s.acepta_reglamento, s.estado,
       s.admin_fecha, ad.nombre AS admin, s.admin_comentario, s.lab_fecha, lb.nombre AS laboratorista, s.lab_comentario, s.creado
  FROM solicitudes_lab s
  JOIN usuarios p ON p.id = s.profesor_id
  JOIN grupos g ON g.id = s.grupo_id
  JOIN materias m ON m.id = s.materia_id
  LEFT JOIN usuarios ad ON ad.id = s.admin_id
  LEFT JOIN usuarios lb ON lb.id = s.lab_id`;

// Agrega artículos, bitácora, fotos y vales a cada práctica (consultas por lote, sin N+1)
async function conDetalles(rows, usuario) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const [items] = await db.query(
    `SELECT i.id, i.solicitud_id, i.material_id, i.equipo_id, i.cantidad_por_equipo,
            COALESCE(m.codigo, e.codigo) AS codigo, COALESCE(m.nombre, e.nombre) AS nombre,
            COALESCE(m.unidad, 'pza') AS unidad, IF(i.material_id IS NULL, 'equipo', 'material') AS clase
       FROM solicitud_lab_items i LEFT JOIN materiales m ON m.id = i.material_id LEFT JOIN equipos e ON e.id = i.equipo_id
      WHERE i.solicitud_id IN (?) ORDER BY i.id`,
    [ids],
  );
  const [bitacoras] = await db.query(
    `SELECT b.solicitud_id, b.anotaciones, b.hubo_incidente, b.descripcion_incidente, u.nombre AS registrado_por, b.registrado
       FROM practica_bitacora b JOIN usuarios u ON u.id = b.registrado_por WHERE b.solicitud_id IN (?)`,
    [ids],
  );
  const [fotos] = await db.query(
    `SELECT f.id, f.solicitud_id, CONCAT('/api/fotos/', f.archivo) AS url, f.descripcion, f.usuario_id, u.nombre AS subida_por, LOWER(u.rol) AS rol, f.subida
       FROM practica_fotos f JOIN usuarios u ON u.id = f.usuario_id WHERE f.solicitud_id IN (?) ORDER BY f.subida`,
    [ids],
  );
  let valesParams = [ids];
  let valesFiltro = '';
  if (usuario.rol === 'alumno') {
    valesFiltro = ' AND v.equipo_trabajo_id = (SELECT equipo_trabajo_id FROM alumnos WHERE usuario_id = ?)';
    valesParams.push(usuario.id);
  }
  const [vales] = await db.query(
    `SELECT v.id, v.solicitud_id, v.equipo_trabajo_id, et.nombre AS equipo_trabajo, v.estado, v.solicitado, v.devuelto, v.hubo_incidente
       FROM vales_material v JOIN equipos_trabajo et ON et.id = v.equipo_trabajo_id WHERE v.solicitud_id IN (?)${valesFiltro}`,
    valesParams,
  );
  const de = (lista, id) => lista.filter((x) => x.solicitud_id === id).map(({ solicitud_id, ...x }) => x);
  return rows.map((r) => ({
    ...r,
    items: de(items, r.id).map((i) => ({ ...i, cantidad_total: i.cantidad_por_equipo * r.num_equipos })),
    bitacora: de(bitacoras, r.id)[0] || null,
    fotos: de(fotos, r.id),
    vales: de(vales, r.id),
  }));
}

// Quién puede ver una práctica
async function verificarAcceso(usuario, s) {
  if (LAB.includes(usuario.rol)) return;
  if (usuario.rol === 'profesor' && s.profesor_id === usuario.id) return;
  if (usuario.rol === 'alumno') {
    const [[a]] = await db.query('SELECT grupo_id FROM alumnos WHERE usuario_id = ?', [usuario.id]);
    if (a?.grupo_id === s.grupo_id && ['APROBADA', 'REALIZADA'].includes(s.estado)) return;
  }
  throw new HttpError(404, 'La práctica no existe');
}

async function obtener(id, usuario) {
  const [[s]] = await db.query(`${SQL} WHERE s.id = ?`, [id]);
  if (!s) throw new HttpError(404, 'La práctica no existe');
  await verificarAcceso(usuario, s);
  return (await conDetalles([s], usuario))[0];
}

// Listado / historial según el rol:
//  profesor: las suyas · alumno: las aprobadas o realizadas de su grupo · laboratorio/admin: todas
//  ?estado=APROBADA  ?pendientes=1 (lo que le toca autorizar a quien consulta)  ?desde= ?hasta=
router.get('/', requiereSesion, async (req, res) => {
  const where = [];
  const params = [];
  const { rol, id } = req.usuario;
  if (rol === 'profesor') { where.push('s.profesor_id = ?'); params.push(id); }
  if (rol === 'alumno') {
    where.push("s.grupo_id = (SELECT grupo_id FROM alumnos WHERE usuario_id = ?) AND s.estado IN ('APROBADA','REALIZADA')");
    params.push(id);
  }
  if (req.query.pendientes) {
    if (rol === 'administrador') where.push("s.estado = 'PENDIENTE_ADMIN'");
    else if (rol === 'laboratorio') where.push("s.estado = 'PENDIENTE_LAB'");
  }
  if (req.query.estado) { where.push('s.estado = ?'); params.push(opcion(req.query.estado, ESTADOS, 'Estado')); }
  if (req.query.desde) { where.push('s.fecha >= ?'); params.push(fecha(req.query.desde, false, 'desde')); }
  if (req.query.hasta) { where.push('s.fecha <= ?'); params.push(fecha(req.query.hasta, false, 'hasta')); }
  const [rows] = await db.query(
    `${SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.fecha DESC, s.hora_inicio DESC LIMIT 300`,
    params,
  );
  res.json({ data: await conDetalles(rows, req.usuario) });
});

router.get('/:id', requiereSesion, async (req, res) => {
  res.json({ data: await obtener(idParam(req.params.id), req.usuario) });
});

// ---------- Solicitud del profesor ----------
async function validarItems(lista, numEquipos) {
  if (!Array.isArray(lista)) throw new HttpError(400, 'items debe ser una lista de materiales y equipos');
  if (lista.length > 60) throw new HttpError(400, 'Demasiados artículos en la solicitud');
  const vistos = new Set();
  const items = [];
  const advertencias = [];
  for (const it of lista) {
    const esMat = it?.material_id != null;
    const esEq = it?.equipo_id != null;
    if (esMat === esEq) throw new HttpError(400, 'Cada artículo debe indicar material_id o equipo_id');
    const artId = idParam(esMat ? it.material_id : it.equipo_id, esMat ? 'material_id' : 'equipo_id');
    const clave = `${esMat ? 'm' : 'e'}${artId}`;
    if (vistos.has(clave)) throw new HttpError(400, 'Hay artículos repetidos en la solicitud');
    vistos.add(clave);
    const cantidad = Number(it.cantidad_por_equipo);
    if (!Number.isFinite(cantidad) || cantidad <= 0) throw new HttpError(400, 'La cantidad por equipo debe ser mayor a 0');
    const [[art]] = esMat
      ? await db.query('SELECT id, codigo, nombre, unidad, stock AS disponible FROM materiales WHERE id = ? AND activo = 1', [artId])
      : await db.query("SELECT id, codigo, nombre, 'pza' AS unidad, cantidad AS disponible FROM equipos WHERE id = ? AND activo = 1", [artId]);
    if (!art) throw new HttpError(404, `El ${esMat ? 'material' : 'equipo'} ${artId} no existe o está dado de baja`);
    if ((!esMat || art.unidad === 'pza') && !Number.isInteger(cantidad)) throw new HttpError(400, `${art.nombre}: la cantidad debe ser entera`);
    const total = cantidad * numEquipos;
    if (total > art.disponible) advertencias.push(`${art.codigo} ${art.nombre}: se piden ${total} ${art.unidad} y hoy hay ${art.disponible}`);
    items.push({ material_id: esMat ? artId : null, equipo_id: esMat ? null : artId, cantidad_por_equipo: cantidad });
  }
  return { items, advertencias };
}

router.post('/', requiereRol('profesor'), async (req, res) => {
  const b = req.body || {};
  // Ventana del reglamento: sin la casilla marcada no se envía la solicitud
  if (b.acepta_reglamento !== true) throw new HttpError(400, 'Debes leer y aceptar el reglamento del laboratorio para enviar la solicitud');
  const grupoId = idParam(b.grupo_id, 'grupo_id');
  const materiaId = idParam(b.materia_id, 'materia_id');
  const [[clase]] = await db.query(
    'SELECT id FROM clases WHERE profesor_id = ? AND grupo_id = ? AND materia_id = ?',
    [req.usuario.id, grupoId, materiaId],
  );
  if (!clase) throw new HttpError(403, 'Solo puedes solicitar prácticas para tus grupos y materias');
  const titulo = textoRequerido(b.titulo, 150, 'El nombre de la práctica');
  const descripcion = textoRequerido(b.descripcion, 5000, 'La descripción de la práctica');
  const f = fecha(b.fecha, false, 'La fecha');
  if (!f) throw new HttpError(400, 'La fecha es obligatoria');
  if (diasHasta(f) < DIAS_ANTICIPACION) throw new HttpError(400, `El laboratorio se solicita con al menos ${DIAS_ANTICIPACION} días de anticipación (a partir del ${sumarDias(fechaLocal(), DIAS_ANTICIPACION)})`);
  if (!esDiaHabil(f)) throw new HttpError(400, 'El laboratorio solo se agenda de lunes a viernes');
  const ini = hora(b.hora_inicio, 'La hora de inicio');
  const fin = hora(b.hora_fin, 'La hora de término');
  if (ini >= fin) throw new HttpError(400, 'La hora de inicio debe ser antes de la hora de término');
  if (ini < APERTURA || fin > CIERRE) throw new HttpError(400, `El laboratorio abre de ${APERTURA} a ${CIERRE}`);
  const numEquipos = Number(b.num_equipos);
  if (!Number.isInteger(numEquipos) || numEquipos < 1 || numEquipos > 30) throw new HttpError(400, 'La cantidad de equipos debe ser de 1 a 30');
  const { items, advertencias } = await validarItems(b.items ?? [], numEquipos);

  const id = await transaccion(async (conn) => {
    // Bloquea las reservas de ese día para que dos profesores no tomen el mismo horario a la vez
    const [delDia] = await conn.query(
      `SELECT id, TIME_FORMAT(hora_inicio,'%H:%i') AS ini, TIME_FORMAT(hora_fin,'%H:%i') AS fin FROM solicitudes_lab
        WHERE fecha = ? AND estado IN ${OCUPAN} FOR UPDATE`,
      [f],
    );
    const choque = delDia.find((o) => o.ini < fin && o.fin > ini);
    if (choque) throw new HttpError(409, `El laboratorio ya está apartado de ${choque.ini} a ${choque.fin} ese día`);
    const [r] = await conn.query(
      `INSERT INTO solicitudes_lab (profesor_id, grupo_id, materia_id, titulo, descripcion, fecha, hora_inicio, hora_fin, num_equipos, acepta_reglamento)
       VALUES (?,?,?,?,?,?,?,?,?, NOW())`,
      [req.usuario.id, grupoId, materiaId, titulo, descripcion, f, ini, fin, numEquipos],
    );
    if (items.length) {
      await conn.query(
        'INSERT INTO solicitud_lab_items (solicitud_id, material_id, equipo_id, cantidad_por_equipo) VALUES ?',
        [items.map((i) => [r.insertId, i.material_id, i.equipo_id, i.cantidad_por_equipo])],
      );
    }
    await notificar(conn, { roles: ['ADMINISTRADOR'] }, 'PRACTICA', 'Nueva solicitud de laboratorio',
      `${req.usuario.nombre} solicita el laboratorio el ${f} de ${ini} a ${fin}: ${titulo}.`);
    return r.insertId;
  });
  res.status(201).json({ data: await obtener(id, req.usuario), advertencias });
});

// Cambio de estado atómico: si otro usuario ya la atendió, responde 409 con el estado actual
async function cambiarEstado(conn, id, desde, set, params) {
  const [r] = await conn.query(`UPDATE solicitudes_lab SET ${set} WHERE id = ? AND estado IN (?)`, [...params, id, desde]);
  if (!r.affectedRows) {
    const [[s]] = await conn.query('SELECT estado FROM solicitudes_lab WHERE id = ?', [id]);
    if (!s) throw new HttpError(404, 'La práctica no existe');
    throw new HttpError(409, `La solicitud ya no se puede cambiar: está ${s.estado.replace('_', ' ').toLowerCase()}`);
  }
}

// Paso 1: el administrador (coordinación) autoriza o rechaza
router.post('/:id/admin', requiereRol('administrador'), async (req, res) => {
  const id = idParam(req.params.id);
  const decision = opcion(req.body?.decision, ['ACEPTAR', 'RECHAZAR'], 'Decisión');
  const comentario = texto(req.body?.comentario, 255, 'El comentario');
  await transaccion(async (conn) => {
    await cambiarEstado(conn, id, ['PENDIENTE_ADMIN'], 'estado = ?, admin_id = ?, admin_fecha = NOW(), admin_comentario = ?',
      [decision === 'ACEPTAR' ? 'PENDIENTE_LAB' : 'RECHAZADA_ADMIN', req.usuario.id, comentario]);
    const [[s]] = await conn.query('SELECT profesor_id, titulo, fecha FROM solicitudes_lab WHERE id = ?', [id]);
    if (decision === 'ACEPTAR') {
      await notificar(conn, { roles: ['LABORATORIO'] }, 'PRACTICA', 'Solicitud autorizada por coordinación', `Revisa y acepta la práctica "${s.titulo}" del ${s.fecha}.`);
      await notificar(conn, s.profesor_id, 'PRACTICA', 'Coordinación autorizó tu solicitud', `"${s.titulo}" ahora espera la confirmación del laboratorio.`);
    } else {
      await notificar(conn, s.profesor_id, 'PRACTICA', 'Solicitud rechazada por coordinación', `"${s.titulo}" fue rechazada.${comentario ? ' ' + comentario : ''}`);
    }
  });
  res.json({ data: await obtener(id, req.usuario) });
});

// Paso 2: el laboratorista confirma o rechaza (solo después del administrador)
router.post('/:id/laboratorio', requiereRol('laboratorio'), async (req, res) => {
  const id = idParam(req.params.id);
  const decision = opcion(req.body?.decision, ['ACEPTAR', 'RECHAZAR'], 'Decisión');
  const comentario = texto(req.body?.comentario, 255, 'El comentario');
  await transaccion(async (conn) => {
    await cambiarEstado(conn, id, ['PENDIENTE_LAB'], 'estado = ?, lab_id = ?, lab_fecha = NOW(), lab_comentario = ?',
      [decision === 'ACEPTAR' ? 'APROBADA' : 'RECHAZADA_LAB', req.usuario.id, comentario]);
    const [[s]] = await conn.query('SELECT profesor_id, grupo_id, titulo, fecha FROM solicitudes_lab WHERE id = ?', [id]);
    if (decision === 'ACEPTAR') {
      await notificar(conn, s.profesor_id, 'PRACTICA', 'Práctica aprobada', `"${s.titulo}" quedó agendada para el ${s.fecha}.`);
      const [alumnos] = await conn.query('SELECT usuario_id FROM alumnos WHERE grupo_id = ?', [s.grupo_id]);
      await notificar(conn, alumnos.map((a) => a.usuario_id), 'PRACTICA', 'Nueva práctica para tu grupo',
        `"${s.titulo}" el ${s.fecha}. Solicita el material de tu equipo con al menos 3 días de anticipación.`);
    } else {
      await notificar(conn, s.profesor_id, 'PRACTICA', 'El laboratorio rechazó tu solicitud', `"${s.titulo}".${comentario ? ' ' + comentario : ''}`);
    }
  });
  res.json({ data: await obtener(id, req.usuario) });
});

router.post('/:id/cancelar', requiereRol('profesor'), async (req, res) => {
  const id = idParam(req.params.id);
  const [[s]] = await db.query('SELECT profesor_id FROM solicitudes_lab WHERE id = ?', [id]);
  if (!s || s.profesor_id !== req.usuario.id) throw new HttpError(404, 'La práctica no existe');
  await transaccion(async (conn) => {
    const [[entregados]] = await conn.query("SELECT COUNT(*) AS n FROM vales_material WHERE solicitud_id = ? AND estado IN ('PENDIENTE_DEVOLUCION','DEVUELTO')", [id]);
    if (entregados.n) throw new HttpError(409, 'Ya se entregó material de esta práctica; no se puede cancelar');
    await cambiarEstado(conn, id, ['PENDIENTE_ADMIN', 'PENDIENTE_LAB', 'APROBADA'], "estado = 'CANCELADA'", []);
    await conn.query("UPDATE vales_material SET estado = 'RECHAZADO', comentario = 'Práctica cancelada por el profesor' WHERE solicitud_id = ? AND estado = 'SOLICITADO'", [id]);
  });
  res.json({ data: await obtener(id, req.usuario) });
});

// ---------- Bitácora de la práctica (laboratorista o administrador) ----------
// Sin incidente: +1 al contador de buena conducta del profesor. Con incidente: -1.
router.post('/:id/bitacora', requiereRol(...LAB), async (req, res) => {
  const id = idParam(req.params.id);
  const b = req.body || {};
  if (typeof b.hubo_incidente !== 'boolean') throw new HttpError(400, 'Indica si hubo un incidente (hubo_incidente: true o false)');
  const descripcion = texto(b.descripcion_incidente, 500, 'La descripción del incidente');
  if (b.hubo_incidente && !descripcion) throw new HttpError(400, 'Describe el incidente');
  const anotaciones = texto(b.anotaciones, 5000, 'Las anotaciones');
  await transaccion(async (conn) => {
    const [[s]] = await conn.query('SELECT id, profesor_id, titulo, fecha, estado FROM solicitudes_lab WHERE id = ? FOR UPDATE', [id]);
    if (!s) throw new HttpError(404, 'La práctica no existe');
    if (s.estado === 'REALIZADA') throw new HttpError(409, 'La bitácora de esta práctica ya fue registrada');
    if (s.estado !== 'APROBADA') throw new HttpError(409, 'Solo se registra la bitácora de prácticas aprobadas');
    if (s.fecha > fechaLocal()) throw new HttpError(409, `La práctica es el ${s.fecha}; registra la bitácora cuando se realice`);
    await conn.query(
      'INSERT INTO practica_bitacora (solicitud_id, anotaciones, hubo_incidente, descripcion_incidente, registrado_por) VALUES (?,?,?,?,?)',
      [id, anotaciones, b.hubo_incidente ? 1 : 0, b.hubo_incidente ? descripcion : null, req.usuario.id],
    );
    await conn.query("UPDATE solicitudes_lab SET estado = 'REALIZADA' WHERE id = ?", [id]);
    await aplicarConducta(conn, [s.profesor_id], b.hubo_incidente ? -1 : 1,
      b.hubo_incidente ? `Incidente en la práctica "${s.titulo}"` : `Práctica "${s.titulo}" sin incidentes`, 'PRACTICA', id, req.usuario.id);
    await notificar(conn, s.profesor_id, 'CONDUCTA', b.hubo_incidente ? 'Incidente registrado (-1 punto)' : 'Práctica sin incidentes (+1 punto)',
      `Bitácora de "${s.titulo}" registrada por ${req.usuario.nombre}.`);
  });
  res.status(201).json({ data: await obtener(id, req.usuario) });
});

// ---------- Fotos de la práctica ----------
const CARPETA_FOTOS = path.join(__dirname, '..', '..', 'uploads', 'practicas');
fs.mkdirSync(CARPETA_FOTOS, { recursive: true });
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const subida = multer({
  storage: multer.diskStorage({
    destination: CARPETA_FOTOS,
    // Nombre aleatorio: no se puede adivinar ni pisar otro archivo
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(EXT[file.mimetype] ? null : new HttpError(400, 'Solo se aceptan fotos JPG, PNG o WEBP'), !!EXT[file.mimetype]),
});

// Suben fotos: laboratorio/admin, el profesor de la práctica y los alumnos del grupo
router.post('/:id/fotos', requiereSesion, subida.single('foto'), async (req, res) => {
  const borrarArchivo = () => req.file && fs.promises.unlink(req.file.path).catch(() => {});
  try {
    const id = idParam(req.params.id);
    if (!req.file) throw new HttpError(400, 'Adjunta la foto en el campo "foto"');
    const [[s]] = await db.query('SELECT id, profesor_id, grupo_id, estado FROM solicitudes_lab WHERE id = ?', [id]);
    if (!s) throw new HttpError(404, 'La práctica no existe');
    await verificarAcceso(req.usuario, s);
    if (!['APROBADA', 'REALIZADA'].includes(s.estado)) throw new HttpError(409, 'Solo se suben fotos de prácticas aprobadas o realizadas');
    const [[n]] = await db.query('SELECT COUNT(*) AS n FROM practica_fotos WHERE solicitud_id = ?', [id]);
    if (n.n >= 40) throw new HttpError(409, 'Esta práctica ya tiene el máximo de 40 fotos');
    const [r] = await db.query(
      'INSERT INTO practica_fotos (solicitud_id, usuario_id, archivo, descripcion) VALUES (?,?,?,?)',
      [id, req.usuario.id, req.file.filename, texto(req.body?.descripcion, 200, 'La descripción')],
    );
    res.status(201).json({ data: { id: r.insertId, url: `/api/fotos/${req.file.filename}` } });
  } catch (e) {
    await borrarArchivo();
    throw e;
  }
});

router.delete('/:id/fotos/:fotoId', requiereSesion, async (req, res) => {
  const [[f]] = await db.query(
    'SELECT id, usuario_id, archivo FROM practica_fotos WHERE id = ? AND solicitud_id = ?',
    [idParam(req.params.fotoId, 'foto'), idParam(req.params.id)],
  );
  if (!f) throw new HttpError(404, 'La foto no existe');
  if (f.usuario_id !== req.usuario.id && !LAB.includes(req.usuario.rol)) throw new HttpError(403, 'Solo quien subió la foto o el laboratorio puede borrarla');
  await db.query('DELETE FROM practica_fotos WHERE id = ?', [f.id]);
  await fs.promises.unlink(path.join(CARPETA_FOTOS, f.archivo)).catch(() => {});
  res.json({ data: { ok: true } });
});

module.exports = { router, CARPETA_FOTOS };
