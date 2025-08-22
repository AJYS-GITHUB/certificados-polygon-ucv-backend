const Emision = require('../models/Emision');
const Certificado = require('../models/Certificado');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const { rgb } = require('pdf-lib');
const QRCode = require('qrcode');

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

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            Emision.find().skip(skip).limit(limit).populate('certificado'),
            Emision.countDocuments()
        ]);
        res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Obtener emisión por ID
exports.getById = async (req, res) => {
    try {
        const emision = await Emision.findById(req.params.id).populate('certificado');
        if (!emision) return res.status(404).json({ error: 'No encontrada' });
        res.json(emision);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Crear emisión
exports.create = async (req, res) => {
    try {
        const { doc, fullname, certificado_id, description, datestring } = req.body;
        const certificado = await Certificado.findById(certificado_id).populate('dependencia');
        if (!certificado) return res.status(404).json({ error: 'No encontrado' });
        const uuid = uuidv4();

        const templatePath = path.join(__dirname, '..', 'storage', 'templates', certificado.filename);
        const existingPdfBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const qrPath = path.join(__dirname, '..', 'storage', 'certificates', `${uuid}.png`);
        const qrdata = `${process.env.APP_URI}/verificar/${uuid}`;
        await generateQR(qrPath, qrdata);

        for (const pag of certificado.paginas) {
            const page = pdfDoc.getPages()[pag.numero - 1];
            if (pag.contenido == "subject") {
                const embedFont = await pdfDoc.embedStandardFont(pag.font);
                page.drawText(fullname, {
                    x: pag.x,
                    y: pag.y,
                    size: pag.fontSize,
                    color: hexToRgb(pag.color),
                    font: embedFont
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
            } else if (pag.contenido == "date") {
                const embedFont = await pdfDoc.embedStandardFont(pag.font);
                // const date = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
                page.drawText(datestring, {
                    x: pag.x,
                    y: pag.y,
                    size: pag.fontSize,
                    color: hexToRgb(pag.color),
                    font: embedFont
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        const savePath = path.join(__dirname, '..', 'storage', 'certificates', `${uuid}.pdf`);
        fs.writeFileSync(savePath, pdfBytes);
        fs.unlinkSync(qrPath);

        // Generar imagen JPEG de la primera página usando pdftoppm
        const imgDir = path.join(__dirname, '..', 'storage', 'img');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);
        const imgBase = path.join(imgDir, uuid);
        const { execSync } = require('child_process');
        execSync(`pdftoppm -jpeg -f 1 -l 1 "${savePath}" "${imgBase}"`);
        const imagePath = `${imgBase}-1.jpg`;



        // Calcular hash del PDF
        const crypto = require('crypto');
        const pdfBuffer = fs.readFileSync(savePath);
        const pdfHash = 'sha256:' + crypto.createHash('sha256').update(pdfBuffer).digest('hex');

        // Generar JSON de metadata
        const jsonDir = path.join(__dirname, '..', 'storage', 'json');
        if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir);
        const jsonPath = path.join(jsonDir, `${uuid}.json`);
        const metadata = {
            name: `Certificado de ${certificado.titulo}`,
            description: description,
            image: `${process.env.APP_URI}/img/${uuid}-1.jpg`,
            pdf: `${process.env.APP_URI}/certs/${uuid}.pdf`,
            pdfhash: pdfHash,
            json: `${process.env.APP_URI}/json/${uuid}.json`,
            attributes: [
                { trait_type: "document", value: doc },
                { trait_type: "fullname", value: fullname },
                { trait_type: "program", value: certificado.titulo },
                { trait_type: "dependency", value: certificado.dependencia.nombre },
                { trait_type: "issued_at", value: new Date().toISOString().split('T')[0] },
                { trait_type: "pdfhash", value: pdfHash }
            ]
        };
        fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

        // Guardar la emisión
        const nueva = new Emision({
            certificado: certificado._id,
            uuid,
            subject: {
                documento: doc,
                nombreCompleto: fullname
            },
            fechaEmision: new Date(),
            pdfHash,
            pdfPath: `${process.env.APP_URI}/certs/${uuid}.pdf`,
            jsonPath:`${process.env.APP_URI}/json/${uuid}.json`,
            imagePath:`${process.env.APP_URI}/img/${uuid}-1.jpg`
        });
        await nueva.save();
        res.status(201).json(nueva);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Actualizar emisión
exports.update = async (req, res) => {
    try {
        const actualizada = await Emision.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!actualizada) return res.status(404).json({ error: 'No encontrada' });
        res.json(actualizada);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Eliminar emisión
exports.delete = async (req, res) => {
    try {
        const eliminada = await Emision.findByIdAndDelete(req.params.id);
        if (!eliminada) return res.status(404).json({ error: 'No encontrada' });
        res.json({ mensaje: 'Emisión eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
