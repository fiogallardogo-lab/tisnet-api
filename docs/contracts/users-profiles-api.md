# TISNET - Contrato API de usuarios y perfiles

Versión: 1.0 - Línea base del Sprint 3  
Fecha: 16/09/2026  
Estado: APROBADO PARA DESARROLLO  
Fuente: Documentación SCRUM TISNET aprobada, Sprint 3 (14-20/09/2026).

Este contrato cubre identidad, perfiles, registro de Cliente y autorización por rol. El módulo Quote tiene un contrato independiente a cargo del Responsable B.

## 1. Compatibilidad y decisiones técnicas

- Base local: `http://localhost:3000/api/v1`.
- Se conservan login, refresh, logout y `GET /auth/me`.
- Las rutas privadas usan `Authorization: Bearer <accessToken>`.
- Roles: `CLIENT`, `DEVELOPER`, `PRODUCT_OWNER`, `ADMIN`, `SUPER_ADMIN`.
- `SUPERADMIN` del documento SCRUM se implementa como `SUPER_ADMIN` para conservar guards y datos existentes.
- Un visitante solo puede registrar una cuenta CLIENT. El body nunca acepta `role`, `roleId`, `isActive`, `tokenVersion` ni identificadores de otro usuario.
- SUPER_ADMIN no necesita perfil extendido en este Sprint; su `profile` es `null`.
- Cambiar roles y administrar usuarios ajenos quedan fuera hasta una historia administrativa explícita.

## 2. Convenciones

Éxito: `{ "success": true, "message": "Operación realizada correctamente", "data": {} }`.
Los errores mantienen el filtro HTTP global con `success`, `message` y `error`.

| HTTP | Uso                                     |
| ---- | --------------------------------------- |
| 200  | Consulta o actualización correcta       |
| 201  | Registro correcto                       |
| 400  | DTO, consentimiento o versión inválidos |
| 401  | Credenciales o sesión inválidas         |
| 403  | Rol sin permiso para ese perfil         |
| 404  | Usuario autenticado inexistente         |
| 409  | Email ya registrado                     |
| 503  | Versiones legales no configuradas       |

Nunca se devuelven `passwordHash`, `tokenVersion`, secretos o tokens en recursos de usuario. Las fechas usan ISO 8601. En PATCH, un campo omitido conserva su valor; `null` limpia únicamente un campo opcional.

## 3. Endpoints del Sprint 3

| Método | Ruta                              | Permiso       | Estado                                   |
| ------ | --------------------------------- | ------------- | ---------------------------------------- |
| GET    | `/auth/me`                        | Autenticado   | Existente, sin cambios                   |
| POST   | `/auth/register`                  | Público       | Crea exclusivamente CLIENT               |
| PATCH  | `/users/me`                       | Autenticado   | Actualiza únicamente name                |
| GET    | `/users/me/profile`               | Autenticado   | Devuelve usuario seguro y perfil del rol |
| PATCH  | `/users/me/client-profile`        | CLIENT        | Upsert del perfil propio                 |
| PATCH  | `/users/me/developer-profile`     | DEVELOPER     | Upsert del perfil propio                 |
| PATCH  | `/users/me/product-owner-profile` | PRODUCT_OWNER | Upsert del perfil propio                 |
| PATCH  | `/users/me/admin-profile`         | ADMIN         | Upsert del perfil propio                 |

El usuario se obtiene siempre del JWT. Ninguna ruta personal recibe `userId` por path, query o body.

## 4. Registro de Cliente

`POST /auth/register`

```json
{
  "name": "Cliente de ejemplo",
  "email": "cliente@example.test",
  "password": "PasswordSegura123!",
  "acceptedTerms": true,
  "termsVersion": "v1.0",
  "privacyVersion": "v1.0"
}
```

Reglas:

- name: 2-100 caracteres.
- email: válido, normalizado a minúsculas y sin espacios externos.
- password: 8-72 caracteres; nunca se registra ni devuelve.
- acceptedTerms debe ser literalmente true.
- termsVersion y privacyVersion deben coincidir con `TERMS_VERSION` y `PRIVACY_VERSION` del backend.
- Sin versiones legales configuradas se responde 503 y no se crean datos.
- User y ClientProfile se crean en una transacción con rol CLIENT.
- La respuesta 201 no inicia sesión automáticamente.

Respuesta data: `id`, `name`, `email`, `role`, `isActive`, `acceptedTermsAt`, `termsVersion` y `privacyVersion`.

## 5. Usuario y perfil propio

`PATCH /users/me`: `{ "name": "Nombre actualizado" }`. No modifica email, contraseña, rol o estado.

`GET /users/me/profile`:

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "user": {
      "id": 12,
      "name": "Cliente",
      "email": "cliente@example.test",
      "role": "CLIENT",
      "isActive": true
    },
    "profile": {
      "type": "CLIENT",
      "phone": "+51999999999",
      "district": "Lima",
      "businessName": null
    }
  }
}
```

Si aún no existe el perfil correspondiente, `profile` es `null`, no 404.

## 6. Payloads de perfiles

Todos los campos son opcionales en PATCH. Campos desconocidos se rechazan.

### CLIENT - `PATCH /users/me/client-profile`

Campos: `dni`, `age`, `phone`, `district`, `businessName`, `ruc`, `commercialName`, `businessDistrict`.
DNI acepta 8 dígitos; RUC 11; age un entero 0-130; phone entre 6 y 20 caracteres permitiendo dígitos, espacios, `+`, `-` y paréntesis.

### DEVELOPER - `PATCH /users/me/developer-profile`

Campos: `career`, `university`, `academicStatus`, `experienceYears`, `specialty`, `technologyIds`, `cvUrl`, `photoUrl`, `linkedinUrl`, `githubUrl`.
Las tecnologías deben existir y estar activas. El backend reemplaza la selección completa en una transacción. URLs únicamente HTTP(S).

### PRODUCT_OWNER - `PATCH /users/me/product-owner-profile`

Campos: `bio`, `specialty`, `availabilityNotes`, `photoUrl`.

### ADMIN - `PATCH /users/me/admin-profile`

Campos: `executiveTitle`, `specialty`, `photoUrl`, `calendlyUrl`.
`isPublicAdvisor` existe en el modelo, pero no puede modificarse desde el perfil propio; su autorización pertenece al Sprint de reuniones/asesores.

## 7. Seguridad y persistencia

- Cada perfil tiene `userId` único y relación uno-a-uno con User.
- El rol determina qué perfil puede consultarse y actualizarse.
- Parámetros o un `userId` inyectado no alteran el propietario.
- Los perfiles antiguos no se eliminan automáticamente ante futuros cambios de rol.
- Registro con bcrypt usando el costo actual de autenticación.
- No incluir datos personales en logs, fixtures versionados o capturas.
- Reemplazo de tecnologías y altas compuestas usan transacciones.

## 8. Pruebas obligatorias

- Registro correcto, email duplicado, consentimiento falso, versiones inválidas y configuración ausente.
- El registro no puede asignar un rol privilegiado.
- Cada rol consulta y actualiza únicamente su perfil permitido.
- Campos sensibles/desconocidos se rechazan.
- Perfil inexistente retorna null; PATCH crea y luego actualiza.
- technologyIds inexistentes, inactivos o duplicados se rechazan.
- Las respuestas no contienen passwordHash ni tokenVersion.
- Regresión de login, refresh, logout, Projects y Services.
- E2E en base aislada, nunca en la base compartida de desarrollo.

## 9. Entrega a frontend

El Responsable A comparte contrato, rama/commit, Swagger y ejemplos reales sin secretos. El frontend puede usar mocks equivalentes, pero la integración final se prueba contra la API real.
