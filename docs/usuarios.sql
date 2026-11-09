/*
  Tabla de usuarios para iniciar sesión con contraseña.
  Se ejecuta DESPUÉS de "base de datos.sql" (usa la base almacen_lab).
  Las contraseñas se guardan cifradas (scrypt); para crear usuarios usa:
    cd back && npm run usuario:crear -- <usuario> <rol> "<Nombre completo>" <contraseña>
*/
USE `almacen_lab`;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario` varchar(40) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('PROFESOR','ADMINISTRADOR','LABORATORIO') NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `ultimo_acceso` datetime DEFAULT NULL,
  `creado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_usuario` (`usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
