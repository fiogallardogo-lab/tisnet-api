# Sprint 15 A — Operación y validación pendiente

## Configuración requerida

1. Aplicar la migración aditiva 20260929200000_s15_commercial_operations sobre una base cuyo esquema e historial estén reconciliados. Crea PaymentReminder, PaymentReminderDelivery y PublicTeamProfile; no borra datos.
2. Configurar NOTIFICATION_PROVIDER=smtp o resend con remitente autorizado. SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM. Resend: RESEND_API_KEY, MAIL_FROM. PUBLIC_FRONTEND_URL debe ser la URL del portal. Guardar secretos en el gestor del entorno, nunca en Git ni en el informe.
3. Aprobar evento, hora, versión y días adicionales. Configurar PAYMENT_REMINDER_TRIGGER, PAYMENT_REMINDER_CUTOFF, PAYMENT_REMINDER_POLICY_VERSION y opcional PAYMENT_REMINDER_EXTRA_HOLIDAYS. Activar PAYMENT_REMINDERS_ENABLED=true en procesos API destinados a ejecutar tareas. Varias instancias se coordinan mediante reservas en MySQL.
4. Montar LEGAL_CONTENT_FILE, establecer TERMS_VERSION y PRIVACY_VERSION coincidentes y LEGAL_REQUIRE_PUBLISHED=true. Publicar solo archivo definitivo con referencia de aprobación real.
5. Aprobar dominios públicos de imágenes en PUBLIC_TEAM_MEDIA_HOSTS. Publicar perfiles individualmente con consentimiento registrado.

## Ensayo externo para A y QA

Con cuentas y buzón expresamente autorizados, ejecutar activación → cotización oficial/PDF → reunión pendiente/confirmada → evidencia/aprobación → recordatorio vencido → postulación. Conservar identificador de envío, fecha y evidencia de recepción de las cinco categorías, con capturas redactadas. No exportar enlaces de activación, tokens, CV ni fotos privadas al informe.

En staging, comprobar worker activo, fechas de Lima, consulta del cliente, reintento por Admin, pago antes del envío, deuda reemplazada, retiro del perfil público y aceptación legal. Ejecutar los recorridos de cinco roles desde frontend con C. SMTP local demuestra integración de protocolo; falta confirmar TLS, DNS/remitente y llegada al buzón externo autorizado.

## Incidencia anterior de migraciones — Responsable B

La ejecución limpia de prisma migrate deploy falla con P3018/MySQL 1146 en 20260925170000_project_kickoff_audit: intenta ALTER de ProjectMember antes de su creación en 20260928100000_add_project_members_deliverables. Reproducido en base nueva aislada. No se reescribieron migraciones históricas que puedan estar aplicadas en otros entornos.

B debe acordar un baseline/reconciliación compatible con los historiales reales, revisar otros pasos posteriores y repetir migrate deploy desde cero en CI. No usar db push ni migrate reset sobre staging/producción como sustituto. La validación incremental de A partió del esquema de develop y terminó sin drift; esto no certifica la cadena histórica completa.

## Recuperación

Los envíos pendientes y las reservas viven en MySQL. Tras reinicio, iniciar API con el worker habilitado: reserva caducada vuelve a ser elegible, envíos SENT no se reprograman automáticamente y cuotas pagadas/reemplazadas se cancelan al procesar. FAILED se reencola mediante endpoint administrativo documentado.

Para retirar la versión de API, desactivar primero el worker y preservar las tres tablas y su historial. No borrar recordatorios como rollback: se perdería la protección contra reenvíos. B debe probar backup/restauración y rollback del despliegue completo con datos de staging; esta entrega no declara esas tareas verificadas.

## Comandos de validación local

    npm run build
    npm run lint
    npm test -- --maxWorkers=2
    npm run test:e2e -- --maxWorkers=1
    npx prisma validate

Usar únicamente DATABASE_URL_TEST/DATABASE_URL apuntando a una base MySQL aislada con nombre de test. Los E2E comerciales usan SMTP real en loopback con buzón en memoria; no envían mensajes a Internet. Archivos .env, buzones MIME y salidas temporales permanecen ignorados por Git.
