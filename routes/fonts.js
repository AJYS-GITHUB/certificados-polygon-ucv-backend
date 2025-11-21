const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { listSystemFonts, searchFont, getCommonFonts, validateFont } = require('../utils/fontManager');
const { execSync } = require('child_process');

// Configurar multer para subida de fuentes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fontDir = path.join(__dirname, '..', 'storage', 'fonts');
        if (!fs.existsSync(fontDir)) {
            fs.mkdirSync(fontDir, { recursive: true });
        }
        cb(null, fontDir);
    },
    filename: (req, file, cb) => {
        // Mantener el nombre original del archivo
        cb(null, file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    // Aceptar solo archivos de fuentes
    const allowedTypes = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de fuente (.ttf, .otf, .woff, .woff2)'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Límite de 10MB por fuente
    }
});

/**
 * GET /fonts - Lista todas las fuentes disponibles (sistema + subidas)
 */
router.get('/', (req, res) => {
    try {
        const allFonts = [];
        
        // Agregar fuentes estándar de PDF-lib
        const standardFonts = [
            { name: 'Helvetica', type: 'standard', category: 'sans-serif', source: 'built-in' },
            { name: 'Helvetica-Bold', type: 'standard', category: 'sans-serif', source: 'built-in' },
            { name: 'Times-Roman', type: 'standard', category: 'serif', source: 'built-in' },
            { name: 'Times-Bold', type: 'standard', category: 'serif', source: 'built-in' },
            { name: 'Courier', type: 'standard', category: 'monospace', source: 'built-in' },
            { name: 'Courier-Bold', type: 'standard', category: 'monospace', source: 'built-in' }
        ];
        allFonts.push(...standardFonts);
        
        // Agregar fuentes subidas
        const uploadedDir = path.join(__dirname, '..', 'storage', 'fonts');
        if (fs.existsSync(uploadedDir)) {
            const uploadedFiles = fs.readdirSync(uploadedDir);
            for (const file of uploadedFiles) {
                const ext = path.extname(file).toLowerCase();
                if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
                    const name = path.basename(file, ext);
                    const filePath = path.join(uploadedDir, file);
                    const stats = fs.statSync(filePath);
                    
                    allFonts.push({
                        name: name,
                        type: 'uploaded',
                        category: 'custom',
                        source: 'uploaded',
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        uploadDate: stats.birthtime
                    });
                }
            }
        }
        
        // Agregar muestra de fuentes del sistema
        const systemFonts = listSystemFonts();
        for (const font of systemFonts) {
            allFonts.push({
                name: path.basename(font.name, path.extname(font.name)),
                type: 'system',
                category: 'system',
                source: 'system',
                path: font.path,
                directory: font.directory
            });
        }
        
        res.json({
            success: true,
            count: allFonts.length,
            fonts: allFonts,
            summary: {
                standard: standardFonts.length,
                uploaded: allFonts.filter(f => f.type === 'uploaded').length,
                system: allFonts.filter(f => f.type === 'system').length
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al listar fuentes: ' + err.message
        });
    }
});

/**
 * GET /fonts/common - Lista fuentes comunes disponibles
 */
router.get('/common', (req, res) => {
    try {
        const commonFonts = getCommonFonts();
        res.json({
            success: true,
            fonts: commonFonts
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener fuentes comunes: ' + err.message
        });
    }
});

/**
 * GET /fonts/search/:name - Busca fuentes por nombre
 */
router.get('/search/:name', (req, res) => {
    try {
        const { name } = req.params;
        const fonts = searchFont(name);
        res.json({
            success: true,
            query: name,
            count: fonts.length,
            fonts: fonts
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al buscar fuente: ' + err.message
        });
    }
});

/**
 * POST /fonts/validate - Valida si una fuente existe
 */
router.post('/validate', (req, res) => {
    try {
        const { fontPath } = req.body;
        
        if (!fontPath) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere el campo fontPath'
            });
        }
        
        const isValid = validateFont(fontPath);
        res.json({
            success: true,
            fontPath: fontPath,
            valid: isValid
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al validar fuente: ' + err.message
        });
    }
});

/**
 * POST /fonts/upload - Sube una o múltiples fuentes al servidor
 */
router.post('/upload', upload.array('fonts', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se subieron archivos de fuentes'
            });
        }

        const uploadedFonts = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const fontInfo = {
                    originalName: file.originalname,
                    filename: file.filename,
                    path: file.path,
                    size: file.size,
                    type: path.extname(file.originalname).substring(1)
                };

                // Validar que el archivo es una fuente válida
                if (validateFont(file.path)) {
                    uploadedFonts.push(fontInfo);
                } else {
                    errors.push(`${file.originalname}: No es un archivo de fuente válido`);
                    // Eliminar archivo inválido
                    fs.unlinkSync(file.path);
                }
            } catch (err) {
                errors.push(`${file.originalname}: ${err.message}`);
            }
        }

        res.json({
            success: uploadedFonts.length > 0,
            uploaded: uploadedFonts.length,
            fonts: uploadedFonts,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al subir fuentes: ' + err.message
        });
    }
});

/**
 * POST /fonts/install - Instala fuentes subidas al sistema
 */
router.post('/install', (req, res) => {
    try {
        const { fontFiles } = req.body; // Array de nombres de archivos a instalar

        if (!fontFiles || !Array.isArray(fontFiles)) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de nombres de archivos en fontFiles'
            });
        }

        const installedFonts = [];
        const errors = [];
        const platform = process.platform;
        const fontStorageDir = path.join(__dirname, '..', 'storage', 'fonts');

        for (const fontFile of fontFiles) {
            try {
                const sourcePath = path.join(fontStorageDir, fontFile);
                
                if (!fs.existsSync(sourcePath)) {
                    errors.push(`${fontFile}: Archivo no encontrado`);
                    continue;
                }

                let destinationDir;
                let requiresSudo = false;

                // Determinar directorio de destino según el sistema operativo
                switch (platform) {
                    case 'linux':
                        destinationDir = '/usr/local/share/fonts';
                        requiresSudo = true;
                        break;
                    case 'darwin': // macOS
                        destinationDir = '/Library/Fonts';
                        requiresSudo = true;
                        break;
                    case 'win32': // Windows
                        destinationDir = 'C:\\Windows\\Fonts';
                        break;
                    default:
                        destinationDir = '/usr/local/share/fonts';
                        requiresSudo = true;
                }

                const destinationPath = path.join(destinationDir, fontFile);

                // Intentar copiar la fuente al directorio del sistema
                if (platform === 'win32') {
                    // En Windows, copiar directamente
                    execSync(`copy "${sourcePath}" "${destinationPath}"`);
                } else {
                    // En Unix/Linux/macOS
                    if (requiresSudo) {
                        // Crear directorio si no existe
                        execSync(`sudo mkdir -p "${destinationDir}"`);
                        // Copiar la fuente
                        execSync(`sudo cp "${sourcePath}" "${destinationPath}"`);
                        // Cambiar permisos
                        execSync(`sudo chmod 644 "${destinationPath}"`);
                    } else {
                        fs.copyFileSync(sourcePath, destinationPath);
                    }
                }

                // Actualizar caché de fuentes
                if (platform === 'linux') {
                    execSync('sudo fc-cache -f -v', { stdio: 'ignore' });
                } else if (platform === 'darwin') {
                    execSync('sudo atsutil databases -remove', { stdio: 'ignore' });
                }

                installedFonts.push({
                    filename: fontFile,
                    installed: true,
                    path: destinationPath
                });

            } catch (err) {
                errors.push(`${fontFile}: Error de instalación - ${err.message}`);
            }
        }

        res.json({
            success: installedFonts.length > 0,
            installed: installedFonts.length,
            fonts: installedFonts,
            errors: errors.length > 0 ? errors : undefined,
            message: installedFonts.length > 0 ? 
                'Fuentes instaladas correctamente. Reinicie la aplicación para que estén disponibles.' : 
                'No se pudieron instalar las fuentes'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al instalar fuentes: ' + err.message
        });
    }
});

/**
 * GET /fonts/uploaded - Lista fuentes subidas pero no instaladas
 */
router.get('/uploaded', (req, res) => {
    try {
        const fontStorageDir = path.join(__dirname, '..', 'storage', 'fonts');
        
        if (!fs.existsSync(fontStorageDir)) {
            return res.json({
                success: true,
                fonts: []
            });
        }

        const files = fs.readdirSync(fontStorageDir);
        const fontFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.ttf', '.otf', '.woff', '.woff2'].includes(ext);
        });

        const fonts = fontFiles.map(file => {
            const filePath = path.join(fontStorageDir, file);
            const stats = fs.statSync(filePath);
            
            return {
                filename: file,
                path: filePath,
                size: stats.size,
                uploadDate: stats.birthtime,
                type: path.extname(file).substring(1)
            };
        });

        res.json({
            success: true,
            count: fonts.length,
            fonts: fonts
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al listar fuentes subidas: ' + err.message
        });
    }
});

/**
 * DELETE /fonts/uploaded/:filename - Elimina una fuente subida
 */
router.delete('/uploaded/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const fontPath = path.join(__dirname, '..', 'storage', 'fonts', filename);

        if (!fs.existsSync(fontPath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo de fuente no encontrado'
            });
        }

        fs.unlinkSync(fontPath);

        res.json({
            success: true,
            message: `Fuente ${filename} eliminada correctamente`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al eliminar fuente: ' + err.message
        });
    }
});

/**
 * POST /fonts/test - Prueba la carga de una fuente específica
 */
router.post('/test', (req, res) => {
    try {
        const { fontName } = req.body;
        
        if (!fontName) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere el campo fontName'
            });
        }

        const { findUploadedFont, findSystemFont } = require('../utils/pdf');
        
        // Buscar en fuentes subidas
        const uploadedPath = findUploadedFont(fontName);
        
        // Buscar en fuentes del sistema
        const systemPath = findSystemFont(fontName);
        
        // Verificar fuentes estándar
        const standardFonts = ['Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Times-Bold', 'Courier', 'Courier-Bold'];
        const isStandard = standardFonts.includes(fontName);
        
        res.json({
            success: true,
            fontName: fontName,
            found: {
                uploaded: uploadedPath !== null,
                uploadedPath: uploadedPath,
                system: systemPath !== null,
                systemPath: systemPath,
                standard: isStandard
            },
            recommendation: uploadedPath ? 'uploaded' : (systemPath ? 'system' : (isStandard ? 'standard' : 'none'))
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al probar fuente: ' + err.message
        });
    }
});

/**
 * GET /fonts/available - Lista fuentes disponibles con nombres exactos para usar (sin duplicados)
 */
router.get('/available', (req, res) => {
    try {
        const availableFonts = [];
        const usedNames = new Set();
        
        // Fuentes estándar siempre disponibles
        const standardFonts = [
            { name: 'Helvetica', type: 'standard', category: 'sans-serif', priority: 1 },
            { name: 'Helvetica-Bold', type: 'standard', category: 'sans-serif', priority: 1 },
            { name: 'Times-Roman', type: 'standard', category: 'serif', priority: 1 },
            { name: 'Times-Bold', type: 'standard', category: 'serif', priority: 1 },
            { name: 'Courier', type: 'standard', category: 'monospace', priority: 1 },
            { name: 'Courier-Bold', type: 'standard', category: 'monospace', priority: 1 }
        ];
        
        // Agregar fuentes estándar
        for (const font of standardFonts) {
            availableFonts.push(font);
            usedNames.add(font.name.toLowerCase());
        }
        
        // Fuentes subidas (tienen prioridad sobre fuentes del sistema)
        const uploadedDir = path.join(__dirname, '..', 'storage', 'fonts');
        if (fs.existsSync(uploadedDir)) {
            const uploadedFiles = fs.readdirSync(uploadedDir);
            for (const file of uploadedFiles) {
                const ext = path.extname(file).toLowerCase();
                if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
                    const name = path.basename(file, ext);
                    
                    // Solo agregar si no existe ya
                    if (!usedNames.has(name.toLowerCase())) {
                        availableFonts.push({
                            name: name,
                            type: 'uploaded',
                            category: 'custom',
                            priority: 2,
                            filename: file,
                            path: path.join(uploadedDir, file)
                        });
                        usedNames.add(name.toLowerCase());
                    }
                }
            }
        }
        
        // Fuentes del sistema comunes (solo las que no están ya incluidas)
        const { listSystemFonts } = require('../utils/fontManager');
        const systemFonts = listSystemFonts();
        
        // Filtrar fuentes del sistema comunes que no estén ya incluidas
        const commonSystemFonts = systemFonts.filter(font => {
            const lowerName = font.name.toLowerCase();
            const baseName = path.basename(font.name, path.extname(font.name)).toLowerCase();
            
            return (lowerName.includes('arial') || 
                   lowerName.includes('times') || 
                   lowerName.includes('courier') ||
                   lowerName.includes('verdana') ||
                   lowerName.includes('georgia') ||
                   lowerName.includes('liberation')) && 
                   !usedNames.has(baseName);
        }).slice(0, 8); // Limitar a 8 para no sobrecargar
        
        for (const font of commonSystemFonts) {
            const name = path.basename(font.name, path.extname(font.name));
            availableFonts.push({
                name: name,
                type: 'system',
                category: 'system',
                priority: 3,
                path: font.path
            });
        }
        
        res.json({
            success: true,
            count: availableFonts.length,
            fonts: availableFonts,
            categories: {
                standard: availableFonts.filter(f => f.type === 'standard').length,
                uploaded: availableFonts.filter(f => f.type === 'uploaded').length,
                system: availableFonts.filter(f => f.type === 'system').length
            },
            usage: {
                message: "Usa el campo 'name' exactamente como aparece para especificar la fuente en tus certificados",
                example: {
                    "font": "PlaywriteNZGuides-Regular"
                },
                priority: "Las fuentes subidas tienen prioridad sobre las del sistema con el mismo nombre"
            }
        });
        
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al listar fuentes disponibles: ' + err.message
        });
    }
});

/**
 * GET /fonts/status - Verifica el estado del sistema de fuentes
 */
router.get('/status', (req, res) => {
    try {
        // Verificar fontkit
        let fontkitStatus = false;
        try {
            const fontkit = require('fontkit');
            fontkitStatus = true;
        } catch (err) {
            fontkitStatus = false;
        }

        // Verificar directorio de fuentes subidas
        const uploadedDir = path.join(__dirname, '..', 'storage', 'fonts');
        const uploadedDirExists = fs.existsSync(uploadedDir);
        let uploadedFontsCount = 0;
        
        if (uploadedDirExists) {
            const files = fs.readdirSync(uploadedDir);
            uploadedFontsCount = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.ttf', '.otf', '.woff', '.woff2'].includes(ext);
            }).length;
        }

        // Verificar directorios del sistema
        const systemDirs = [
            '/usr/share/fonts',
            '/usr/local/share/fonts',
            '/System/Library/Fonts',
            '/Library/Fonts',
            'C:\\Windows\\Fonts'
        ];
        
        const availableSystemDirs = systemDirs.filter(dir => fs.existsSync(dir));

        res.json({
            success: true,
            status: {
                fontkit: {
                    installed: fontkitStatus,
                    message: fontkitStatus ? 'Fontkit está instalado y funcionando' : 'Fontkit no está disponible'
                },
                uploadedFonts: {
                    directory: uploadedDir,
                    exists: uploadedDirExists,
                    count: uploadedFontsCount
                },
                systemFonts: {
                    availableDirectories: availableSystemDirs,
                    count: availableSystemDirs.length
                }
            },
            recommendations: fontkitStatus ? [] : [
                'Ejecuta: npm install fontkit',
                'Reinicia la aplicación después de instalar fontkit'
            ]
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Error al verificar estado: ' + err.message
        });
    }
});

module.exports = router;