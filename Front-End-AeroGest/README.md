[README.md](https://github.com/user-attachments/files/29074933/README.md)
# ✈ AeroGest

> **Plataforma integral de gestión de operaciones aéreas**  
> Universidad Tecnológica Nacional (UTN) · Mar del Plata · Programación III

---

## 👥 Equipo

| Integrante | Rol |
|---|---|
| Juan Manuel Fernandez | Desarrollador |
| Valentina Navarro | Desarrolladora |
| Franco Rodriguez | Desarrollador |
| Celeste Souto | Desarrolladora |

**Docente:** Rodrigo Soto  
**Fecha de entrega:** 18 de junio de 2026

---

## 🌐 Acceso a la plataforma

AeroGest se encuentra desplegado en producción y accesible desde cualquier navegador:

🔗 **[https://aerogest.ddns.net/](https://aerogest.ddns.net/)**

No se requiere instalación. Solo necesitás conexión a Internet y un navegador actualizado.
## Repositorios

| Proyecto | Enlace |
|-----------|---------|
| 🔧 Backend | [Ver repositorio](https://github.com/pefati/TrabajoProgra3-Backend) |
| 🎨 Frontend | [Ver repositorio](https://github.com/pefati/TrabajoProgra3-Frontend) |


### Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | admin@gmail.com | admin123 |
| Cliente | cliente@gmail.com | cliente123 |

---

## 📖 Descripción general

AeroGest es una plataforma web que centraliza la gestión de operaciones de una aerolínea. Permite administrar vuelos, reservas, pasajeros, empleados y compras de pasajes desde una única interfaz, con experiencias diferenciadas según el rol del usuario.

### Perfiles de usuario

- **🧳 Cliente** — Registro, búsqueda de vuelos, gestión de reservas, selección de asientos, compra de pasajes y administración de perfil.
- **👔 Empleado** — Las mismas funcionalidades que el cliente, más acceso a los vuelos en los que se encuentra asignado.
- **🛠 Administrador** — Acceso completo: gestión de vuelos, reservas, clientes, empleados, aeropuertos, aviones y supervisión general de la plataforma.

---

## 🛠 Stack tecnológico

### Backend
![Java](https://img.shields.io/badge/Java-21-orange) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3-brightgreen) ![JWT](https://img.shields.io/badge/Auth-JWT-blue) ![Redis](https://img.shields.io/badge/Cache-Redis-red)

- Java 21
- Spring Boot · Spring Security · Spring Data JPA
- JWT (JSON Web Token)
- Lombok · Hibernate

### Base de datos
- MySQL
- Redis (caché)

### Frontend
![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![Vite](https://img.shields.io/badge/Vite-purple) ![CSS](https://img.shields.io/badge/CSS3-navy)

- Vite · TypeScript · HTML · CSS

### Infraestructura
- Google Cloud · Docker · Nginx · Pterodactyl Panel

### Herramientas
- Maven · GitHub · Postman · IntelliJ IDEA / VS Code

---

## 🏗 Estructura del proyecto

### Frontend

```
src/
├── components/     # Componentes reutilizables (navbar, footer, etc.)
├── scripts/        # Lógica del cliente, manipulación del DOM, llamadas a la API
├── styles/         # Hojas de estilo CSS
├── images/         # Recursos gráficos (logos, íconos, imágenes)
└── *.html          # Vistas del sistema
```

### Backend

```
src/main/java/
├── auth/           # Autenticación, JWT, registro e inicio de sesión
├── config/         # Spring Security, JWT, Redis, beans generales
├── controller/     # Controladores REST (endpoints de la API)
├── dto/            # Data Transfer Objects
├── model/          # Entidades del dominio (Vuelo, Reserva, Pasaje, etc.)
├── repository/     # Acceso a datos con Spring Data JPA
├── service/        # Lógica de negocio
├── specifications/ # Consultas dinámicas y filtros avanzados
├── exceptions/     # Manejo de errores y excepciones personalizadas
└── AerolineaApplication.java
```

---

## 🗂 Entidades principales

| Entidad | Descripción |
|---|---|
| **Usuario** | Credenciales de acceso (email, password, rol) |
| **Persona** | Información personal (nombre, apellido, DNI, fecha de nacimiento) |
| **Vuelo** | Origen, destino, fechas, precio, capacidad |
| **Reserva** | Agrupa los pasajes de una compra (fecha, estado) |
| **Pasaje** | Lugar de un pasajero en un vuelo (asiento, equipaje) |
| **Equipaje** | Opciones de equipaje contratables |
| **AsistenciaAlViajero** | Cobertura opcional para pasajeros |
| **Carrito** | Vuelos seleccionados antes de confirmar la compra |
| **Factura** | Información de facturación de cada compra |

---

## 🔌 Endpoints de la API

### Autenticación `/api/auth`
| Método | Ruta |
|---|---|
| POST | `/api/auth/login` |
| POST | `/api/auth/register` |
| GET | `/api/auth/perfil` |
| PUT | `/api/auth/completarPerfil` |
| PUT | `/api/auth/perfil` |
| GET | `/api/auth/verify` |
| POST | `/api/auth/verify-2fa` |
| POST | `/api/auth/toggle-2fa` |
| POST | `/api/auth/forgot-password` |
| POST | `/api/auth/reset-password` |
| POST | `/api/auth/logout` |

### Vuelos `/api/vuelos`
| Método | Ruta |
|---|---|
| GET | `/api/vuelos` |
| GET | `/api/vuelos/disponibles` |
| GET | `/api/vuelos/{id}` |
| POST | `/api/vuelos` |
| PUT | `/api/vuelos/{id}` |
| DELETE | `/api/vuelos/{id}` |
| GET | `/api/vuelos/filtrar` |
| GET | `/api/vuelos/disponibles/filtrar` |

### Carrito `/api/carrito`
| Método | Ruta |
|---|---|
| GET | `/api/carrito` |
| POST | `/api/carrito/items` |
| DELETE | `/api/carrito/items/{itemId}` |
| DELETE | `/api/carrito/{carritoId}/clear` |

### Reservas `/api/reservas`
| Método | Ruta |
|---|---|
| GET | `/api/reservas/mis-reservas` |
| GET | `/api/reservas/{id}` |
| POST | `/api/reservas` |
| PUT | `/api/reservas/{id}/cancelar` |
| PATCH | `/api/reservas/{id}/checkin` |
| GET | `/api/reservas/filtrar` |

### Otros módulos
- **Aeropuertos** `/api/aeropuertos` — CRUD completo
- **Aviones** `/api/aviones` — CRUD + filtros
- **Pasajes** `/api/pasajes` — CRUD completo
- **Equipajes** `/api/equipajes` — CRUD completo
- **Favoritos** `/api/favoritos` — GET, POST, DELETE
- **Facturas** `/api/facturas` — GET, POST, descarga PDF
- **Compras** `/api/compras/confirmar` — POST
- **Mercado Pago** `/api/mercadopago` — integración de pagos
- **Asientos** `/api/asientos/avion/{avionId}` — GET
- **Asignaciones** `/api/asignacion` — CRUD completo
- **Personas** `/api/personas` — CRUD + filtros
- **Admin usuarios** `/api/admin/users` — cambio de roles

---

## 🔐 Seguridad

AeroGest implementa un sistema de autenticación y autorización multicapa:

1. **JWT** — Tokens seguros generados al iniciar sesión, almacenados en cookies y validados en cada solicitud.
2. **RBAC** — Control de acceso basado en roles (Cliente / Empleado / Administrador).
3. **Verificación de email** — Requerida antes de realizar reservas o compras.
4. **2FA** — Autenticación en dos factores opcional vía código por correo electrónico.
5. **Spring Security** — Protección centralizada de endpoints mediante `SecurityConfig` y anotaciones `@PreAuthorize`.

---

## ⚙️ Ejecución local (desarrollo)

### Requisitos
- Java 21
- Maven
- MySQL
- Redis
- Node.js + TypeScript + Vite

### Backend
```bash
# Configurar variables en application.properties
mvn spring-boot:run
```

### Frontend
```bash
npm install
npm run dev
```

---

## 🚀 Funcionalidades futuras

- Programa de millas y puntos
- Selección avanzada de asientos
- Check-in online
- Integración con pasarelas de pago externas
- Notificaciones automáticas
- Herramientas de atención al cliente

---

<div align="center">

✈ **AeroGest** · UTN Mar del Plata · 2026

*Desarrollado con dedicación por el equipo de Programación III*

</div>
