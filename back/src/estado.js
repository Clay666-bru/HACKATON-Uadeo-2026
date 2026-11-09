// Cálculo de estados y alertas a partir de los datos del inventario
const DIAS_CAD = Number(process.env.DIAS_AVISO_CADUCIDAD || 30);
const DIAS_MANT = Number(process.env.DIAS_AVISO_MANTENIMIENTO || 15);

function hoy() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diasHasta(fechaTexto) {
  if (!fechaTexto) return null;
  const [a, m, d] = fechaTexto.slice(0, 10).split('-').map(Number);
  return Math.round((new Date(a, m - 1, d) - hoy()) / 86400000);
}

function estadoMaterial(m) {
  const avisos = [];
  const dias = diasHasta(m.fecha_caducidad);
  if (m.stock <= 0) avisos.push({ tipo: 'AGOTADO', prioridad: 'alta', mensaje: 'Sin existencias' });
  else if (m.stock <= m.stock_minimo) avisos.push({ tipo: 'STOCK_BAJO', prioridad: 'media', mensaje: `Quedan ${m.stock} ${m.unidad} (mínimo ${m.stock_minimo})` });
  if (dias !== null && dias < 0) avisos.push({ tipo: 'CADUCADO', prioridad: 'alta', mensaje: `Caducó el ${m.fecha_caducidad}` });
  else if (dias !== null && dias <= DIAS_CAD) avisos.push({ tipo: 'POR_CADUCAR', prioridad: 'media', mensaje: `Caduca en ${dias} día(s) (${m.fecha_caducidad})` });
  const estado = avisos.find((a) => a.prioridad === 'alta')?.tipo || avisos[0]?.tipo || 'DISPONIBLE';
  return { ...m, estado, avisos };
}

function estadoEquipo(e) {
  const avisos = [];
  const dias = diasHasta(e.proximo_mantenimiento);
  if (e.estado === 'FUERA_DE_SERVICIO') avisos.push({ tipo: 'FUERA_DE_SERVICIO', prioridad: 'alta', mensaje: 'Equipo fuera de servicio' });
  if (e.estado === 'EN_MANTENIMIENTO') avisos.push({ tipo: 'EN_MANTENIMIENTO', prioridad: 'media', mensaje: 'Equipo en mantenimiento' });
  if (e.cantidad <= 0) avisos.push({ tipo: 'SIN_DISPONIBLES', prioridad: 'media', mensaje: 'No hay unidades disponibles en almacén' });
  if (dias !== null && dias < 0 && e.estado !== 'EN_MANTENIMIENTO') avisos.push({ tipo: 'MANTENIMIENTO_VENCIDO', prioridad: 'alta', mensaje: `Mantenimiento vencido desde ${e.proximo_mantenimiento}` });
  else if (dias !== null && dias >= 0 && dias <= DIAS_MANT) avisos.push({ tipo: 'MANTENIMIENTO_PROXIMO', prioridad: 'media', mensaje: `Mantenimiento en ${dias} día(s) (${e.proximo_mantenimiento})` });
  return { ...e, avisos };
}

module.exports = { estadoMaterial, estadoEquipo, diasHasta };
