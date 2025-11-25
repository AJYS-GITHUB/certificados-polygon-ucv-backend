# Guía de Sistema de Envío de Correos Electrónicos

## Descripción General

El sistema de envío de correos electrónicos permite enviar certificados digitales a los usuarios a través de plantillas de correo configurables con assets personalizados.

## Configuración Requerida

### Variables de Entorno (.env)

```env
# Email Service Configuration
EMAIL_HOST=smtp.gmail.com              # Servidor SMTP
EMAIL_PORT=587                         # Puerto SMTP (587 para TLS, 465 para SSL)
EMAIL_SECURE=false                     # true si puerto 465, false si puerto 587
EMAIL_USER=your-email@gmail.com        # Usuario/email para autenticación
EMAIL_PASSWORD=your-app-password       # Contraseña de aplicación
EMAIL_FROM=noreply@ucv.edu.ve         # Email remitente
```

### Configuración para Gmail

1. Habilitar "Verificación en 2 pasos"
2. Generar "Contraseña de aplicación" en https://myaccount.google.com/apppasswords
3. Usar esa contraseña en `EMAIL_PASSWORD`

## Soporte para CC (Copia) y CCO (Copia Oculta)

El sistema soporta CC y CCO de dos formas:

### 1. A Nivel de Plantilla (Configuración Permanente)

Cuando creas o actualizas una plantilla, puedes definir CC y CCO por defecto:

```json
{
  "nombre": "plantilla-certificado",
  "asunto": "Tu Certificado Digital",
  "contenidoHtml": "...",
  "cc": [
    "supervisor@example.com",
    "director-academico@example.com"
  ],
  "cco": [
    "auditoria@example.com",
    "archivo@example.com"
  ]
}
```

### 2. A Nivel de Endpoint (Adicionales por Envío)

En cada endpoint de envío, puedes agregar CC y CCO adicionales:

```json
{
  "correoTemplateId": "id",
  "cc": ["email@example.com"],
  "cco": ["email@example.com"]
}
```

### 3. Combinación de Ambos

Los CC y CCO del endpoint se **combinan** con los de la plantilla (elimina duplicados automáticamente):

**Plantilla define:** `cc: ["supervisor@example.com"]`, `cco: ["auditoria@example.com"]`

**Endpoint envía:** `cc: ["director@example.com"]`, `cco: ["compliance@example.com"]`

**Resultado final:**
- **CC:** supervisor@example.com, director@example.com
- **CCO:** auditoria@example.com, compliance@example.com

### Formato de Parámetros

- **String único:** `"cc": "email@example.com"`
- **Array de emails:** `"cc": ["email1@example.com", "email2@example.com"]`

## Funcionalidades

### 1. Obtener Estado del Servicio

**Endpoint:** `GET /emails/status`

```bash
curl http://localhost:3000/emails/status
```

**Respuesta:**
```json
{
  "configured": true,
  "verified": true,
  "host": "smtp.gmail.com",
  "port": 587,
  "from": "noreply@ucv.edu.ve",
  "secure": false
}
```

### 2. Obtener Estadísticas de Envío

**Endpoint:** `GET /emails/stats`

```bash
curl http://localhost:3000/emails/stats
```

**Respuesta:**
```json
{
  "sent": 45,
  "pending": 12,
  "total": 57,
  "sentPercentage": "78.95"
}
```

### 3. Enviar Correo de Prueba

**Endpoint:** `POST /emails/test`

Prueba la configuración de email enviando un correo a un usuario de prueba.

**Body:**
```json
{
  "toEmail": "test@example.com",
  "correoTemplateId": "id_de_plantilla",
  "cc": ["supervisor@example.com"],
  "cco": ["auditoria@example.com"]
}
```

**Parámetros:**
- `toEmail` (requerido) - Email destinatario
- `correoTemplateId` (requerido) - ID de la plantilla
- `cc` (opcional) - CC adicionales (se combinan con los de la plantilla)
- `cco` (opcional) - CCO adicionales (se combinan con los de la plantilla)

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:3000/emails/test \
  -H "Content-Type: application/json" \
  -d '{
    "toEmail": "test@example.com",
    "correoTemplateId": "6924c02b7e49d5a4f709b651",
    "cc": ["director@example.com"],
    "cco": ["auditor@example.com"]
  }'
```

### 4. Enviar Correo a Emisión Específica

**Endpoint:** `POST /emails/emision/:id/send`

Envía correo a una emisión individual con el certificado PDF adjunto.

**Body:**
```json
{
  "correoTemplateId": "id_de_plantilla",
  "cc": ["supervisor@example.com"],
  "cco": ["auditoria@example.com"]
}
```

**Parámetros:**
- `correoTemplateId` (requerido) - ID de la plantilla
- `cc` (opcional) - CC adicionales (se combinan con los de la plantilla)
- `cco` (opcional) - CCO adicionales (se combinan con los de la plantilla)

**Variables Disponibles en la Plantilla:**
- `{{nombre}}` - Nombre completo del estudiante
- `{{documento}}` - Número de documento/cédula
- `{{email}}` - Email del estudiante
- `{{fecha}}` - Fecha de emisión (formato: DD/MM/YYYY)
- `{{fechaLarga}}` - Fecha de emisión (formato: Martes, 21 de noviembre de 2025)
- `{{uuid}}` - UUID único de la emisión

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/emails/emision/6924c02b7e49d5a4f709b651/send \
  -H "Content-Type: application/json" \
  -d '{
    "correoTemplateId": "6924c02b7e49d5a4f709b651",
    "bcc": ["admin@example.com", "supervisor@example.com"]
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Correo enviado exitosamente",
  "result": {
    "success": true,
    "messageId": "<xxx@gmail.com>",
    "emisionId": "6924c02b7e49d5a4f709b651",
    "email": "usuario@example.com"
  }
}
```

### 5. Enviar Correos a Múltiples Emisiones

**Endpoint:** `POST /emails/emisions/send`

Envía correos a varias emisiones simultáneamente.

**Body:**
```json
{
  "emisionIds": [
    "id_emision_1",
    "id_emision_2",
    "id_emision_3"
  ],
  "correoTemplateId": "id_de_plantilla",
  "cc": ["supervisor@example.com"],
  "cco": ["auditoria@example.com"]
}
```

**Parámetros:**
- `emisionIds` (requerido) - Array de IDs de emisiones
- `correoTemplateId` (requerido) - ID de la plantilla
- `cc` (opcional) - CC adicionales (se combinan con los de la plantilla)
- `cco` (opcional) - CCO adicionales (se combinan con los de la plantilla)

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/emails/emisions/send \
  -H "Content-Type: application/json" \
  -d '{
    "emisionIds": ["6924c02b7e49d5a4f709b651", "6924c02b7e49d5a4f709b652"],
    "correoTemplateId": "6924c02b7e49d5a4f709b653",
    "bcc": ["admin@example.com", "director@example.com"]
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Correos enviados: 2/2",
  "results": {
    "sent": [
      {
        "success": true,
        "messageId": "<xxx@gmail.com>",
        "emisionId": "6924c02b7e49d5a4f709b651",
        "email": "usuario1@example.com"
      },
      {
        "success": true,
        "messageId": "<yyy@gmail.com>",
        "emisionId": "6924c02b7e49d5a4f709b652",
        "email": "usuario2@example.com"
      }
    ],
    "failed": [],
    "total": 2
  }
}
```

### 6. Enviar Correos Pendientes (No Enviados)

**Endpoint:** `POST /emails/pending/send`

Envía correos a todas las emisiones que aún no han sido enviadas (`emailSended = false`).

**Body:**
```json
{
  "correoTemplateId": "id_de_plantilla",
  "cc": ["supervisor@example.com"],
  "cco": ["auditoria@example.com"]
}
```

**Parámetros:**
- `correoTemplateId` (requerido) - ID de la plantilla
- `cc` (opcional) - CC adicionales (se combinan con los de la plantilla)
- `cco` (opcional) - CCO adicionales (se combinan con los de la plantilla)

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/emails/pending/send \
  -H "Content-Type: application/json" \
  -d '{
    "correoTemplateId": "6924c02b7e49d5a4f709b651",
    "bcc": ["admin@example.com", "auditor@example.com"]
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Correos pendientes procesados: 45",
  "results": {
    "sent": [
      {
        "success": true,
        "messageId": "<xxx@gmail.com>",
        "emisionId": "...",
        "email": "usuario@example.com"
      }
      // ... más envíos
    ],
    "failed": [
      {
        "emisionId": "...",
        "error": "Archivo PDF no encontrado"
      }
      // ... más errores
    ],
    "total": 45
  }
}
```

## Crear Plantilla de Correo

Antes de enviar correos, es necesario crear una plantilla.

**Endpoint:** `POST /correos`

```bash
curl -X POST http://localhost:3000/correos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Plantilla Certificado UCV",
    "asunto": "Tu Certificado Digital de {{nombre}}",
    "contenidoHtml": "<html><body><h1>Felicitaciones {{nombre}}</h1><p>Tu certificado ha sido emitido el {{fechaLarga}}</p></body></html>",
    "descripcion": "Plantilla para envío de certificados digitales",
    "cc": ["supervisor@example.com", "director@example.com"],
    "cco": ["auditoria@example.com"],
    "variables": [
      {
        "nombre": "nombre",
        "descripcion": "Nombre completo del estudiante",
        "ejemplo": "Juan Pérez"
      },
      {
        "nombre": "fecha",
        "descripcion": "Fecha de emisión",
        "ejemplo": "21/11/2025"
      }
    ],
    "activo": true
  }'
```

## Flujo Completo de Ejemplo

### 1. Crear Plantilla de Correo

```bash
curl -X POST http://localhost:3000/correos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "plantilla-certificado",
    "asunto": "Tu Certificado Digital",
    "contenidoHtml": "<html><body><h1>Hola {{nombre}}</h1><p>Adjunto tu certificado</p></body></html>",
    "variables": [
      { "nombre": "nombre", "descripcion": "Nombre", "ejemplo": "Juan" }
    ],
    "activo": true
  }'
```

Guardar el `_id` de respuesta: `PLANTILLA_ID`

### 2. Subir Assets (Opcional)

```bash
curl -X POST http://localhost:3000/correos/PLANTILLA_ID/assets \
  -F "file=@logo.png"
```

### 3. Enviar Correo de Prueba

```bash
curl -X POST http://localhost:3000/emails/test \
  -H "Content-Type: application/json" \
  -d '{
    "toEmail": "admin@example.com",
    "correoTemplateId": "PLANTILLA_ID"
  }'
```

### 4. Enviar Correos Pendientes

Una vez confirmado que funciona:

```bash
curl -X POST http://localhost:3000/emails/pending/send \
  -H "Content-Type: application/json" \
  -d '{
    "correoTemplateId": "PLANTILLA_ID"
  }'
```

## Monitoreo y Debugging

### Logs de Email

El sistema registra todos los intentos de envío en la consola:

```
Email sent successfully: <xxx@gmail.com>
Error sending email to emision: Error message
```

### Verificar Configuración

```bash
curl http://localhost:3000/emails/status
```

Si `verified: false`, revisar:
- Credenciales en `.env`
- Conexión de red
- Configuración del servidor SMTP

### Ver Estadísticas

```bash
curl http://localhost:3000/emails/stats
```

## Estructura de Datos

### Modelo Emision

```javascript
{
  _id: ObjectId,
  certificado: ObjectId,      // Referencia al certificado
  subject: {
    documento: String,
    nombreCompleto: String,
    correo: String            // Email del destinatario
  },
  fechaEmision: Date,
  emailSended: Boolean,        // true si fue enviado
  transactionId: String,
  status: String,
  updatedAt: Date
}
```

### Modelo Correo

```javascript
{
  _id: ObjectId,
  nombre: String,             // Nombre único de la plantilla
  asunto: String,             // Asunto del email
  contenidoHtml: String,      // HTML con variables {{variable}}
  descripcion: String,
  variables: [
    {
      nombre: String,
      descripcion: String,
      ejemplo: String
    }
  ],
  assets: [
    {
      nombre: String,
      url: String,
      filename: String,
      tipo: String             // imagen, css, etc
    }
  ],
  activo: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Mejores Prácticas

1. **Plantillas Responsivas:** Usar HTML/CSS que se adapte a dispositivos móviles
2. **Pruebas:** Siempre enviar correo de prueba antes de envío masivo
3. **Monitoreo:** Revisar `GET /emails/stats` regularmente
4. **Variables:** Usar variables disponibles en la plantilla
5. **Assets:** Incluir logos e imágenes para mejorar presentación
6. **Límites:** Considerar límites de envío del servidor SMTP

## Resolución de Problemas

### Error: "No hay plantilla de correo configurada"

- Verificar que la emisión tiene `plantillaCorreo` asignada
- O proporcionar `correoTemplateId` en el body

### Error: "Archivo PDF no encontrado"

- Verificar que `pdfPath` en la emisión es correcto
- Confirmar que el archivo existe en el storage

### Error: "Unexpected field"

- Verificar que el campo de email es `correo`
- En Postman, usar `form-data` con campo `file`

### Emails no se envían

- Ejecutar `GET /emails/status` para ver si está configurado
- Revisar credenciales en `.env`
- Revisar logs de consola para errores detallados

