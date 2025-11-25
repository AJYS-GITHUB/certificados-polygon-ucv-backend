const Correo = require('../models/Correo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorio para assets de correos si no existe
const assetsDir = path.join(__dirname, '..', 'public', 'email-assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Configuración de multer para subir assets
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, assetsDir);
    },
    filename: function (req, file, cb) {
        // Generar nombre consistente: timestamp + sufijo aleatorio + extensión original
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        // Nombre final: basename-timestamp-random.ext
        cb(null, basename + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // Permitir imágenes, CSS y algunos archivos comunes
    const allowedTypes = /jpeg|jpg|png|gif|svg|css|html|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de imagen, CSS y HTML'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: fileFilter
});

// Exportar middleware de multer para subidas de archivos
// Acepta archivo en campos: file, asset, document, o files (pero solo un archivo)
exports.uploadMiddleware = (req, res, next) => {
    // Intentar con múltiples nombres de campo
    const fieldNames = ['file', 'asset', 'document', 'files'];
    let attemptIndex = 0;

    const tryNextField = () => {
        if (attemptIndex >= fieldNames.length) {
            // Si ninguno funcionó, ejecutar con 'file' para capturar el error
            return upload.single('file')(req, res, next);
        }

        const field = fieldNames[attemptIndex];
        attemptIndex++;

        upload.single(field)(req, res, (err) => {
            if (err) {
                console.error(`Multer error with field '${field}':`, err);
                return next(err);
            }
            
            if (req.file) {
                // Archivo subido exitosamente
                return next();
            }
            
            // Este campo no tenía archivo, probar el siguiente
            tryNextField();
        });
    };

    tryNextField();
};

/**
 * Obtener todas las plantillas de correo
 */
exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const [items, total] = await Promise.all([
            Correo.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
            Correo.countDocuments()
        ]);
        
        res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error('Error en getAll correos:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Obtener una plantilla por ID
 */
exports.getById = async (req, res) => {
    try {
        const correo = await Correo.findById(req.params.id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }
        res.json(correo);
    } catch (err) {
        console.error('Error en getById correo:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Crear nueva plantilla de correo
 */
exports.create = async (req, res) => {
    try {
        const { nombre, asunto, contenidoHtml, descripcion, variables, cc, cco, activo } = req.body;

        // Validar campos requeridos
        if (!nombre || !asunto || !contenidoHtml) {
            return res.status(400).json({ 
                error: 'Campos requeridos: nombre, asunto, contenidoHtml' 
            });
        }

        // Crear la plantilla
        const correo = new Correo({
            nombre,
            asunto,
            contenidoHtml,
            descripcion,
            variables: variables || [],
            cc: cc || [],
            cco: cco || [],
            activo: activo !== undefined ? activo : true,
            assets: []
        });

        await correo.save();
        res.status(201).json(correo);
    } catch (err) {
        console.error('Error en create correo:', err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Ya existe una plantilla con ese nombre' });
        }
        res.status(500).json({ error: err.message });
    }
};

/**
 * Actualizar plantilla de correo
 */
exports.update = async (req, res) => {
    try {
        const { nombre, asunto, contenidoHtml, descripcion, variables, cc, cco, activo } = req.body;

        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (asunto !== undefined) updateData.asunto = asunto;
        if (contenidoHtml !== undefined) updateData.contenidoHtml = contenidoHtml;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (variables !== undefined) updateData.variables = variables;
        if (cc !== undefined) updateData.cc = cc;
        if (cco !== undefined) updateData.cco = cco;
        if (activo !== undefined) updateData.activo = activo;
        updateData.updatedAt = Date.now();

        const correo = await Correo.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        res.json(correo);
    } catch (err) {
        console.error('Error en update correo:', err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Ya existe una plantilla con ese nombre' });
        }
        res.status(500).json({ error: err.message });
    }
};

/**
 * Eliminar plantilla de correo
 */
exports.delete = async (req, res) => {
    try {
        const correo = await Correo.findById(req.params.id);
        
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        // Eliminar assets asociados
        if (correo.assets && correo.assets.length > 0) {
            correo.assets.forEach(asset => {
                const filePath = path.join(assetsDir, path.basename(asset.url));
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }

        await Correo.findByIdAndDelete(req.params.id);
        res.json({ message: 'Plantilla de correo eliminada exitosamente' });
    } catch (err) {
        console.error('Error en delete correo:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Subir asset (imagen, CSS, etc.) para una plantilla
 */
exports.uploadAsset = async (req, res) => {
    try {
        const correo = await Correo.findById(req.params.id);
        
        if (!correo) {
            // Eliminar archivo subido si el correo no existe
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
        }

        // Determinar tipo de archivo
        let tipo = 'otro';
        if (req.file.mimetype.startsWith('image/')) {
            tipo = 'imagen';
        } else if (req.file.mimetype === 'text/css') {
            tipo = 'css';
        }

        // Construir URL dinámica basada en la solicitud actual
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = process.env.APP_URI || `${protocol}://${host}`;
        const assetUrl = `${baseUrl}/email-assets/${req.file.filename}`;
        
        console.log('Asset upload info:', {
            filename: req.file.filename,
            path: req.file.path,
            baseUrl,
            assetUrl,
            exists: fs.existsSync(req.file.path)
        });

        const asset = {
            nombre: req.file.originalname,
            url: assetUrl,
            filename: req.file.filename,
            tipo: tipo,
            createdAt: new Date()
        };

        correo.assets.push(asset);
        await correo.save();

        res.status(201).json({
            message: 'Asset subido exitosamente',
            asset: asset,
            htmlSnippet: `<img src="${assetUrl}" alt="${req.file.originalname}" />`,
            markdownSnippet: `![${req.file.originalname}](${assetUrl})`
        });
    } catch (err) {
        console.error('Error en uploadAsset:', err);
        // Eliminar archivo si hubo error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: err.message });
    }
};

/**
 * Descargar/servir un asset específico
 */
exports.downloadAsset = async (req, res) => {
    try {
        const { id, assetFilename } = req.params;
        
        const correo = await Correo.findById(id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        const asset = correo.assets.find(a => a.filename === assetFilename);
        if (!asset) {
            return res.status(404).json({ error: 'Asset no encontrado' });
        }

        // Construir ruta del archivo
        const filePath = path.join(__dirname, '..', 'public', 'email-assets', assetFilename);

        // Verificar que el archivo existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: `Archivo no encontrado en disco: ${assetFilename}` });
        }

        // Enviar el archivo
        res.download(filePath, asset.nombre);
    } catch (err) {
        console.error('Error en downloadAsset:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Eliminar un asset específico
 */
exports.deleteAsset = async (req, res) => {
    try {
        const { id, assetId } = req.params;
        
        const correo = await Correo.findById(id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        const asset = correo.assets.id(assetId);
        if (!asset) {
            return res.status(404).json({ error: 'Asset no encontrado' });
        }

        // Eliminar archivo físico
        const filePath = path.join(assetsDir, path.basename(asset.url));
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Eliminar del array de assets
        correo.assets.pull(assetId);
        await correo.save();

        res.json({ message: 'Asset eliminado exitosamente' });
    } catch (err) {
        console.error('Error en deleteAsset:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Obtener lista de assets de una plantilla
 */
exports.getAssets = async (req, res) => {
    try {
        const correo = await Correo.findById(req.params.id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        res.json({ assets: correo.assets });
    } catch (err) {
        console.error('Error en getAssets:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Vista previa de la plantilla con variables de ejemplo
 */
exports.preview = async (req, res) => {
    try {
        const correo = await Correo.findById(req.params.id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        let html = correo.contenidoHtml;

        // Reemplazar variables con ejemplos
        if (correo.variables && correo.variables.length > 0) {
            correo.variables.forEach(variable => {
                const regex = new RegExp(`{{${variable.nombre}}}`, 'g');
                html = html.replace(regex, variable.ejemplo || `[${variable.nombre}]`);
            });
        }

        res.send(html);
    } catch (err) {
        console.error('Error en preview:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Obtener URL completa de un asset específico
 */
exports.getAssetUrl = async (req, res) => {
    try {
        const { id, assetFilename } = req.params;
        
        const correo = await Correo.findById(id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        const asset = correo.assets.find(a => a.filename === assetFilename);
        if (!asset) {
            return res.status(404).json({ error: 'Asset no encontrado' });
        }

        res.json({
            asset: asset,
            htmlSnippet: `<img src="${asset.url}" alt="${asset.nombre}" />`,
            markdownSnippet: `![${asset.nombre}](${asset.url})`,
            directUrl: asset.url
        });
    } catch (err) {
        console.error('Error en getAssetUrl:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Obtener información completa de una plantilla con URLs de assets formateadas
 */
exports.getWithAssetUrls = async (req, res) => {
    try {
        const correo = await Correo.findById(req.params.id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        const correoData = correo.toObject();
        correoData.assetsFormato = correo.assets.map(asset => ({
            ...asset,
            htmlSnippet: `<img src="${asset.url}" alt="${asset.nombre}" />`,
            markdownSnippet: `![${asset.nombre}](${asset.url})`,
            cssImport: asset.tipo === 'css' ? `<link rel="stylesheet" href="${asset.url}">` : null
        }));

        // Crear un listado de variables disponibles con sus placeholders
        const variablesList = correo.variables.map(v => ({
            ...v,
            placeholder: `{{${v.nombre}}}`
        }));

        res.json({
            ...correoData,
            variablesList,
            assetCount: correo.assets.length,
            variableCount: correo.variables.length
        });
    } catch (err) {
        console.error('Error en getWithAssetUrls:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Reemplazar variables en el contenido HTML y retornar HTML listo
 */
exports.renderHtml = async (req, res) => {
    try {
        const { id } = req.params;
        const { variables } = req.body;

        const correo = await Correo.findById(id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        let html = correo.contenidoHtml;

        // Reemplazar variables
        if (variables && typeof variables === 'object') {
            Object.keys(variables).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                html = html.replace(regex, variables[key] || '');
            });
        }

        res.json({
            html: html,
            asunto: correo.asunto,
            assets: correo.assets.map(a => ({
                nombre: a.nombre,
                url: a.url,
                tipo: a.tipo
            }))
        });
    } catch (err) {
        console.error('Error en renderHtml:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Generar código HTML/CSS completo para vista previa con assets
 */
exports.generatePreviewCode = async (req, res) => {
    try {
        const correo = await Correo.findById(req.params.id);
        if (!correo) {
            return res.status(404).json({ error: 'Plantilla de correo no encontrada' });
        }

        // Generar CSS imports
        const cssImports = correo.assets
            .filter(a => a.tipo === 'css')
            .map(a => `<link rel="stylesheet" href="${a.url}">`)
            .join('\n');

        // Generar HTML completo
        const htmlCompleto = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${correo.asunto}</title>
    ${cssImports}
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
        }
        img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    ${correo.contenidoHtml}
</body>
</html>`;

        res.json({
            htmlCompleto: htmlCompleto,
            assets: correo.assets.map(a => ({
                nombre: a.nombre,
                url: a.url,
                tipo: a.tipo
            })),
            variables: correo.variables
        });
    } catch (err) {
        console.error('Error en generatePreviewCode:', err);
        res.status(500).json({ error: err.message });
    }
};

