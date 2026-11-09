/*
  NIVEL 2 · Prácticas, alumnos, batas, conducta, semestres y reportes.
  Ejecutar DESPUÉS de "base de datos.sql" y "usuarios.sql".
  Se puede volver a ejecutar sin perder datos (IF NOT EXISTS).
*/
USE `almacen_lab`;

-- ---------- Usuarios: rol ALUMNO, conducta y avatar ----------
ALTER TABLE `usuarios`
  MODIFY `rol` enum('PROFESOR','ADMINISTRADOR','LABORATORIO','ALUMNO') NOT NULL,
  ADD COLUMN IF NOT EXISTS `puntos_conducta` int(11) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `avatar` tinyint(4) NOT NULL DEFAULT 1;

-- ---------- Catálogos escolares ----------
CREATE TABLE IF NOT EXISTS `grupos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(30) NOT NULL,
  `turno` enum('MATUTINO','VESPERTINO') NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grupos_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `materias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_materias_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Qué profesor da qué materia a qué grupo (alimenta los desplegables de la solicitud)
CREATE TABLE IF NOT EXISTS `clases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `profesor_id` int(11) NOT NULL,
  `grupo_id` int(11) NOT NULL,
  `materia_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clase` (`profesor_id`,`grupo_id`,`materia_id`),
  KEY `fk_clase_grupo` (`grupo_id`),
  KEY `fk_clase_materia` (`materia_id`),
  CONSTRAINT `fk_clase_profesor` FOREIGN KEY (`profesor_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_clase_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`),
  CONSTRAINT `fk_clase_materia` FOREIGN KEY (`materia_id`) REFERENCES `materias` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Equipos de trabajo de alumnos (distinto de `equipos`, que es el equipo de laboratorio)
CREATE TABLE IF NOT EXISTS `equipos_trabajo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grupo_id` int(11) NOT NULL,
  `nombre` varchar(40) NOT NULL,
  `creado_por` int(11) NOT NULL,
  `creado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_equipo_trabajo` (`grupo_id`,`nombre`),
  CONSTRAINT `fk_eqt_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`),
  CONSTRAINT `fk_eqt_creador` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Datos de alumno: grupo y equipo (el profesor los da de alta)
CREATE TABLE IF NOT EXISTS `alumnos` (
  `usuario_id` int(11) NOT NULL,
  `matricula` varchar(20) NOT NULL,
  `grupo_id` int(11) DEFAULT NULL,
  `equipo_trabajo_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`usuario_id`),
  UNIQUE KEY `uq_alumnos_matricula` (`matricula`),
  KEY `fk_alumno_grupo` (`grupo_id`),
  KEY `fk_alumno_equipo` (`equipo_trabajo_id`),
  CONSTRAINT `fk_alumno_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_alumno_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`),
  CONSTRAINT `fk_alumno_equipo` FOREIGN KEY (`equipo_trabajo_id`) REFERENCES `equipos_trabajo` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Renta de batas (cada renta queda con sus fechas) ----------
CREATE TABLE IF NOT EXISTS `rentas_batas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `alumno_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `talla` varchar(5) DEFAULT NULL,
  `estado` enum('SOLICITADA','RECHAZADA','EN_RENTA','CONCLUIDA','CANCELADA') NOT NULL DEFAULT 'SOLICITADA',
  `solicitada` datetime NOT NULL DEFAULT current_timestamp(),
  `respondida` datetime DEFAULT NULL,
  `respondio_id` int(11) DEFAULT NULL,
  `comentario` varchar(255) DEFAULT NULL,
  `devuelta` datetime DEFAULT NULL,
  `recibio_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_batas_estado` (`estado`),
  KEY `ix_batas_fecha` (`respondida`),
  KEY `fk_bata_alumno` (`alumno_id`),
  CONSTRAINT `fk_bata_alumno` FOREIGN KEY (`alumno_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_bata_respondio` FOREIGN KEY (`respondio_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_bata_recibio` FOREIGN KEY (`recibio_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `chk_bata_cantidad` CHECK (`cantidad` BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Solicitud de laboratorio (profesor -> administrador -> laboratorista) ----------
CREATE TABLE IF NOT EXISTS `solicitudes_lab` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `profesor_id` int(11) NOT NULL,
  `grupo_id` int(11) NOT NULL,
  `materia_id` int(11) NOT NULL,
  `titulo` varchar(150) NOT NULL,
  `descripcion` text NOT NULL,
  `fecha` date NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `num_equipos` int(11) NOT NULL,
  `acepta_reglamento` datetime NOT NULL,
  `estado` enum('PENDIENTE_ADMIN','RECHAZADA_ADMIN','PENDIENTE_LAB','RECHAZADA_LAB','APROBADA','CANCELADA','REALIZADA') NOT NULL DEFAULT 'PENDIENTE_ADMIN',
  `admin_id` int(11) DEFAULT NULL,
  `admin_fecha` datetime DEFAULT NULL,
  `admin_comentario` varchar(255) DEFAULT NULL,
  `lab_id` int(11) DEFAULT NULL,
  `lab_fecha` datetime DEFAULT NULL,
  `lab_comentario` varchar(255) DEFAULT NULL,
  `creado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `ix_sol_fecha` (`fecha`,`estado`),
  KEY `fk_sol_profesor` (`profesor_id`),
  KEY `fk_sol_grupo` (`grupo_id`),
  CONSTRAINT `fk_sol_profesor` FOREIGN KEY (`profesor_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_sol_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`),
  CONSTRAINT `fk_sol_materia` FOREIGN KEY (`materia_id`) REFERENCES `materias` (`id`),
  CONSTRAINT `fk_sol_admin` FOREIGN KEY (`admin_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_sol_lab` FOREIGN KEY (`lab_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `chk_sol_horas` CHECK (`hora_inicio` < `hora_fin`),
  CONSTRAINT `chk_sol_equipos` CHECK (`num_equipos` BETWEEN 1 AND 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Materiales y equipos que pide el profesor, por equipo de alumnos
CREATE TABLE IF NOT EXISTS `solicitud_lab_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `solicitud_id` int(11) NOT NULL,
  `material_id` int(11) DEFAULT NULL,
  `equipo_id` int(11) DEFAULT NULL,
  `cantidad_por_equipo` double NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_soli_solicitud` (`solicitud_id`),
  CONSTRAINT `fk_soli_solicitud` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_lab` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_soli_material` FOREIGN KEY (`material_id`) REFERENCES `materiales` (`id`),
  CONSTRAINT `fk_soli_equipo` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `chk_soli_articulo` CHECK ((`material_id` IS NULL) <> (`equipo_id` IS NULL)),
  CONSTRAINT `chk_soli_cantidad` CHECK (`cantidad_por_equipo` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Bitácora de la práctica realizada (una por práctica; suma o resta conducta al profesor)
CREATE TABLE IF NOT EXISTS `practica_bitacora` (
  `solicitud_id` int(11) NOT NULL,
  `anotaciones` text DEFAULT NULL,
  `hubo_incidente` tinyint(1) NOT NULL,
  `descripcion_incidente` varchar(500) DEFAULT NULL,
  `registrado_por` int(11) NOT NULL,
  `registrado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`solicitud_id`),
  CONSTRAINT `fk_bit_solicitud` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_lab` (`id`),
  CONSTRAINT `fk_bit_usuario` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `practica_fotos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `solicitud_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `archivo` varchar(80) NOT NULL,
  `descripcion` varchar(200) DEFAULT NULL,
  `subida` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_foto_solicitud` (`solicitud_id`),
  CONSTRAINT `fk_foto_solicitud` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_lab` (`id`),
  CONSTRAINT `fk_foto_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Vale de material de cada equipo de alumnos ----------
CREATE TABLE IF NOT EXISTS `vales_material` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `solicitud_id` int(11) NOT NULL,
  `equipo_trabajo_id` int(11) NOT NULL,
  `solicitado_por` int(11) NOT NULL,
  `estado` enum('SOLICITADO','RECHAZADO','PENDIENTE_DEVOLUCION','DEVUELTO') NOT NULL DEFAULT 'SOLICITADO',
  `solicitado` datetime NOT NULL DEFAULT current_timestamp(),
  `atendio_id` int(11) DEFAULT NULL,
  `atendido` datetime DEFAULT NULL,
  `comentario` varchar(255) DEFAULT NULL,
  `recibio_id` int(11) DEFAULT NULL,
  `devuelto` datetime DEFAULT NULL,
  `hubo_incidente` tinyint(1) DEFAULT NULL,
  `descripcion_incidente` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vale` (`solicitud_id`,`equipo_trabajo_id`),
  KEY `ix_vale_estado` (`estado`),
  CONSTRAINT `fk_vale_solicitud` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_lab` (`id`),
  CONSTRAINT `fk_vale_equipo` FOREIGN KEY (`equipo_trabajo_id`) REFERENCES `equipos_trabajo` (`id`),
  CONSTRAINT `fk_vale_alumno` FOREIGN KEY (`solicitado_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_vale_atendio` FOREIGN KEY (`atendio_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_vale_recibio` FOREIGN KEY (`recibio_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `vale_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vale_id` int(11) NOT NULL,
  `material_id` int(11) DEFAULT NULL,
  `equipo_id` int(11) DEFAULT NULL,
  `cantidad` double NOT NULL,
  `cantidad_devuelta` double DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_vi_vale` (`vale_id`),
  CONSTRAINT `fk_vi_vale` FOREIGN KEY (`vale_id`) REFERENCES `vales_material` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vi_material` FOREIGN KEY (`material_id`) REFERENCES `materiales` (`id`),
  CONSTRAINT `fk_vi_equipo` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `chk_vi_articulo` CHECK ((`material_id` IS NULL) <> (`equipo_id` IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Contador de buena conducta (historial de cada punto) ----------
CREATE TABLE IF NOT EXISTS `conducta_eventos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `delta` int(11) NOT NULL,
  `motivo` varchar(150) NOT NULL,
  `origen` enum('PRACTICA','VALE','AJUSTE') NOT NULL,
  `origen_id` int(11) DEFAULT NULL,
  `registrado_por` int(11) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `ix_conducta_usuario` (`usuario_id`,`fecha`),
  CONSTRAINT `fk_cond_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_cond_registro` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Semestre, cuenta regresiva y cortes de inventario ----------
CREATE TABLE IF NOT EXISTS `semestres` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) NOT NULL,
  `inicio` datetime NOT NULL,
  `fin` datetime NOT NULL,
  `estado` enum('ACTIVO','FINALIZADO') NOT NULL DEFAULT 'ACTIVO',
  `iniciado_por` int(11) NOT NULL,
  `finalizado` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_semestre_estado` (`estado`),
  CONSTRAINT `fk_sem_usuario` FOREIGN KEY (`iniciado_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `chk_sem_fechas` CHECK (`inicio` < `fin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Un semestre se puede cancelar (sin inventario final) o finalizar antes de tiempo
ALTER TABLE `semestres` MODIFY `estado` enum('ACTIVO','FINALIZADO','CANCELADO') NOT NULL DEFAULT 'ACTIVO';

-- Foto del inventario al presionar "Iniciar semestre"
CREATE TABLE IF NOT EXISTS `inventario_inicio` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `semestre_id` int(11) NOT NULL,
  `clase` enum('MATERIAL','EQUIPO') NOT NULL,
  `articulo_id` int(11) NOT NULL,
  `codigo` varchar(40) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `cantidad` double NOT NULL,
  `unidad` varchar(20) NOT NULL,
  `estado` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ini` (`semestre_id`,`clase`,`articulo_id`),
  CONSTRAINT `fk_ini_semestre` FOREIGN KEY (`semestre_id`) REFERENCES `semestres` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Foto del inventario cuando termina la cuenta regresiva (para la comparación)
CREATE TABLE IF NOT EXISTS `inventario_fin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `semestre_id` int(11) NOT NULL,
  `clase` enum('MATERIAL','EQUIPO') NOT NULL,
  `articulo_id` int(11) NOT NULL,
  `codigo` varchar(40) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `cantidad` double NOT NULL,
  `unidad` varchar(20) NOT NULL,
  `estado` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fin` (`semestre_id`,`clase`,`articulo_id`),
  CONSTRAINT `fk_fin_semestre` FOREIGN KEY (`semestre_id`) REFERENCES `semestres` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Avisos para cada usuario ----------
CREATE TABLE IF NOT EXISTS `notificaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `tipo` varchar(30) NOT NULL,
  `titulo` varchar(120) NOT NULL,
  `mensaje` varchar(500) NOT NULL,
  `leida` tinyint(1) NOT NULL DEFAULT 0,
  `creada` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `ix_notif_usuario` (`usuario_id`,`leida`),
  CONSTRAINT `fk_notif_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Manuales (por ahora solo el título; el archivo se sube después) ----------
CREATE TABLE IF NOT EXISTS `manuales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titulo` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `archivo` varchar(200) DEFAULT NULL,
  `orden` int(11) NOT NULL DEFAULT 0,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- Datos iniciales ----------
INSERT IGNORE INTO `grupos` (`nombre`, `turno`) VALUES
  ('1-1 Biomédicas', 'MATUTINO'), ('1-2 Biomédicas', 'VESPERTINO'),
  ('3-1 Biomédicas', 'MATUTINO'), ('3-2 Biomédicas', 'VESPERTINO');

INSERT IGNORE INTO `materias` (`nombre`) VALUES
  ('Química general'), ('Biología celular'), ('Microbiología'),
  ('Física'), ('Criminalística'), ('Bioquímica');

INSERT INTO `manuales` (`titulo`, `descripcion`, `orden`)
SELECT * FROM (SELECT 'Manual de seguridad del laboratorio' AS t, 'Normas, equipo de protección y emergencias' AS d, 1 AS o UNION ALL
               SELECT 'Manual de uso de equipos', 'Microscopios, centrífuga, balanza y más', 2 UNION ALL
               SELECT 'Manual de prácticas', 'Guías de las prácticas del semestre', 3) m
WHERE NOT EXISTS (SELECT 1 FROM `manuales`);
