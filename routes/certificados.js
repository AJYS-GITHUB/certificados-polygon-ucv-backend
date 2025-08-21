const express = require('express');
const router = express.Router();
const certificadoController = require('../controllers/certificadoController');

router.get('/', certificadoController.getAll);
router.get('/:id', certificadoController.getById);
router.post('/', certificadoController.create);
router.put('/:id', certificadoController.update);
router.delete('/:id', certificadoController.delete);
router.post('/generate-pdf', async (req, res) => {
  try {
    const pdfFilename = await certificadoController.generatePdf(req.body);
    res.json({ pdfFilename });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
});

module.exports = router;
