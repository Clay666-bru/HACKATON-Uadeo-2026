// Crea o actualiza un usuario.
// Uso: npm run usuario:crear -- <usuario> <rol> "<Nombre completo>" <contraseña>
//   rol: laboratorio | profesor | administrador
require('dotenv').config({ quiet: true });
const db = require('../src/db');
const { cifrarPassword, ROLES } = require('../src/auth');

async function main() {
  const [usuario, rol, nombre, password] = process.argv.slice(2);
  if (!usuario || !rol || !nombre || !password) {
    console.log('Uso: npm run usuario:crear -- <usuario> <rol> "<Nombre completo>" <contraseña>');
    process.exit(1);
  }
  if (rol.toLowerCase() === 'alumno') {
    console.error('Los alumnos los da de alta su profesor (POST /api/escolar/alumnos) para asignarles grupo.');
    process.exit(1);
  }
  if (!ROLES.includes(rol.toLowerCase())) {
    console.error(`Rol inválido. Opciones: ${ROLES.filter((r) => r !== 'alumno').join(', ')}`);
    process.exit(1);
  }
  if (!/^[a-z0-9._-]{3,40}$/i.test(usuario)) {
    console.error('El usuario debe tener 3 a 40 caracteres: letras, números, punto, guion o guion bajo.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }
  await db.query(
    `INSERT INTO usuarios (usuario, nombre, password_hash, rol) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), password_hash = VALUES(password_hash), rol = VALUES(rol), activo = 1`,
    [usuario.toLowerCase(), nombre.trim(), cifrarPassword(password), rol.toUpperCase()],
  );
  console.log(`Usuario "${usuario.toLowerCase()}" (${rol.toLowerCase()}) listo.`);
  await db.end();
}

main().catch((e) => {
  console.error(e.code === 'ER_NO_SUCH_TABLE' ? 'Falta la tabla usuarios: ejecuta docs/usuarios.sql primero.' : e.message);
  process.exit(1);
});
