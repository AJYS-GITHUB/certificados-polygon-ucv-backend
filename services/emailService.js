const nodemailer = require('nodemailer');
const Emision = require('../models/Emision');
const Certificado = require('../models/Certificado');
const Correo = require('../models/Correo');
const fs = require('fs');
const path = require('path');

// Configurar transporte de correo
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Verificar que el transporte está configurado correctamente
 */
const verifyTransporter = async () => {
    try {
        await transporter.verify();
        console.log('Email transporter verified successfully');
        return true;
    } catch (err) {
        console.error('Email transporter verification failed:', err);
        return false;
    }
};

/**
 * Renderizar HTML de plantilla con variables de emisión
 */
const renderEmailTemplate = (templateHtml, emision) => {
    let html = templateHtml;
    
    // Variables disponibles
    const variables = {
        'nombre': emision.subject.nombreCompleto,
        'documento': emision.subject.documento,
        'email': emision.subject.correo,
        'fecha': new Date(emision.fechaEmision).toLocaleDateString('es-ES'),
        'fechaLarga': new Date(emision.fechaEmision).toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        'uuid': emision.uuid
    };

    // Reemplazar {{variable}} con valores
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, variables[key] || '');
    });

    return html;
};

/**
 * Enviar correo a una emisión específica
 * @param {String} emisionId - ID de la emisión
 * @param {String} correoTemplateId - ID de la plantilla
 * @param {Array|String} cc - Email(s) para CC adicionales
 * @param {Array|String} cco - Email(s) para CCO adicionales
 */
exports.sendEmailToEmision = async (emisionId, correoTemplateId, cc, cco) => {
    try {
        // Obtener emisión
        const emision = await Emision.findById(emisionId).populate('certificado');
        if (!emision) {
            throw new Error('Emisión no encontrada');
        }

        // Obtener plantilla de correo
        let correoTemplate;
        if (correoTemplateId) {
            correoTemplate = await Correo.findById(correoTemplateId);
        } else if (emision.certificado && emision.certificado.plantillaCorreo) {
            correoTemplate = await Correo.findById(emision.certificado.plantillaCorreo);
        }

        if (!correoTemplate) {
            throw new Error('No hay plantilla de correo configurada');
        }

        // Renderizar HTML con variables de la emisión
        const htmlContent = renderEmailTemplate(correoTemplate.contenidoHtml, emision);

        // Obtener ruta del PDF
        let pdfPath = emision.pdfPath;
        
        // Extraer solo el nombre del archivo (sin dominio ni ruta)
        let filename = pdfPath;
        if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
            // Extraer nombre del archivo de la URL
            // Ej: http://localhost:3000/uploads/cert.pdf -> cert.pdf
            filename = path.basename(new URL(pdfPath).pathname);
        } else if (pdfPath.includes('/')) {
            // Si es una ruta relativa, extraer solo el nombre del archivo
            filename = path.basename(pdfPath);
        }
        
        // Construir ruta completa en la carpeta storage
        pdfPath = path.join(__dirname, '..', 'storage/certificates', filename);

        // Verificar que el PDF existe
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`Archivo PDF no encontrado: ${pdfPath}`);
        }

        // Preparar attachments
        const attachments = [
            {
                filename: filename,
                path: pdfPath
            }
        ];

        // Enviar correo
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: emision.subject.correo,
            subject: correoTemplate.asunto,
            html: htmlContent,
            attachments: attachments
        };

        // Combinar CC del modelo con CC adicionales
        const ccList = [...(correoTemplate.cc || [])];
        if (cc) {
            const additionalCc = Array.isArray(cc) ? cc : [cc];
            ccList.push(...additionalCc);
        }
        if (ccList.length > 0) {
            mailOptions.cc = [...new Set(ccList)]; // Eliminar duplicados
        }

        // Combinar CCO del modelo con CCO adicionales
        const ccoList = [...(correoTemplate.cco || [])];
        if (cco) {
            const additionalCco = Array.isArray(cco) ? cco : [cco];
            ccoList.push(...additionalCco);
        }
        if (ccoList.length > 0) {
            mailOptions.bcc = [...new Set(ccoList)]; // Eliminar duplicados
        }

        const info = await transporter.sendMail(mailOptions);

        // Actualizar estado de emisión
        emision.emailSended = true;
        emision.updatedAt = new Date();
        await emision.save();

        console.log('Email sent successfully:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
            emisionId: emisionId,
            email: emision.subject.correo
        };
    } catch (err) {
        console.error('Error sending email to emision:', err);
        throw err;
    }
};

/**
 * Enviar correos a múltiples emisiones
 * @param {Array} emisionIds - Array de IDs de emisiones
 * @param {String} correoTemplateId - ID de la plantilla
 * @param {Array|String} cc - Email(s) para CC adicionales
 * @param {Array|String} cco - Email(s) para CCO adicionales
 */
exports.sendEmailsToEmisions = async (emisionIds, correoTemplateId, cc, cco) => {
    const results = {
        sent: [],
        failed: [],
        total: emisionIds.length
    };

    for (const emisionId of emisionIds) {
        try {
            const result = await exports.sendEmailToEmision(emisionId, correoTemplateId, cc, cco);
            results.sent.push(result);
        } catch (err) {
            results.failed.push({
                emisionId: emisionId,
                error: err.message
            });
        }
    }

    return results;
};

/**
 * Enviar correos a todas las emisiones no enviadas
 * @param {String} correoTemplateId - ID de la plantilla
 * @param {Array|String} cc - Email(s) para CC adicionales
 * @param {Array|String} cco - Email(s) para CCO adicionales
 */
exports.sendPendingEmails = async (correoTemplateId, cc, cco) => {
    try {
        // Obtener emisiones con emailSended = false
        const emisions = await Emision.find({ emailSended: false })
            .populate('certificado')
            .select('_id');

        const emisionIds = emisions.map(e => e._id);

        if (emisionIds.length === 0) {
            return {
                success: true,
                message: 'No hay emisiones pendientes de envío',
                sent: [],
                failed: [],
                total: 0
            };
        }

        const results = await exports.sendEmailsToEmisions(emisionIds, correoTemplateId, cc, cco);

        return {
            success: true,
            ...results
        };
    } catch (err) {
        console.error('Error sending pending emails:', err);
        throw err;
    }
};

/**
 * Enviar correo de prueba
 * @param {String} toEmail - Email de destino
 * @param {String} correoTemplateId - ID de la plantilla
 * @param {Array|String} cc - Email(s) para CC adicionales
 * @param {Array|String} cco - Email(s) para CCO adicionales
 */
exports.sendTestEmail = async (toEmail, correoTemplateId, cc, cco) => {
    try {
        const correoTemplate = await Correo.findById(correoTemplateId);
        if (!correoTemplate) {
            throw new Error('Plantilla de correo no encontrada');
        }

        // Crear emisión de prueba
        const testEmision = {
            subject: {
                nombreCompleto: 'Usuario Prueba',
                documento: '12345678',
                correo: toEmail
            },
            fechaEmision: new Date(),
            uuid: 'test-' + Date.now()
        };

        const htmlContent = renderEmailTemplate(correoTemplate.contenidoHtml, testEmision);

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: toEmail,
            subject: `[PRUEBA] ${correoTemplate.asunto}`,
            html: htmlContent
        };

        // Combinar CC del modelo con CC adicionales
        const ccList = [...(correoTemplate.cc || [])];
        if (cc) {
            const additionalCc = Array.isArray(cc) ? cc : [cc];
            ccList.push(...additionalCc);
        }
        if (ccList.length > 0) {
            mailOptions.cc = [...new Set(ccList)]; // Eliminar duplicados
        }

        // Combinar CCO del modelo con CCO adicionales
        const ccoList = [...(correoTemplate.cco || [])];
        if (cco) {
            const additionalCco = Array.isArray(cco) ? cco : [cco];
            ccoList.push(...additionalCco);
        }
        if (ccoList.length > 0) {
            mailOptions.bcc = [...new Set(ccoList)]; // Eliminar duplicados
        }

        const info = await transporter.sendMail(mailOptions);

        return {
            success: true,
            messageId: info.messageId,
            email: toEmail,
            message: 'Correo de prueba enviado exitosamente'
        };
    } catch (err) {
        console.error('Error sending test email:', err);
        throw err;
    }
};

/**
 * Obtener estado de configuración del servicio de email
 */
exports.getEmailStatus = async () => {
    const isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
    const isVerified = isConfigured ? await verifyTransporter() : false;

    return {
        configured: isConfigured,
        verified: isVerified,
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'not configured',
        secure: process.env.EMAIL_SECURE === 'true' || false
    };
};

module.exports = exports;
