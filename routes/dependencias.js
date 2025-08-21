const express = require('express');
const router = express.Router();
const dependenciaController = require('../controllers/dependenciaController');

router.get('/', dependenciaController.getAll);
router.get('/:id', dependenciaController.getById);
router.post('/', dependenciaController.create);
router.put('/:id', dependenciaController.update);
router.delete('/:id', dependenciaController.delete);

module.exports = router;
