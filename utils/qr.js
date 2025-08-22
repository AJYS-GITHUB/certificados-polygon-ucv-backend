const QRCode = require('qrcode');

/**
 * Genera una imagen QR en la ruta especificada.
 * @param {string} qrPath - Ruta donde guardar la imagen QR.
 * @param {string} qrdata - Datos a codificar en el QR.
 * @returns {Promise<void>}
 */

const generateQR = async (qrPath, qrdata) => {
    try {
        await QRCode.toFile(qrPath, qrdata, {
            color: {
                dark: '#000',  // Color del QR
                light: '#FFF'  // Fondo
            },
            margin: 0
        });
    } catch (err) {
        console.error(err)
    }
}

module.exports = { generateQR };