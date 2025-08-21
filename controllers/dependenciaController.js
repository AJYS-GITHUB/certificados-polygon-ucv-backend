const Dependencia = require('../models/Dependencia');

// Obtener todas las dependencias con paginación
exports.getAll = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Dependencia.find().skip(skip).limit(limit),
      Dependencia.countDocuments()
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

// Obtener una dependencia por ID
exports.getById = async (req, res) => {
  try {
    const dependencia = await Dependencia.findById(req.params.id);
    if (!dependencia) return res.status(404).json({ error: 'No encontrada' });
    res.json(dependencia);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Crear una nueva dependencia
exports.create = async (req, res) => {
  try {
    const nueva = new Dependencia(req.body);
    await nueva.save();
    res.status(201).json(nueva);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Actualizar una dependencia
exports.update = async (req, res) => {
  try {
    const actualizada = await Dependencia.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!actualizada) return res.status(404).json({ error: 'No encontrada' });
    res.json(actualizada);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Eliminar una dependencia
exports.delete = async (req, res) => {
  try {
    const eliminada = await Dependencia.findByIdAndDelete(req.params.id);
    if (!eliminada) return res.status(404).json({ error: 'No encontrada' });
    res.json({ mensaje: 'Dependencia eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
