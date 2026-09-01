Plataforma Web Corporativa, Portafolio Tecnológico y Espacio de Gestión Interna
01. ANÁLISIS FUNCIONAL
1.1 ¿Qué problema busca solucionar?
Actualmente, TISNET necesita una plataforma que permita:
Presentarse comercialmente ante clientes potenciales.
Exhibir de forma ordenada los proyectos y soluciones que ha desarrollado (portafolio).
Administrar ese contenido sin depender de que un desarrollador modifique el código cada vez que se agrega un proyecto, servicio o integrante.
Dar al equipo interno una vista centralizada y sencilla del estado de los proyectos en curso (sin sustituir herramientas como Jira o Trello).
Por ello, TISNET no será solamente una página web informativa. Será una plataforma web con un Portal Público y un Panel Privado de gestión.
1.2 ¿Qué solución se propone?
Se propone desarrollar dos partes principales:
Portal Público
Será visible para cualquier visitante y permitirá:
conocer TISNET;
consultar servicios;
consultar proyectos;
ver tecnologías;
conocer al equipo;
enviar solicitudes de contacto.
Plataforma Privada
Será utilizada por el personal autorizado y permitirá:
iniciar sesión;
visualizar un Dashboard;
administrar proyectos;
administrar servicios;
administrar tecnologías;
administrar categorías;
gestionar equipo;
gestionar solicitudes;
utilizar el Workspace;
administrar usuarios;
modificar la configuración.
1.3 Flujo principal
El flujo principal del sistema será:

Este será el flujo principal que permitirá demostrar que Frontend + Backend + Base de Datos funcionan como un solo sistema.
1.4 Decisión sobre los proyectos
Se propone manejar el proyecto mediante una sola entidad:
Project
El proyecto tendrá:
información técnica;
información interna;
Información pública.
Para controlar su estado se utilizará:
status: estado interno del proyecto.
isPublished: indica si aparece públicamente.


02. MAPA DE MÓDULOS
El sistema estará dividido de la siguiente manera:
TISNET
│
├── PORTAL PÚBLICO
│   ├── Inicio
│   ├── Nosotros
│   ├── Servicios
│   ├── Soluciones
│   ├── Portafolio
│     ├── Detalle de Proyecto
│   ├── Tecnologías
│   ├── Equipo
│   └── Contacto
│
└── PLATAFORMA PRIVADA
    ├── Autenticación
    ├── Dashboard
    ├── Proyectos
    ├── Categorías
    ├── Tecnologías
    ├── Servicios
    ├── Equipo
    ├── Contactos / Leads
    ├── Workspace
    ├── Usuarios
    └── Configuración
Módulos principales
Módulo
Función
Autenticación
Controlar el acceso
Dashboard
Mostrar resumen del sistema
Proyectos
Crear y administrar proyectos
Categorías
Clasificar proyectos
Tecnologías
Registrar tecnologías
Servicios
Administrar servicios
Equipo
Administrar integrantes
Contactos
Recibir solicitudes
Workspace
Seguimiento interno
Usuarios
Administrar cuentas
Configuración
Administrar información institucional

Estos módulos corresponden al alcance definido para la plataforma privada.
03. ACTORES Y PERMISOS
El sistema tendrá cuatro tipos de usuarios.
Actor
¿Qué puede hacer?
Visitante
Consultar información pública y enviar contacto
Developer
Consultar Workspace y actualizar proyectos autorizados
Administrador
Gestionar contenido, proyectos, servicios, tecnologías y solicitudes
Super Administrador
Acceso completo, usuarios, roles y configuración

Matriz simplificada
Función
Visitante
Developer
Admin
Super Admin
Portal público
✓
✓
✓
✓
Login
—
✓
✓
✓
Dashboard
—
✓
✓
✓
Workspace
—
✓
✓
✓
Actualizar avances
—
✓*
✓
✓
Proyectos
—
—
✓
✓
Servicios
—
—
✓
✓
Categorías
—
—
✓
✓
Tecnologías
—
—
✓
✓
Equipo
—
—
✓
✓
Solicitudes
—
—
✓
✓
Usuarios
—
—
—
✓
Configuración
—
—
—
✓

. El Developer solo podrá actualizar proyectos donde tenga autorización.
04. HISTORIAS DE USUARIO
Las historias de usuario representan las principales acciones que deberá realizar cada actor.
4.1 Historias de Usuario - Visitante
US-001
 Como visitante
 quiero consultar el portafolio de proyectos publicados
 para conocer las soluciones que TISNET ha desarrollado.
Criterios de aceptación:
Dado que existen proyectos con isPublished = true, cuando ingreso al Portafolio, entonces debo ver únicamente esos proyectos.
Los proyectos no publicados nunca deben ser visibles en el Portal Público.
US-002
 Como visitante
 quiero ver el detalle de un proyecto específico
 para entender su alcance, tecnologías utilizadas y resultados.
Criterios de aceptación:
Dado un proyecto publicado, cuando accedo a su detalle, entonces debo ver su información pública completa (descripción, tecnologías, categoría, imágenes).
No debo poder acceder al detalle de un proyecto no publicado, aunque conozca su URL.
US-003
 Como visitante
 quiero consultar los servicios que ofrece TISNET
 para evaluar si se ajustan a lo que necesito.
US-004
 Como visitante (potencial cliente)
 quiero enviar una solicitud de contacto
 para iniciar una conversación comercial con TISNET.
Criterios de aceptación:
El formulario valida los campos obligatorios antes de enviar.
La solicitud queda almacenada con fecha de creación.
Debo recibir una confirmación visual del envío exitoso.
4.2 Historias de usuario — Developer / Administrador (Autenticación y acceso)
US-005
 Como Developer, Administrador o Super Administrador
 quiero iniciar sesión con mis credenciales
 para acceder al panel privado según mi rol.
Criterios de aceptación:
Dado que tengo credenciales válidas, cuando inicio sesión, entonces accedo al Dashboard correspondiente a mi rol.
Dado que las credenciales son inválidas, entonces el sistema debe mostrar un error sin indicar cuál campo falló (por seguridad).
US-006
 Como usuario autenticado
 quiero cerrar sesión
 para proteger el acceso cuando termino de usar la plataforma.
US-007
 Como sistema
 quiero proteger las rutas privadas mediante autorización por rol
 para que ningún actor acceda a funciones que no le corresponden.
4.3 Historias de usuario — Administrador (Gestión de proyectos y catálogo)
US-008
 Como administrador
 quiero registrar un nuevo proyecto
 para incorporarlo al catálogo interno de TISNET.
Criterios de aceptación:
El formulario exige los campos obligatorios definidos en el modelo Project.
El proyecto se crea con status interno y isPublished = false por defecto.
El proyecto aparece de inmediato en el listado administrativo.
US-009
 Como administrador
 quiero editar la información de un proyecto existente
 para mantener actualizado su contenido técnico, interno y público.
US-010
 Como administrador
 quiero publicar o despublicar un proyecto
 para controlar qué aparece en el Portal Público sin borrar su información.
Criterios de aceptación:
Solo un administrador o super administrador puede cambiar isPublished.
El proyecto debe cumplir la información mínima antes de poder publicarse.
Al despublicar, el proyecto desaparece del portal pero se conserva en el sistema.
US-011
 Como administrador
 quiero administrar servicios, categorías y tecnologías
 para mantener el catálogo del portal ordenado y actualizado.
US-012
 Como administrador
 quiero asociar tecnologías y una categoría a cada proyecto
 para clasificarlo correctamente dentro del portafolio.
4.4 Historias de usuario — Gestión de leads
US-013
 Como administrador
 quiero consultar las solicitudes de contacto recibidas
 para dar seguimiento comercial a cada lead.
US-014
 Como administrador
 quiero cambiar el estado de una solicitud (nueva, en proceso, atendida)
 para llevar control del proceso comercial.
4.5 Historias de usuario — Workspace (Developer / Admin)
US-015
 Como Developer
 quiero visualizar el Workspace con los proyectos donde tengo autorización
 para conocer el estado interno de mi trabajo asignado.
US-016
 Como Developer
 quiero registrar actualizaciones de avance en un proyecto autorizado
 para mantener informado al equipo sin depender de herramientas externas.
Criterios de aceptación:
Solo puedo actualizar proyectos donde tengo autorización explícita.
Toda actualización queda con fecha y autor.
US-017
 Como administrador
 quiero asociar integrantes del equipo a un proyecto
 para reflejar quién trabaja en cada iniciativa dentro del Workspace.
4.6 Historias de usuario — Super Administrador
US-018
 Como Super Administrador
 quiero administrar usuarios del sistema
 para dar de alta, editar o desactivar cuentas del equipo.
US-019
 Como Super Administrador
 quiero asignar roles a los usuarios
 para controlar qué nivel de acceso tiene cada uno.
US-020
 Como Super Administrador
 quiero administrar la configuración institucional (datos de contacto, redes, información general)
 para mantener actualizada la información base que consume el Portal Público.
05. DIAGRAMA DE ARQUITECTURA
La arquitectura será un Monolito Modular.
         
RESPONSABILIDAD:
React
Se encarga de:
interfaz;
formularios;
navegación;
interacción;
experiencia de usuario;
consumo de API.
NestJS
Se encarga de:
autenticación;
autorización;
validaciones;
reglas del negocio;
seguridad;
procesamiento;
API.
Prisma
Se encarga del acceso a la base de datos.
MySQL
Almacena la información del sistema.
El documento establece específicamente el uso de un Monolito Modular y descarta microservicios por introducir complejidad innecesaria para este proyecto.



06. DIAGRAMA ENTIDAD–RELACIÓN
Entidades principales:
“Role”, “User”, “Workspace_Update”, “Project”, “Project_Image”, “Project_Member”, “Team_Member”, “Project_Technology”, “Technology”, “Category”, “Service”, “Contact_Request”, “Setting”.


Relaciones principales
Entidades
Tipo de Relación
Tabla Intermedia
Descripción
User – Role
1 a Muchos (1:N)
—
Un rol puede tener varios usuarios.
Project – Category
1 a Muchos (1:N)
—
Una categoría puede contener varios proyectos.
Project – Technology
Muchos a Muchos (N:M)
ProjectTechnology
Relación de muchos a muchos.
Project – Team/User
1 a Muchos (1:N)
ProjectMember
Un proyecto puede tener varios integrantes.
Project – Images
1 a Muchos (1:N)
ProjectImage
Un proyecto puede tener varias imágenes.
Project – Updates
1 a Muchos (1:N)
WorkspaceUpdate
Un proyecto puede tener varias actualizaciones.



.
07. DICCIONARIO PRELIMINAR DE DATOS
ROLE
El documento define tres roles iniciales:
SUPER_ADMIN
ADMIN
DEVELOPER
y establece que el Super Administrador puede asignar roles a los usuarios.


Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador único del rol.
name
VARCHAR(30)
—
No
Nombre del rol.
createdAt
DATETIME
—
No
Fecha de creación.
updatedAt
DATETIME
—
No
Fecha de actualización.

USER
El sistema requiere autenticación de usuarios internos y diferentes niveles de autorización según el rol. Además, las contraseñas deben almacenarse mediante hash.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador único del usuario.
name
VARCHAR(100)
—
No
Nombre del usuario.
email
VARCHAR(150)
UNIQUE
No
Correo utilizado para autenticación.
passwordHash
VARCHAR(255)
—
No
Contraseña almacenada mediante hash.
roleId
INT
FK
No
Rol asignado al usuario.
isActive
BOOLEAN
—
No
Indica si el usuario está habilitado.
createdAt
DATETIME
—
No
Fecha de creación.
updatedAt
DATETIME
—
No
Fecha de actualización.



CATEGORY
Las categorías permiten clasificar los proyectos. El documento propone ejemplos como Logística, Educación, Finanzas, Administración, Automatización, ERP y E-Commerce.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador de la categoría.
name
VARCHAR(100)
UNIQUE
No
Nombre de la categoría.
description
TEXT
—
Sí
Descripción de la categoría.
isActive
BOOLEAN
—
No
Indica si está disponible.
createdAt
DATETIME
—
No
Fecha de creación.
updatedAt
DATETIME
—
No
Fecha de actualización.








PROJECT
Esta será probablemente la entidad central del sistema.
El documento especifica una gran cantidad de información que debe almacenarse para cada proyecto: nombre, slug, descripciones, problema, solución, objetivo, características, categoría, tecnologías, imágenes, estado, fechas, cliente, URLs, destacado, publicación y orden.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador único del proyecto.
name
VARCHAR(150)
—
No
Nombre del proyecto.
slug
VARCHAR(180)
UNIQUE
No
Identificador amigable para URL.
shortDescription
VARCHAR(300)
—
No
Descripción breve.
description
TEXT
—
No
Descripción completa.
problem
TEXT
—
Sí
Problema identificado.
solution
TEXT
—
Sí
Solución desarrollada.
objective
TEXT
—
Sí
Objetivo del proyecto.
features
TEXT
—
Sí
Características principales.
categoryId
INT
FK
No
Categoría a la que pertenece.
status
VARCHAR/ENUM
—
No
Estado del proyecto.
developmentDate
DATE
—
Sí
Fecha de desarrollo.
clientName
VARCHAR(150)
—
Sí
Cliente, si corresponde.
demoUrl
VARCHAR(500)
—
Sí
URL demostrativa.
externalUrl
VARCHAR(500)
—
Sí
URL externa.
isFeatured
BOOLEAN
—
No
Indica si es proyecto destacado.
isPublished
BOOLEAN
—
No
Indica si aparece públicamente.
displayOrder
INT
—
No
Orden de aparición.
responsibleUserId
INT
FK propuesta
Sí
Usuario responsable del proyecto.
createdAt
DATETIME
—
No
Fecha de creación.
updatedAt
DATETIME
—
No
Fecha de actualización.



TECHNOLOGY
Las tecnologías funcionan como catálogo y pueden asociarse con múltiples proyectos.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador de la tecnología.
name
VARCHAR(100)
UNIQUE
No
Nombre de la tecnología.
description
TEXT
—
Sí
Descripción.
icon
VARCHAR(255)
—
Sí
Referencia al icono.
isActive
BOOLEAN
—
No
Indica si está activa.
createdAt
DATETIME
—
No
Fecha de creación.
updatedAt
DATETIME
—
No
Fecha de actualización.








PROJECT_TECHNOLOGY
Es la entidad intermedia para resolver:
PROJECT N:M TECHNOLOGY
El documento establece explícitamente que esta relación debe resolverse mediante una tabla intermedia.

Campo
Tipo propuesto
Clave
Nulo
Descripción
projectId
INT
PK, FK
No
Identificador del proyecto.
technologyId
INT
PK, FK
No
Identificador de la tecnología.



PROJECT_IMAGE
Las imágenes tendrán almacenamiento externo; MySQL debe guardar principalmente la URL o identificador correspondiente. El documento prohíbe almacenar las imágenes directamente como Base64.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador de la imagen.
projectId
INT
FK
No
Proyecto al que pertenece.
url
VARCHAR(500)
—
No
URL de la imagen.
publicId
VARCHAR(255)
—
Sí
Identificador del archivo en el almacenamiento.
type
VARCHAR(30)
—
No
Tipo de imagen, por ejemplo portada o galería.
displayOrder
INT
—
No
Orden de aparición.
createdAt
DATETIME
—
No
Fecha de creación.



TEAM_MEMBER
El documento define para cada integrante:
nombre;
cargo;
descripción;
fotografía;
LinkedIn;
GitHub;
estado;
orden.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador del integrante.
name
VARCHAR(100)
—
No
Nombre completo.
position
VARCHAR(100)
—
No
Cargo.
description
TEXT
—
Sí
Descripción del integrante.
photoUrl
VARCHAR(500)
—
Sí
URL de la fotografía.
linkedinUrl
VARCHAR(500)
—
Sí
Perfil de LinkedIn.
githubUrl
VARCHAR(500)
—
Sí
Perfil de GitHub.
isActive
BOOLEAN
—
No
Estado del integrante.
displayOrder
INT
—
No
Orden de visualización.
createdAt
DATETIME
—
No
Fecha de creación.
updatedAt
DATETIME
—
No
Fecha de actualización.


PROJECT_MEMBER
Tabla intermedia para:
PROJECT N:M TEAM_MEMBER

Campo
Tipo propuesto
Clave
Nulo
Descripción
projectId
INT
PK, FK
No
Identificador del proyecto.
teamMemberId
INT
PK, FK
No
Identificador del integrante.



WORKSPACE_UPDATE
El documento establece que cada proyecto puede tener múltiples actualizaciones y que estas contienen fecha, autor, avance y pendientes.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador de la actualización.
projectId
INT
FK
No
Proyecto actualizado.
authorId
INT
FK propuesta
No
Usuario que registra la actualización.
date
DATE
—
No
Fecha de la actualización.
progress
TEXT
—
Sí
Avance realizado.
pending
TEXT
—
Sí
Actividades pendientes.
observation
TEXT
—
Sí
Observaciones adicionales.
createdAt
DATETIME
—
No
Fecha de creación del registro.
updatedAt
DATETIME
—
No
Fecha de modificación.



SERVICE
Los servicios deben ser administrables desde backend y cada servicio debe tener nombre, slug, descripciones, icono, imagen opcional, estado, orden y destacado.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador del servicio.
name
VARCHAR(150)
—
No
Nombre del servicio.
slug
VARCHAR(180)
UNIQUE
No
Identificador amigable para URL.
shortDescription
VARCHAR(300)
—
No
Descripción corta.
description
TEXT
—
No
Descripción completa.
icon
VARCHAR(255)
—
Sí
Icono del servicio.
imageUrl
VARCHAR(500)
—
Sí
Imagen del servicio.
isActive
BOOLEAN
—
No
Estado del servicio.
displayOrder
INT
—
No
Orden de visualización.
isFeatured
BOOLEAN
—
No
Indica si es destacado.
createdAt
DATETIME
—
No
Fecha de creación.
updatedAt
DATETIME
—
No
Fecha de actualización.




CONTACT_REQUEST
El formulario de contacto contempla:
nombre;
empresa;
correo;
teléfono;
servicio de interés;
mensaje.
Las solicitudes deben almacenarse en la base de datos.

Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador de la solicitud.
serviceId
INT
FK propuesta
Sí
Servicio de interés.
name
VARCHAR(100)
—
No
Nombre del solicitante.
company
VARCHAR(150)
—
Sí
Empresa del solicitante.
email
VARCHAR(150)
—
No
Correo electrónico.
phone
VARCHAR(30)
—
Sí
Teléfono.
message
TEXT
—
No
Mensaje enviado.
status
VARCHAR/ENUM
—
No
Estado de la solicitud.
observation
TEXT
—
Sí
Observación administrativa.
contactedAt
DATETIME
—
Sí
Fecha en que fue contactado.
createdAt
DATETIME
—
No
Fecha de recepción.
updatedAt
DATETIME
—
No
Fecha de actualización.


SETTING
La configuración almacena información institucional como nombre comercial, descripción, correo, teléfono, dirección y redes sociales.






Campo
Tipo propuesto
Clave
Nulo
Descripción
id
INT
PK
No
Identificador del registro.
businessName
VARCHAR(150)
—
No
Nombre comercial.
description
TEXT
—
Sí
Descripción institucional.
email
VARCHAR(150)
—
Sí
Correo institucional.
phone
VARCHAR(30)
—
Sí
Teléfono institucional.
address
VARCHAR(255)
—
Sí
Dirección.
facebook
VARCHAR(500)
—
Sí
URL de Facebook.
instagram
VARCHAR(500)
—
Sí
URL de Instagram.
linkedin
VARCHAR(500)
—
Sí
URL de LinkedIn.
github
VARCHAR(500)
—
Sí
URL de GitHub.
whatsapp
VARCHAR(50)
—
Sí
Información de WhatsApp.
updatedAt
DATETIME
—
No
Fecha de actualización.


08. DISEÑO INICIAL DE API
“React + TypeScript → HTTPS/REST → NestJS API → módulos del sistema”
El diseño inicial de API sería establecer qué endpoints tendrá el backend, qué datos recibirán y qué datos devolverán.
La API utilizará REST y tendrá como base: **/api/v1**
Endpoints públicos



Método
Endpoint
Función
Auth
Roles
GET
/api/v1/public/projects
Listar proyectos publicados
No
Ninguno
GET
/api/v1/public/projects/:slug
Ver detalle de un proyecto
No
Ninguno
GET
/api/v1/public/services
Ver catálogo de servicios
No
Ninguno
GET
/api/v1/public/technologies
Ver catálogo de tecnologías
No
Ninguno
GET
/api/v1/public/team
Ver integrantes públicos
No
Ninguno
POST
/api/v1/public/contact
Enviar formulario de contacto
No
Ninguno






Autenticación



Método
Endpoint
Función
Auth
Roles
POST
/api/v1/auth/login
Iniciar sesión y obtener tokens
No
Ninguno
POST
/api/v1/auth/refresh
Renovar sesión (Refresh Token)
No*
Ninguno
POST
/api/v1/auth/logout
Cerrar sesión y revocar tokens
Sí
Todos
GET
/api/v1/auth/me
Obtener datos del usuario actual
Sí
Todos


Proyectos



Método
Endpoint
Función
Auth
Roles
GET
/api/v1/projects
Listar todos los proyectos
Sí
ADMIN, SUPER_ADMIN
GET
/api/v1/projects/:id
Consultar un proyecto específico
Sí
ADMIN, SUPER_ADMIN
POST
/api/v1/projects
Crear un nuevo proyecto
Sí
ADMIN, SUPER_ADMIN
PATCH
/api/v1/projects/:id
Editar información general
Sí
ADMIN, SUPER_ADMIN
PATCH
/api/v1/projects/:id/publish
Publicar en portal público
Sí
ADMIN, SUPER_ADMIN
PATCH
/api/v1/projects/:id/unpublish
Retirar del portal público
Sí
ADMIN, SUPER_ADMIN
PATCH
/api/v1/projects/:id/archive
Archivar lógicamente
Sí
ADMIN, SUPER_ADMIN


Workspace



Método
Endpoint
Función
Auth
Roles
GET
/api/v1/workspace/projects
Listar proyectos internos
Sí
DEV, ADMIN, SUPER_ADMIN
GET
/api/v1/workspace/projects/:id
Ver detalle del proyecto
Sí
DEV*, ADMIN, SUPER_ADMIN
GET
/api/v1/workspace/projects/:id/updates
Ver historial de avances
Sí
DEV*, ADMIN, SUPER_ADMIN
POST
/api/v1/workspace/projects/:id/updates
Registrar nuevo avance
Sí
DEV*, ADMIN, SUPER_ADMIN
PATCH
/api/v1/workspace/projects/:id/status
Cambiar estado interno
Sí
ADMIN, SUPER_ADMIN
PATCH
/api/v1/workspace/projects/:id/progress
Actualizar % de progreso
Sí
DEV*, ADMIN, SUPER_ADMIN

(Nota: El rol DEVELOPER [DEV] solo puede interactuar con los proyectos donde tenga autorización explícita asignada). 
Los endpoints anteriores son una propuesta inicial basada en los ejemplos del documento, no una copia definitiva; deberán revisarse antes de programarlos.


Convención de Respuestas de la API

Estructura de Éxito (HTTP 200 / 201): 

{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": { ... } 
}

Estructura de Error (HTTP 400, 401, 403, 404, 500): 

{
  "success": false,
  "message": "Descripción clara del problema",
  "error": "CÓDIGO_INTERNO_ERROR" }

No se devolverá HTTP 200 OK si ha ocurrido un error interno. 

09. WIREFRAMES 
Wireframe de baja fidelidad de la página de Inicio del portal público de TISNET
INICIO

Figura 1: Wireframe - Página de Inicio

PORTAFOLIO CON FILTROS

Figura 2: Wireframe - Portafolio con Filtros

Detalle de Proyecto:

Figura 3: Wireframe - Detalle de Proyecto

SERVICIOS:

Figura 4: Wireframe - Servicios










10. DISEÑO UI EN FIGMA 

Vistas Portal Público
– Landing page –



Figura 5: Diseño UI - Landing Page


– Servicios –


Figura 6: Diseño UI - Servicios

			Figura 7: Diseño UI - Portafolio Proyectos
– Contacto –



Figura 8: Diseño UI - Contacto
VISTAS DEL PANEL PRIVADO

– Login –

Figura 9: Diseño UI - Login Panel Privado

– Dashboard –

Figura 10: Diseño UI - Dashboard Panel Privado

– Gestión de Proyectos –


Figura 11: Diseño UI - Gestión de Proyectos

– WorkSpace & Usuarios  –

Figura 12: Diseño UI - Workspace

11. BACKLOG 
El backlog se organizará por funcionalidades.
Prioridad alta – MVP
Autenticación
Login.
Logout.
JWT.
Refresh Token.
Roles.
Protección de endpoints.
Proyectos
Crear proyecto.
Listar proyectos.
Consultar proyecto.
Editar proyecto.
Publicar proyecto.
Despublicar proyecto.
Categorías
Crear.
Listar.
Editar.
Tecnologías
Crear.
Listar.
Editar.
Asociar a proyectos.
Portal Público
Landing.
Portafolio.
Detalle de proyecto.
Prioridad media – Segunda etapa
Servicios.
Equipo.
Contacto.
Gestión de leads.
Workspace.
Actualizaciones.
Configuración.
El documento establece precisamente esta separación entre el MVP y la segunda etapa.
12. SPRINT 1
Objetivo
Preparar la estructura técnica y desarrollar la base de autenticación del sistema.
Actividades
Backend
Crear proyecto NestJS.
Configurar Prisma.
Configurar MySQL.
Crear modelos User y Role.
Configurar JWT.
Configurar Refresh Token.
Crear Guards.
Crear sistema de roles.
Configurar Swagger.
Frontend
Crear proyecto React.
Configurar TypeScript.
Configurar Vite.
Configurar React Router.
Crear estructura inicial.
Crear Login.
Crear layout privado.
Crear Dashboard inicial.
Infraestructura
Crear Docker.
Configurar variables de entorno.
Crear .env.example.
Crear repositorios.
Resultado esperado
Al terminar Sprint 1:
Usuario ➔ Login ➔ Backend ➔ Validación ➔ JWT ➔ Rol ➔ Dashboard
El Sprint 1 no debe intentar desarrollar todo el sistema. Su objetivo será dejar una base sólida para continuar con el CRUD de proyectos.



13. DISTRIBUCIÓN DE RESPONSABILIDADES
Oliver
Responsable principal: Backend, arquitectura y base de datos.
Se encargará principalmente de:
NestJS;
Prisma;
MySQL;
autenticación;
autorización;
API;
arquitectura;
seguridad;
Docker Backend;
pruebas Backend.
Fiorella
Responsable principal: Frontend, UX/UI e integración.
Se encargará principalmente de:
React;
TypeScript;
Figma;
componentes;
páginas;
formularios;
navegación;
responsive;
consumo de API;
experiencia de usuario.
Ambos
Deberán conocer:
Frontend➔API➔Controller➔Service➔Repository➔Prisma➔MySQL
También deberán participar en:
decisiones importantes;
revisión de código;
Pull Requests;
pruebas;
integración;
documentación.
La distribución Oliver = Backend y Fiorella = Frontend aparece en el documento como organización posible, pero la división final debe acordarse durante la planificación.


14. ESTRATEGIA GIT/GITHUB
- Repositorios
Se utilizarán dos repositorios:
tisnet-web (FRONT-END)
tisnet-api (BACK-END)
- Ramas
main
develop
feature/*
fix/*
refactor/*
- Uso
main
Código estable.
develop
Código en desarrollo e integración.
feature
Para nuevas funcionalidades.
Ejemplo:
feature/authentication
feature/project-management
feature/public-portfolio
fix
Para corregir errores.
Ejemplo:
fix/login-validation
- Flujo

No se desarrollará directamente sobre main.


- Commits
Se utilizará Conventional Commits:
feat ➔ nueva funcionalidad
fix ➔ corrección
refactor ➔ reorganización
docs ➔ documentación
test ➔ pruebas
chore ➔ configuración
Ejemplo:
feat: implement project creation
fix: validate login credentials
docs: update api documentation
test: add project service tests

- Seguridad
No se subirán al repositorio:
“.env”
“JWT_SECRET”
“DATABASE_PASSWORD”
“DATABASE_URL”
“CLOUDINARY_SECRET”
Se deberá mantener:
.env.example
sin credenciales reales.

