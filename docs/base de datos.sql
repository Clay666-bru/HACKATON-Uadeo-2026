/*
SQLyog Professional v12.4.1 (64 bit)
MySQL - 10.4.32-MariaDB : Database - almacen_lab
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`almacen_lab` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;

USE `almacen_lab`;

/*Table structure for table `equipos` */

DROP TABLE IF EXISTS `equipos`;

CREATE TABLE `equipos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(40) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `marca` varchar(60) DEFAULT NULL,
  `modelo` varchar(60) DEFAULT NULL,
  `numero_serie` varchar(80) DEFAULT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 0,
  `estado` enum('OPERATIVO','EN_MANTENIMIENTO','FUERA_DE_SERVICIO') NOT NULL DEFAULT 'OPERATIVO',
  `ultimo_mantenimiento` date DEFAULT NULL,
  `proximo_mantenimiento` date DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  CONSTRAINT `ck_eq_cantidad` CHECK (`cantidad` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `equipos` */

insert  into `equipos`(`id`,`codigo`,`nombre`,`marca`,`modelo`,`numero_serie`,`cantidad`,`estado`,`ultimo_mantenimiento`,`proximo_mantenimiento`,`activo`,`creado`) values 
(1,'EQP-001','Microscopio óptico','Olympus','CX23','OLY-CX23-0001',5,'OPERATIVO','2026-05-01','2026-11-01',1,'2026-11-07 16:29:58'),
(2,'EQP-002','Centrífuga clínica','Hettich','EBA 200','HET-200-0042',2,'EN_MANTENIMIENTO','2026-10-08','2027-01-06',1,'2026-11-07 16:29:58'),
(3,'EQP-003','Multímetro biomédico','Fluke','117','FLK-117-7781',6,'OPERATIVO','2026-07-30','2027-07-30',1,'2026-11-07 16:29:58'),
(4,'EQP-004','Electrocardiógrafo','Contec','ECG300G','CTC-300-1150',4,'OPERATIVO','2026-09-08','2027-01-06',1,'2026-11-07 16:29:58');

/*Table structure for table `materiales` */

DROP TABLE IF EXISTS `materiales`;

CREATE TABLE `materiales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(40) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `tipo` enum('REACTIVO','CONSUMIBLE') NOT NULL,
  `unidad` varchar(20) NOT NULL DEFAULT 'pza',
  `stock` double NOT NULL DEFAULT 0,
  `stock_minimo` double NOT NULL DEFAULT 0,
  `fecha_caducidad` date DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  CONSTRAINT `ck_mat_stock` CHECK (`stock` >= 0),
  CONSTRAINT `ck_mat_minimo` CHECK (`stock_minimo` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `materiales` */

insert  into `materiales`(`id`,`codigo`,`nombre`,`tipo`,`unidad`,`stock`,`stock_minimo`,`fecha_caducidad`,`activo`,`creado`) values 
(1,'MAT-001','Etanol 70%','REACTIVO','ml',6400,1000,'2027-06-30',1,'2026-11-07 16:29:58'),
(2,'MAT-002','Solución salina 0.9%','REACTIVO','ml',8000,2000,'2027-03-15',1,'2026-11-07 16:29:58'),
(3,'MAT-003','Gel conductor ECG','REACTIVO','ml',3000,500,'2027-12-01',1,'2026-11-07 16:29:58'),
(4,'MAT-004','Guantes de nitrilo','CONSUMIBLE','pza',550,100,NULL,1,'2026-11-07 16:29:58'),
(5,'MAT-005','Portaobjetos','CONSUMIBLE','pza',250,100,NULL,1,'2026-11-07 16:29:58'),
(6,'MAT-006','Electrodos desechables','CONSUMIBLE','pza',200,50,NULL,1,'2026-11-07 16:29:58');

/*Table structure for table `movimientos_equipos` */

DROP TABLE IF EXISTS `movimientos_equipos`;

CREATE TABLE `movimientos_equipos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha_hora` datetime NOT NULL DEFAULT current_timestamp(),
  `equipo_id` int(11) NOT NULL,
  `tipo` enum('ENTRADA','SALIDA') NOT NULL,
  `cantidad` int(11) NOT NULL,
  `motivo` enum('COMPRA','DONACION','DEVOLUCION_PRESTAMO','REGRESO_MANTENIMIENTO','PRESTAMO','MANTENIMIENTO','BAJA','AJUSTE') NOT NULL,
  `persona` varchar(100) DEFAULT NULL,
  `proveedor` varchar(120) DEFAULT NULL,
  `factura` varchar(40) DEFAULT NULL,
  `condicion` enum('BUENA','CON_DETALLES','DANADO') DEFAULT NULL,
  `grupo` varchar(30) DEFAULT NULL,
  `practica` varchar(150) DEFAULT NULL,
  `devolucion_esperada` datetime DEFAULT NULL,
  `responsable` varchar(100) NOT NULL,
  `observaciones` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_moveq_equipo_fecha` (`equipo_id`,`fecha_hora`),
  KEY `ix_moveq_tipo_fecha` (`tipo`,`fecha_hora`),
  CONSTRAINT `fk_moveq_equipo` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `ck_moveq_cantidad` CHECK (`cantidad` > 0),
  CONSTRAINT `ck_moveq_motivo` CHECK (`tipo` = 'ENTRADA' and `motivo` in ('COMPRA','DONACION','DEVOLUCION_PRESTAMO','REGRESO_MANTENIMIENTO','AJUSTE') or `tipo` = 'SALIDA' and `motivo` in ('PRESTAMO','MANTENIMIENTO','BAJA','AJUSTE')),
  CONSTRAINT `ck_moveq_persona` CHECK (`tipo` = 'ENTRADA' or `persona` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `movimientos_equipos` */

insert  into `movimientos_equipos`(`id`,`fecha_hora`,`equipo_id`,`tipo`,`cantidad`,`motivo`,`persona`,`proveedor`,`factura`,`condicion`,`grupo`,`practica`,`devolucion_esperada`,`responsable`,`observaciones`) values 
(1,'2026-11-07 16:30:09',3,'ENTRADA',2,'COMPRA',NULL,'Fluke México','F-7781','BUENA',NULL,NULL,NULL,'Laura Almacén','Equipos nuevos'),
(2,'2026-11-07 16:30:09',4,'ENTRADA',1,'DONACION',NULL,'Hospital General',NULL,'BUENA',NULL,NULL,NULL,'Laura Almacén',NULL),
(3,'2026-11-07 16:30:09',1,'SALIDA',5,'PRESTAMO','Mtra. Ana Beltrán',NULL,NULL,NULL,'3B','Observación de tejidos','2026-11-07 12:00:00','Laura Almacén','Regresan al terminar'),
(4,'2026-11-07 16:30:09',3,'SALIDA',4,'PRESTAMO','Ing. Sofía Núñez',NULL,NULL,NULL,'5A','Medición con multímetro','2026-11-07 11:00:00','Laura Almacén',NULL);

/*Table structure for table `movimientos_materiales` */

DROP TABLE IF EXISTS `movimientos_materiales`;

CREATE TABLE `movimientos_materiales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha_hora` datetime NOT NULL DEFAULT current_timestamp(),
  `material_id` int(11) NOT NULL,
  `tipo` enum('ENTRADA','SALIDA') NOT NULL,
  `cantidad` double NOT NULL,
  `motivo` enum('COMPRA','DONACION','DEVOLUCION','PRACTICA','CADUCIDAD','DANO','AJUSTE') NOT NULL,
  `proveedor` varchar(120) DEFAULT NULL,
  `factura` varchar(40) DEFAULT NULL,
  `lote` varchar(40) DEFAULT NULL,
  `fecha_caducidad` date DEFAULT NULL,
  `solicitante` varchar(100) DEFAULT NULL,
  `grupo` varchar(30) DEFAULT NULL,
  `practica` varchar(150) DEFAULT NULL,
  `responsable` varchar(100) NOT NULL,
  `observaciones` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_movmat_material_fecha` (`material_id`,`fecha_hora`),
  KEY `ix_movmat_tipo_fecha` (`tipo`,`fecha_hora`),
  CONSTRAINT `fk_movmat_material` FOREIGN KEY (`material_id`) REFERENCES `materiales` (`id`),
  CONSTRAINT `ck_movmat_cantidad` CHECK (`cantidad` > 0),
  CONSTRAINT `ck_movmat_motivo` CHECK (`tipo` = 'ENTRADA' and `motivo` in ('COMPRA','DONACION','DEVOLUCION','AJUSTE') or `tipo` = 'SALIDA' and `motivo` in ('PRACTICA','CADUCIDAD','DANO','AJUSTE')),
  CONSTRAINT `ck_movmat_solicitante` CHECK (`tipo` = 'ENTRADA' or `solicitante` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `movimientos_materiales` */

insert  into `movimientos_materiales`(`id`,`fecha_hora`,`material_id`,`tipo`,`cantidad`,`motivo`,`proveedor`,`factura`,`lote`,`fecha_caducidad`,`solicitante`,`grupo`,`practica`,`responsable`,`observaciones`) values 
(1,'2026-11-07 16:30:09',1,'ENTRADA',2000,'COMPRA','Química Industrial SA','F-1021','L-E03','2027-09-30',NULL,NULL,NULL,'Laura Almacén',NULL),
(2,'2026-11-07 16:30:09',4,'ENTRADA',200,'COMPRA','Médica del Norte','F-3310',NULL,NULL,NULL,NULL,NULL,'Laura Almacén','Caja de 200'),
(3,'2026-11-07 16:30:09',6,'ENTRADA',50,'DONACION','Hospital General',NULL,NULL,NULL,NULL,NULL,NULL,'Laura Almacén',NULL),
(4,'2026-11-07 16:30:09',4,'SALIDA',50,'PRACTICA',NULL,NULL,NULL,NULL,'Dr. Ramón Torres','3A','Tinción de Gram','Laura Almacén',NULL),
(5,'2026-11-07 16:30:09',5,'SALIDA',50,'PRACTICA',NULL,NULL,NULL,NULL,'Dr. Ramón Torres','3A','Tinción de Gram','Laura Almacén',NULL),
(6,'2026-11-07 16:30:09',1,'SALIDA',600,'PRACTICA',NULL,NULL,NULL,NULL,'Mtra. Ana Beltrán','3B','Observación de tejidos','Laura Almacén',NULL);

/* Trigger structure for table `movimientos_equipos` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_moveq_valida` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_moveq_valida` BEFORE INSERT ON `movimientos_equipos` FOR EACH ROW BEGIN
  DECLARE disponible INT;
  DECLARE est VARCHAR(20);
  IF NEW.tipo = 'SALIDA' THEN
    SELECT cantidad, estado INTO disponible, est FROM equipos WHERE id = NEW.equipo_id;
    IF disponible IS NULL OR disponible < NEW.cantidad THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CANTIDAD INSUFICIENTE: no hay suficientes equipos disponibles';
    END IF;
    IF NEW.motivo = 'PRESTAMO' AND est <> 'OPERATIVO' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'EQUIPO NO DISPONIBLE: solo se prestan equipos en estado OPERATIVO';
    END IF;
  END IF;
END */$$


DELIMITER ;

/* Trigger structure for table `movimientos_equipos` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_moveq_actualiza` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_moveq_actualiza` AFTER INSERT ON `movimientos_equipos` FOR EACH ROW BEGIN
  UPDATE equipos
     SET cantidad = cantidad + IF(NEW.tipo = 'ENTRADA', NEW.cantidad, -NEW.cantidad),
         estado = CASE NEW.motivo
                    WHEN 'MANTENIMIENTO'         THEN 'EN_MANTENIMIENTO'
                    WHEN 'REGRESO_MANTENIMIENTO' THEN 'OPERATIVO'
                    ELSE estado END,
         ultimo_mantenimiento = IF(NEW.motivo = 'REGRESO_MANTENIMIENTO', DATE(NEW.fecha_hora), ultimo_mantenimiento)
   WHERE id = NEW.equipo_id;
END */$$


DELIMITER ;

/* Trigger structure for table `movimientos_materiales` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_movmat_valida` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_movmat_valida` BEFORE INSERT ON `movimientos_materiales` FOR EACH ROW BEGIN
  DECLARE disponible DOUBLE;
  IF NEW.tipo = 'SALIDA' THEN
    SELECT stock INTO disponible FROM materiales WHERE id = NEW.material_id;
    IF disponible IS NULL OR disponible < NEW.cantidad THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'STOCK INSUFICIENTE: no hay suficiente material para esta salida';
    END IF;
  END IF;
END */$$


DELIMITER ;

/* Trigger structure for table `movimientos_materiales` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_movmat_actualiza_stock` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_movmat_actualiza_stock` AFTER INSERT ON `movimientos_materiales` FOR EACH ROW BEGIN
  UPDATE materiales
     SET stock = stock + IF(NEW.tipo = 'ENTRADA', NEW.cantidad, -NEW.cantidad)
   WHERE id = NEW.material_id;
END */$$


DELIMITER ;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
