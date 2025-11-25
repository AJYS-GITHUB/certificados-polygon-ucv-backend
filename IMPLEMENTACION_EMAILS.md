# Implementación del Sistema de Envío de Correos - Resumen

## Archivos Creados

### 1. `/services/emailService.js`
**Propósito:** Servicio central de envío de correos electrónicos

**Funcionalidades principales:**
- `sendEmailToEmision(emisionId, correoTemplateId)` - Envía correo individual
- `sendEmailsToEmisions(emisionIds, correoTemplateId)` - Envía a múltiples emisiones
- `sendPendingEmails(correoTemplateId)` - Envía todos los pendientes
- `sendTestEmail(toEmail, correoTemplateId)` - Prueba de configuración
- `getEmailStatus()` - Verifica estado del transporte
- `renderEmailTemplate(templateHtml, emision)` - Reemplaza variables en HTML

**Características:**
- Variables disponibles: `{{nombre}}`, `{{documento}}`, `{{email}}`, `{{fecha}}`, `{{fechaLarga}}`, `{{uuid}}`
- Adjunta automáticamente el PDF del certificado
- Gestiona errores y registra intentos
- Verifica existencia de plantilla y archivo PDF

### 2. `/controllers/emailController.js`
**Propósito:** Controladores de rutas de email

**Endpoints:**
- `sendToEmision` - POST /emails/emision/:id/send
- `sendToMultipleEmisions` - POST /emails/emisions/send
- `sendPendingEmails` - POST /emails/pending/send
- `sendTestEmail` - POST /emails/test
- `getEmailStatus` - GET /emails/status
- `getEmailStats` - GET /emails/stats

### 3. `/routes/emails.js`
**Propósito:** Rutas HTTP para el sistema de email

**Rutas configuradas:**
```
GET  /emails/status           - Estado del servicio
GET  /emails/stats            - Estadísticas de envío
POST /emails/test             - Correo de prueba
POST /emails/emision/:id/send - Envío individual
POST /emails/emisions/send    - Envío múltiple
POST /emails/pending/send     - Envío pendientes
```

## Archivos Modificados

### 1. `/app.js`
**Cambios:**
- Importado `const emailsRouter = require('./routes/emails');`
- Registrado `app.use('/emails', emailsRouter);`
- Mejorado middleware de error para retornar JSON en rutas API
- Agregado manejo específico de errores para endpoints `/correos`, `/certificados`, `/emisiones`

### 2. `/.env.example`
**Cambios:** Agregadas variables de configuración de email:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@ucv.edu.ve
```

### 3. `/postman_collection.json`
**Cambios:** 
- Agregada nueva sección "Emails" con 6 endpoints
- Documentados los parámetros y bodies requeridos
- Incluidos ejemplos de uso

## Documentación Creada

### 1. `/GUIA_EMAILS.md`
Guía completa con:
- Configuración del servicio (especialmente para Gmail)
- Documentación de cada endpoint
- Variables disponibles en plantillas
- Flujo completo de ejemplo
- Debugging y resolución de problemas
- Estructura de datos
- Mejores prácticas

## Flujo de Uso

### Instalación Inicial (Una sola vez)

1. **Configurar variables de entorno** en `.env`:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=tu-email@gmail.com
   EMAIL_PASSWORD=tu-contraseña-app
   EMAIL_FROM=noreply@ucv.edu.ve
   ```

2. **Crear plantilla de correo**:
   ```bash
   POST /correos
   Body: {
     "nombre": "plantilla-certificado",
     "asunto": "Tu Certificado Digital",
     "contenidoHtml": "...",
     "variables": [...]
   }
   ```

3. **Opcionalmente subir assets**:
   ```bash
   POST /correos/:id/assets
   Form-data: file=logo.png
   ```

### Uso Diario

1. **Verificar estado del servicio**:
   ```bash
   GET /emails/status
   ```

2. **Enviar correo de prueba**:
   ```bash
   POST /emails/test
   Body: {
     "toEmail": "admin@example.com",
     "correoTemplateId": "PLANTILLA_ID"
   }
   ```

3. **Enviar correos pendientes**:
   ```bash
   POST /emails/pending/send
   Body: {
     "correoTemplateId": "PLANTILLA_ID"
   }
   ```

## Integración con Modelo Emision

El modelo Emision ya tenía los campos necesarios:
- `subject.correo` - Email del destinatario
- `emailSended` - Bandera de envío (se actualiza automáticamente)
- `subject.nombreCompleto` - Nombre para variable {{nombre}}
- `subject.documento` - Documento para variable {{documento}}
- `pdfPath` - Ruta del PDF a adjuntar

## Integración con Modelo Correo

Se aprovecha la plantilla de correo existente:
- `contenidoHtml` - HTML con variables {{variable}}
- `asunto` - Asunto del email
- `variables` - Definición de variables disponibles
- `assets` - Imágenes y estilos CSS

## Integración con Modelo Certificado

Se utiliza el campo `plantillaCorreo` agregado previamente:
- Referencia a la plantilla por defecto
- Permite sobrescribir con parámetro en request

## Configuración de SMTP

### Para Gmail:

1. Habilitar "Verificación en 2 pasos"
2. Generar "Contraseña de aplicación" en https://myaccount.google.com/apppasswords
3. En `.env`:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=tucorreo@gmail.com
   EMAIL_PASSWORD=contraseña-de-aplicación
   EMAIL_FROM=noreply@ucv.edu.ve
   ```

### Para Otros Proveedores:

Ajustar HOST, PORT y SECURE según documentación del proveedor.

## Variables en Plantilla

```
{{nombre}}        - Nombre completo del estudiante
{{documento}}     - Número de cédula/documento
{{email}}         - Email del estudiante
{{fecha}}         - Fecha corta (DD/MM/YYYY)
{{fechaLarga}}    - Fecha larga (Martes, 21 de noviembre de 2025)
{{uuid}}          - Identificador único de emisión
```

## Respuestas del Sistema

### Envío Exitoso
```json
{
  "success": true,
  "messageId": "<xxx@smtp.gmail.com>",
  "emisionId": "...",
  "email": "usuario@example.com"
}
```

### Envío con Errores (parcial)
```json
{
  "success": true,
  "message": "Correos enviados: 45/50",
  "results": {
    "sent": [...],
    "failed": [
      {
        "emisionId": "...",
        "error": "Archivo PDF no encontrado"
      }
    ],
    "total": 50
  }
}
```

## Consideraciones de Producción

1. **Límites de envío:** Gmail permite ~100 emails/hora desde cuentas estándar
2. **Cola de envío:** Para envíos masivos, considerar implementar cola (Bull, RabbitMQ)
3. **Reintentos:** Sistema actual no reintenta fallidos (feature futura)
4. **Logging:** Implementar logging persistente de intentos
5. **Reportes:** Crear reportes de envío/no-envío por fecha
6. **Validación:** Validar emails antes de enviar
7. **Templating:** Considerar motor como Handlebars para plantillas complejas

## Testing Recomendado

1. Verificar `GET /emails/status` retorna `verified: true`
2. Enviar `POST /emails/test` a email de prueba
3. Verificar `GET /emails/stats` después de envíos
4. Revisar logs en consola para errors
5. Verificar que `emailSended` se actualiza en BD

## Próximos Pasos (Opcionales)

1. Implementar reintentos automáticos para fallos
2. Agregar cola de tareas para envíos masivos
3. Crear dashboard de estadísticas de email
4. Implementar webhook para confirmar lectura
5. Agregar plantillas pre-diseñadas
6. Implementar A/B testing de asuntos
