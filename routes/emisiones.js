const multer = require('multer');
const upload = multer();
const express = require('express');
const router = express.Router();
const emisionController = require('../controllers/emisionController');

router.get('/', emisionController.getAll);
router.get('/:id', emisionController.getById);
router.post('/', emisionController.create);
router.put('/:id', emisionController.update);
router.delete('/:id', emisionController.delete);
router.put('/completar/:id', emisionController.completarEmision);
router.post('/verificar',upload.single('csv'), emisionController.verificarEmision);

module.exports = router;
