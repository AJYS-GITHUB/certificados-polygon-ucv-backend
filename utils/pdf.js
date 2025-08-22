const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const { generateQR } = require('./qr');
const { v4: uuidv4 } = require('uuid');

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
}

/**
 * Genera un PDF de certificado.
 * @param {Object} params - Parámetros para el PDF.
 * @param {string} params.templatePath - Ruta al template PDF.
 * @param {Array} params.paginas - Configuración de páginas y contenido.
 * @param {Object} params.subject - Datos del receptor.
 * @param {string} params.qrdata - Datos para el QR.
 * @param {string} params.savePath - Ruta donde guardar el PDF generado.
 * @param {string} params.dateString - Fecha de emisión.
 */
async function generateCertificadoPdf({ templatePath, paginas, subject, dateString, qrdata, savePath }) {
    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Generar QR temporal
    console.log("savepath: ", savePath);
    const qrPath = savePath.replace('.pdf', '.png');
    console.log("qrPath: ", qrPath);
    await generateQR(qrPath, qrdata);

    for (const pag of paginas) {
        const page = pdfDoc.getPages()[pag.numero - 1];
        if (pag.contenido === "subject") {
            const embedFont = await pdfDoc.embedStandardFont(pag.font);
            page.drawText(subject, {
                x: pag.x,
                y: pag.y,
                size: pag.fontSize,
                color: hexToRgb(pag.color),
                font: embedFont
            });
        } else if (pag.contenido === "qr") {
            const qrImageBytes = fs.readFileSync(qrPath);
            const qrImage = await pdfDoc.embedPng(qrImageBytes);
            page.drawImage(qrImage, {
                x: pag.x,
                y: pag.y,
                width: pag.width,
                height: pag.height
            });
        } else if (pag.contenido === "date") {
            const embedFont = await pdfDoc.embedStandardFont(pag.font);
            page.drawText(dateString, {
                x: pag.x,
                y: pag.y,
                size: pag.fontSize,
                color: hexToRgb(pag.color),
                font: embedFont
            });
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
    generateQR
};