const Certificado = require('../models/Certificado');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const { rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const signer = require('node-signpdf').default;
const { v4: uuidv4 } = require('uuid');
const { plainAddPlaceholder } = require('node-signpdf/dist/helpers');
const { generateCertificadoPdf } = require('../utils/pdf');

// Listar certificados con paginación
exports.getAll = async (req, res) => {
   try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
         Certificado.find().skip(skip).limit(limit).populate('dependencia'),
         Certificado.countDocuments()
      ]);

      res.json({
         items,
         total,
         page,
         pages: Math.ceil(total / limit)
      });
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
};

// Obtener certificado por ID
exports.getById = async (req, res) => {
   try {
      const certificado = await Certificado.findById(req.params.id).populate('dependencia');
      if (!certificado) return res.status(404).json({ error: 'No encontrado' });
      res.json(certificado);
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
};

// Crear certificado
exports.create = async (req, res) => {
   try {
      const nuevo = new Certificado(req.body);
      await nuevo.save();
      res.status(201).json(nuevo);
   } catch (err) {
      res.status(400).json({ error: err.message });
   }
};

// Actualizar certificado
exports.update = async (req, res) => {
   try {
      const actualizado = await Certificado.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!actualizado) return res.status(404).json({ error: 'No encontrado' });
      res.json(actualizado);
   } catch (err) {
      res.status(400).json({ error: err.message });
   }
};

// Eliminar certificado
exports.delete = async (req, res) => {
   try {
      const eliminado = await Certificado.findByIdAndDelete(req.params.id);
      if (!eliminado) return res.status(404).json({ error: 'No encontrado' });
      res.json({ mensaje: 'Certificado eliminado' });
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
};

exports.generatePdf = async (req, res) => {
   const { doc, fullname, certificado_id, datestring } = req.body;

   const certificado = await Certificado.findById(certificado_id).populate('dependencia');
   if (!certificado) return res.status(404).json({ error: 'No encontrado' });

   const templatePath = path.join(__dirname, '..', 'storage', 'templates', certificado.filename);
   const uuid = uuidv4();
   const qrdata = `${process.env.APP_URI}/verificar/${uuid}`;
   const savePath = path.join(__dirname, '..', 'storage', 'certificates', `${uuid}.pdf`);
   try {
      const resultSavePath = await generateCertificadoPdf({ templatePath, paginas: certificado.paginas, subject: fullname, dateString: datestring, qrdata, savePath });

      res.json({ pdfFilename: `${uuid}.pdf` });
   } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
   }
};


