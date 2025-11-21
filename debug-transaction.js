const mongoose = require('mongoose');
const { getBlockchainQueue } = require('./utils/blockchainQueue');
const Emision = require('./models/Emision');

// Conectar a MongoDB
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function debugTransaction() {
    try {
        console.log('🔍 Buscando emisiones en estado procesando...');
        
        const processingEmissions = await Emision.find({ 
            status: 'procesando',
            transactionId: { $exists: true, $ne: null }
        });
        
        console.log(`Encontradas ${processingEmissions.length} emisiones en estado procesando`);
        
        if (processingEmissions.length > 0) {
            const emision = processingEmissions[0];
            console.log(`\n📋 Emisión: ${emision._id}`);
            console.log(`📋 Transaction ID: ${emision.transactionId}`);
            console.log(`📋 Estado: ${emision.status}`);
            console.log(`📋 Última actualización: ${emision.updatedAt}`);
            
            // Verificar en blockchain
            const { ethers } = require('ethers');
            const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            
            console.log('\n🔗 Verificando en blockchain...');
            const receipt = await provider.getTransactionReceipt(emision.transactionId);
            
            if (receipt) {
                console.log(`✅ Transacción encontrada en blockchain`);
                console.log(`📊 Status: ${receipt.status}`);
                console.log(`📊 Block: ${receipt.blockNumber}`);
                console.log(`📊 Gas usado: ${receipt.gasUsed?.toString()}`);
                
                if (receipt.status === 1) {
                    console.log('\n🎯 La transacción está confirmada. Actualizando estado...');
                    
                    // Actualizar directamente
                    const updated = await Emision.findByIdAndUpdate(
                        emision._id,
                        {
                            status: 'completado',
                            updatedAt: new Date()
                        },
                        { new: true }
                    );
                    
                    if (updated) {
                        console.log(`✅ Estado actualizado correctamente a: ${updated.status}`);
                    } else {
                        console.log(`❌ Error actualizando el estado`);
                    }
                }
            } else {
                console.log(`⏳ Transacción no confirmada aún`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

debugTransaction();