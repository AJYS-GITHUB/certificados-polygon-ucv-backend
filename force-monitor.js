const mongoose = require('mongoose');
const { getBlockchainQueue } = require('./utils/blockchainQueue');
const Emision = require('./models/Emision');

// Conectar a MongoDB
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function forceMonitorCheck() {
    try {
        console.log('🔍 Buscando emisiones en estado procesando...');
        
        const processingEmissions = await Emision.find({ 
            status: 'procesando',
            transactionId: { $exists: true, $ne: null }
        });
        
        console.log(`Encontradas ${processingEmissions.length} emisiones en estado procesando`);
        
        for (const emision of processingEmissions) {
            console.log(`\n📋 Procesando emisión: ${emision._id}`);
            console.log(`📋 Transaction ID: ${emision.transactionId}`);
            
            // Crear un job de monitoreo manual
            const queue = getBlockchainQueue();
            const jobId = queue.addMonitoringJob(emision._id.toString(), emision.transactionId);
            
            console.log(`👁️ Job de monitoreo ${jobId} creado para emisión ${emision._id}`);
        }
        
        // Esperar unos segundos para que el monitoreo se ejecute
        console.log('\n⏳ Esperando 10 segundos para que se procese el monitoreo...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log('\n✅ Monitoreo iniciado. Cerrando script...');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

forceMonitorCheck();