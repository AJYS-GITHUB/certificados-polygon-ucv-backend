const express = require('express');
const Emision = require('../models/Emision');
const router = express.Router();


router.get('/:id', async (req, res) => {
    try {
        // Popula certificado y su dependencia
        const emision = await Emision.findById(req.params.id)
            .populate({
                path: 'certificado',
                populate: { path: 'dependencia' }
            });

        if (!emision) return res.status(404).json({ error: 'No encontrada' });

        const emisionObj = emision.toObject();

        // Eliminar 'paginas' y 'filename' de certificado
        if (emisionObj.certificado) {
            delete emisionObj.certificado.paginas;
            delete emisionObj.certificado.filename;

            // Eliminar 'certificadodigital' de dependencia
            if (emisionObj.certificado.dependencia) {
                delete emisionObj.certificado.dependencia.certificadodigital;
            }
        }

        res.json(emisionObj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
