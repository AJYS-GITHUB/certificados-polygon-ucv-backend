const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const QRCode = require('qrcode');
const { generateQR } = require('./qr');
const { v4: uuidv4 } = require('uuid');

console.log('✓ PDF-lib y fontkit cargados correctamente');

// Mapeo de rutas comunes de fuentes del sistema
const SYSTEM_FONT_PATHS = {
    // Linux paths
    linux: {
        'Arial': ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/TTF/arial.ttf'],
        'Arial Bold': ['/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', '/usr/share/fonts/TTF/arialbd.ttf'],
        'Times': ['/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf', '/usr/share/fonts/TTF/times.ttf'],
        'Times Bold': ['/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf', '/usr/share/fonts/TTF/timesbd.ttf'],
        'Helvetica': ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/arial.ttf'],
        'Courier': ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', '/usr/share/fonts/TTF/cour.ttf'],
    },
    // Windows paths
    windows: {
        'Arial': ['C:\\Windows\\Fonts\\arial.ttf'],
        'Arial Bold': ['C:\\Windows\\Fonts\\arialbd.ttf'],
        'Times': ['C:\\Windows\\Fonts\\times.ttf'],
        'Times Bold': ['C:\\Windows\\Fonts\\timesbd.ttf'],
        'Helvetica': ['C:\\Windows\\Fonts\\arial.ttf'],
        'Courier': ['C:\\Windows\\Fonts\\cour.ttf'],
    },
    // macOS paths
    darwin: {
        'Arial': ['/System/Library/Fonts/Arial.ttf'],
        'Arial Bold': ['/System/Library/Fonts/Arial Bold.ttf'],
        'Times': ['/System/Library/Fonts/Times.ttc'],
        'Times Bold': ['/System/Library/Fonts/Times Bold.ttc'],
        'Helvetica': ['/System/Library/Fonts/Helvetica.ttc'],
        'Courier': ['/System/Library/Fonts/Courier New.ttf'],
    }
};

/**
 * Encuentra y carga una fuente del sistema
 * @param {string} fontName - Nombre de la fuente a buscar
 * @returns {string|null} - Ruta de la fuente encontrada o null
 */
function findSystemFont(fontName) {
    const platform = process.platform;
    const platformFonts = SYSTEM_FONT_PATHS[platform] || SYSTEM_FONT_PATHS.linux;
    
    // Buscar en mapeo predefinido
    if (platformFonts[fontName]) {
        for (const fontPath of platformFonts[fontName]) {
            if (fs.existsSync(fontPath)) {
                return fontPath;
            }
        }
    }
    
    // Búsqueda adicional en directorios comunes
    const commonDirs = [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        '/System/Library/Fonts',
        '/Library/Fonts',
        'C:\\Windows\\Fonts'
    ];
    
    for (const dir of commonDirs) {
        if (fs.existsSync(dir)) {
            try {
                const result = searchInDirectory(dir, fontName);
                if (result) return result;
            } catch (err) {
                // Continuar si no se puede leer el directorio
            }
        }
    }
    
    return null;
}

/**
 * Busca recursivamente una fuente en un directorio
 * @param {string} dir - Directorio donde buscar
 * @param {string} fontName - Nombre de la fuente
 * @returns {string|null} - Ruta encontrada o null
 */
function searchInDirectory(dir, fontName) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
            try {
                const result = searchInDirectory(fullPath, fontName);
                if (result) return result;
            } catch (err) {
                // Continuar si no se puede acceder al subdirectorio
            }
        } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (['.ttf', '.otf', '.ttc'].includes(ext)) {
                const baseName = path.basename(item.name, ext);
                
                // Múltiples estrategias de coincidencia
                if (matchFontName(baseName, fontName)) {
                    return fullPath;
                }
            }
        }
    }
    
    return null;
}

/**
 * Verifica si dos nombres de fuente coinciden usando varias estrategias
 * @param {string} fileName - Nombre del archivo de fuente
 * @param {string} searchName - Nombre buscado
 * @returns {boolean} - true si coinciden
 */
function matchFontName(fileName, searchName) {
    const fileNameLower = fileName.toLowerCase();
    const searchNameLower = searchName.toLowerCase();
    
    // Coincidencia exacta
    if (fileNameLower === searchNameLower) return true;
    
    // Sin espacios, guiones, guiones bajos
    const normalizedFileName = fileNameLower.replace(/[-_\s]/g, '');
    const normalizedSearchName = searchNameLower.replace(/[-_\s]/g, '');
    if (normalizedFileName === normalizedSearchName) return true;
    
    // Contiene el nombre buscado
    if (fileNameLower.includes(searchNameLower)) return true;
    if (searchNameLower.includes(fileNameLower)) return true;
    
    // Coincidencias comunes de nombres de fuentes
    const fontAliases = {
        'arial': ['liberation-sans', 'liberationsans', 'arimo'],
        'times': ['liberation-serif', 'liberationserif', 'tinos'],
        'courier': ['liberation-mono', 'liberationmono', 'cousine'],
        'helvetica': ['arial', 'liberation-sans', 'liberationsans']
    };
    
    for (const [alias, variations] of Object.entries(fontAliases)) {
        if (searchNameLower.includes(alias)) {
            for (const variation of variations) {
                if (fileNameLower.includes(variation)) return true;
            }
        }
    }
    
    return false;
}

/**
 * Embebe una fuente en el documento PDF
 * @param {PDFDocument} pdfDoc - Documento PDF
 * @param {string} fontName - Nombre de la fuente
 * @returns {Promise} - Fuente embebida
 */
async function embedFontInPdf(pdfDoc, fontName) {
    console.log(`Intentando cargar fuente: ${fontName}`);
    
    // Primero intentar usar fuentes estándar de PDF-lib
    const standardFonts = {
        'Helvetica': StandardFonts.Helvetica,
        'Helvetica-Bold': StandardFonts.HelveticaBold,
        'Times-Roman': StandardFonts.TimesRoman,
        'Times-Bold': StandardFonts.TimesRomanBold,
        'Courier': StandardFonts.Courier,
        'Courier-Bold': StandardFonts.CourierBold,
    };
    
    if (standardFonts[fontName]) {
        console.log(`Usando fuente estándar: ${fontName}`);
        return await pdfDoc.embedStandardFont(standardFonts[fontName]);
    }
    
    // Buscar en fuentes subidas primero
    const uploadedFontPath = findUploadedFont(fontName);
    if (uploadedFontPath) {
        try {
            console.log(`Cargando fuente subida desde: ${uploadedFontPath}`);
            const fontBytes = fs.readFileSync(uploadedFontPath);
            
            // Registrar fontkit en este documento específico (siguiendo la documentación oficial)
            pdfDoc.registerFontkit(fontkit);
            console.log('✓ Fontkit registrado en el documento');
            
            // Embeber la fuente personalizada
            const customFont = await pdfDoc.embedFont(fontBytes);
            console.log(`✓ Fuente ${fontName} cargada exitosamente desde archivo subido`);
            return customFont;
            
        } catch (err) {
            console.error(`✗ Error al cargar fuente subida ${fontName}:`, err.message);
        }
    }
    
    // Intentar cargar fuente del sistema
    const systemFontPath = findSystemFont(fontName);
    if (systemFontPath) {
        try {
            console.log(`Cargando fuente del sistema desde: ${systemFontPath}`);
            const fontBytes = fs.readFileSync(systemFontPath);
            
            // Registrar fontkit en este documento específico
            pdfDoc.registerFontkit(fontkit);
            console.log('✓ Fontkit registrado en el documento para fuente del sistema');
            
            if (systemFontPath.endsWith('.ttf') || systemFontPath.endsWith('.otf')) {
                const customFont = await pdfDoc.embedFont(fontBytes);
                console.log(`✓ Fuente ${fontName} cargada exitosamente desde sistema`);
                return customFont;
            } else if (systemFontPath.endsWith('.ttc')) {
                const customFont = await pdfDoc.embedFont(fontBytes, { subset: true });
                console.log(`✓ Fuente ${fontName} cargada exitosamente desde sistema (TTC)`);
                return customFont;
            }
        } catch (err) {
            console.error(`✗ Error al cargar fuente del sistema ${fontName}:`, err.message);
        }
    }
    
    // Fallback a Helvetica si no se encuentra la fuente
    console.warn(`⚠ Fuente ${fontName} no encontrada, usando Helvetica como fallback`);
    return await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
}

/**
 * Busca una fuente en el directorio de fuentes subidas
 * @param {string} fontName - Nombre de la fuente a buscar
 * @returns {string|null} - Ruta de la fuente encontrada o null
 */
function findUploadedFont(fontName) {
    const uploadedFontsDir = path.join(__dirname, '..', 'storage', 'fonts');
    
    if (!fs.existsSync(uploadedFontsDir)) {
        return null;
    }
    
    try {
        const files = fs.readdirSync(uploadedFontsDir);
        
        // Buscar por nombre exacto
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
                const baseName = path.basename(file, ext);
                
                // Coincidencia exacta
                if (baseName === fontName || baseName.toLowerCase() === fontName.toLowerCase()) {
                    return path.join(uploadedFontsDir, file);
                }
                
                // Coincidencia sin espacios y guiones
                const normalizedBaseName = baseName.replace(/[-_\s]/g, '').toLowerCase();
                const normalizedFontName = fontName.replace(/[-_\s]/g, '').toLowerCase();
                if (normalizedBaseName === normalizedFontName) {
                    return path.join(uploadedFontsDir, file);
                }
                
                // Coincidencia parcial
                if (baseName.toLowerCase().includes(fontName.toLowerCase()) || 
                    fontName.toLowerCase().includes(baseName.toLowerCase())) {
                    return path.join(uploadedFontsDir, file);
                }
            }
        }
    } catch (err) {
        console.warn(`Error al buscar fuentes subidas: ${err.message}`);
    }
    
    return null;
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
}

/**
 * Calcula la posición X del texto basada en la alineación
 * @param {string} text - Texto a renderizar
 * @param {Object} font - Fuente embebida
 * @param {number} fontSize - Tamaño de la fuente
 * @param {number} x - Posición X base
 * @param {string} textAlign - Alineación: 'left', 'center', 'right'
 * @param {number} maxWidth - Ancho máximo disponible (opcional)
 * @returns {number} - Posición X calculada
 */
function calculateTextX(text, font, fontSize, x, textAlign = 'left', maxWidth = null) {
    if (textAlign === 'left') {
        return x;
    }
    
    // Obtener el ancho del texto
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    if (textAlign === 'center') {
        // Para centrado: mover hacia la izquierda la mitad del ancho del texto
        return x - (textWidth / 2);
    }
    
    if (textAlign === 'right') {
        // Para derecha: mover hacia la izquierda todo el ancho del texto
        return x - textWidth;
    }
    
    return x;
}

/**
 * Genera un PDF de certificado.
 * @param {Object} params - Parámetros para el PDF.
 * @param {string} params.templatePath - Ruta al template PDF.
 * @param {Array} params.paginas - Configuración de páginas y contenido.
 * @param {Object} params.data - Datos dinámicos a renderizar (subject, date, codigo, etc.).
 * @param {string} params.qrdata - Datos para el QR.
 * @param {string} params.savePath - Ruta donde guardar el PDF generado.
 */
async function generateCertificadoPdf({ templatePath, paginas, data, qrdata, savePath }) {
    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    console.log("savepath: ", savePath);
    const qrPath = savePath.replace('.pdf', '.png');
    console.log("qrPath: ", qrPath);
    await generateQR(qrPath, qrdata);

    for (const pag of paginas) {
        const page = pdfDoc.getPages()[pag.numero - 1];
        
        if (pag.contenido === "qr") {
            // Renderizar QR (imagen)
            const qrImageBytes = fs.readFileSync(qrPath);
            const qrImage = await pdfDoc.embedPng(qrImageBytes);
            page.drawImage(qrImage, {
                x: pag.x,
                y: pag.y,
                width: pag.width,
                height: pag.height
            });
        } else if (pag.contenido === "signature") {
            // Renderizar firma gráfica (importación dinámica para evitar circulares)
            const { generateSignature } = require('./signature');
            const signaturePath = savePath.replace('.pdf', '-signature.png');
            
            // Obtener datos para la firma
            const authorName = data.subject || data.fullname || 'FIRMANTE';
            const authorTitle = data.title || data.cargo || 'AUTOR';
            const authorRuc = data.ruc || '20101113552';
            const authorDni = data.dni || data.doc || '00000000';
            const signDate = data.signDate || data.dateString || new Date().toISOString().split('T')[0];
            const institution = data.institution || data.institucion || 'Universidad César Vallejo';
            
            // Cargar configuración de firma si existe
            let signatureConfig = {};
            let logoPath = null;
            
            try {
                const configPath = path.join(__dirname, '..', 'storage', 'signature-config.json');
                if (fs.existsSync(configPath)) {
                    const configData = fs.readFileSync(configPath, 'utf8');
                    const config = JSON.parse(configData);
                    signatureConfig = config.style || {};
                    
                    // Configurar logo si está especificado
                    if (config.defaultLogo) {
                        const logoDir = path.join(__dirname, '..', 'storage', 'logos');
                        const fullLogoPath = path.join(logoDir, config.defaultLogo);
                        if (fs.existsSync(fullLogoPath)) {
                            logoPath = fullLogoPath;
                        }
                    }
                }
            } catch (err) {
                console.warn('No se pudo cargar configuración de firma:', err.message);
            }
            
            // Usar logo específico si se proporciona en los datos
            if (data.logoFilename) {
                const logoDir = path.join(__dirname, '..', 'storage', 'logos');
                const customLogoPath = path.join(logoDir, data.logoFilename);
                if (fs.existsSync(customLogoPath)) {
                    logoPath = customLogoPath;
                }
            }
            
            await generateSignature({
                author: authorName,
                title: authorTitle,
                institution: institution,
                ruc: authorRuc,
                dni: authorDni,
                date: signDate,
                savePath: signaturePath,
                width: pag.width || 350,
                height: pag.height || 100,
                logoPath: logoPath,
                config: signatureConfig
            });
            
            const signatureImageBytes = fs.readFileSync(signaturePath);
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            page.drawImage(signatureImage, {
                x: pag.x,
                y: pag.y,
                width: pag.width || 350,
                height: pag.height || 100
            });
            
            // Limpiar archivo temporal
            fs.unlinkSync(signaturePath);
            
            console.log(`✓ Renderizada firma gráfica para '${authorName}' en posición (${pag.x}, ${pag.y}) con tamaño ${pag.width || 350}x${pag.height || 100}`);
            
        } else if (pag.contenido === "simple_signature") {
            // Renderizar firma simple (importación dinámica para evitar circulares)
            const { generateSimpleSignature } = require('./signature');
            const simpleSignaturePath = savePath.replace('.pdf', '-simple-signature.png');
            
            const signerName = data.subject || data.fullname || 'FIRMANTE';
            
            await generateSimpleSignature({
                name: signerName,
                savePath: simpleSignaturePath,
                width: pag.width || 300,
                height: pag.height || 80
            });
            
            const simpleSignatureImageBytes = fs.readFileSync(simpleSignaturePath);
            const simpleSignatureImage = await pdfDoc.embedPng(simpleSignatureImageBytes);
            page.drawImage(simpleSignatureImage, {
                x: pag.x,
                y: pag.y,
                width: pag.width || 300,
                height: pag.height || 80
            });
            
            // Limpiar archivo temporal
            fs.unlinkSync(simpleSignaturePath);
            
            console.log(`✓ Renderizada firma simple para '${signerName}' en posición (${pag.x}, ${pag.y})`);
            
        } else {
            // Renderizar texto dinámico
            let textContent = '';
            
            // Obtener el contenido basado en el tipo
            if (pag.contenido === "subject" && data.subject) {
                textContent = data.subject;
            } else if (pag.contenido === "date" && data.dateString) {
                textContent = data.dateString;
            } else if (pag.contenido === "signdate") {
                textContent = new Date().toISOString().split('T')[0];
            } else if (data[pag.contenido]) {
                // Campo dinámico personalizado
                textContent = data[pag.contenido];
            }
            
            // Si hay contenido para renderizar
            if (textContent) {
                const embedFont = await embedFontInPdf(pdfDoc, pag.font);
                const textX = calculateTextX(textContent, embedFont, pag.fontSize, pag.x, pag.textAlign || 'left');
                page.drawText(textContent, {
                    x: textX,
                    y: pag.y,
                    size: pag.fontSize,
                    color: hexToRgb(pag.color),
                    font: embedFont
                });
                
                console.log(`✓ Renderizado campo '${pag.contenido}': '${textContent}' en posición (${textX}, ${pag.y})`);
            } else {
                console.warn(`⚠ No se encontró contenido para el campo '${pag.contenido}'`);
            }
        }
    }

    // const pdfBytes = await pdfDoc.save();

    const pdfBytes = await pdfDoc.save({
        useObjectStreams: false,        // ⭐ CRUCIAL: Sin object streams
        addDefaultPage: false,
        objectsPerTick: Infinity,
        updateFieldAppearances: false,  // ⭐ IMPORTANTE
        useJSInflate: false            // ⭐ Para mejor compatibilidad
    });

    fs.writeFileSync(savePath, pdfBytes);
    fs.unlinkSync(qrPath);
    return savePath;
}

module.exports = {
    generateCertificadoPdf,
    hexToRgb,
    generateQR,
    findSystemFont,
    embedFontInPdf,
    findUploadedFont,
    calculateTextX
};