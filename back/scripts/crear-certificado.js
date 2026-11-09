// Crea un certificado local (back/certs) para servir la app por HTTPS y poder usar la cámara
// desde el teléfono. Es autofirmado: el navegador mostrará un aviso que hay que aceptar una vez.
// Uso: npm run certificado   (requiere openssl; viene con Git para Windows)
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = path.join(__dirname, '..', 'certs');
fs.mkdirSync(dir, { recursive: true });

// Válido para esta computadora y su zona con cobertura (192.168.137.1 es la de Windows)
const ips = new Set(['127.0.0.1', '192.168.137.1']);
Object.values(os.networkInterfaces()).flat().forEach((i) => { if (i.family === 'IPv4' && !i.internal) ips.add(i.address); });
const nombres = ['DNS:localhost', ...[...ips].map((ip) => `IP:${ip}`)].join(',');

try {
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365',
    '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'),
    '-subj', '/CN=LabControl local', '-addext', `subjectAltName=${nombres}`,
  ], { stdio: 'pipe' });
} catch (e) {
  console.error(e.code === 'ENOENT'
    ? 'No se encontró openssl. Ejecuta este comando desde Git Bash.'
    : `No se pudo crear el certificado: ${e.stderr || e.message}`);
  process.exit(1);
}
console.log(`Certificado creado en back/certs para: ${nombres}`);
console.log('Reinicia el servidor y abre en el teléfono https://<ip-de-esta-computadora>:<puerto>');
