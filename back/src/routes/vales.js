// Vales de material de los equipos de alumnos.
// El alumno acepta el formato con los materiales que pidió el profesor (3 días antes),
// el laboratorista lo entrega (salida de inventario) y queda pendiente de devolución
// hasta que lo recibe de vuelta y marca si hubo incidente (+1 / -1 a cada integrante).
const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol, requiereSesion, LAB } = require('../auth');
const { texto, opcion } = require('../validacion');
const { idParam, transaccion, notificar, aplicarConducta, diasHasta } = require('../comun');

const router = express.Router();
const DIAS_ANTICIPACION = 3;
const ESTADOS = ['SOLICITADO', 'RECHAZADO', 'PENDIENTE_DEVOLUCION', 'DEVUELTO'];

const SQL = `SELECT v.id, v.solicitud_id, s.titulo AS practica, s.fecha, TIME_FORMAT(s.hora_inicio,'%H:%i') AS hora_inicio,
       TIME_FORMAT(s.hora_fin,'%H:%i') AS hora_fin, s.profesor_id, p.nombre AS profesor, g.nombre AS grupo,
       v.equipo_trabajo_id, et.nombre AS equipo_trabajo, v.solicitado_por AS alumno_id, al.nombre AS alumno,
       v.estado, v.solicitado, v.atendido, at.nombre AS atendio, v.comentario, v.devuelto, rc.nombre AS recibio,
       v.hubo_incidente, v.descripcion_incidente
  FROM vales_material v
  JOIN solicitudes_lab s ON s.id = v.solicitud_id
  JOIN usuarios p ON p.id = s.profesor_id
  JOIN grupos g ON g.id = s.grupo_id
  JOIN equipos_trabajo et ON et.id = v.equipo_trabajo_id
  JOIN usuarios al ON al.id = v.solicitado_por
  LEFT JOIN usuarios at ON at.id = v.atendio_id
  LEFT JOIN usuarios rc ON rc.id = v.recibio_id`;

async function conItems(vales) {
  if (!vales.length) return vales;
  const [items] = await db.query(
    `SELECT i.id, i.vale_id, i.material_id, i.equipo_id, i.cantidad, i.cantidad_devuelta,
            COALESCE(m.codigo, e.codigo) AS codigo, COALESCE(m.nombre, e.nombre) AS nombre,
            COALESCE(m.unidad, 'pza') AS unidad, m.tipo AS tipo_material, IF(i.material_id IS NULL, 'equipo', 'material') AS clase
       FROM vale_items i LEFT JOIN materiales m ON m.id = i.material_id LEFT JOIN equipos e ON e.id = i.equipo_id
      WHERE i.vale_id IN (?) ORDER BY i.id`,
    [vales.map((v) => v.id)],
  );
  const [miembros] = await db.query(
    `SELECT a.equipo_trabajo_id, u.id, u.nombre, a.matricula FROM alumnos a JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.equipo_trabajo_id IN (?) ORDER BY u.nombre`,
    [[...new Set(vales.map((v) => v.equipo_trabajo_id))]],
  );
  return vales.map((v) => ({
    ...v,
    items: items.filter((i) => i.vale_id === v.id).map(({ vale_id, ...i }) => i),
    integrantes: miembros.filter((m) => m.equipo_trabajo_id === v.equipo_trabajo_id).map(({ equipo_trabajo_id, ...m }) => m),
  }));
}

async function obtener(id) {
  const [[v]] = await db.query(`${SQL} WHERE v.id = ?`, [id]);
  if (!v) throw new HttpError(404, 'El vale no existe');
  return (await conItems([v]))[0];
}

const miembrosDe = async (conn, equipoId) =>
  (await conn.query('SELECT usuario_id FROM alumnos WHERE equipo_trabajo_id = ?', [equipoId]))[0].map((r) => r.usuario_id);

// Alumno: los de su equipo · profesor: los de sus prácticas · laboratorio/admin: todos (?estado=, ?solicitud_id=)
router.get('/', requiereSesion, async (req, res) => {
  const where = [];
  const params = [];
  const { rol, id } = req.usuario;
  if (rol === 'alumno') { where.push('v.equipo_trabajo_id = (SELECT equipo_trabajo_id FROM alumnos WHERE usuario_id = ?)'); params.push(id); }
  if (rol === 'profesor') { where.push('s.profesor_id = ?'); params.push(id); }
  if (req.query.estado) { where.push('v.estado = ?'); params.push(opcion(req.query.estado, ESTADOS, 'Estado')); }
  if (req.query.solicitud_id) { where.push('v.solicitud_id = ?'); params.push(idParam(req.query.solicitud_id, 'solicitud_id')); }
  const [rows] = await db.query(
    `${SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY FIELD(v.estado,'SOLICITADO','PENDIENTE_DEVOLUCION') DESC, s.fecha DESC, v.id DESC LIMIT 300`,
    params,
  );
  res.json({ data: await conItems(rows) });
});

router.get('/:id', requiereSesion, async (req, res) => {
  const v = await obtener(idParam(req.params.id));
  const { rol, id } = req.usuario;
  const permitido = LAB.includes(rol) || (rol === 'profesor' && v.profesor_id === id) || (rol === 'alumno' && v.integrantes.some((m) => m.id === id));
  if (!permitido) throw new HttpError(404, 'El vale no existe');
  res.json({ data: v });
});

// El alumno acepta el formato de materiales de la práctica para su equipo
router.post('/', requiereRol('alumno'), async (req, res) => {
  const solicitudId = idParam(req.body?.solicitud_id, 'solicitud_id');
  const valeId = await transaccion(async (conn) => {
    const [[al]] = await conn.query('SELECT grupo_id, equipo_trabajo_id FROM alumnos WHERE usuario_id = ?', [req.usuario.id]);
    if (!al?.equipo_trabajo_id) throw new HttpError(409, 'Aún no estás en un equipo; pídele a tu profesor que te asigne uno');
    const [[s]] = await conn.query('SELECT id, grupo_id, titulo, fecha, num_equipos, estado FROM solicitudes_lab WHERE id = ? FOR UPDATE', [solicitudId]);
    if (!s || s.grupo_id !== al.grupo_id) throw new HttpError(404, 'La práctica no existe para tu grupo');
    if (s.estado !== 'APROBADA') throw new HttpError(409, 'La práctica todavía no está aprobada por el laboratorio');
    if (diasHasta(s.fecha) < DIAS_ANTICIPACION) throw new HttpError(409, `El material se solicita con al menos ${DIAS_ANTICIPACION} días de anticipación`);
    const [items] = await conn.query('SELECT material_id, equipo_id, cantidad_por_equipo FROM solicitud_lab_items WHERE solicitud_id = ?', [s.id]);
    if (!items.length) throw new HttpError(409, 'Esta práctica no requiere material');

    const [[previo]] = await conn.query('SELECT id, estado FROM vales_material WHERE solicitud_id = ? AND equipo_trabajo_id = ?', [s.id, al.equipo_trabajo_id]);
    if (previo && previo.estado !== 'RECHAZADO') throw new HttpError(409, 'Tu equipo ya solicitó el material de esta práctica');
    const [[ocupados]] = await conn.query("SELECT COUNT(*) AS n FROM vales_material WHERE solicitud_id = ? AND estado <> 'RECHAZADO'", [s.id]);
    if (ocupados.n >= s.num_equipos) throw new HttpError(409, `La práctica es para ${s.num_equipos} equipo(s) y ya todos solicitaron material`);

    let id;
    if (previo) { // se vuelve a solicitar un vale rechazado
      id = previo.id;
      await conn.query(
        "UPDATE vales_material SET estado = 'SOLICITADO', solicitado_por = ?, solicitado = NOW(), atendio_id = NULL, atendido = NULL, comentario = NULL WHERE id = ?",
        [req.usuario.id, id],
      );
      await conn.query('DELETE FROM vale_items WHERE vale_id = ?', [id]);
    } else {
      const [r] = await conn.query(
        'INSERT INTO vales_material (solicitud_id, equipo_trabajo_id, solicitado_por) VALUES (?,?,?)',
        [s.id, al.equipo_trabajo_id, req.usuario.id],
      );
      id = r.insertId;
    }
    await conn.query(
      'INSERT INTO vale_items (vale_id, material_id, equipo_id, cantidad) VALUES ?',
      [items.map((i) => [id, i.material_id, i.equipo_id, i.cantidad_por_equipo])],
    );
    await notificar(conn, { roles: ['LABORATORIO'] }, 'VALE', 'Nuevo vale de material', `${req.usuario.nombre} solicita el material de "${s.titulo}" (${s.fecha}).`);
    return id;
  });
  res.status(201).json({ data: await obtener(valeId) });
});

// Laboratorio/admin: aceptar (entrega y salida de inventario) o rechazar
router.post('/:id/decision', requiereRol(...LAB), async (req, res) => {
  const id = idParam(req.params.id);
  const decision = opcion(req.body?.decision, ['ACEPTAR', 'RECHAZAR'], 'Decisión');
  const comentario = texto(req.body?.comentario, 255, 'El comentario');
  await transaccion(async (conn) => {
    const [[v]] = await conn.query(
      `SELECT v.id, v.estado, v.equipo_trabajo_id, al.nombre AS alumno, g.nombre AS grupo, s.titulo, s.fecha, s.hora_fin
         FROM vales_material v JOIN solicitudes_lab s ON s.id = v.solicitud_id JOIN grupos g ON g.id = s.grupo_id
         JOIN usuarios al ON al.id = v.solicitado_por WHERE v.id = ? FOR UPDATE`,
      [id],
    );
    if (!v) throw new HttpError(404, 'El vale no existe');
    if (v.estado !== 'SOLICITADO') throw new HttpError(409, `Este vale ya fue atendido (${v.estado.replace('_', ' ').toLowerCase()})`);
    if (decision === 'ACEPTAR') {
      const [items] = await conn.query('SELECT material_id, equipo_id, cantidad FROM vale_items WHERE vale_id = ?', [id]);
      const obs = `Vale #${id}`;
      for (const it of items) {
        // Los triggers validan existencias: si falta material se deshace todo (409)
        if (it.material_id) {
          await conn.query(
            `INSERT INTO movimientos_materiales (material_id, tipo, cantidad, motivo, solicitante, grupo, practica, responsable, observaciones)
             VALUES (?, 'SALIDA', ?, 'PRACTICA', ?, ?, ?, ?, ?)`,
            [it.material_id, it.cantidad, v.alumno, v.grupo.slice(0, 30), v.titulo, req.usuario.nombre, obs],
          );
        } else {
          await conn.query(
            `INSERT INTO movimientos_equipos (equipo_id, tipo, cantidad, motivo, persona, grupo, practica, devolucion_esperada, responsable, observaciones)
             VALUES (?, 'SALIDA', ?, 'PRESTAMO', ?, ?, ?, ?, ?, ?)`,
            [it.equipo_id, it.cantidad, v.alumno, v.grupo.slice(0, 30), v.titulo, `${v.fecha} ${v.hora_fin}`, req.usuario.nombre, obs],
          );
        }
      }
    }
    await conn.query(
      'UPDATE vales_material SET estado = ?, atendio_id = ?, atendido = NOW(), comentario = ? WHERE id = ?',
      [decision === 'ACEPTAR' ? 'PENDIENTE_DEVOLUCION' : 'RECHAZADO', req.usuario.id, comentario, id],
    );
    await notificar(conn, await miembrosDe(conn, v.equipo_trabajo_id), 'VALE',
      decision === 'ACEPTAR' ? 'Material entregado' : 'Vale de material rechazado',
      decision === 'ACEPTAR' ? `Material de "${v.titulo}" entregado. Queda pendiente de devolución.` : `"${v.titulo}".${comentario ? ' ' + comentario : ''}`);
  });
  res.json({ data: await obtener(id) });
});

// Laboratorio/admin: recibe el material de vuelta y marca si hubo incidente.
// devoluciones: [{ item_id, cantidad_devuelta }] opcional. Si no se indica: equipos y consumibles
// regresan completos y los reactivos se consideran usados (0).
router.post('/:id/devolucion', requiereRol(...LAB), async (req, res) => {
  const id = idParam(req.params.id);
  const b = req.body || {};
  if (typeof b.hubo_incidente !== 'boolean') throw new HttpError(400, 'Indica si hubo un incidente (hubo_incidente: true o false)');
  const descripcion = texto(b.descripcion_incidente, 500, 'La descripción del incidente');
  if (b.hubo_incidente && !descripcion) throw new HttpError(400, 'Describe el incidente');
  const condicion = b.condicion ? opcion(b.condicion, ['BUENA', 'CON_DETALLES', 'DANADO'], 'Condición') : (b.hubo_incidente ? 'CON_DETALLES' : 'BUENA');
  const indicadas = new Map((Array.isArray(b.devoluciones) ? b.devoluciones : []).map((d) => [Number(d.item_id), d.cantidad_devuelta]));

  await transaccion(async (conn) => {
    const [[v]] = await conn.query(
      `SELECT v.id, v.estado, v.equipo_trabajo_id, al.nombre AS alumno, s.titulo
         FROM vales_material v JOIN solicitudes_lab s ON s.id = v.solicitud_id JOIN usuarios al ON al.id = v.solicitado_por
        WHERE v.id = ? FOR UPDATE`,
      [id],
    );
    if (!v) throw new HttpError(404, 'El vale no existe');
    if (v.estado !== 'PENDIENTE_DEVOLUCION') throw new HttpError(409, v.estado === 'DEVUELTO' ? 'Este vale ya fue devuelto' : 'Este vale no tiene material entregado');
    const [items] = await conn.query(
      `SELECT i.id, i.material_id, i.equipo_id, i.cantidad, m.tipo, m.unidad
         FROM vale_items i LEFT JOIN materiales m ON m.id = i.material_id WHERE i.vale_id = ?`,
      [id],
    );
    for (const id2 of indicadas.keys()) {
      if (!items.some((i) => i.id === id2)) throw new HttpError(400, `El artículo ${id2} no pertenece a este vale`);
    }
    const obs = `Devolución vale #${id}`;
    for (const it of items) {
      const porDefecto = it.equipo_id || it.tipo === 'CONSUMIBLE' ? it.cantidad : 0;
      const dev = indicadas.has(it.id) ? Number(indicadas.get(it.id)) : porDefecto;
      if (!Number.isFinite(dev) || dev < 0 || dev > it.cantidad) throw new HttpError(400, `La cantidad devuelta debe estar entre 0 y ${it.cantidad}`);
      if ((it.equipo_id || it.unidad === 'pza') && !Number.isInteger(dev)) throw new HttpError(400, 'Las piezas y equipos se devuelven en números enteros');
      await conn.query('UPDATE vale_items SET cantidad_devuelta = ? WHERE id = ?', [dev, it.id]);
      if (dev <= 0) continue;
      if (it.material_id) {
        await conn.query(
          "INSERT INTO movimientos_materiales (material_id, tipo, cantidad, motivo, proveedor, responsable, observaciones) VALUES (?, 'ENTRADA', ?, 'DEVOLUCION', ?, ?, ?)",
          [it.material_id, dev, v.alumno.slice(0, 120), req.usuario.nombre, obs],
        );
      } else {
        await conn.query(
          "INSERT INTO movimientos_equipos (equipo_id, tipo, cantidad, motivo, persona, condicion, responsable, observaciones) VALUES (?, 'ENTRADA', ?, 'DEVOLUCION_PRESTAMO', ?, ?, ?, ?)",
          [it.equipo_id, dev, v.alumno, condicion, req.usuario.nombre, obs],
        );
      }
    }
    await conn.query(
      "UPDATE vales_material SET estado = 'DEVUELTO', recibio_id = ?, devuelto = NOW(), hubo_incidente = ?, descripcion_incidente = ? WHERE id = ?",
      [req.usuario.id, b.hubo_incidente ? 1 : 0, b.hubo_incidente ? descripcion : null, id],
    );
    const miembros = await miembrosDe(conn, v.equipo_trabajo_id);
    await aplicarConducta(conn, miembros, b.hubo_incidente ? -1 : 1,
      b.hubo_incidente ? `Incidente con el material de "${v.titulo}"` : `Material de "${v.titulo}" devuelto sin incidentes`, 'VALE', id, req.usuario.id);
    await notificar(conn, miembros, 'CONDUCTA', b.hubo_incidente ? 'Incidente registrado (-1 punto)' : 'Material devuelto sin incidentes (+1 punto)', `Vale de "${v.titulo}".`);
  });
  res.json({ data: await obtener(id) });
});

module.exports = router;
