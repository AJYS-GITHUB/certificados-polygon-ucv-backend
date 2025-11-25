const emailService = require('../services/emailService');
const Emision = require('../models/Emision');

/**
 * Enviar correo a una emisión específica
 * POST /emails/emision/:id/send
 */
exports.sendToEmision = async (req, res) => {
    try {
        const { id } = req.params;
        const { correoTemplateId, cc, cco } = req.body;

        // Validar que la emisión existe
        const emision = await Emision.findById(id);
        if (!emision) {
            return res.status(404).json({ error: 'Emisión no encontrada' });
        }

        // Enviar correo
        const result = await emailService.sendEmailToEmision(id, correoTemplateId, cc, cco);

        res.json({
            success: true,
            message: 'Correo enviado exitosamente',
            result: result
        });
    } catch (err) {
        console.error('Error in sendToEmision:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

/**
 * Enviar correos a múltiples emisiones
 * POST /emails/emisions/send
 */
exports.sendToMultipleEmisions = async (req, res) => {
    try {
        const { emisionIds, correoTemplateId, cc, cco } = req.body;

        if (!emisionIds || !Array.isArray(emisionIds) || emisionIds.length === 0) {
            return res.status(400).json({
                error: 'Se requiere un array de emisionIds'
            });
        }

        // Enviar correos
        const results = await emailService.sendEmailsToEmisions(emisionIds, correoTemplateId, cc, cco);

        res.json({
            success: true,
            message: `Correos enviados: ${results.sent.length}/${results.total}`,
            results: results
        });
    } catch (err) {
        console.error('Error in sendToMultipleEmisions:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

/**
 * Enviar correos a todas las emisiones sin envío
 * POST /emails/pending/send
 */
exports.sendPendingEmails = async (req, res) => {
    try {
        const { correoTemplateId, cc, cco } = req.body;

        const results = await emailService.sendPendingEmails(correoTemplateId, cc, cco);

        res.json({
            success: true,
            message: `Correos pendientes procesados: ${results.sent.length + results.failed.length}`,
            results: results
        });
    } catch (err) {
        console.error('Error in sendPendingEmails:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

/**
 * Enviar correo de prueba
 * POST /emails/test
 */
exports.sendTestEmail = async (req, res) => {
    try {
        const { toEmail, correoTemplateId, cc, cco } = req.body;

        if (!toEmail || !correoTemplateId) {
            return res.status(400).json({
                error: 'Se requieren toEmail y correoTemplateId'
            });
        }

        const result = await emailService.sendTestEmail(toEmail, correoTemplateId, cc, cco);

        res.json({
            success: true,
            message: 'Correo de prueba enviado',
            result: result
        });
    } catch (err) {
        console.error('Error in sendTestEmail:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

/**
 * Obtener estado del servicio de email
 * GET /emails/status
 */
exports.getEmailStatus = async (req, res) => {
    try {
        const status = await emailService.getEmailStatus();
        res.json(status);
    } catch (err) {
        console.error('Error in getEmailStatus:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

/**
 * Obtener estadísticas de envío
 * GET /emails/stats
 */
exports.getEmailStats = async (req, res) => {
    try {
        const sent = await Emision.countDocuments({ emailSended: true });
        const pending = await Emision.countDocuments({ emailSended: false });
        const total = await Emision.countDocuments({});

        res.json({
            sent: sent,
            pending: pending,
            total: total,
            sentPercentage: total > 0 ? ((sent / total) * 100).toFixed(2) : 0
        });
    } catch (err) {
        console.error('Error in getEmailStats:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

module.exports = exports;
