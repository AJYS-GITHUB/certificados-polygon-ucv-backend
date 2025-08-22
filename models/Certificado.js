const mongoose = require('mongoose');

const CertificadoSchema = new mongoose.Schema({
  dependencia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dependencia',
    required: true
  },
  titulo: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true,
    default: ''
  },
  contractUrl:{
    type: String,
    required: true,
    default: ''
  },
  paginas: [
    {
      numero: { type: Number, required: true },
      contenido: { type: String, required: true },
      font: { type: String, required: true },
      fontSize: { type: Number, required: true },
      color: { type: String, required: true },
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    }
  ]
});

module.exports = mongoose.model('Certificado', CertificadoSchema);
