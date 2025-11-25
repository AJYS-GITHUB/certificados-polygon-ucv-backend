const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

/**
 * Rutas para envío de correos electrónicos
 */

// Obtener estado del servicio de email
router.get('/status', emailController.getEmailStatus);

// Obtener estadísticas de envío
router.get('/stats', emailController.getEmailStats);

// Enviar correo de prueba
router.post('/test', emailController.sendTestEmail);

// Enviar correo a una emisión específica
router.post('/emision/:id/send', emailController.sendToEmision);

// Enviar correos a múltiples emisiones
router.post('/emisions/send', emailController.sendToMultipleEmisions);

// Enviar correos a todas las emisiones sin envío
router.post('/pending/send', emailController.sendPendingEmails);

module.exports = router;
