// Resúmenes del administrador. Cada reporte responde JSON o, con ?formato=html,
// una página lista para imprimir o guardar como PDF (Ctrl+P → Guardar como PDF).
const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { requiereRol } = require('../auth');
const { fecha, opcion } = require('../validacion');
const { idParam, fechaHoraLocal } = require('../comun');

const router = express.Router();
router.use(requiereRol('administrador'));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

async function obtenerSemestre(id) {
  const [[s]] = await db.query('SELECT id, nombre, inicio, fin, estado, finalizado FROM semestres WHERE id = ?', [idParam(id, 'semestre_id')]);
  if (!s) throw new HttpError(404, 'El semestre no existe');
  // Mientras sigue activo, el periodo llega hasta hoy; si se canceló, hasta el día en que se canceló
  const hasta = s.estado === 'ACTIVO' ? fechaHoraLocal() : s.estado === 'CANCELADO' ? s.finalizado : s.fin;
  return { ...s, desde: s.inicio, hasta };
}

// Periodo por ?semestre_id=, ?mes=YYYY-MM o ?desde=&hasta=
async function periodo(q, requerido = false) {
  if (q.semestre_id) {
    const s = await obtenerSemestre(q.semestre_id);
    return { desde: s.desde, hasta: s.hasta, etiqueta: `${s.nombre} (${s.desde.slice(0, 10)} a ${s.hasta.slice(0, 10)})`, semestre: s };
  }
  if (q.mes) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(q.mes)) throw new HttpError(400, 'mes debe tener el formato YYYY-MM');
    const [a, m] = q.mes.split('-').map(Number);
    const fin = new Date(a, m, 0).getDate();
    return { desde: `${q.mes}-01 00:00:00`, hasta: `${q.mes}-${fin} 23:59:59`, etiqueta: nombreMes(q.mes) };
  }
  if (q.desde || q.hasta) {
    const d = fecha(q.desde, false, 'desde') || '2000-01-01';
    const h = fecha(q.hasta, false, 'hasta') || fechaHoraLocal().slice(0, 10);
    return { desde: `${d} 00:00:00`, hasta: `${h} 23:59:59`, etiqueta: `${d} a ${h}` };
  }
  if (requerido) throw new HttpError(400, 'Indica el periodo: semestre_id, mes (YYYY-MM) o desde/hasta');
  return { desde: '2000-01-01 00:00:00', hasta: '2999-12-31 23:59:59', etiqueta: 'Todo el historial' };
}

// ---------- Salida HTML imprimible ----------
const esc = (v) => String(v ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => (typeof v === 'number' ? v.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : v);

function html(r) {
  const tablas = r.tablas.map((t) => `
    <h2>${esc(t.titulo)}</h2>
    ${t.filas.length ? `<table><thead><tr>${t.columnas.map((c) => `<th class="${c.num ? 'n' : ''}">${esc(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${t.filas.map((f) => `<tr>${t.columnas.map((c) => `<td class="${c.num ? 'n' : ''}">${esc(num(f[c.campo]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '<p class="vacio">Sin registros en este periodo.</p>'}`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(r.titulo)}</title><style>
  :root{--tinta:#1d1b20;--suave:#6b6570;--linea:#e4dde3;--acento:#b3261e}
  *{box-sizing:border-box}body{margin:0;padding:32px;font:14px/1.45 system-ui,"Segoe UI",sans-serif;color:var(--tinta);background:#fff}
  header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid var(--acento);padding-bottom:12px;margin-bottom:20px}
  h1{margin:0;font-size:22px}h2{font-size:16px;margin:28px 0 8px}.meta{color:var(--suave);margin:4px 0 0}
  .resumen{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 8px;padding:0;list-style:none}
  .resumen li{border:1px solid var(--linea);border-radius:8px;padding:8px 12px;min-width:140px}.resumen b{display:block;font-size:20px}
  table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 8px;border-bottom:1px solid var(--linea);text-align:left}
  th{background:#f6f2f5;font-weight:600}.n{text-align:right;font-variant-numeric:tabular-nums}.vacio{color:var(--suave)}
  button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--acento);background:var(--acento);color:#fff;cursor:pointer}
  @media print{body{padding:0}button{display:none}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>
<header><div><h1>${esc(r.titulo)}</h1><p class="meta">Laboratorio Biomédico · UAdeO · ${esc(r.periodo)}</p><p class="meta">Generado el ${esc(r.generado)}</p></div>
<button type="button" onclick="print()">Imprimir / Guardar PDF</button></header>
${r.resumen.length ? `<ul class="resumen">${r.resumen.map((x) => `<li>${esc(x.etiqueta)}<b>${esc(num(x.valor))}</b></li>`).join('')}</ul>` : ''}
${tablas}
${r.nota ? `<p class="meta">${esc(r.nota)}</p>` : ''}
</body></html>`;
}

function responder(req, res, reporte) {
  reporte.generado = fechaHoraLocal();
  if (String(req.query.formato || '').toLowerCase() === 'html') {
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
    return res.type('html').send(html(reporte));
  }
  res.json({ data: reporte });
}

// ---------- Batas rentadas (filtro por mes o semestre) ----------
router.get('/batas', async (req, res) => {
  const p = await periodo(req.query);
  const [rentas] = await db.query(
    `SELECT r.id, r.respondida AS fecha, u.nombre AS alumno, a.matricula, g.nombre AS grupo, r.cantidad, r.talla, r.estado, r.devuelta
       FROM rentas_batas r JOIN usuarios u ON u.id = r.alumno_id
       LEFT JOIN alumnos a ON a.usuario_id = r.alumno_id LEFT JOIN grupos g ON g.id = a.grupo_id
      WHERE r.estado IN ('EN_RENTA','CONCLUIDA') AND r.respondida BETWEEN ? AND ? ORDER BY r.respondida`,
    [p.desde, p.hasta],
  );
  const [[sol]] = await db.query(
    "SELECT COUNT(*) AS total, SUM(estado = 'RECHAZADA') AS rechazadas FROM rentas_batas WHERE solicitada BETWEEN ? AND ?",
    [p.desde, p.hasta],
  );
  const porMes = {};
  for (const r of rentas) {
    const m = r.fecha.slice(0, 7);
    porMes[m] ??= { mes: nombreMes(m), rentas: 0, batas: 0 };
    porMes[m].rentas += 1;
    porMes[m].batas += r.cantidad;
  }
  responder(req, res, {
    titulo: 'Resumen de batas rentadas',
    periodo: p.etiqueta,
    resumen: [
      { etiqueta: 'Rentas', valor: rentas.length },
      { etiqueta: 'Batas rentadas', valor: rentas.reduce((t, r) => t + r.cantidad, 0) },
      { etiqueta: 'Aún en renta', valor: rentas.filter((r) => r.estado === 'EN_RENTA').length },
      { etiqueta: 'Solicitudes rechazadas', valor: Number(sol.rechazadas || 0) },
    ],
    tablas: [
      { titulo: 'Por mes', columnas: [{ campo: 'mes', titulo: 'Mes' }, { campo: 'rentas', titulo: 'Rentas', num: true }, { campo: 'batas', titulo: 'Batas', num: true }], filas: Object.values(porMes) },
      {
        titulo: 'Detalle',
        columnas: [{ campo: 'fecha', titulo: 'Fecha' }, { campo: 'alumno', titulo: 'Alumno' }, { campo: 'matricula', titulo: 'Matrícula' }, { campo: 'grupo', titulo: 'Grupo' },
          { campo: 'cantidad', titulo: 'Batas', num: true }, { campo: 'talla', titulo: 'Talla' }, { campo: 'estado', titulo: 'Estado' }, { campo: 'devuelta', titulo: 'Devuelta' }],
        filas: rentas,
      },
    ],
  });
});

// ---------- Inventario actual ----------
router.get('/inventario', async (req, res) => {
  const [mats] = await db.query('SELECT codigo, nombre, tipo, stock, unidad, stock_minimo, fecha_caducidad FROM materiales WHERE activo = 1 ORDER BY codigo');
  const [eqs] = await db.query("SELECT codigo, nombre, CONCAT_WS(' ', marca, modelo) AS modelo, cantidad, estado, proximo_mantenimiento FROM equipos WHERE activo = 1 ORDER BY codigo");
  responder(req, res, {
    titulo: 'Reporte de inventario actual',
    periodo: `Existencias al ${fechaHoraLocal().slice(0, 16)}`,
    resumen: [
      { etiqueta: 'Materiales', valor: mats.length },
      { etiqueta: 'Con stock bajo o agotados', valor: mats.filter((m) => m.stock <= m.stock_minimo).length },
      { etiqueta: 'Equipos', valor: eqs.length },
      { etiqueta: 'Unidades de equipo', valor: eqs.reduce((t, e) => t + e.cantidad, 0) },
    ],
    tablas: [
      { titulo: 'Materiales y reactivos', columnas: [{ campo: 'codigo', titulo: 'Código' }, { campo: 'nombre', titulo: 'Nombre' }, { campo: 'tipo', titulo: 'Tipo' },
        { campo: 'stock', titulo: 'Existencia', num: true }, { campo: 'unidad', titulo: 'Unidad' }, { campo: 'stock_minimo', titulo: 'Mínimo', num: true }, { campo: 'fecha_caducidad', titulo: 'Caducidad' }], filas: mats },
      { titulo: 'Equipos', columnas: [{ campo: 'codigo', titulo: 'Código' }, { campo: 'nombre', titulo: 'Nombre' }, { campo: 'modelo', titulo: 'Marca / modelo' },
        { campo: 'cantidad', titulo: 'Disponibles', num: true }, { campo: 'estado', titulo: 'Estado' }, { campo: 'proximo_mantenimiento', titulo: 'Próx. mantenimiento' }], filas: eqs },
    ],
  });
});

// ---------- Entradas o salidas de un semestre (o periodo) ----------
router.get('/movimientos', async (req, res) => {
  const tipo = opcion(req.query.tipo, ['ENTRADA', 'SALIDA'], 'tipo');
  const p = await periodo(req.query, true);
  const [rows] = await db.query(
    `SELECT mv.fecha_hora, 'Material' AS clase, m.codigo, m.nombre, mv.cantidad, m.unidad, mv.motivo,
            COALESCE(mv.solicitante, mv.proveedor) AS persona, mv.grupo, mv.practica, mv.responsable
       FROM movimientos_materiales mv JOIN materiales m ON m.id = mv.material_id
      WHERE mv.tipo = ? AND mv.fecha_hora BETWEEN ? AND ?
     UNION ALL
     SELECT mv.fecha_hora, 'Equipo', e.codigo, e.nombre, mv.cantidad, 'pza', mv.motivo,
            COALESCE(mv.persona, mv.proveedor), mv.grupo, mv.practica, mv.responsable
       FROM movimientos_equipos mv JOIN equipos e ON e.id = mv.equipo_id
      WHERE mv.tipo = ? AND mv.fecha_hora BETWEEN ? AND ?
     ORDER BY fecha_hora`,
    [tipo, p.desde, p.hasta, tipo, p.desde, p.hasta],
  );
  const porArticulo = {};
  for (const r of rows) {
    porArticulo[r.codigo] ??= { codigo: r.codigo, nombre: r.nombre, unidad: r.unidad, movimientos: 0, total: 0 };
    porArticulo[r.codigo].movimientos += 1;
    porArticulo[r.codigo].total += r.cantidad;
  }
  const palabra = tipo === 'ENTRADA' ? 'Entradas' : 'Salidas';
  responder(req, res, {
    titulo: `${palabra} de inventario`,
    periodo: p.etiqueta,
    resumen: [{ etiqueta: palabra, valor: rows.length }, { etiqueta: 'Artículos distintos', valor: Object.keys(porArticulo).length }],
    tablas: [
      { titulo: 'Total por artículo', columnas: [{ campo: 'codigo', titulo: 'Código' }, { campo: 'nombre', titulo: 'Nombre' },
        { campo: 'movimientos', titulo: 'Movimientos', num: true }, { campo: 'total', titulo: 'Cantidad', num: true }, { campo: 'unidad', titulo: 'Unidad' }],
        filas: Object.values(porArticulo).sort((a, b) => a.codigo.localeCompare(b.codigo)) },
      { titulo: 'Detalle', columnas: [{ campo: 'fecha_hora', titulo: 'Fecha' }, { campo: 'codigo', titulo: 'Código' }, { campo: 'nombre', titulo: 'Artículo' },
        { campo: 'cantidad', titulo: 'Cantidad', num: true }, { campo: 'unidad', titulo: 'Unidad' }, { campo: 'motivo', titulo: 'Motivo' },
        { campo: 'persona', titulo: tipo === 'ENTRADA' ? 'Proveedor / quién devuelve' : 'Quién recibe' }, { campo: 'grupo', titulo: 'Grupo' }, { campo: 'responsable', titulo: 'Registró' }],
        filas: rows },
    ],
  });
});

// ---------- Comparación inventario inicial vs final del semestre ----------
router.get('/comparacion', async (req, res) => {
  const s = await obtenerSemestre(req.query.semestre_id);
  const [inicio] = await db.query('SELECT clase, articulo_id, codigo, nombre, cantidad, unidad FROM inventario_inicio WHERE semestre_id = ?', [s.id]);
  let [fin] = await db.query('SELECT clase, articulo_id, codigo, nombre, cantidad, unidad FROM inventario_fin WHERE semestre_id = ?', [s.id]);
  const enCurso = !fin.length;
  if (enCurso) { // semestre aún activo: se compara contra el inventario de hoy
    [fin] = await db.query(
      `SELECT 'MATERIAL' AS clase, id AS articulo_id, codigo, nombre, stock AS cantidad, unidad FROM materiales WHERE activo = 1
       UNION ALL SELECT 'EQUIPO', id, codigo, nombre, cantidad, 'pza' FROM equipos WHERE activo = 1`,
    );
  }
  const clave = (x) => `${x.clase}-${x.articulo_id}`;
  const mapa = new Map();
  for (const x of inicio) mapa.set(clave(x), { codigo: x.codigo, nombre: x.nombre, clase: x.clase === 'MATERIAL' ? 'Material' : 'Equipo', unidad: x.unidad, inicial: x.cantidad, final: 0 });
  for (const x of fin) {
    const fila = mapa.get(clave(x)) || { codigo: x.codigo, nombre: x.nombre, clase: x.clase === 'MATERIAL' ? 'Material' : 'Equipo', unidad: x.unidad, inicial: 0 };
    fila.final = x.cantidad;
    mapa.set(clave(x), fila);
  }
  const filas = [...mapa.values()].map((f) => ({ ...f, diferencia: Math.round((f.final - f.inicial) * 100) / 100 }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  responder(req, res, {
    titulo: 'Comparación de inventario del semestre',
    periodo: `${s.nombre} (${s.inicio.slice(0, 10)} a ${s.fin.slice(0, 10)})`,
    resumen: [
      { etiqueta: 'Artículos comparados', valor: filas.length },
      { etiqueta: 'Disminuyeron', valor: filas.filter((f) => f.diferencia < 0).length },
      { etiqueta: 'Aumentaron', valor: filas.filter((f) => f.diferencia > 0).length },
      { etiqueta: 'Sin cambio', valor: filas.filter((f) => f.diferencia === 0).length },
    ],
    tablas: [{ titulo: 'Inicio vs. fin', columnas: [{ campo: 'codigo', titulo: 'Código' }, { campo: 'nombre', titulo: 'Nombre' }, { campo: 'clase', titulo: 'Clase' },
      { campo: 'inicial', titulo: 'Al inicio', num: true }, { campo: 'final', titulo: enCurso ? 'Hoy' : 'Al final', num: true },
      { campo: 'diferencia', titulo: 'Diferencia', num: true }, { campo: 'unidad', titulo: 'Unidad' }], filas }],
    nota: enCurso ? 'El semestre sigue en curso: la columna "Hoy" muestra el inventario actual.' : null,
  });
});

module.exports = router;
