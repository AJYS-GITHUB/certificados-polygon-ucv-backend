# Email Assets Directory

Este directorio almacena los assets (imágenes, CSS, etc.) utilizados en las plantillas de correo.

## Estructura
- Todos los archivos subidos se almacenan aquí con nombres únicos
- Los archivos son accesibles públicamente vía `/email-assets/[nombre-archivo]`

## Tipos de archivos permitidos
- Imágenes: JPG, PNG, GIF, SVG, WEBP
- Estilos: CSS
- Otros: HTML

## Tamaño máximo
- 5MB por archivo

## Uso
Los assets se gestionan a través de la API de correos:
- POST `/correos/:id/assets` - Subir asset
- GET `/correos/:id/assets` - Listar assets
- DELETE `/correos/:id/assets/:assetId` - Eliminar asset
