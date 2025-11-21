const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

/**
 * Genera una imagen de firma gráfica con el estilo de Universidad César Vallejo
 * @param {Object} params - Parámetros para la firma
 * @param {string} params.author - Nombre del autor de la firma
 * @param {string} params.title - Título o cargo del firmante
 * @param {string} params.institution - Nombre de la institución
 * @param {string} params.ruc - RUC de la institución
 * @param {string} params.dni - DNI del firmante
 * @param {string} params.date - Fecha de la firma
 * @param {string} params.savePath - Ruta donde guardar la imagen
 * @param {number} params.width - Ancho de la imagen (opcional, default 350)
 * @param {number} params.height - Alto de la imagen (opcional, default 100)
 * @param {string} params.logoPath - Ruta al logo personalizado (opcional)
 * @param {Object} params.config - Configuración adicional (opcional)
 * @returns {Promise<string>} - Ruta del archivo generado
 */
async function generateSignature({
    author,
    title = "FIRMANTE",
    institution = "Universidad César Vallejo",
    ruc = "20101113552",
    dni = "00000000",
    date,
    savePath,
    width = 350,
    height = 100,
    logoPath = null,
    config = {}
}) {
    // Configuración por defecto
    const defaultConfig = {
        backgroundColor: '#FFFFFF',
        borderColor: '#000000',
        borderWidth: 1,
        logoWidth: 50,
        logoHeight: 70,
        logoBackgroundColor: '#CC0000',
        logoTextColor: '#FFFFFF',
        logoText: ['U', 'C', 'V'],
        institutionColor: '#000000',
        authorColor: '#000000',
        titleColor: '#000000',
        infoColor: '#666666',
        institutionFontSize: 12,
        authorFontSize: 14,
        titleFontSize: 10,
        infoFontSize: 8,
        padding: 8
    };

    const finalConfig = { ...defaultConfig, ...config };

    // Crear canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fondo
    ctx.fillStyle = finalConfig.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Borde
    if (finalConfig.borderWidth > 0) {
        ctx.strokeStyle = finalConfig.borderColor;
        ctx.lineWidth = finalConfig.borderWidth;
        ctx.strokeRect(
            finalConfig.borderWidth / 2, 
            finalConfig.borderWidth / 2, 
            width - finalConfig.borderWidth, 
            height - finalConfig.borderWidth
        );
    }

    // Logo área
    const logoWidth = Math.min(finalConfig.logoWidth, width * 0.2);
    const logoHeight = height - (finalConfig.padding * 2);
    const logoX = finalConfig.padding;
    const logoY = finalConfig.padding;

    // Intentar cargar logo personalizado
    let useCustomLogo = false;
    let logoImage = null;

    if (logoPath && fs.existsSync(logoPath)) {
        try {
            logoImage = await loadImage(logoPath);
            useCustomLogo = true;
            console.log(`✓ Logo personalizado cargado: ${logoPath}`);
        } catch (err) {
            console.warn(`⚠ No se pudo cargar el logo personalizado: ${err.message}`);
            useCustomLogo = false;
        }
    }

    if (useCustomLogo && logoImage) {
        // Dibujar logo personalizado
        ctx.save();
        ctx.beginPath();
        ctx.rect(logoX, logoY, logoWidth, logoHeight);
        ctx.clip();
        
        // Calcular proporciones para mantener aspecto
        const imageAspect = logoImage.width / logoImage.height;
        const targetAspect = logoWidth / logoHeight;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imageAspect > targetAspect) {
            // Imagen más ancha
            drawHeight = logoHeight;
            drawWidth = logoHeight * imageAspect;
            drawX = logoX - (drawWidth - logoWidth) / 2;
            drawY = logoY;
        } else {
            // Imagen más alta
            drawWidth = logoWidth;
            drawHeight = logoWidth / imageAspect;
            drawX = logoX;
            drawY = logoY + (logoHeight - drawHeight) / 2;
        }
        
        ctx.drawImage(logoImage, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    } else {
        // Dibujar logo predeterminado
        ctx.fillStyle = finalConfig.logoBackgroundColor;
        ctx.fillRect(logoX, logoY, logoWidth, logoHeight);

        // Texto del logo
        ctx.fillStyle = finalConfig.logoTextColor;
        ctx.font = `bold ${Math.floor(logoWidth / 4)}px Arial`;
        ctx.textAlign = 'center';
        
        const logoTextArray = finalConfig.logoText;
        const lineHeight = logoHeight / logoTextArray.length;
        
        logoTextArray.forEach((text, index) => {
            const textY = logoY + (lineHeight * (index + 0.7));
            ctx.fillText(text, logoX + logoWidth / 2, textY);
        });
    }

    // Área de texto principal
    const textStartX = logoX + logoWidth + finalConfig.padding;
    const textWidth = width - textStartX - finalConfig.padding;

    // Nombre de la institución
    ctx.fillStyle = finalConfig.institutionColor;
    ctx.font = `bold ${finalConfig.institutionFontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(institution, textStartX, logoY + finalConfig.institutionFontSize + 2);

    // Línea divisoria
    const lineY = logoY + finalConfig.institutionFontSize + 8;
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(textStartX, lineY);
    ctx.lineTo(width - finalConfig.padding, lineY);
    ctx.stroke();

    // Nombre del autor (firmante)
    ctx.fillStyle = finalConfig.authorColor;
    ctx.font = `bold ${finalConfig.authorFontSize}px Arial`;
    
    // Ajustar texto si es muy largo
    let authorText = `AUTOR: ${author.toUpperCase()}`;
    let textMetrics = ctx.measureText(authorText);
    if (textMetrics.width > textWidth) {
        authorText = author.toUpperCase();
        textMetrics = ctx.measureText(authorText);
        if (textMetrics.width > textWidth) {
            // Recortar si aún es muy largo
            const ratio = textWidth / textMetrics.width;
            const maxChars = Math.floor(author.length * ratio * 0.9);
            authorText = author.toUpperCase().substring(0, maxChars) + '...';
        }
    }
    
    ctx.fillText(authorText, textStartX, lineY + finalConfig.authorFontSize + 5);

    // Título/Cargo
    if (title && title.trim() !== '') {
        ctx.font = `${finalConfig.titleFontSize}px Arial`;
        ctx.fillStyle = finalConfig.titleColor;
        
        let titleText = title.toUpperCase();
        textMetrics = ctx.measureText(titleText);
        if (textMetrics.width > textWidth) {
            const ratio = textWidth / textMetrics.width;
            const maxChars = Math.floor(title.length * ratio * 0.9);
            titleText = title.toUpperCase().substring(0, maxChars) + '...';
        }
        
        ctx.fillText(titleText, textStartX, lineY + finalConfig.authorFontSize + finalConfig.titleFontSize + 8);
    }

    // Información adicional (RUC, DNI, Fecha)
    ctx.font = `${finalConfig.infoFontSize}px Arial`;
    ctx.fillStyle = finalConfig.infoColor;
    
    const infoY = height - finalConfig.padding - 3;
    let infoX = textStartX;
    
    // RUC
    if (ruc && ruc.trim() !== '') {
        const rucText = `RUC: ${ruc}`;
        ctx.fillText(rucText, infoX, infoY);
        infoX += ctx.measureText(rucText).width + 15;
    }
    
    // DNI
    if (dni && dni.trim() !== '' && dni !== '00000000') {
        const dniText = `DNI: ${dni}`;
        if (infoX + ctx.measureText(dniText).width < width - finalConfig.padding) {
            ctx.fillText(dniText, infoX, infoY);
            infoX += ctx.measureText(dniText).width + 15;
        }
    }
    
    // Fecha
    if (date && date.trim() !== '') {
        const dateText = `FECHA: ${date}`;
        if (infoX + ctx.measureText(dateText).width < width - finalConfig.padding) {
            ctx.fillText(dateText, infoX, infoY);
        }
    }

    // Guardar la imagen
    const buffer = canvas.toBuffer('image/png');
    
    // Crear directorio si no existe
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(savePath, buffer);
    
    console.log(`✓ Firma generada: ${savePath} (${width}x${height})`);
    return savePath;
}

/**
 * Genera una firma simple solo con el nombre
 * @param {Object} params - Parámetros para la firma
 * @param {string} params.name - Nombre para la firma
 * @param {string} params.savePath - Ruta donde guardar la imagen
 * @param {number} params.width - Ancho de la imagen (opcional)
 * @param {number} params.height - Alto de la imagen (opcional)
 * @returns {Promise<string>} - Ruta del archivo generado
 */
async function generateSimpleSignature({
    name,
    savePath,
    width = 300,
    height = 80
}) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fondo transparente
    ctx.clearRect(0, 0, width, height);

    // Línea de firma
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, height - 25);
    ctx.lineTo(width - 20, height - 25);
    ctx.stroke();

    // Texto del nombre
    ctx.fillStyle = '#000000';
    ctx.font = 'italic 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name, width / 2, height - 35);

    // Guardar la imagen
    const buffer = canvas.toBuffer('image/png');
    
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(savePath, buffer);
    
    console.log(`✓ Firma simple generada: ${savePath}`);
    return savePath;
}

module.exports = {
    generateSignature,
    generateSimpleSignature
};