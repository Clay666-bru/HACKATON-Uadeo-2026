require('dotenv').config({ quiet: true });
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const express = require('express');
const db = require('./db');
const { errorHandler, HttpError } = require('./errors');
const { leerUsuario } = require('./auth');
const inventario = require('./routes/inventario');
const movimientos = require('./routes/movimientos');
const practicas = require('./routes/practicas');
const semestres = require('./routes/semestres');

const { version: VERSION } = require('../package.json');

// HTTPS opcional para usar la cámara desde el teléfono: los navegadores solo permiten la
// cámara en páginas seguras. Se activa si existe back/certs (npm run certificado).
const DIR_CERTS = path.join(__dirname, '..', 'certs');
const ARCHIVO_LLAVE = path.join(DIR_CERTS, 'key.pem');
const ARCHIVO_CERT = path.join(DIR_CERTS, 'cert.pem');
const conHttps = fs.existsSync(ARCHIVO_LLAVE) && fs.existsSync(ARCHIVO_CERT);

const app = express();
// Desde otro dispositivo, http pasa a https; en la propia computadora (localhost) no hace falta
app.use((req, res, next) => {
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(req.hostname);
  if (conHttps && !req.socket.encrypted && !local && ['GET', 'HEAD'].includes(req.method)) {
    return res.redirect(`https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(leerUsuario);

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', version: VERSION, nivel: 2, db: 'conectada' });
  } catch (e) {
    res.status(503).json({ status: 'error', version: VERSION, nivel: 2, db: 'sin conexión', detalle: e.code });
  }
});

// Nivel 1: sesión, inventario y movimientos
app.use('/api/auth', require('./routes/auth'));
app.use('/api/inventario', inventario.router);
app.use('/api/inventario', require('./routes/articulos'));
app.use('/api/movimientos', movimientos);

// Nivel 2: escuela, prácticas, vales, batas, conducta, semestre, reportes y manuales
app.use('/api/escolar', require('./routes/escolar'));
app.use('/api/practicas', practicas.router);
app.use('/api/vales', require('./routes/vales'));
app.use('/api/batas', require('./routes/batas'));
app.use('/api/conducta', require('./routes/conducta'));
app.use('/api/semestres', semestres.router);
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/manuales', require('./routes/manuales'));
app.use('/api/notificaciones', require('./routes/notificaciones'));
// Fotos de prácticas: nombres aleatorios de 128 bits, solo se conocen desde la práctica
app.use('/api/fotos', express.static(practicas.CARPETA_FOTOS, {
  index: false, dotfiles: 'deny', fallthrough: true,
  setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
}));

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')));

// Front (HTML, CSS y JS sin compilación)
app.use(express.static(path.join(__dirname, '..', '..', 'front')));

app.use(errorHandler);

const PORT = Number(process.env.PORT || 3000);
const alIniciar = () => {
  console.log(`Servidor listo en http://localhost:${PORT}${conHttps ? ` y https://<ip-de-esta-computadora>:${PORT}` : ''}`);
  semestres.iniciarRevision(); // cuenta regresiva del semestre
};

if (conHttps) {
  // El mismo puerto atiende http y https: el primer byte de una conexión TLS es 22
  const servidorHttp = http.createServer(app);
  const servidorHttps = https.createServer({ key: fs.readFileSync(ARCHIVO_LLAVE), cert: fs.readFileSync(ARCHIVO_CERT) }, app);
  net.createServer((socket) => {
    socket.on('error', () => {});
    socket.once('data', (datos) => {
      socket.pause();
      socket.unshift(datos);
      (datos[0] === 22 ? servidorHttps : servidorHttp).emit('connection', socket);
      process.nextTick(() => socket.resume());
    });
  }).listen(PORT, alIniciar);
} else {
  app.listen(PORT, alIniciar);
}
