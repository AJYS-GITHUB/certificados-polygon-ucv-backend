const multer = require('multer');
const upload = multer();
const express = require('express');
const router = express.Router();
const emisionController = require('../controllers/emisionController');

router.get('/', emisionController.getAll);
router.get('/summary', emisionController.getSummary);
router.get('/balance', emisionController.balance);
router.get('/queue/stats', emisionController.getBlockchainQueueStats);
router.get('/processing', emisionController.getProcessingEmissions);
router.get('/pending-blockchain', emisionController.getPendingBlockchain);
router.get('/unconfirmed-transactions', emisionController.getUnconfirmedTransactions);
router.post('/resend-all-blockchain', emisionController.resendAllPendingToBlockchain);
router.post('/verify-all-transactions', emisionController.verifyAndConfirmAllTransactions);
router.get('/:id', emisionController.getById);
router.get('/:id/status', emisionController.getEmisionStatus);
router.post('/', emisionController.create);
router.post('/ethers', emisionController.create_ethers);
router.post('/:id/retry-blockchain', emisionController.retryBlockchainTransaction);
router.post('/:id/resend-blockchain', emisionController.resendToBlockchain);
router.post('/:id/verify-transaction', emisionController.verifyAndConfirmTransaction);
router.post('/:id/force-check', emisionController.forceCheckTransaction);
router.put('/:id', emisionController.update);
router.delete('/:id', emisionController.delete);
router.put('/completar/:id', emisionController.completarEmision);
router.post('/verificar',upload.single('csv'), emisionController.verificarEmision);

module.exports = router;
