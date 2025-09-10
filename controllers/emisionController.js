const Emision = require('../models/Emision');
const Certificado = require('../models/Certificado');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const { rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const { generateCertificadoPdf } = require('../utils/pdf');
const { signPdf } = require('../utils/signer');

const csv = require('csv-parser');
const pdfParse = require('pdf-parse');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');

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
        const certPath = path.join(__dirname, '..', 'storage', 'signs', certificado.dependencia.certificadodigital);
        const savePath = path.join(__dirname, '..', 'storage', 'certificates', `${uuid}.pdf`);

        const nueva = new Emision({
            certificado: certificado._id,
            uuid,
            subject: {
                documento: doc,
                nombreCompleto: fullname
            },
            fechaEmision: new Date(),
            pdfHash: "-",
            pdfPath: "-",
            jsonPath: "-",
            imagePath: "-",
            transactionId: null,
            status: 'pendiente'

        });
        await nueva.save();

        const resultSavePath = await generateCertificadoPdf({
            templatePath,
            paginas: certificado.paginas,
            subject: fullname,
            dateString: datestring,
            qrdata: `${process.env.APP_URI}/landing/${nueva._id}`,
            savePath
        });

        // Generar imagen JPEG de la primera página usando pdftoppm
        const imgDir = path.join(__dirname, '..', 'storage', 'img');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);
        const imgBase = path.join(imgDir, uuid);
        const { execSync } = require('child_process');
        execSync(`pdftoppm -jpeg -f 1 -l 1 "${resultSavePath}" "${imgBase}"`);
        const imagePath = `${imgBase}-1.jpg`;

        const resultSignedPath = await signPdf(resultSavePath, certPath, resultSavePath.replace('.pdf', '-signed.pdf'), "12345678");

        // Calcular hash del PDF
        const crypto = require('crypto');
        const pdfBuffer = fs.readFileSync(resultSignedPath);
        const pdfHash = 'sha256:' + crypto.createHash('sha256').update(pdfBuffer).digest('hex');

        // Generar JSON de metadata
        const jsonDir = path.join(__dirname, '..', 'storage', 'json');
        if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir);
        const jsonPath = path.join(jsonDir, `${uuid}.json`);
        const metadata = {
            name: `Certificado de ${certificado.titulo}`,
            description: description,
            image: `${process.env.APP_URI}/img/${uuid}-1.jpg`,
            pdf: `${process.env.APP_URI}/certs/${uuid}-signed.pdf`,
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
        fs.unlinkSync(resultSavePath);

        nueva.pdfPath = `${process.env.APP_URI}/certs/${uuid}-signed.pdf`;
        nueva.jsonPath = `${process.env.APP_URI}/json/${uuid}.json`;
        nueva.imagePath = `${process.env.APP_URI}/img/${uuid}-1.jpg`;
        nueva.pdfHash = pdfHash;

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

exports.completarEmision = async (req, res) => {
    const { id } = req.params;
    const { transactionId } = req.body;

    try {
        const emision = await Emision.findById(req.params.id);
        if (!emision) return res.status(404).json({ error: 'Emisión no encontrada' });

        if (!transactionId || transactionId.trim() === '') {
            emision.status = 'error';
            emision.transactionId = '';
        } else {
            emision.status = 'completado';
            emision.transactionId = transactionId;
        }

        await emision.save();
        res.json(emision);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.verificarEmision = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se envió el archivo CSV.' });
        }

        const results = [];
        const stream = require('stream');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);

        bufferStream
            .pipe(csv({ separator: ';' }))
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                let csvRows = [];

                for (const row of results) {
                    const dni = row.dni;
                    if (!dni) continue;

                    // Buscar la última emisión por dni
                    const emision = await Emision.findOne({ "subject.documento": dni }).sort({ fechaEmision: -1 });

                    if (!emision || !emision.pdfPath) continue;

                    // Solo el nombre del archivo PDF
                    let pdfFileName = emision.pdfPath.split('/').pop();
                    let pdfLocalPath = path.join(__dirname, '..', 'storage', 'certificates', pdfFileName);

                    // Leer PDF local
                    let pdfBuffer;
                    try {
                        pdfBuffer = fs.readFileSync(pdfLocalPath);
                    } catch (e) {
                        continue;
                    }

                    // Verificar campos en el PDF
                    const pdfData = await pdfParse(pdfBuffer);
                    const pdfText = pdfData.text;
                    let campos = Object.keys(row).filter(k => k !== 'dni' && k !== 'correo' && k != 'largo' && k != 'curso/programa');
                    let faltantes = campos.filter(campo => !pdfText.includes(row[campo]));

                    if (faltantes.length === 0) {
                        csvRows.push({
                            id: emision._id,
                            doc: emision.subject.documento,
                            fullname: emision.subject.nombreCompleto,
                            pdf: pdfFileName,
                            email: row.correo || row.email || ''
                        });
                    }
                }

                // Generar CSV
                const fields = ['id', 'doc', 'fullname', 'pdf', 'email'];
                const parser = new Parser({ fields, delimiter: ';' });
                const csvString = parser.parse(csvRows);

                res.header('Content-Type', 'text/csv');
                res.attachment('verificados.csv');
                res.send(csvString);
            });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};