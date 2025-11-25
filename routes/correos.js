const express = require('express');
const router = express.Router();
const correoController = require('../controllers/correoController');

// Rutas CRUD básicas
router.get('/', correoController.getAll);
router.get('/:id', correoController.getById);
router.post('/', correoController.create);
router.put('/:id', correoController.update);
router.delete('/:id', correoController.delete);

// Rutas para manejo de assets
router.get('/:id/assets', correoController.getAssets);
router.get('/:id/assets/:assetFilename/url', correoController.getAssetUrl);
router.post('/:id/assets', correoController.uploadMiddleware, (err, req, res, next) => {
  if (err) {
    console.error('Multer error:', err);
    return res.status(400).json({ error: err.message });
  }
  next();
}, correoController.uploadAsset);
router.delete('/:id/assets/:assetId', correoController.deleteAsset);

// Ruta para vista previa
router.get('/:id/preview', correoController.preview);

// Nuevas rutas útiles
router.get('/:id/with-assets', correoController.getWithAssetUrls);
router.post('/:id/render', correoController.renderHtml);
router.get('/:id/preview-code', correoController.generatePreviewCode);

module.exports = router;
