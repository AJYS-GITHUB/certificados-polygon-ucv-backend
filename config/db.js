// Configuración de la base de datos (ejemplo para MongoDB)
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB conectado');
  } catch (err) {
    console.error('Error de conexión:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
