const express = require('express');
const router = express.Router();
const certificadoController = require('../controllers/certificadoController');

router.get('/', certificadoController.getAll);
router.post('/', certificadoController.create);
router.post('/preview', certificadoController.previewCertificate);
router.post('/generate-pdf', certificadoController.generatePdf);
router.get('/:id', certificadoController.getById);
router.put('/:id', certificadoController.update);
router.delete('/:id', certificadoController.delete);

module.exports = router;
