const Certificado = require('../models/Certificado');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const { rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const signer = require('node-signpdf').default;
const { plainAddPlaceholder } = require('node-signpdf/dist/helpers');

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

exports.generatePdf = async ({ filename, subject, certificado_id, qrdata }) => {
	const certificado = await Certificado.findById(certificado_id).populate('dependencia');
	if (!certificado) return res.status(404).json({ error: 'No encontrado' });

	const templatePath = path.join(__dirname, '..', 'storage', 'templates', certificado.filename);
	const existingPdfBytes = fs.readFileSync(templatePath);
	const pdfDoc = await PDFDocument.load(existingPdfBytes);
	const qrPath = path.join(__dirname, '..', 'storage', 'certificates', `${filename}.png`);
	await generateQR(qrPath, qrdata);

	for (const pag of certificado.paginas) {
		const page = pdfDoc.getPages()[pag.numero - 1];
		if (pag.contenido == "subject") {
			const timesRomanFont = await pdfDoc.embedStandardFont('Times-Roman');
			page.drawText(subject, {
				x: pag.x,
				y: pag.y,
				size: pag.fontSize,
				color: rgb(1, 1, 1),
				font: timesRomanFont
			});
		} else if (pag.contenido == "qr") {
			const qrImageBytes = fs.readFileSync(qrPath);
			const qrImage = await pdfDoc.embedPng(qrImageBytes);
			page.drawImage(qrImage, {
				x: pag.x,
				y: pag.y,
				width: pag.width,
				height: pag.height
			});
		}
	}

	const pdfBytes = await pdfDoc.save();
	const savePath = path.join(__dirname, '..', 'storage', 'certificates', filename);
	fs.writeFileSync(savePath, pdfBytes);    
	fs.unlinkSync(qrPath);

	// Agregar placeholder para la firma sobre el PDF modificado
	// const pdfBuffer = fs.readFileSync(savePath);
	// const pdfWithPlaceholder = plainAddPlaceholder({ pdfBuffer });
	// fs.writeFileSync(savePath, pdfWithPlaceholder);

	// // Firmar el PDF
	// const certPath = path.join(__dirname, '..', 'storage', 'templates', certificado.dependencia.certificadodigital);
	// const result =  await signPdf(templatePath, certPath, savePath);

	return savePath;
};

const generateQR = async (qrPath, qrdata) => {
	try {
		await QRCode.toFile(qrPath, qrdata, {
			color: {
				dark: '#000',  // Color del QR
				light: '#FFF'  // Fondo
			},
			margin: 0
		});
	} catch (err) {
		console.error(err)
	}
}

// Firmar digitalmente un PDF
const signPdf = async (pdfPath, certPath, outputPath) => {
  try {
    // Leer PDF generado
    const pdfBuffer = fs.readFileSync(pdfPath);
    // Agregar placeholder para la firma
    const pdfWithPlaceholder = plainAddPlaceholder({ pdfBuffer });
    // Leer certificado
    const p12Buffer = fs.readFileSync(certPath);
    // Firmar el PDF
    const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer);
    // Guardar PDF firmado
    fs.writeFileSync(outputPath, signedPdf);
    return outputPath;
  } catch (err) {
    console.error('Error al firmar PDF:', err);
    throw err;
  }
};
