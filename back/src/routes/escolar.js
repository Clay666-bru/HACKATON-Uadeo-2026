// Catálogos escolares, cuentas, alumnos y equipos de trabajo de alumnos
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, requiereSesion, cifrarPassword } = require('../auth');
const { textoRequerido, texto, opcion } = require('../validacion');
const { idParam, transaccion } = require('../comun');

const router = express.Router();
const soloAdmin = requiereRol('administrador');
const gestores = requiereRol('profesor', 'administrador');
const consultores = requiereRol('profesor', 'administrador', 'laboratorio');

// El profesor solo administra alumnos y equipos de los grupos a los que da clase
async function validarGrupo(usuario, grupoId, conn = db) {
  const [[g]] = await conn.query('SELECT id, nombre FROM grupos WHERE id = ? AND activo = 1', [grupoId]);
  if (!g) throw new HttpError(404, 'El grupo no existe');
  if (usuario.rol === 'profesor') {
    const [[c]] = await conn.query('SELECT 1 AS ok FROM clases WHERE profesor_id = ? AND grupo_id = ? LIMIT 1', [usuario.id, grupoId]);
    if (!c) throw new HttpError(403, 'Solo puedes administrar los grupos a los que das clase');
  }
  return g;
}

function validarUsuarioNuevo(u) {
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) throw new HttpError(400, 'El usuario debe tener 3 a 40 caracteres: letras, números, punto, guion o guion bajo');
  return u;
}

// ---------- Grupos, materias y clases ----------
router.get('/grupos', requiereSesion, async (_req, res) => {
  const [rows] = await db.query('SELECT id, nombre, turno FROM grupos WHERE activo = 1 ORDER BY nombre');
  res.json({ data: rows });
});

router.post('/grupos', soloAdmin, async (req, res) => {
  const nombre = textoRequerido(req.body?.nombre, 30, 'El nombre del grupo');
  const turno = opcion(req.body?.turno, ['MATUTINO', 'VESPERTINO'], 'Turno');
  const [r] = await db.query('INSERT INTO grupos (nombre, turno) VALUES (?, ?)', [nombre, turno]);
  res.status(201).json({ data: { id: r.insertId, nombre, turno } });
});

router.get('/materias', requiereSesion, async (_req, res) => {
  const [rows] = await db.query('SELECT id, nombre FROM materias WHERE activo = 1 ORDER BY nombre');
  res.json({ data: rows });
});

router.post('/materias', soloAdmin, async (req, res) => {
  const nombre = textoRequerido(req.body?.nombre, 120, 'El nombre de la materia');
  const [r] = await db.query('INSERT INTO materias (nombre) VALUES (?)', [nombre]);
  res.status(201).json({ data: { id: r.insertId, nombre } });
});

// El profesor ve sus clases (para elegir grupo y materia en la solicitud); el admin, todas
router.get('/clases', consultores, async (req, res) => {
  const params = [];
  let filtro = '';
  if (req.usuario.rol === 'profesor') { filtro = 'WHERE c.profesor_id = ?'; params.push(req.usuario.id); }
  const [rows] = await db.query(
    `SELECT c.id, c.profesor_id, u.nombre AS profesor, c.grupo_id, g.nombre AS grupo, g.turno, c.materia_id, m.nombre AS materia
       FROM clases c JOIN usuarios u ON u.id = c.profesor_id JOIN grupos g ON g.id = c.grupo_id JOIN materias m ON m.id = c.materia_id
       ${filtro} ORDER BY g.nombre, m.nombre`,
    params,
  );
  res.json({ data: rows });
});

router.post('/clases', soloAdmin, async (req, res) => {
  const profesorId = idParam(req.body?.profesor_id, 'profesor_id');
  const [[p]] = await db.query("SELECT id FROM usuarios WHERE id = ? AND rol = 'PROFESOR' AND activo = 1", [profesorId]);
  if (!p) throw new HttpError(404, 'El profesor no existe');
  const [r] = await db.query(
    'INSERT INTO clases (profesor_id, grupo_id, materia_id) VALUES (?, ?, ?)',
    [profesorId, idParam(req.body?.grupo_id, 'grupo_id'), idParam(req.body?.materia_id, 'materia_id')],
  );
  res.status(201).json({ data: { id: r.insertId } });
});

router.delete('/clases/:id', soloAdmin, async (req, res) => {
  const [r] = await db.query('DELETE FROM clases WHERE id = ?', [idParam(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'La clase no existe');
  res.json({ data: { ok: true } });
});

// ---------- Cuentas de personal (solo administrador) ----------
router.get('/usuarios', soloAdmin, async (req, res) => {
  const params = [];
  let filtro = '';
  if (req.query.rol) { filtro = 'WHERE rol = ?'; params.push(opcion(req.query.rol, ['PROFESOR', 'ADMINISTRADOR', 'LABORATORIO', 'ALUMNO'], 'Rol')); }
  const [rows] = await db.query(
    `SELECT id, usuario, nombre, LOWER(rol) AS rol, activo, puntos_conducta, ultimo_acceso, creado FROM usuarios ${filtro} ORDER BY rol, nombre`,
    params,
  );
  res.json({ data: rows });
});

router.post('/usuarios', soloAdmin, async (req, res) => {
  const b = req.body || {};
  const usuario = validarUsuarioNuevo(String(b.usuario || '').trim().toLowerCase());
  const nombre = textoRequerido(b.nombre, 100, 'El nombre');
  const rol = opcion(b.rol, ['PROFESOR', 'ADMINISTRADOR', 'LABORATORIO'], 'Rol (los alumnos se dan de alta en /alumnos)');
  const password = String(b.password || '');
  if (password.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  const [r] = await db.query(
    'INSERT INTO usuarios (usuario, nombre, password_hash, rol) VALUES (?, ?, ?, ?)',
    [usuario, nombre, cifrarPassword(password), rol],
  );
  res.status(201).json({ data: { id: r.insertId, usuario, nombre, rol: rol.toLowerCase() } });
});

// Cambiar nombre y/o activar o desactivar una cuenta
router.patch('/usuarios/:id', soloAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  const b = req.body || {};
  const cambios = [];
  const params = [];
  if (b.nombre !== undefined) { cambios.push('nombre = ?'); params.push(textoRequerido(b.nombre, 100, 'El nombre')); }
  if (b.activo !== undefined) {
    if (id === req.usuario.id) throw new HttpError(409, 'No puedes desactivar tu propia cuenta');
    cambios.push('activo = ?'); params.push(b.activo ? 1 : 0);
  }
  if (!cambios.length) throw new HttpError(400, 'No hay cambios');
  const [r] = await db.query(`UPDATE usuarios SET ${cambios.join(', ')} WHERE id = ?`, [...params, id]);
  if (!r.affectedRows) throw new HttpError(404, 'El usuario no existe');
  const [[u]] = await db.query('SELECT id, usuario, nombre, LOWER(rol) AS rol, activo FROM usuarios WHERE id = ?', [id]);
  res.json({ data: u });
});

// Restablecer contraseña (sin contraseña nueva se genera una temporal que se muestra una sola vez)
router.post('/usuarios/:id/password', soloAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  if (id === req.usuario.id) throw new HttpError(409, 'Para tu propia cuenta usa "Cambiar contraseña"');
  let password = String(req.body?.password || '').trim();
  const generada = !password;
  if (generada) password = 'Tmp-' + crypto.randomBytes(6).toString('base64url');
  if (password.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  const [r] = await db.query("UPDATE usuarios SET password_hash = ? WHERE id = ? AND rol <> 'ADMINISTRADOR'", [cifrarPassword(password), id]);
  if (!r.affectedRows) throw new HttpError(404, 'El usuario no existe o es de coordinación');
  res.json({ data: { id, password_temporal: generada ? password : undefined } });
});

// Laboratoristas con su actividad (lo que han atendido en el sistema)
router.get('/laboratoristas', soloAdmin, async (_req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.usuario, u.nombre, u.activo, u.ultimo_acceso, u.creado,
            (SELECT COUNT(*) FROM movimientos_materiales m WHERE m.responsable = u.nombre)
              + (SELECT COUNT(*) FROM movimientos_equipos e WHERE e.responsable = u.nombre) AS movimientos,
            (SELECT COUNT(*) FROM solicitudes_lab s WHERE s.lab_id = u.id) AS practicas,
            (SELECT COUNT(*) FROM vales_material v WHERE v.atendio_id = u.id OR v.recibio_id = u.id) AS vales,
            (SELECT COUNT(*) FROM rentas_batas b WHERE b.respondio_id = u.id OR b.recibio_id = u.id) AS batas,
            (SELECT COUNT(*) FROM practica_bitacora pb WHERE pb.registrado_por = u.id) AS bitacoras
       FROM usuarios u WHERE u.rol = 'LABORATORIO' ORDER BY u.activo DESC, u.nombre`,
  );
  res.json({ data: rows });
});

// ---------- Alumnos (alta solo por coordinación; el profesor los consulta y arma equipos) ----------
const SQL_ALUMNOS = `SELECT u.id, u.usuario, u.nombre, u.activo, u.puntos_conducta, u.avatar, a.matricula,
       a.grupo_id, g.nombre AS grupo, a.equipo_trabajo_id, et.nombre AS equipo_trabajo
  FROM alumnos a JOIN usuarios u ON u.id = a.usuario_id
  LEFT JOIN grupos g ON g.id = a.grupo_id
  LEFT JOIN equipos_trabajo et ON et.id = a.equipo_trabajo_id`;

router.get('/grupos/:id/alumnos', consultores, async (req, res) => {
  const grupoId = idParam(req.params.id);
  if (req.usuario.rol !== 'laboratorio') await validarGrupo(req.usuario, grupoId);
  const [rows] = await db.query(`${SQL_ALUMNOS} WHERE a.grupo_id = ? ORDER BY u.nombre`, [grupoId]);
  res.json({ data: rows });
});

// Valida los datos de un alumno nuevo. Sin contraseña se genera una temporal (se muestra una sola vez).
function datosAlumno(b) {
  const matricula = String(b.matricula ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{3,20}$/.test(matricula)) throw new HttpError(400, 'La matrícula debe tener 3 a 20 letras, números o guiones');
  const nombre = textoRequerido(b.nombre, 100, 'El nombre del alumno');
  let password = String(b.password ?? '').trim();
  const generada = !password;
  if (generada) password = 'Al-' + crypto.randomBytes(6).toString('base64url');
  if (password.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  return { matricula, nombre, password, generada };
}

async function crearAlumno(conn, { matricula, nombre, password }, grupoId, equipoId = null) {
  const [r] = await conn.query(
    "INSERT INTO usuarios (usuario, nombre, password_hash, rol) VALUES (?, ?, ?, 'ALUMNO')",
    [matricula, nombre, cifrarPassword(password)],
  );
  await conn.query('INSERT INTO alumnos (usuario_id, matricula, grupo_id, equipo_trabajo_id) VALUES (?, ?, ?, ?)', [r.insertId, matricula, grupoId, equipoId]);
  return r.insertId;
}

// Solo coordinación da de alta alumnos (uno por uno o desde Excel)
router.post('/alumnos', soloAdmin, async (req, res) => {
  const d = datosAlumno(req.body || {});
  const grupoId = idParam(req.body?.grupo_id, 'grupo_id');
  await validarGrupo(req.usuario, grupoId);
  const id = await transaccion((conn) => crearAlumno(conn, d, grupoId));
  res.status(201).json({ data: { id, usuario: d.matricula, matricula: d.matricula, nombre: d.nombre, grupo_id: grupoId, password_temporal: d.generada ? d.password : undefined } });
});

// ---------- Carga masiva desde Excel ----------
const COLUMNAS = [
  { campo: 'matricula', titulo: 'Matrícula', nombres: ['matricula', 'matrícula', 'usuario', 'no. de control', 'numero de control'] },
  { campo: 'nombre', titulo: 'Nombre completo', nombres: ['nombre completo', 'nombre', 'alumno', 'nombre del alumno'] },
  { campo: 'grupo', titulo: 'Grupo', nombres: ['grupo'] },
  { campo: 'equipo', titulo: 'Equipo (opcional)', nombres: ['equipo', 'equipo (opcional)', 'equipo de trabajo'] },
  { campo: 'password', titulo: 'Contraseña (opcional)', nombres: ['contraseña', 'contrasena', 'contraseña (opcional)', 'contrasena (opcional)', 'password'] },
];
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const subidaExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.xlsx$/i.test(file.originalname);
    cb(ok ? null : new HttpError(400, 'Sube un archivo de Excel .xlsx (si es .xls o .csv, guárdalo como .xlsx)'), ok);
  },
});

// Texto de una celda de Excel (fórmulas, texto enriquecido, hipervínculos, números)
function textoCelda(c) {
  let v = c?.value;
  if (v && typeof v === 'object') v = v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join('') : '');
  return v == null ? '' : String(v).trim();
}

router.get('/alumnos/plantilla', soloAdmin, async (_req, res) => {
  const [grupos] = await db.query('SELECT nombre, turno FROM grupos WHERE activo = 1 ORDER BY nombre');
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet('Alumnos');
  hoja.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.campo, width: c.campo === 'nombre' ? 34 : 20 }));
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3261E' } };
  hoja.addRow({ matricula: '2026001', nombre: 'Ejemplo: Ana López Pérez', grupo: grupos[0]?.nombre || '1-1 Biomédicas', equipo: 'Equipo 1', password: '' });
  // Lista desplegable de grupos en la columna Grupo
  if (grupos.length) {
    for (let n = 2; n <= 500; n++) hoja.getCell(`C${n}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Grupos!$A$2:$A$${grupos.length + 1}`] };
  }
  const g = wb.addWorksheet('Grupos');
  g.columns = [{ header: 'Grupo', key: 'nombre', width: 24 }, { header: 'Turno', key: 'turno', width: 14 }];
  g.getRow(1).font = { bold: true };
  grupos.forEach((x) => g.addRow(x));
  const ayuda = wb.addWorksheet('Instrucciones');
  ayuda.getColumn(1).width = 110;
  [
    'Cómo llenar la plantilla',
    '1. Una fila por alumno en la hoja "Alumnos". Borra la fila de ejemplo.',
    '2. Matrícula: será su usuario para entrar (3 a 20 letras, números o guiones).',
    '3. Grupo: escríbelo igual que en la hoja "Grupos" (o elígelo de la lista).',
    '4. Equipo (opcional): si no existe en ese grupo, se crea.',
    '5. Contraseña (opcional, mínimo 8 caracteres): si la dejas vacía se genera una temporal que verás al terminar.',
  ].forEach((t, i) => { ayuda.addRow([t]).font = { bold: i === 0 }; });
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename="plantilla-alumnos.xlsx"');
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
});

// Crea las cuentas de cada fila válida y reporta las que tienen errores (fila por fila)
router.post('/alumnos/importar', soloAdmin, subidaExcel.single('archivo'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Adjunta el archivo de Excel en el campo "archivo"');
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(req.file.buffer); } catch (_) { throw new HttpError(400, 'No se pudo leer el archivo. ¿Es un Excel .xlsx válido?'); }
  const hoja = wb.worksheets.find((h) => normalizar(h.name) === 'alumnos') || wb.worksheets[0];
  if (!hoja) throw new HttpError(400, 'El archivo no tiene hojas');

  // Busca la fila de encabezados (en las primeras 5) y ubica cada columna por su nombre
  let filaEnc = 0;
  let posicion = {};
  for (let f = 1; f <= Math.min(5, hoja.rowCount); f++) {
    const mapa = {};
    hoja.getRow(f).eachCell((c, col) => {
      const t = normalizar(textoCelda(c));
      const def = COLUMNAS.find((d) => d.nombres.includes(t));
      if (def && !mapa[def.campo]) mapa[def.campo] = col;
    });
    if (mapa.matricula && mapa.nombre && mapa.grupo) { filaEnc = f; posicion = mapa; break; }
  }
  if (!filaEnc) throw new HttpError(400, 'No encontré las columnas Matrícula, Nombre completo y Grupo. Usa la plantilla.');

  const [grupos] = await db.query('SELECT id, nombre FROM grupos WHERE activo = 1');
  const grupoPorNombre = new Map(grupos.map((g) => [normalizar(g.nombre), g]));
  const creados = [];
  const errores = [];
  const vistas = new Set();
  let total = 0;
  for (let f = filaEnc + 1; f <= hoja.rowCount; f++) {
    const fila = hoja.getRow(f);
    const val = (campo) => (posicion[campo] ? textoCelda(fila.getCell(posicion[campo])) : '');
    const crudo = { matricula: val('matricula'), nombre: val('nombre'), grupo: val('grupo'), equipo: val('equipo'), password: val('password') };
    if (!crudo.matricula && !crudo.nombre && !crudo.grupo) continue; // fila vacía
    if (/^ejemplo/i.test(crudo.nombre)) continue; // fila de ejemplo de la plantilla
    total++;
    if (total > 1000) { errores.push({ fila: f, matricula: crudo.matricula, error: 'Máximo 1000 alumnos por archivo' }); break; }
    try {
      const d = datosAlumno(crudo);
      if (vistas.has(d.matricula)) throw new HttpError(409, 'Matrícula repetida en el archivo');
      vistas.add(d.matricula);
      const g = grupoPorNombre.get(normalizar(crudo.grupo));
      if (!g) throw new HttpError(400, `El grupo "${crudo.grupo || '(vacío)'}" no existe`);
      const equipo = texto(crudo.equipo, 40, 'El equipo');
      await transaccion(async (conn) => {
        let equipoId = null;
        if (equipo) {
          const [[e]] = await conn.query('SELECT id FROM equipos_trabajo WHERE grupo_id = ? AND nombre = ?', [g.id, equipo]);
          equipoId = e?.id || (await conn.query('INSERT INTO equipos_trabajo (grupo_id, nombre, creado_por) VALUES (?, ?, ?)', [g.id, equipo, req.usuario.id]))[0].insertId;
        }
        await crearAlumno(conn, d, g.id, equipoId);
      });
      creados.push({ fila: f, matricula: d.matricula, nombre: d.nombre, grupo: g.nombre, equipo, password_temporal: d.generada ? d.password : null });
    } catch (e) {
      const msg = e.code === 'ER_DUP_ENTRY' ? 'Ya existe una cuenta con esa matrícula' : e instanceof HttpError ? e.message : 'No se pudo crear';
      if (!(e instanceof HttpError) && e.code !== 'ER_DUP_ENTRY') console.error('[importar alumnos]', e);
      errores.push({ fila: f, matricula: crudo.matricula, nombre: crudo.nombre, error: msg });
    }
  }
  if (!total) throw new HttpError(400, 'El archivo no tiene alumnos (solo encabezados o filas vacías)');
  res.status(creados.length ? 201 : 200).json({ data: { total, creados, errores } });
});

// Cambiar nombre o grupo (al cambiar de grupo sale de su equipo)
router.patch('/alumnos/:id', soloAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  const [[al]] = await db.query('SELECT usuario_id, grupo_id FROM alumnos WHERE usuario_id = ?', [id]);
  if (!al) throw new HttpError(404, 'El alumno no existe');
  if (al.grupo_id) await validarGrupo(req.usuario, al.grupo_id);
  const b = req.body || {};
  await transaccion(async (conn) => {
    if (b.nombre !== undefined) await conn.query('UPDATE usuarios SET nombre = ? WHERE id = ?', [textoRequerido(b.nombre, 100, 'El nombre'), id]);
    if (b.grupo_id !== undefined) {
      const grupoId = idParam(b.grupo_id, 'grupo_id');
      await validarGrupo(req.usuario, grupoId, conn);
      if (grupoId !== al.grupo_id) await conn.query('UPDATE alumnos SET grupo_id = ?, equipo_trabajo_id = NULL WHERE usuario_id = ?', [grupoId, id]);
    }
  });
  const [[fila]] = await db.query(`${SQL_ALUMNOS} WHERE a.usuario_id = ?`, [id]);
  res.json({ data: fila });
});

// ---------- Equipos de trabajo de alumnos ----------
async function equiposConMiembros(where, params) {
  const [equipos] = await db.query(
    `SELECT et.id, et.nombre, et.grupo_id, g.nombre AS grupo, et.creado
       FROM equipos_trabajo et JOIN grupos g ON g.id = et.grupo_id WHERE ${where} ORDER BY g.nombre, et.nombre`,
    params,
  );
  if (!equipos.length) return [];
  const [miembros] = await db.query(
    `SELECT a.equipo_trabajo_id, u.id, u.nombre, a.matricula, u.puntos_conducta, u.avatar
       FROM alumnos a JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.equipo_trabajo_id IN (?) ORDER BY u.nombre`,
    [equipos.map((e) => e.id)],
  );
  return equipos.map((e) => ({ ...e, miembros: miembros.filter((m) => m.equipo_trabajo_id === e.id).map(({ equipo_trabajo_id, ...m }) => m) }));
}

async function obtenerEquipo(usuario, id) {
  const [[et]] = await db.query('SELECT id, grupo_id, nombre FROM equipos_trabajo WHERE id = ?', [id]);
  if (!et) throw new HttpError(404, 'El equipo no existe');
  await validarGrupo(usuario, et.grupo_id);
  return et;
}

router.get('/equipos-trabajo', consultores, async (req, res) => {
  const grupoId = idParam(req.query.grupo_id, 'grupo_id');
  if (req.usuario.rol !== 'laboratorio') await validarGrupo(req.usuario, grupoId);
  res.json({ data: await equiposConMiembros('et.grupo_id = ?', [grupoId]) });
});

// El alumno ve su equipo y sus compañeros
router.get('/mi-equipo', requiereRol('alumno'), async (req, res) => {
  const [[a]] = await db.query('SELECT equipo_trabajo_id FROM alumnos WHERE usuario_id = ?', [req.usuario.id]);
  if (!a?.equipo_trabajo_id) return res.json({ data: null });
  const [equipo] = await equiposConMiembros('et.id = ?', [a.equipo_trabajo_id]);
  res.json({ data: equipo || null });
});

router.post('/equipos-trabajo', gestores, async (req, res) => {
  const grupoId = idParam(req.body?.grupo_id, 'grupo_id');
  await validarGrupo(req.usuario, grupoId);
  const nombre = textoRequerido(req.body?.nombre, 40, 'El nombre del equipo');
  const [r] = await db.query('INSERT INTO equipos_trabajo (grupo_id, nombre, creado_por) VALUES (?, ?, ?)', [grupoId, nombre, req.usuario.id]);
  res.status(201).json({ data: { id: r.insertId, grupo_id: grupoId, nombre, miembros: [] } });
});

router.put('/equipos-trabajo/:id', gestores, async (req, res) => {
  const et = await obtenerEquipo(req.usuario, idParam(req.params.id));
  const nombre = textoRequerido(req.body?.nombre, 40, 'El nombre del equipo');
  await db.query('UPDATE equipos_trabajo SET nombre = ? WHERE id = ?', [nombre, et.id]);
  res.json({ data: { ...et, nombre } });
});

router.delete('/equipos-trabajo/:id', gestores, async (req, res) => {
  const et = await obtenerEquipo(req.usuario, idParam(req.params.id));
  const [[v]] = await db.query('SELECT COUNT(*) AS n FROM vales_material WHERE equipo_trabajo_id = ?', [et.id]);
  if (v.n) throw new HttpError(409, 'Este equipo ya tiene vales de material registrados; no se puede borrar. Puedes quitar a sus alumnos.');
  await db.query('DELETE FROM equipos_trabajo WHERE id = ?', [et.id]); // los alumnos quedan sin equipo (ON DELETE SET NULL)
  res.json({ data: { ok: true } });
});

router.post('/equipos-trabajo/:id/alumnos', gestores, async (req, res) => {
  const et = await obtenerEquipo(req.usuario, idParam(req.params.id));
  const alumnoId = idParam(req.body?.alumno_id, 'alumno_id');
  const [[al]] = await db.query('SELECT grupo_id FROM alumnos WHERE usuario_id = ?', [alumnoId]);
  if (!al) throw new HttpError(404, 'El alumno no existe');
  if (al.grupo_id !== et.grupo_id) throw new HttpError(409, 'El alumno pertenece a otro grupo');
  await db.query('UPDATE alumnos SET equipo_trabajo_id = ? WHERE usuario_id = ?', [et.id, alumnoId]);
  const [equipo] = await equiposConMiembros('et.id = ?', [et.id]);
  res.json({ data: equipo });
});

router.delete('/equipos-trabajo/:id/alumnos/:alumnoId', gestores, async (req, res) => {
  const et = await obtenerEquipo(req.usuario, idParam(req.params.id));
  const [r] = await db.query(
    'UPDATE alumnos SET equipo_trabajo_id = NULL WHERE usuario_id = ? AND equipo_trabajo_id = ?',
    [idParam(req.params.alumnoId, 'alumno'), et.id],
  );
  if (!r.affectedRows) throw new HttpError(404, 'El alumno no está en este equipo');
  const [equipo] = await equiposConMiembros('et.id = ?', [et.id]);
  res.json({ data: equipo });
});

module.exports = router;
