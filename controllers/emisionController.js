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
const abi = require('../config/abi.json');
const { ethers } = require('ethers');
const { getBlockchainQueue } = require('../utils/blockchainQueue');

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

/**
 * Obtener resumen/estadísticas de emisiones
 */
exports.getSummary = async (req, res) => {
    try {
        // Obtener conteos por estado usando agregación
        const statusStats = await Emision.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Convertir array a objeto
        const byStatus = statusStats.reduce((acc, stat) => {
            acc[stat._id || 'sin_estado'] = stat.count;
            return acc;
        }, {});

        // Obtener conteos de envío por correo
        const emailStats = await Emision.aggregate([
            {
                $group: {
                    _id: '$emailSended',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Convertir a objeto de email
        const emailSent = emailStats.find(s => s._id === true)?.count || 0;
        const emailPending = emailStats.find(s => s._id === false || s._id === null || s._id === undefined)?.count || 0;

        // Total de emisiones
        const total = await Emision.countDocuments();

        res.json({
            success: true,
            total,
            byStatus: {
                pendiente: byStatus.pendiente || 0,
                procesando: byStatus.procesando || 0,
                completado: byStatus.completado || 0,
                error: byStatus.error || 0,
                reintentando: byStatus.reintentando || 0,
                sin_estado: byStatus.sin_estado || 0
            },
            byEmail: {
                enviados: emailSent,
                pendientes: emailPending
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error en getSummary:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Construir filtros opcionales
        const filters = {};
        
        // Filtro por estado de emisión (pendiente, procesando, completado, error, reintentando)
        if (req.query.status) {
            filters.status = req.query.status;
        }
        
        // Filtro por si fue enviado por correo
        if (req.query.emailSended !== undefined) {
            filters.emailSended = req.query.emailSended === 'true' || req.query.emailSended === true;
        }
        
        // Filtro por certificado (ID del certificado)
        if (req.query.certificado) {
            filters.certificado = req.query.certificado;
        }
        
        // Filtro por búsqueda en subject (documento, nombre o correo)
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i'); // Case insensitive
            filters.$or = [
                { 'subject.documento': searchRegex },
                { 'subject.nombreCompleto': searchRegex },
                { 'subject.correo': searchRegex }
            ];
        }
        
        // Filtro específico por documento
        if (req.query.documento) {
            filters['subject.documento'] = new RegExp(req.query.documento, 'i');
        }
        
        // Filtro específico por nombre completo
        if (req.query.nombreCompleto) {
            filters['subject.nombreCompleto'] = new RegExp(req.query.nombreCompleto, 'i');
        }
        
        // Filtro específico por correo
        if (req.query.correo) {
            filters['subject.correo'] = new RegExp(req.query.correo, 'i');
        }
        
        const [items, total] = await Promise.all([
            Emision.find(filters).skip(skip).limit(limit).populate('certificado').sort({ fechaEmision: -1 }),
            Emision.countDocuments(filters)
        ]);
        
        res.json({ 
            items, 
            total, 
            page, 
            pages: Math.ceil(total / limit),
            filters: filters // Devolver filtros aplicados para referencia
        });
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
        const { doc, fullname, certificado_id, description, datestring, correo, ...dynamicFields } = req.body;
        
        // Validaciones
        if (!doc || !fullname || !certificado_id || !correo) {
            return res.status(400).json({ 
                error: 'Campos requeridos: doc, fullname, certificado_id, correo' 
            });
        }
        
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo)) {
            return res.status(400).json({ 
                error: 'El formato del correo electrónico no es válido' 
            });
        }
        
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
                nombreCompleto: fullname,
                correo: correo
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

        // Preparar datos dinámicos para el PDF
        const data = {
            subject: fullname,
            dateString: datestring,
            date: datestring,
            fullname: fullname,
            doc: doc,
            documento: doc,
            correo: correo,
            email: correo,
            ...dynamicFields // Agregar todos los campos adicionales
        };
        
        console.log('Generando PDF con datos dinámicos:', data);

        const resultSavePath = await generateCertificadoPdf({
            templatePath,
            paginas: certificado.paginas,
            data, // Usar el objeto data en lugar de campos individuales
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

        const resultSignedPath = await signPdf(resultSavePath, certPath, resultSavePath.replace('.pdf', '-signed.pdf'), certificado.dependencia.clave);

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

exports.create_ethers = async (req, res) => {
    try {
        const { doc, fullname, certificado_id, description, datestring, emite, correo, ...dynamicFields } = req.body;
        
        // Validaciones
        if (!doc || !fullname || !certificado_id || !emite || !correo) {
            return res.status(400).json({ 
                error: 'Campos requeridos: doc, fullname, certificado_id, emite, correo' 
            });
        }
        
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo)) {
            return res.status(400).json({ 
                error: 'El formato del correo electrónico no es válido' 
            });
        }
        
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
                nombreCompleto: fullname,
                correo: correo
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

        // Preparar datos dinámicos para el PDF
        const data = {
            subject: fullname,
            dateString: datestring,
            date: datestring,
            fullname: fullname,
            doc: doc,
            documento: doc,
            correo: correo,
            email: correo,
            emite: emite,
            ...dynamicFields // Agregar todos los campos adicionales
        };
        
        console.log('Generando PDF con datos dinámicos (ethers):', data);

        const resultSavePath = await generateCertificadoPdf({
            templatePath,
            paginas: certificado.paginas,
            data, // Usar el objeto data en lugar de campos individuales
            qrdata: `${process.env.APP_URI}/landing/${nueva._id}`,
            savePath
        });

        // Generar imagen JPEG de la primera página usando pdftoppm
        const imgDir = path.join(__dirname, '..', 'storage', 'img');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        const imgBase = path.join(imgDir, uuid);
        const { execSync } = require('child_process');
        try {
            execSync(`pdftoppm -jpeg -f 1 -l 1 "${resultSavePath}" "${imgBase}"`);
            const imagePath = `${imgBase}-1.jpg`;
            // Verificar que la imagen se generó correctamente
            if (!fs.existsSync(imagePath)) {
                console.warn(`⚠️ Advertencia: La imagen no se generó correctamente en ${imagePath}`);
            } else {
                console.log(`✅ Imagen generada exitosamente: ${imagePath}`);
            }
        } catch (err) {
            console.error(`❌ Error generando imagen JPEG: ${err.message}`);
            console.error(`Comando ejecutado: pdftoppm -jpeg -f 1 -l 1 "${resultSavePath}" "${imgBase}"`);
            throw new Error(`No se pudo generar la imagen JPEG: ${err.message}`);
        }

        const resultSignedPath = await signPdf(resultSavePath, certPath, resultSavePath.replace('.pdf', '-signed.pdf'), certificado.dependencia.clave);

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
        nueva.status = 'procesando';

        await nueva.save();

        // Agregar a la cola de blockchain de manera asíncrona
        const blockchainQueue = getBlockchainQueue();
        const jobId = await blockchainQueue.addToQueue(
            nueva._id,
            emite,
            certificado.titulo,
            nueva.jsonPath
        );

        console.log(`📤 Emisión ${nueva._id} agregada a la cola de blockchain con job ID: ${jobId}`);
        console.log(`📸 Imagen disponible en: ${nueva.imagePath}`);

        // Responder inmediatamente sin esperar la transacción
        res.status(201).json({
            ...nueva.toObject(),
            message: 'Emisión creada exitosamente. La transacción blockchain se está procesando en segundo plano.',
            blockchainJobId: jobId,
            status: 'procesando'
        });

    } catch (err) {
        console.error('Error en create_ethers:', err);
        res.status(400).json({ error: err.message });
    }
};

exports.balance = async (req, res) => {
    try {
        const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
        const PRIVATE_KEY = process.env.PRIVATE_KEY;

        if (!PRIVATE_KEY) {
            return res.status(400).json({ error: 'PRIVATE_KEY no está configurada' });
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        const balance = await provider.getBalance(wallet.address);
        res.status(200).json({
            address: wallet.address,
            balance: ethers.formatEther(balance) + " POL"
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.update = async (req, res) => {
    try {
        const actualizada = await Emision.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!actualizada) return res.status(404).json({ error: 'No encontrada' });
        res.json(actualizada);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

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

// Obtener estadísticas de la cola de blockchain
exports.getBlockchainQueueStats = async (req, res) => {
    try {
        const blockchainQueue = getBlockchainQueue();
        const stats = blockchainQueue.getQueueStats();
        
        // Obtener estadísticas de emisiones por estado
        const emisionStats = await Emision.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const emisionsByStatus = emisionStats.reduce((acc, stat) => {
            acc[stat._id || 'sin_estado'] = stat.count;
            return acc;
        }, {});

        res.json({
            success: true,
            queue: stats,
            emissions: {
                byStatus: emisionsByStatus,
                total: Object.values(emisionsByStatus).reduce((sum, count) => sum + count, 0)
            },
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Error obteniendo estadísticas de cola:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error al obtener estadísticas de blockchain',
            details: err.message 
        });
    }
};

// Reenviar una emisión al blockchain
exports.retryBlockchainTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const emision = await Emision.findById(id);
        
        if (!emision) {
            return res.status(404).json({ 
                success: false,
                error: 'Emisión no encontrada' 
            });
        }

        if (emision.status === 'completado') {
            return res.status(400).json({ 
                success: false,
                error: 'La emisión ya está completada' 
            });
        }

        const certificado = await Certificado.findById(emision.certificado);
        if (!certificado) {
            return res.status(404).json({ 
                success: false,
                error: 'Certificado asociado no encontrado' 
            });
        }

        // Agregar nuevamente a la cola
        const blockchainQueue = getBlockchainQueue();
        const jobId = await blockchainQueue.addToQueue(
            emision._id,
            req.body.emite || 'retry',
            certificado.titulo,
            emision.jsonPath
        );

        // Actualizar estado
        emision.status = 'reintentando';
        await emision.save();

        res.json({
            success: true,
            message: 'Emisión reagendada para procesamiento blockchain',
            emisionId: emision._id,
            blockchainJobId: jobId
        });

    } catch (err) {
        console.error('Error reintentando transacción blockchain:', err);
        res.status(500).json({ 
            success: false,
            error: 'Error al reintentar transacción blockchain',
            details: err.message 
        });
    }
};

exports.forceCheckTransaction = async (req, res) => {
    try {
        const { emisionId } = req.params;
        
        // Buscar la emisión
        const emision = await Emision.findById(emisionId);
        if (!emision) {
            return res.status(404).json({ error: 'Emisión no encontrada' });
        }
        
        if (!emision.transactionId) {
            return res.status(400).json({ error: 'Emisión no tiene transaction ID' });
        }
        
        console.log(`🔍 Verificación manual solicitada para emisión ${emisionId}, TX: ${emision.transactionId}`);
        
        // Crear un job de monitoreo forzado
        const blockchainQueue = getBlockchainQueue();
        const jobId = blockchainQueue.addMonitoringJob(emisionId, emision.transactionId);
        
        res.json({
            success: true,
            message: 'Verificación de transacción iniciada',
            emisionId,
            transactionId: emision.transactionId,
            currentStatus: emision.status,
            monitoringJobId: jobId
        });
        
    } catch (error) {
        console.error('Error en forceCheckTransaction:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getEmisionStatus = async (req, res) => {
    try {
        const { emisionId } = req.params;
        
        const emision = await Emision.findById(emisionId);
        if (!emision) {
            return res.status(404).json({ error: 'Emisión no encontrada' });
        }
        
        // También obtener info del blockchain si hay transaction ID
        let blockchainInfo = null;
        if (emision.transactionId) {
            try {
                const { ethers } = require('ethers');
                const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
                const provider = new ethers.JsonRpcProvider(RPC_URL);
                
                const receipt = await provider.getTransactionReceipt(emision.transactionId);
                const transaction = await provider.getTransaction(emision.transactionId);
                
                blockchainInfo = {
                    transactionExists: !!transaction,
                    isConfirmed: !!receipt,
                    status: receipt?.status,
                    blockNumber: receipt?.blockNumber,
                    gasUsed: receipt?.gasUsed?.toString(),
                    confirmations: receipt ? await provider.getBlockNumber() - receipt.blockNumber : 0
                };
            } catch (blockchainError) {
                blockchainInfo = { error: blockchainError.message };
            }
        }
        
        res.json({
            emision: {
                id: emision._id,
                status: emision.status,
                transactionId: emision.transactionId,
                updatedAt: emision.updatedAt,
                subject: emision.subject
            },
            blockchain: blockchainInfo
        });
        
    } catch (error) {
        console.error('Error en getEmisionStatus:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getProcessingEmissions = async (req, res) => {
    try {
        const processingEmissions = await Emision.find({ 
            status: 'procesando',
            transactionId: { $exists: true, $ne: null }
        }).sort({ updatedAt: -1 });
        
        console.log(`🔍 Encontradas ${processingEmissions.length} emisiones en estado procesando con transaction ID`);
        
        const results = [];
        for (const emision of processingEmissions) {
            let blockchainStatus = 'unknown';
            try {
                const { ethers } = require('ethers');
                const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
                const provider = new ethers.JsonRpcProvider(RPC_URL);
                
                const receipt = await provider.getTransactionReceipt(emision.transactionId);
                if (receipt) {
                    blockchainStatus = receipt.status === 1 ? 'confirmed' : 'failed';
                } else {
                    blockchainStatus = 'pending';
                }
            } catch (error) {
                blockchainStatus = `error: ${error.message}`;
            }
            
            results.push({
                id: emision._id,
                transactionId: emision.transactionId,
                subject: emision.subject,
                updatedAt: emision.updatedAt,
                blockchainStatus
            });
        }
        
        res.json({
            count: results.length,
            emissions: results
        });
        
    } catch (error) {
        console.error('Error en getProcessingEmissions:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Obtener emisiones pendientes de blockchain (sin transactionId)
 */
exports.getPendingBlockchain = async (req, res) => {
    try {
        // Buscar emisiones que no tienen transactionId o está vacío
        const pendingEmissions = await Emision.find({
            $or: [
                { transactionId: null },
                { transactionId: '' },
                { transactionId: '-' },
                { transactionId: { $exists: false } }
            ],
            status: { $nin: ['completado'] } // Excluir las que ya están completadas
        })
        .populate('certificado')
        .sort({ fechaEmision: -1 });

        res.json({
            success: true,
            count: pendingEmissions.length,
            emissions: pendingEmissions.map(e => ({
                id: e._id,
                uuid: e.uuid,
                subject: e.subject,
                status: e.status,
                certificado: e.certificado?.titulo || 'N/A',
                fechaEmision: e.fechaEmision,
                jsonPath: e.jsonPath
            }))
        });

    } catch (error) {
        console.error('Error en getPendingBlockchain:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reenviar UNA emisión específica al blockchain
 */
exports.resendToBlockchain = async (req, res) => {
    try {
        const { id } = req.params;
        const { emite } = req.body;

        const emision = await Emision.findById(id).populate('certificado');
        
        if (!emision) {
            return res.status(404).json({ 
                success: false,
                error: 'Emisión no encontrada' 
            });
        }

        // Verificar que tiene los datos necesarios
        if (!emision.jsonPath || emision.jsonPath === '-') {
            return res.status(400).json({ 
                success: false,
                error: 'La emisión no tiene jsonPath válido' 
            });
        }

        if (!emision.certificado) {
            return res.status(400).json({ 
                success: false,
                error: 'La emisión no tiene certificado asociado' 
            });
        }

        // Agregar a la cola de blockchain
        const blockchainQueue = getBlockchainQueue();
        const jobId = await blockchainQueue.addToQueue(
            emision._id,
            emite || 'resend',
            emision.certificado.titulo,
            emision.jsonPath
        );

        // Actualizar estado
        emision.status = 'procesando';
        await emision.save();

        console.log(`📤 Emisión ${emision._id} reenviada al blockchain con job ID: ${jobId}`);

        res.json({
            success: true,
            message: 'Emisión reenviada al blockchain',
            emisionId: emision._id,
            blockchainJobId: jobId
        });

    } catch (error) {
        console.error('Error en resendToBlockchain:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

/**
 * Reenviar TODAS las emisiones pendientes al blockchain
 */
exports.resendAllPendingToBlockchain = async (req, res) => {
    try {
        const { emite } = req.body;
        const { limit } = req.query; // Opcional: limitar cuántas procesar

        // Buscar emisiones que no tienen transactionId o está vacío
        let query = Emision.find({
            $or: [
                { transactionId: null },
                { transactionId: '' },
                { transactionId: '-' },
                { transactionId: { $exists: false } }
            ],
            status: { $nin: ['completado'] }
        }).populate('certificado');

        // Aplicar límite si se especifica
        if (limit) {
            query = query.limit(parseInt(limit));
        }

        const pendingEmissions = await query.sort({ fechaEmision: -1 });

        if (pendingEmissions.length === 0) {
            return res.json({
                success: true,
                message: 'No hay emisiones pendientes de blockchain',
                processed: 0,
                failed: 0
            });
        }

        const blockchainQueue = getBlockchainQueue();
        const results = {
            processed: [],
            failed: []
        };

        for (const emision of pendingEmissions) {
            try {
                // Verificar datos necesarios
                if (!emision.jsonPath || emision.jsonPath === '-') {
                    results.failed.push({
                        id: emision._id,
                        error: 'Sin jsonPath válido'
                    });
                    continue;
                }

                if (!emision.certificado) {
                    results.failed.push({
                        id: emision._id,
                        error: 'Sin certificado asociado'
                    });
                    continue;
                }

                // Agregar a la cola de blockchain
                const jobId = await blockchainQueue.addToQueue(
                    emision._id,
                    emite || 'resend-batch',
                    emision.certificado.titulo,
                    emision.jsonPath
                );

                // Actualizar estado
                emision.status = 'procesando';
                await emision.save();

                results.processed.push({
                    id: emision._id,
                    subject: emision.subject?.nombreCompleto,
                    jobId: jobId
                });

                console.log(`📤 Emisión ${emision._id} agregada a cola de blockchain (job: ${jobId})`);

            } catch (error) {
                results.failed.push({
                    id: emision._id,
                    error: error.message
                });
            }
        }

        console.log(`✅ Procesamiento masivo completado: ${results.processed.length} enviadas, ${results.failed.length} fallidas`);

        res.json({
            success: true,
            message: `${results.processed.length} emisiones enviadas a la cola de blockchain`,
            processed: results.processed.length,
            failed: results.failed.length,
            details: {
                processed: results.processed,
                failed: results.failed
            }
        });

    } catch (error) {
        console.error('Error en resendAllPendingToBlockchain:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

/**
 * Obtener emisiones con transactionId pero no confirmadas
 */
exports.getUnconfirmedTransactions = async (req, res) => {
    try {
        // Buscar emisiones que tienen transactionId pero no están completadas
        const unconfirmedEmissions = await Emision.find({
            transactionId: { $exists: true, $nin: [null, '', '-'] },
            status: { $nin: ['completado', 'error'] }
        })
        .populate('certificado')
        .sort({ updatedAt: -1 });

        res.json({
            success: true,
            count: unconfirmedEmissions.length,
            emissions: unconfirmedEmissions.map(e => ({
                id: e._id,
                uuid: e.uuid,
                subject: e.subject,
                status: e.status,
                transactionId: e.transactionId,
                certificado: e.certificado?.titulo || 'N/A',
                fechaEmision: e.fechaEmision,
                updatedAt: e.updatedAt
            }))
        });

    } catch (error) {
        console.error('Error en getUnconfirmedTransactions:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Verificar y confirmar UNA transacción específica
 */
exports.verifyAndConfirmTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const emision = await Emision.findById(id);
        
        if (!emision) {
            return res.status(404).json({ 
                success: false,
                error: 'Emisión no encontrada' 
            });
        }

        if (!emision.transactionId || emision.transactionId === '-' || emision.transactionId === '') {
            return res.status(400).json({ 
                success: false,
                error: 'La emisión no tiene transactionId' 
            });
        }

        if (emision.status === 'completado') {
            return res.json({
                success: true,
                message: 'La emisión ya está confirmada',
                emisionId: emision._id,
                transactionId: emision.transactionId,
                status: emision.status
            });
        }

        // Verificar en blockchain
        const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        console.log(`🔍 Verificando transacción ${emision.transactionId} para emisión ${emision._id}`);

        const receipt = await provider.getTransactionReceipt(emision.transactionId);

        if (receipt) {
            if (receipt.status === 1) {
                // Transacción confirmada exitosamente
                emision.status = 'completado';
                await emision.save();

                console.log(`✅ Emisión ${emision._id} confirmada. Block: ${receipt.blockNumber}`);

                return res.json({
                    success: true,
                    message: 'Transacción confirmada exitosamente',
                    emisionId: emision._id,
                    transactionId: emision.transactionId,
                    status: 'completado',
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed?.toString()
                });
            } else {
                // Transacción falló en blockchain
                emision.status = 'error';
                await emision.save();

                return res.json({
                    success: false,
                    message: 'La transacción falló en el blockchain',
                    emisionId: emision._id,
                    transactionId: emision.transactionId,
                    status: 'error',
                    blockNumber: receipt.blockNumber
                });
            }
        } else {
            // Transacción aún pendiente
            return res.json({
                success: false,
                message: 'La transacción aún no ha sido confirmada (pendiente en blockchain)',
                emisionId: emision._id,
                transactionId: emision.transactionId,
                status: emision.status
            });
        }

    } catch (error) {
        console.error('Error en verifyAndConfirmTransaction:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

/**
 * Verificar y confirmar TODAS las transacciones pendientes
 */
exports.verifyAndConfirmAllTransactions = async (req, res) => {
    try {
        const { limit } = req.query;

        // Buscar emisiones con transactionId pero no completadas
        let query = Emision.find({
            transactionId: { $exists: true, $nin: [null, '', '-'] },
            status: { $nin: ['completado', 'error'] }
        });

        if (limit) {
            query = query.limit(parseInt(limit));
        }

        const unconfirmedEmissions = await query.sort({ updatedAt: -1 });

        if (unconfirmedEmissions.length === 0) {
            return res.json({
                success: true,
                message: 'No hay transacciones pendientes de verificar',
                confirmed: 0,
                failed: 0,
                pending: 0
            });
        }

        const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        const results = {
            confirmed: [],
            failed: [],
            pending: []
        };

        console.log(`🔍 Verificando ${unconfirmedEmissions.length} transacciones pendientes...`);

        for (const emision of unconfirmedEmissions) {
            try {
                const receipt = await provider.getTransactionReceipt(emision.transactionId);

                if (receipt) {
                    if (receipt.status === 1) {
                        // Confirmada
                        emision.status = 'completado';
                        await emision.save();

                        results.confirmed.push({
                            id: emision._id,
                            transactionId: emision.transactionId,
                            subject: emision.subject?.nombreCompleto,
                            blockNumber: receipt.blockNumber
                        });

                        console.log(`✅ Emisión ${emision._id} confirmada`);
                    } else {
                        // Falló
                        emision.status = 'error';
                        await emision.save();

                        results.failed.push({
                            id: emision._id,
                            transactionId: emision.transactionId,
                            subject: emision.subject?.nombreCompleto,
                            reason: 'Transaction reverted'
                        });

                        console.log(`❌ Emisión ${emision._id} falló en blockchain`);
                    }
                } else {
                    // Aún pendiente
                    results.pending.push({
                        id: emision._id,
                        transactionId: emision.transactionId,
                        subject: emision.subject?.nombreCompleto
                    });

                    console.log(`⏳ Emisión ${emision._id} aún pendiente`);
                }

                // Pausa para no saturar el RPC
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                results.failed.push({
                    id: emision._id,
                    transactionId: emision.transactionId,
                    error: error.message
                });
            }
        }

        console.log(`✅ Verificación completada: ${results.confirmed.length} confirmadas, ${results.failed.length} fallidas, ${results.pending.length} pendientes`);

        res.json({
            success: true,
            message: `Verificación completada`,
            confirmed: results.confirmed.length,
            failed: results.failed.length,
            pending: results.pending.length,
            details: results
        });

    } catch (error) {
        console.error('Error en verifyAndConfirmAllTransactions:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};