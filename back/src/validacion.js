const { HttpError } = require('./errors');

// Texto opcional recortado; null si viene vacío
function texto(v, max, campo = 'Un campo') {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > max) throw new HttpError(400, `${campo} excede ${max} caracteres`);
  return s;
}

function textoRequerido(v, max, campo) {
  const s = texto(v, max, campo);
  if (!s) throw new HttpError(400, `${campo} es obligatorio`);
  return s;
}

// Fecha YYYY-MM-DD (o con hora si conHora) válida en el calendario
function fecha(v, conHora = false, campo = 'Fecha') {
  const s = texto(v, 25, campo);
  if (!s) return null;
  const re = conHora ? /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(s) || Number.isNaN(new Date(s.slice(0, 10) + 'T00:00:00').getTime())) {
    throw new HttpError(400, `${campo} inválida: ${s}`);
  }
  return s.replace('T', ' ');
}

function numeroNoNegativo(v, campo, { entero = false } = {}) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${campo} debe ser 0 o mayor`);
  if (entero && !Number.isInteger(n)) throw new HttpError(400, `${campo} debe ser un número entero`);
  return n;
}

function opcion(v, opciones, campo) {
  const s = String(v || '').toUpperCase();
  if (!opciones.includes(s)) throw new HttpError(400, `${campo} inválido. Opciones: ${opciones.join(', ')}`);
  return s;
}

module.exports = { texto, textoRequerido, fecha, numeroNoNegativo, opcion };
