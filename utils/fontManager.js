const fs = require('fs');
const path = require('path');

/**
 * Lista todas las fuentes disponibles en el sistema
 * @returns {Array} - Array de objetos con información de las fuentes
 */
function listSystemFonts() {
    const fonts = [];
    const platform = process.platform;
    
    // Directorios donde buscar fuentes según el sistema operativo
    const fontDirectories = {
        linux: [
            '/usr/share/fonts',
            '/usr/local/share/fonts',
            '/home/' + process.env.USER + '/.fonts',
            '/home/' + process.env.USER + '/.local/share/fonts'
        ],
        darwin: [
            '/System/Library/Fonts',
            '/Library/Fonts',
            '/Users/' + process.env.USER + '/Library/Fonts'
        ],
        win32: [
            'C:\\Windows\\Fonts',
            'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Microsoft\\Windows\\Fonts'
        ]
    };
    
    const dirs = fontDirectories[platform] || fontDirectories.linux;
    
    for (const dir of dirs) {
        if (fs.existsSync(dir)) {
            try {
                const scanDir = (dirPath, relativePath = '') => {
                    const items = fs.readdirSync(dirPath);
                    
                    for (const item of items) {
                        const fullPath = path.join(dirPath, item);
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory() && !item.startsWith('.')) {
                            scanDir(fullPath, path.join(relativePath, item));
                        } else if (stat.isFile()) {
                            const ext = path.extname(item).toLowerCase();
                            if (['.ttf', '.otf', '.ttc', '.woff', '.woff2'].includes(ext)) {
                                const fontName = path.basename(item, ext);
                                fonts.push({
                                    name: fontName,
                                    path: fullPath,
                                    type: ext.substring(1),
                                    directory: dirPath,
                                    relativePath: path.join(relativePath, item)
                                });
                            }
                        }
                    }
                };
                
                scanDir(dir);
            } catch (err) {
                console.warn(`No se pudo escanear el directorio ${dir}: ${err.message}`);
            }
        }
    }
    
    return fonts;
}

/**
 * Busca una fuente específica por nombre
 * @param {string} searchName - Nombre de la fuente a buscar
 * @returns {Array} - Array de fuentes que coinciden
 */
function searchFont(searchName) {
    const allFonts = listSystemFonts();
    const searchLower = searchName.toLowerCase();
    
    return allFonts.filter(font => 
        font.name.toLowerCase().includes(searchLower) ||
        font.name.toLowerCase().replace(/[-_\s]/g, '').includes(searchLower.replace(/[-_\s]/g, ''))
    );
}

/**
 * Obtiene fuentes recomendadas comunes
 * @returns {Array} - Array de fuentes comunes disponibles
 */
function getCommonFonts() {
    const commonFontNames = [
        'Arial', 'Helvetica', 'Times', 'Courier', 'Verdana', 
        'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic',
        'Impact', 'Lucida', 'Tahoma', 'Trebuchet', 'Monaco'
    ];
    
    const availableFonts = [];
    const allFonts = listSystemFonts();
    
    for (const commonName of commonFontNames) {
        const found = allFonts.filter(font => 
            font.name.toLowerCase().includes(commonName.toLowerCase())
        );
        if (found.length > 0) {
            availableFonts.push({
                family: commonName,
                variants: found
            });
        }
    }
    
    return availableFonts;
}

/**
 * Valida si una fuente existe en el sistema
 * @param {string} fontPath - Ruta a la fuente
 * @returns {boolean} - true si la fuente existe y es válida
 */
function validateFont(fontPath) {
    if (!fs.existsSync(fontPath)) {
        return false;
    }
    
    const ext = path.extname(fontPath).toLowerCase();
    return ['.ttf', '.otf', '.ttc'].includes(ext);
}

module.exports = {
    listSystemFonts,
    searchFont,
    getCommonFonts,
    validateFont
};