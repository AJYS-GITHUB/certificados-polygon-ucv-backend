const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { signPdf, signPdfWithPDFKit } = require('../utils/signer');

// Configuración dinámica de almacenamiento
const storage = multer.diskStorage({
   destination: function (req, file, cb) {
      const folder = req.body.carpeta;
      if (!folder) return cb(new Error('No se especificó la carpeta'), null);
      const dest = path.join(__dirname, '..', 'storage', folder);
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
   },
   filename: function (req, file, cb) {
      const uuid = uuidv4();
      const ext = path.extname(file.originalname);
      cb(null, uuid + ext);
   }
});
const upload = multer({ storage });

// Endpoint para subir archivo
router.post('/', upload.single('archivo'), (req, res) => {
   if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
   res.json({
      mensaje: 'Archivo subido',
      filename: req.file.filename,
      carpeta: req.body.carpeta,
      path: req.file.path
   });
});

router.delete('/', (req, res) => {
   const { filename, folder } = req.body;
   if (!filename || !folder) {
      return res.status(400).json({ error: 'Faltan datos: filename y carpeta requeridos' });
   }
   const filePath = path.join(__dirname, '..', 'storage', folder, filename);
   if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
   }
   try {
      fs.unlinkSync(filePath);
      res.json({ mensaje: 'Archivo eliminado', filename, folder });
   } catch (err) {
      res.status(500).json({ error: 'No se pudo eliminar el archivo' });
   }
});

router.post('/sign', async (req, res) => {
   const { filename, certpath, folder } = req.body;
   if (!filename || !folder) {
      return res.status(400).json({ error: 'Faltan datos: filename y folder requeridos' });
   }

   const pdfPath = path.join(__dirname, '..', 'storage', folder, filename);
   if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado' });
   }

   // Ruta al certificado .pfx (ajusta según tu estructura)
   const certPath = path.join(__dirname, '..', 'storage', 'signs', certpath);
   if (!fs.existsSync(certPath)) {
      return res.status(404).json({ error: 'Certificado de firma no encontrado' });
   }

   try {
      // Leer PDF y agregar placeholder
      const signedPath = await signPdf(pdfPath, certPath, pdfPath.replace('.pdf', '-signed.pdf'), "12345678");
      const signedPath2 = await signPdf(signedPath, certPath, pdfPath.replace('.pdf', '-signed2.pdf'), "12345678");

      res.json({ mensaje: 'PDF firmado', path: signedPath2 });
   } catch (err) {
      res.status(500).json({ error: 'Error al firmar el PDF', detalle: err.message });
   }
});

module.exports = router;