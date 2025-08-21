const mongoose = require('mongoose');

const DependenciaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  certificadodigital: {
    type: String,
    required: true // ruta o referencia al certificado digital
  }
});

module.exports = mongoose.model('Dependencia', DependenciaSchema);
