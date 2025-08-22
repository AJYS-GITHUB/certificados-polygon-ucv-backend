const mongoose = require('mongoose');

const EmisionSchema = new mongoose.Schema({
  certificado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificado',
    required: true
  },
  uuid: { type: String, required: true },
  subject: {
    documento: { type: String, required: true },
    nombreCompleto: { type: String, required: true }
  },
  fechaEmision: {
    type: Date,
    required: true
  },
  pdfHash: {
    type: String,
    required: true
  },
  pdfPath: {
    type: String,
    required: true
  },
  jsonPath: {
    type: String,
    required: true
  },
  imagePath: {
    type: String,
    required: true
  },
  emailSended: {
    type: Boolean,
    default: false
  },
  transactionId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pendiente', 'completado', 'error', 'revocado'],
    default: 'pendiente'
  }
});

module.exports = mongoose.model('Emision', EmisionSchema);
