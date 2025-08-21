const express = require('express');
const router = express.Router();
const emisionController = require('../controllers/emisionController');

router.get('/', emisionController.getAll);
router.get('/:id', emisionController.getById);
router.post('/', emisionController.create);
router.put('/:id', emisionController.update);
router.delete('/:id', emisionController.delete);

module.exports = router;
