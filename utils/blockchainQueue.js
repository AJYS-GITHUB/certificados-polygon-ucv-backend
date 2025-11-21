const { ethers } = require('ethers');
const Emision = require('../models/Emision');
const abi = require('../config/abi.json');

class BlockchainQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 segundos
        this.processingInterval = null;
        
        // Inicializar el procesador de cola
        this.startProcessing();
        
        console.log('✓ BlockchainQueue inicializada');
    }

    /**
     * Agregar una emisión a la cola de blockchain
     */
    async addToQueue(emisionId, emite, titulo, jsonPath, retryCount = 0) {
        const job = {
            id: Date.now() + Math.random(),
            emisionId,
            emite,
            titulo,
            jsonPath,
            retryCount,
            createdAt: new Date(),
            status: 'pending'
        };

        this.queue.push(job);
        console.log(`📤 Job ${job.id} agregado a la cola de blockchain (Emisión: ${emisionId})`);
        
        // Iniciar procesamiento si no está activo
        if (!this.processing) {
            this.processQueue();
        }
        
        return job.id;
    }

    /**
     * Iniciar el procesamiento automático de la cola
     */
    startProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        
        // Procesar cada 10 segundos
        this.processingInterval = setInterval(() => {
            if (!this.processing && this.queue.length > 0) {
                this.processQueue();
            }
        }, 10000);
    }

    /**
     * Procesar la cola de trabajos de blockchain
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            if (this.processing) {
                console.log('⚠️ Cola ya está siendo procesada, saltando...');
            }
            return;
        }

        this.processing = true;
        console.log(`🔄 Procesando cola de blockchain (${this.queue.length} trabajos pendientes)`);

        while (this.queue.length > 0) {
            const job = this.queue.shift();
            
            console.log(`📋 Procesando job: ${job.id}, tipo: ${job.type}, emisión: ${job.emisionId || 'N/A'}`);
            
            try {
                if (job.type === 'monitor') {
                    // Procesar job de monitoreo
                    console.log(`👁️ Procesando job de monitoreo ${job.id} para emisión ${job.emisionId}, TX ${job.transactionHash}`);
                    
                    const completed = await this.processMonitoringJob(job);
                    if (completed) {
                        console.log(`✅ Job de monitoreo ${job.id} completado`);
                    } else {
                        console.log(`🔄 Job de monitoreo ${job.id} reagendado`);
                    }
                } else {
                    // Procesar job normal de blockchain
                    console.log(`⚡ Procesando job ${job.id} para emisión ${job.emisionId}`);
                    
                    // Actualizar estado de la emisión
                    await this.updateEmisionStatus(job.emisionId, 'procesando', 
                        `Enviando transacción al blockchain (intento ${job.retryCount + 1})`);
                    
                    // Ejecutar transacción de blockchain
                    const txHash = await this.executeBlockchainTransaction(job);
                    
                    // Si llegamos aquí, la transacción fue enviada exitosamente
                    // (puede estar confirmada o en estado de monitoreo)
                    if (txHash) {
                        console.log(`✅ Job ${job.id} procesado. TX: ${txHash}`);
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error en job ${job.id}:`, error.message);
                
                // Solo aplicar lógica de reintentos para jobs normales (no de monitoreo)
                if (job.type !== 'monitor') {
                    // Reintentar si no se han agotado los intentos
                    if (job.retryCount < this.maxRetries) {
                        job.retryCount++;
                        job.status = 'retrying';
                        
                        // Agregar de vuelta a la cola después de un delay
                        setTimeout(() => {
                            this.queue.push(job);
                            console.log(`🔄 Job ${job.id} reagendado para reintento ${job.retryCount}/${this.maxRetries}`);
                        }, this.retryDelay);
                        
                        await this.updateEmisionStatus(job.emisionId, 'reintentando', 
                            `Error en blockchain, reintentando... (${job.retryCount}/${this.maxRetries}): ${error.message}`);
                    } else {
                        // Fallar permanentemente
                        await this.updateEmisionStatus(job.emisionId, 'error', 
                            `Error permanente en blockchain después de ${this.maxRetries} intentos: ${error.message}`);
                        
                        console.error(`💀 Job ${job.id} falló permanentemente después de ${this.maxRetries} intentos`);
                    }
                } else {
                    // Para jobs de monitoreo, el error ya se maneja dentro de processMonitoringJob
                    console.error(`💀 Job de monitoreo ${job.id} falló: ${error.message}`);
                }
            }
            
            // Pausa pequeña entre trabajos
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.processing = false;
        console.log('✅ Cola de blockchain procesada completamente');
    }

    /**
     * Ejecutar la transacción en el blockchain
     */
    async executeBlockchainTransaction(job) {
        const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
        const PRIVATE_KEY = process.env.PRIVATE_KEY;
        const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

        if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
            throw new Error('Configuración de blockchain incompleta (PRIVATE_KEY o CONTRACT_ADDRESS)');
        }

        // Configurar provider y contrato
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

        // Validar parámetros
        if (!wallet.address) {
            throw new Error('Wallet address is undefined');
        }
        if (!job.emite) {
            throw new Error('Emite parameter is undefined');
        }
        if (!job.titulo) {
            throw new Error('Certificate title is undefined');
        }
        if (!job.jsonPath) {
            throw new Error('JSON path is undefined');
        }

        console.log('🔗 Enviando transacción al blockchain:', {
            wallet: wallet.address,
            emite: job.emite,
            titulo: job.titulo,
            jsonPath: job.jsonPath,
            rpc: RPC_URL
        });

        // Enviar transacción
        const tx = await contract.mintNFT(wallet.address, job.emite, job.titulo, job.jsonPath);
        console.log('📡 Transacción enviada. Hash:', tx.hash);

        // Guardar transaction ID inmediatamente (sin esperar confirmación)
        await this.updateEmisionStatus(job.emisionId, 'procesando', 
            'Transacción enviada, esperando confirmación...', tx.hash);

        // Intentar confirmar con timeout configurable
        const confirmationTimeout = parseInt(process.env.BLOCKCHAIN_CONFIRMATION_TIMEOUT) || 300000; // 5 minutos por defecto
        
        try {
            console.log(`⏳ Esperando confirmación de transacción ${tx.hash} (timeout: ${confirmationTimeout/1000}s)`);
            
            const receipt = await Promise.race([
                tx.wait(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('CONFIRMATION_TIMEOUT')), confirmationTimeout)
                )
            ]);

            console.log('✅ Transacción confirmada:', receipt.transactionHash);
            
            // Actualizar estado a completado cuando se confirma exitosamente
            await this.updateEmisionStatus(job.emisionId, 'completado', 
                'Transacción confirmada exitosamente', receipt.transactionHash);
                
            return receipt.transactionHash;

        } catch (confirmationError) {
            if (confirmationError.message === 'CONFIRMATION_TIMEOUT') {
                console.log(`⏰ Timeout esperando confirmación de ${tx.hash}. Dejando transacción pendiente para monitoreo posterior.`);
                
                // Actualizar estado pero mantener como "procesando" ya que la TX fue enviada
                await this.updateEmisionStatus(job.emisionId, 'procesando', 
                    `Transacción enviada (${tx.hash}) pero confirmación demorada. Monitoreando...`, tx.hash);
                
                // Agregar job de monitoreo para verificar después
                this.addMonitoringJob(job.emisionId, tx.hash);
                
                // Retornar el hash aunque no esté confirmado aún
                return tx.hash;
            } else {
                // Error real de confirmación (transacción falló)
                console.error('❌ Error confirmando transacción:', confirmationError.message);
                
                await this.updateEmisionStatus(job.emisionId, 'error', 
                    `Transacción enviada pero falló la confirmación: ${confirmationError.message}`, tx.hash);
                
                throw confirmationError;
            }
        }
    }

    /**
     * Agregar job de monitoreo para transacciones pendientes
     */
    addMonitoringJob(emisionId, transactionHash) {
        const monitoringJob = {
            id: `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'monitor',
            emisionId,
            transactionHash,
            createdAt: new Date(),
            status: 'monitoring',
            checkAttempts: 0,
            maxCheckAttempts: 20 // Verificar hasta 20 veces (aproximadamente 3.5 horas)
        };

        this.queue.push(monitoringJob);
        console.log(`👁️ Job de monitoreo ${monitoringJob.id} agregado para TX ${transactionHash}. Cola actual: ${this.queue.length} jobs`);
        
        // Asegurarse de que el procesamiento está activo
        if (!this.isProcessing) {
            console.log(`🔄 Reiniciando procesamiento de cola...`);
            this.processQueue();
        }
        
        return monitoringJob.id;
    }

    /**
     * Procesar job de monitoreo de transacciones
     */
    async processMonitoringJob(job) {
        try {
            const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            
            console.log(`🔍 Verificando estado de transacción ${job.transactionHash} para emisión ${job.emisionId} (intento ${job.checkAttempts + 1}/${job.maxCheckAttempts})`);
            
            const receipt = await provider.getTransactionReceipt(job.transactionHash);
            
            if (receipt) {
                console.log(`📋 Receipt obtenido para TX ${job.transactionHash}:`, {
                    status: receipt.status,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed?.toString()
                });

                if (receipt.status === 1) {
                    // Transacción confirmada exitosamente
                    console.log(`🎉 Transacción ${job.transactionHash} confirmada exitosamente en bloque ${receipt.blockNumber}`);
                    
                    const updatedEmision = await this.updateEmisionStatus(job.emisionId, 'completado', 
                        'Transacción confirmada exitosamente', job.transactionHash);
                    
                    if (updatedEmision) {
                        console.log(`✅ Emisión ${job.emisionId} marcada como completada exitosamente`);
                    } else {
                        console.error(`❌ Error al actualizar emisión ${job.emisionId} a estado completado`);
                    }
                    
                    return true; // Job completado exitosamente
                } else {
                    // Transacción falló
                    console.log(`💥 Transacción ${job.transactionHash} falló (status: ${receipt.status})`);
                    
                    const updatedEmision = await this.updateEmisionStatus(job.emisionId, 'error', 
                        'Transacción enviada pero falló en la confirmación', job.transactionHash);
                    
                    if (updatedEmision) {
                        console.log(`⚠️ Emisión ${job.emisionId} marcada como error`);
                    }
                    
                    return true; // Job completado (aunque con fallo)
                }
            } else {
                // Transacción aún no confirmada
                job.checkAttempts++;
                
                console.log(`⏳ Transacción ${job.transactionHash} aún no tiene receipt (intento ${job.checkAttempts}/${job.maxCheckAttempts})`);
                
                if (job.checkAttempts >= job.maxCheckAttempts) {
                    console.log(`⏰ Transacción ${job.transactionHash} no confirmada después de ${job.maxCheckAttempts} intentos`);
                    
                    await this.updateEmisionStatus(job.emisionId, 'procesando', 
                        `Transacción enviada (${job.transactionHash}) pero confirmación muy demorada. Verificar manualmente.`, job.transactionHash);
                    
                    return true; // Finalizar monitoreo
                } else {
                    console.log(`⏳ Transacción ${job.transactionHash} aún pendiente. Reagendando verificación...`);
                    
                    // Reagendar para verificar en 10 minutos
                    setTimeout(() => {
                        this.queue.push(job);
                    }, 600000); // 10 minutos
                    
                    return true; // Job reagendado
                }
            }
            
        } catch (error) {
            console.error(`❌ Error monitoreando transacción ${job.transactionHash}:`, error.message);
            
            job.checkAttempts++;
            
            if (job.checkAttempts >= job.maxCheckAttempts) {
                await this.updateEmisionStatus(job.emisionId, 'error', 
                    `Error monitoreando transacción después de ${job.maxCheckAttempts} intentos: ${error.message}`, job.transactionHash);
                return true;
            } else {
                // Reagendar para nuevo intento
                setTimeout(() => {
                    this.queue.push(job);
                }, 300000); // 5 minutos en caso de error
                
                return true;
            }
        }
    }

    /**
     * Actualizar el estado de una emisión
     */
    async updateEmisionStatus(emisionId, status, message = '', transactionId = null) {
        try {
            console.log(`🔄 Intentando actualizar emisión ${emisionId} a estado: ${status}`);
            
            const updateData = {
                status,
                updatedAt: new Date()
            };

            if (transactionId) {
                updateData.transactionId = transactionId;
            }

            console.log(`📊 Datos de actualización:`, updateData);

            // Verificar que la emisión existe antes de actualizar
            const existingEmision = await Emision.findById(emisionId);
            if (!existingEmision) {
                console.error(`❌ Emisión ${emisionId} no encontrada en la base de datos`);
                return null;
            }

            console.log(`📋 Estado actual de la emisión ${emisionId}: ${existingEmision.status}`);

            const emision = await Emision.findByIdAndUpdate(emisionId, updateData, { new: true });
            
            if (emision) {
                console.log(`✅ Emisión ${emisionId} actualizada exitosamente de '${existingEmision.status}' a '${emision.status}' - ${message}`);
                console.log(`📝 Transaction ID: ${emision.transactionId || 'N/A'}`);
            } else {
                console.warn(`⚠️ No se pudo actualizar la emisión ${emisionId}`);
            }

            return emision;
        } catch (error) {
            console.error(`❌ Error actualizando emisión ${emisionId}:`, error.message);
            console.error(`🔍 Stack trace:`, error.stack);
            return null;
        }
    }

    /**
     * Obtener estadísticas de la cola
     */
    getQueueStats() {
        const monitorJobs = this.queue.filter(job => job.type === 'monitor').length;
        const normalJobs = this.queue.filter(job => job.type !== 'monitor').length;
        
        return {
            pending: this.queue.length,
            monitoringJobs: monitorJobs,
            normalJobs: normalJobs,
            processing: this.processing,
            totalProcessed: this.totalProcessed || 0,
            totalFailed: this.totalFailed || 0,
            queueDetails: this.queue.map(job => ({
                id: job.id,
                type: job.type,
                emisionId: job.emisionId,
                transactionHash: job.transactionHash || 'N/A',
                createdAt: job.createdAt,
                checkAttempts: job.checkAttempts || 0
            }))
        };
    }

    /**
     * Obtener estado de un job específico
     */
    getJobStatus(jobId) {
        return this.queue.find(job => job.id === jobId) || null;
    }

    /**
     * Limpiar la cola (usar con cuidado)
     */
    clearQueue() {
        const cleared = this.queue.length;
        this.queue = [];
        console.log(`🧹 Cola limpiada: ${cleared} trabajos eliminados`);
        return cleared;
    }

    /**
     * Detener el procesamiento
     */
    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.processing = false;
        console.log('⏹️ BlockchainQueue detenida');
    }
}

// Singleton instance
let queueInstance = null;

const getBlockchainQueue = () => {
    if (!queueInstance) {
        queueInstance = new BlockchainQueue();
    }
    return queueInstance;
};

module.exports = {
    BlockchainQueue,
    getBlockchainQueue
};