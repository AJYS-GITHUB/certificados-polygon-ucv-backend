# Guía de Uso del Sistema de Assets para Correos

## 📋 Descripción General

El sistema de assets de correos permite subir imágenes, CSS y otros archivos necesarios para crear plantillas de correo profesionales. Cada asset obtiene una URL pública que puedes usar directamente en tu HTML.

## 🚀 Flujo de Trabajo

### 1. Crear Plantilla de Correo

```bash
POST /correos
Content-Type: application/json

{
  "nombre": "bienvenida",
  "asunto": "Bienvenido a UCV",
  "contenidoHtml": "<h1>Hola {{nombre}}</h1><p>Contenido aquí</p>",
  "variables": [
    {
      "nombre": "nombre",
      "descripcion": "Nombre del usuario",
      "ejemplo": "Juan Pérez"
    }
  ]
}
```

**Respuesta:**
```json
{
  "_id": "plantilla_id",
  "nombre": "bienvenida",
  "asunto": "Bienvenido a UCV",
  "contenidoHtml": "...",
  "assets": [],
  ...
}
```

### 2. Subir Assets (Imágenes, CSS, etc.)

```bash
POST /correos/plantilla_id/assets
Content-Type: multipart/form-data

[archivo binario de imagen/css]
```

**Respuesta:**
```json
{
  "message": "Asset subido exitosamente",
  "asset": {
    "nombre": "logo.png",
    "url": "http://localhost:3000/email-assets/asset-1735065123456-abc123.png",
    "filename": "asset-1735065123456-abc123.png",
    "tipo": "imagen",
    "createdAt": "2024-01-21T..."
  },
  "htmlSnippet": "<img src=\"http://localhost:3000/email-assets/asset-1735065123456-abc123.png\" alt=\"logo.png\" />",
  "markdownSnippet": "![logo.png](http://localhost:3000/email-assets/asset-1735065123456-abc123.png)"
}
```

### 3. Usar el Asset en tu HTML

Tienes varias opciones:

#### Opción A: Usar la URL directa
```html
<img src="http://localhost:3000/email-assets/asset-1735065123456-abc123.png" alt="Logo">
```

#### Opción B: Usar el HTML snippet de la respuesta
Copia directamente el `htmlSnippet` de la respuesta al subir el asset:
```html
<img src="http://localhost:3000/email-assets/asset-1735065123456-abc123.png" alt="logo.png" />
```

#### Opción C: Actualizar el contenidoHtml con la URL
```bash
PUT /correos/plantilla_id
Content-Type: application/json

{
  "contenidoHtml": "<h1>Hola {{nombre}}</h1><img src=\"http://localhost:3000/email-assets/asset-1735065123456-abc123.png\" alt=\"Logo\"><p>Contenido aquí</p>"
}
```

## 📦 Endpoints Útiles

### Obtener URL de un Asset específico
```bash
GET /correos/plantilla_id/assets/asset-1735065123456-abc123.png/url
```

**Respuesta:**
```json
{
  "asset": {
    "nombre": "logo.png",
    "url": "http://localhost:3000/email-assets/asset-1735065123456-abc123.png",
    "tipo": "imagen"
  },
  "htmlSnippet": "<img src=\"...\" alt=\"logo.png\" />",
  "directUrl": "http://localhost:3000/email-assets/asset-1735065123456-abc123.png"
}
```

### Obtener Plantilla con URLs formateadas
```bash
GET /correos/plantilla_id/with-assets
```

**Respuesta:**
```json
{
  "_id": "plantilla_id",
  "nombre": "bienvenida",
  "contenidoHtml": "...",
  "assetsFormato": [
    {
      "nombre": "logo.png",
      "url": "http://localhost:3000/email-assets/asset-...",
      "htmlSnippet": "<img src=\"...\" alt=\"logo.png\" />",
      "markdownSnippet": "![logo.png](...)",
      "cssImport": null
    },
    {
      "nombre": "estilos.css",
      "url": "http://localhost:3000/email-assets/asset-...",
      "htmlSnippet": "...",
      "cssImport": "<link rel=\"stylesheet\" href=\"...\">"
    }
  ],
  "variablesList": [
    {
      "nombre": "nombre",
      "descripcion": "Nombre del usuario",
      "ejemplo": "Juan Pérez",
      "placeholder": "{{nombre}}"
    }
  ],
  "assetCount": 2,
  "variableCount": 1
}
```

### Renderizar HTML con Variables
```bash
POST /correos/plantilla_id/render
Content-Type: application/json

{
  "variables": {
    "nombre": "Juan Pérez",
    "certificado": "Certificado de Excelencia"
  }
}
```

**Respuesta:**
```json
{
  "html": "<h1>Hola Juan Pérez</h1><p>Tu certificado Certificado de Excelencia ha sido emitido</p>...",
  "asunto": "Bienvenido a UCV",
  "assets": [
    {
      "nombre": "logo.png",
      "url": "http://localhost:3000/email-assets/asset-...",
      "tipo": "imagen"
    }
  ]
}
```

### Generar HTML Completo para Preview
```bash
GET /correos/plantilla_id/preview-code
```

**Respuesta:**
```json
{
  "htmlCompleto": "<!DOCTYPE html>...<html>...<body>...",
  "assets": [...],
  "variables": [...]
}
```

## 💡 Ejemplos de Uso

### Caso 1: Email Simple con Logo

1. Crear plantilla:
```bash
POST /correos
{
  "nombre": "email-certificado",
  "asunto": "Tu certificado ha sido emitido",
  "contenidoHtml": "<div><img src='LOGO_URL' alt='Logo'><h1>Hola {{nombre}}</h1><p>Tu certificado {{certificado}} ha sido emitido.</p></div>"
}
```

2. Subir logo:
```bash
POST /correos/{id}/assets
multipart/form-data: logo.png
```

3. Copiar URL del logo (de la respuesta) y reemplazar LOGO_URL

4. Actualizar HTML:
```bash
PUT /correos/{id}
{
  "contenidoHtml": "<div><img src='http://localhost:3000/email-assets/asset-...' alt='Logo'><h1>Hola {{nombre}}</h1>..."
}
```

### Caso 2: Email con Estilos CSS

1. Subir CSS:
```bash
POST /correos/{id}/assets
multipart/form-data: estilos.css
```

2. Obtener información con URLs:
```bash
GET /correos/{id}/with-assets
```

3. Copiar el `cssImport` del response y agregarlo al contenidoHtml:
```bash
PUT /correos/{id}
{
  "contenidoHtml": "<link rel='stylesheet' href='http://localhost:3000/email-assets/asset-...'><h1 class='titulo'>Hola {{nombre}}</h1>..."
}
```

## 🎯 Mejores Prácticas

1. **URLs Públicas**: Todos los assets son accesibles públicamente en `/email-assets/`
2. **Nombres únicos**: Los archivos se renombran automáticamente para evitar conflictos
3. **Tipos soportados**: JPG, PNG, GIF, SVG, WEBP, CSS, HTML
4. **Tamaño máximo**: 5MB por archivo
5. **Persistencia**: Los assets se eliminan cuando se elimina la plantilla

## ⚠️ Consideraciones

- Las URLs de assets son **absolutas** (comienzan con `http://`)
- Si cambias `BASE_URL` en `.env`, todas las URLs cambiarán automáticamente
- Los assets se almacenan en `/public/email-assets/`
- Usa siempre `{{variable}}` para los placeholders en el HTML

## 🔧 Variables de Entorno

```env
# En .env
BASE_URL=http://localhost:3000
# O en producción:
BASE_URL=https://tudominio.com
```

---

¡Listo! Ahora puedes crear plantillas de correo con assets de forma sencilla! 🎉
