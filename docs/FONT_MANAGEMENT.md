# Sistema de Gestión de Fuentes

Este documento describe cómo usar el sistema de gestión de fuentes para subir, instalar y utilizar fuentes personalizadas en los certificados.

## Endpoints Disponibles

### 1. Listar Fuentes del Sistema
```http
GET /fonts
```
**Respuesta:**
```json
{
  "success": true,
  "count": 156,
  "fonts": [
    {
      "name": "Arial-Regular",
      "path": "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      "type": "ttf",
      "directory": "/usr/share/fonts/truetype/liberation"
    }
  ]
}
```

### 2. Obtener Fuentes Comunes
```http
GET /fonts/common
```
**Respuesta:**
```json
{
  "success": true,
  "fonts": [
    {
      "family": "Arial",
      "variants": [
        {
          "name": "Arial-Regular",
          "path": "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
        }
      ]
    }
  ]
}
```

### 3. Buscar Fuentes
```http
GET /fonts/search/Arial
```
**Respuesta:**
```json
{
  "success": true,
  "query": "Arial",
  "count": 4,
  "fonts": [...]
}
```

### 4. Subir Fuentes
```http
POST /fonts/upload
Content-Type: multipart/form-data
```
**Parámetros:**
- `fonts`: Array de archivos de fuentes (TTF, OTF, WOFF, WOFF2)
- Límite: 10 archivos, máximo 10MB cada uno

**Respuesta:**
```json
{
  "success": true,
  "uploaded": 2,
  "fonts": [
    {
      "originalName": "MiFuente.ttf",
      "filename": "MiFuente.ttf",
      "path": "/app/storage/fonts/MiFuente.ttf",
      "size": 245760,
      "type": "ttf"
    }
  ],
  "errors": []
}
```

### 5. Instalar Fuentes en el Sistema
```http
POST /fonts/install
Content-Type: application/json
```
**Body:**
```json
{
  "fontFiles": ["MiFuente.ttf", "OtraFuente.otf"]
}
```

**Respuesta:**
```json
{
  "success": true,
  "installed": 2,
  "fonts": [
    {
      "filename": "MiFuente.ttf",
      "installed": true,
      "path": "/usr/local/share/fonts/MiFuente.ttf"
    }
  ],
  "message": "Fuentes instaladas correctamente. Reinicie la aplicación para que estén disponibles."
}
```

### 6. Listar Fuentes Subidas (No Instaladas)
```http
GET /fonts/uploaded
```

### 7. Eliminar Fuente Subida
```http
DELETE /fonts/uploaded/MiFuente.ttf
```

## Proceso de Instalación de Fuentes

### 1. **Subir Fuente**
```bash
curl -X POST \
  http://localhost:3000/fonts/upload \
  -F 'fonts=@/ruta/a/tu/fuente.ttf'
```

### 2. **Instalar en el Sistema**
```bash
curl -X POST \
  http://localhost:3000/fonts/install \
  -H 'Content-Type: application/json' \
  -d '{"fontFiles": ["fuente.ttf"]}'
```

### 3. **Usar en Certificados**
```json
{
  "paginas": [
    {
      "numero": 1,
      "contenido": "subject",
      "font": "MiFuente",
      "fontSize": 20,
      "color": "#000000",
      "x": 100,
      "y": 200
    }
  ]
}
```

## Rutas de Instalación por Sistema Operativo

### Linux
- **Directorio**: `/usr/local/share/fonts`
- **Comando**: `sudo fc-cache -f -v` (actualiza caché)
- **Permisos**: 644

### macOS
- **Directorio**: `/Library/Fonts`
- **Comando**: `sudo atsutil databases -remove` (limpia caché)
- **Permisos**: 644

### Windows
- **Directorio**: `C:\Windows\Fonts`
- **Método**: Copia directa
- **Registro**: Automático

## Formatos de Fuente Soportados

- **TTF** (TrueType Font) - Recomendado
- **OTF** (OpenType Font) - Recomendado
- **WOFF** (Web Open Font Format)
- **WOFF2** (Web Open Font Format 2.0)

## Ejemplos de Uso

### Frontend JavaScript
```javascript
// Subir fuente
const formData = new FormData();
formData.append('fonts', fileInput.files[0]);

fetch('/fonts/upload', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    // Instalar fuente
    return fetch('/fonts/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fontFiles: data.fonts.map(f => f.filename)
      })
    });
  }
})
.then(response => response.json())
.then(data => {
  console.log('Fuentes instaladas:', data);
});
```

### Usando fuentes en certificados
```javascript
// Obtener fuentes disponibles
fetch('/fonts/common')
.then(response => response.json())
.then(fonts => {
  // Configurar certificado con fuente específica
  const certificadoConfig = {
    paginas: [{
      numero: 1,
      contenido: "subject",
      font: fonts.fonts[0].family, // Usar fuente disponible
      fontSize: 24,
      color: "#000000",
      x: 150,
      y: 300
    }]
  };
});
```

## Consideraciones de Seguridad

1. **Permisos**: La instalación requiere permisos de administrador
2. **Validación**: Solo se aceptan formatos de fuente válidos
3. **Límites**: Máximo 10MB por archivo, 10 archivos simultáneos
4. **Directorio**: Las fuentes se guardan en `/storage/fonts` antes de instalar

## Troubleshooting

### Error de permisos
```bash
# En Linux/macOS, asegurar permisos sudo
sudo chown -R $USER:$USER /usr/local/share/fonts
```

### Fuente no aparece después de instalar
```bash
# Limpiar caché de fuentes
# Linux:
sudo fc-cache -f -v

# macOS:
sudo atsutil databases -remove
```

### Error de formato no soportado
- Verificar que el archivo sea TTF, OTF, WOFF o WOFF2
- Usar herramientas como FontForge para convertir formatos

## Notas Importantes

- **Reinicio requerido**: Después de instalar fuentes, reiniciar la aplicación
- **Backup**: Las fuentes subidas se mantienen en `/storage/fonts`
- **Limpieza**: Eliminar fuentes subidas que no se vayan a usar
- **Compatibilidad**: Algunas fuentes pueden no renderizar igual en todos los sistemas