const express = require('express');
const router = express.Router();
const multer = require('multer');
const { generateSignature, generateSimpleSignature } = require('../utils/signature');
const path = require('path');
const fs = require('fs');

// Configurar multer para subir logos
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const logoDir = path.join(__dirname, '..', 'storage', 'logos');
        if (!fs.existsSync(logoDir)) {
            fs.mkdirSync(logoDir, { recursive: true });
        }
        cb(null, logoDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `logo-${timestamp}${ext}`);
    }
});

const logoFilter = (req, file, cb) => {
    const allowedTypes = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (.png, .jpg, .jpeg, .gif, .svg)'), false);
    }
};

const uploadLogo = multer({ 
    storage: logoStorage,
    fileFilter: logoFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

/**
 * POST /signatures/upload-logo - Subir un logo personalizado
 */
router.post('/upload-logo', uploadLogo.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se subió ningún archivo de logo'
            });
        }

        const logoUrl = `${req.protocol}://${req.get('host')}/logos/${req.file.filename}`;

        res.json({
            success: true,
            message: 'Logo subido exitosamente',
            logo: {
                filename: req.file.filename,
                path: req.file.path,
                url: logoUrl,
                size: req.file.size
            }
        });

    } catch (error) {
        console.error('Error subiendo logo:', error);
        res.status(500).json({
            success: false,
            error: 'Error al subir logo',
            details: error.message
        });
    }
});

/**
 * GET /signatures/logos - Listar logos disponibles
 */
router.get('/logos', (req, res) => {
    try {
        const logoDir = path.join(__dirname, '..', 'storage', 'logos');
        
        if (!fs.existsSync(logoDir)) {
            return res.json({
                success: true,
                logos: [],
                count: 0
            });
        }

        const files = fs.readdirSync(logoDir);
        const logos = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
            })
            .map(file => {
                const filePath = path.join(logoDir, file);
                const stats = fs.statSync(filePath);
                
                return {
                    filename: file,
                    url: `${req.protocol}://${req.get('host')}/logos/${file}`,
                    path: filePath,
                    size: stats.size,
                    uploadDate: stats.birthtime
                };
            });

        res.json({
            success: true,
            logos,
            count: logos.length
        });

    } catch (error) {
        console.error('Error listando logos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al listar logos',
            details: error.message
        });
    }
});

/**
 * POST /signatures/test - Generar una firma de prueba con configuración personalizada
 */
router.post('/test', async (req, res) => {
    try {
        const {
            author = "JUAN PÉREZ GARCÍA",
            title = "DECANO DE LA FACULTAD",
            institution = "Universidad César Vallejo",
            ruc = "20101113552",
            dni = "12345678", 
            date = new Date().toISOString().split('T')[0],
            width = 350,
            height = 100,
            type = "full",
            logoFilename = null,
            config = {}
        } = req.body;

        const timestamp = Date.now();
        const testDir = path.join(__dirname, '..', 'storage', 'test');
        
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        let signaturePath;
        let result;

        if (type === "simple") {
            signaturePath = path.join(testDir, `simple-signature-${timestamp}.png`);
            result = await generateSimpleSignature({
                name: author,
                savePath: signaturePath,
                width: parseInt(width) || 300,
                height: parseInt(height) || 80
            });
        } else {
            signaturePath = path.join(testDir, `signature-${timestamp}.png`);
            
            // Configurar logo personalizado si se especifica
            let logoPath = null;
            if (logoFilename) {
                const logoDir = path.join(__dirname, '..', 'storage', 'logos');
                const fullLogoPath = path.join(logoDir, logoFilename);
                if (fs.existsSync(fullLogoPath)) {
                    logoPath = fullLogoPath;
                } else {
                    console.warn(`Logo no encontrado: ${logoFilename}`);
                }
            }

            result = await generateSignature({
                author,
                title,
                institution,
                ruc,
                dni,
                date,
                savePath: signaturePath,
                width: parseInt(width) || 350,
                height: parseInt(height) || 100,
                logoPath,
                config
            });
        }

        const fileName = path.basename(result);
        const publicUrl = `${req.protocol}://${req.get('host')}/test/${fileName}`;

        res.json({
            success: true,
            message: `Firma ${type} generada exitosamente`,
            signature: {
                path: result,
                url: publicUrl,
                type,
                parameters: {
                    author,
                    title: type === "full" ? title : undefined,
                    institution: type === "full" ? institution : undefined,
                    ruc: type === "full" ? ruc : undefined,
                    dni: type === "full" ? dni : undefined,
                    date: type === "full" ? date : undefined,
                    width: parseInt(width) || (type === "simple" ? 300 : 350),
                    height: parseInt(height) || (type === "simple" ? 80 : 100),
                    logoFilename,
                    config
                }
            }
        });

    } catch (error) {
        console.error('Error generando firma de prueba:', error);
        res.status(500).json({
            success: false,
            error: 'Error al generar firma de prueba',
            details: error.message
        });
    }
});

/**
 * POST /signatures/config - Obtener/Configurar plantilla de firma por defecto
 */
router.post('/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, '..', 'storage', 'signature-config.json');
        
        if (req.method === 'POST' && req.body) {
            // Guardar configuración
            const config = {
                ...req.body,
                lastModified: new Date().toISOString()
            };
            
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            res.json({
                success: true,
                message: 'Configuración guardada exitosamente',
                config
            });
        } else {
            // Obtener configuración actual
            let config = {};
            
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(configData);
            }
            
            res.json({
                success: true,
                config,
                exists: fs.existsSync(configPath)
            });
        }

    } catch (error) {
        console.error('Error manejando configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error al manejar configuración',
            details: error.message
        });
    }
});

/**
 * GET /signatures/config - Obtener configuración actual
 */
router.get('/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, '..', 'storage', 'signature-config.json');
        
        let config = {
            // Configuración por defecto
            defaultLogo: null,
            institution: "Universidad César Vallejo",
            defaultWidth: 350,
            defaultHeight: 100,
            style: {
                backgroundColor: '#FFFFFF',
                borderColor: '#000000',
                borderWidth: 1,
                logoBackgroundColor: '#CC0000',
                logoTextColor: '#FFFFFF',
                logoText: ['U', 'C', 'V'],
                institutionColor: '#000000',
                authorColor: '#000000',
                titleColor: '#000000',
                infoColor: '#666666'
            }
        };
        
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const savedConfig = JSON.parse(configData);
            config = { ...config, ...savedConfig };
        }
        
        res.json({
            success: true,
            config,
            examples: {
                customLogo: "Usar logoFilename para especificar un logo subido",
                smallSignature: { width: 250, height: 80 },
                largeSignature: { width: 450, height: 120 },
                customColors: {
                    config: {
                        logoBackgroundColor: '#0066CC',
                        authorColor: '#333333'
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener configuración',
            details: error.message
        });
    }
});

/**
 * GET /signatures/examples - Obtener ejemplos de configuración de firmas
 */
router.get('/examples', (req, res) => {
    res.json({
        success: true,
        examples: {
            signatureInCertificate: {
                description: "Configuración para agregar firma completa en un certificado",
                pageConfiguration: {
                    numero: 1,
                    contenido: "signature",
                    x: 100,
                    y: 50,
                    width: 400,
                    height: 120
                },
                emissionData: {
                    certificado_id: "CERTIFICATE_ID",
                    fullname: "MARÍA GARCÍA LÓPEZ",
                    doc: "87654321",
                    correo: "maria@email.com",
                    title: "COORDINADORA ACADÉMICA",
                    ruc: "20101113552"
                }
            },
            simpleSignatureInCertificate: {
                description: "Configuración para agregar firma simple en un certificado",
                pageConfiguration: {
                    numero: 1,
                    contenido: "simple_signature",
                    x: 200,
                    y: 80,
                    width: 300,
                    height: 80
                },
                emissionData: {
                    certificado_id: "CERTIFICATE_ID",
                    fullname: "CARLOS RODRÍGUEZ SILVA",
                    doc: "11223344",
                    correo: "carlos@email.com"
                }
            }
        },
        contentTypes: {
            signature: {
                description: "Firma institucional completa con logo, información y datos",
                requiredFields: ["fullname"],
                optionalFields: ["title", "ruc", "dni", "date"],
                defaultSize: { width: 400, height: 120 }
            },
            simple_signature: {
                description: "Firma simple con solo el nombre y una línea",
                requiredFields: ["fullname"],
                optionalFields: [],
                defaultSize: { width: 300, height: 80 }
            }
        },
        usage: {
            step1: "Configurar la página del certificado con contenido 'signature' o 'simple_signature'",
            step2: "Enviar los datos necesarios en el request de emisión",
            step3: "La firma se generará automáticamente y se incluirá en el PDF"
        }
    });
});

/**
 * GET /signatures/templates - Obtener plantillas de firmas disponibles
 */
router.get('/templates', (req, res) => {
    res.json({
        success: true,
        templates: {
            institutional: {
                name: "Firma Institucional",
                type: "signature",
                description: "Firma completa con logo y datos institucionales",
                fields: {
                    author: "Nombre del firmante",
                    title: "Cargo o título",
                    ruc: "RUC de la institución",
                    dni: "DNI del firmante",
                    date: "Fecha de la firma"
                },
                recommendedSize: { width: 400, height: 120 },
                preview: "/signatures/test con type=full"
            },
            simple: {
                name: "Firma Simple",
                type: "simple_signature", 
                description: "Firma básica con solo el nombre",
                fields: {
                    name: "Nombre del firmante"
                },
                recommendedSize: { width: 300, height: 80 },
                preview: "/signatures/test con type=simple"
            }
        },
        customization: {
            colors: "Las firmas usan colores predefinidos (rojo para logo, negro para texto)",
            fonts: "Utiliza Arial en diferentes tamaños según el elemento",
            layout: "El diseño se basa en la imagen de referencia proporcionada"
        }
    });
});

module.exports = router;