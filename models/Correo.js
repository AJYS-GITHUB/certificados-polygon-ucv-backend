const mongoose = require('mongoose');

const CorreoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  asunto: {
    type: String,
    required: true,
    trim: true
  },
  contenidoHtml: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  cc: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      },
      message: 'Todos los CC deben ser emails válidos'
    }
  },
  cco: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      },
      message: 'Todos los CCO deben ser emails válidos'
    }
  },
  assets: [{
    nombre: String,
    url: String,
    tipo: String, // 'imagen', 'css', 'otro'
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  variables: [{
    nombre: String,
    descripcion: String,
    ejemplo: String
  }],
  activo: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Actualizar updatedAt antes de guardar
CorreoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Correo', CorreoSchema);
