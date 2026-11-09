class HttpError extends Error {
  constructor(status, message, detalles) {
    super(message);
    this.status = status;
    this.detalles = detalles;
  }
}

// Convierte errores de MySQL (triggers, CHECK, FK) en respuestas entendibles
function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, detalles: err.detalles });
  }
  if (err.sqlState === '45000') {
    // SIGNAL de los triggers: "STOCK INSUFICIENTE: ...", "EQUIPO NO DISPONIBLE: ..."
    return res.status(409).json({ error: err.sqlMessage });
  }
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.errno === 4025) {
    return res.status(400).json({ error: 'Los datos no cumplen las reglas de la base de datos', detalles: err.sqlMessage });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ese registro ya existe (nombre, usuario o matrícula repetidos)' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Uno de los datos seleccionados no existe (grupo, materia, usuario o artículo)' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo es demasiado grande (fotos: máximo 5 MB; Excel: máximo 2 MB)' });
  }
  // Otros errores de subida de archivos (campo equivocado, más de un archivo...)
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `No se pudo recibir el archivo (${err.field ? `campo "${err.field}"` : err.code}). Envía un solo archivo en el campo indicado.` });
  }
  // Cuerpo de la petición inválido (JSON mal formado, demasiado grande): errores del propio Express
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Los datos enviados no son un JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Los datos enviados son demasiado grandes' });
  }
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('[db]', err.code, err.message);
    return res.status(503).json({ error: 'No hay conexión con la base de datos. Revisa que MySQL esté encendido y el archivo .env.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { HttpError, errorHandler };
