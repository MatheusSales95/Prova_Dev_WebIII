import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Conecta a aplicação ao MongoDB usando Mongoose.
 * O nome do banco (reserva) está embutido na MONGODB_URI.
 */
export async function conectarBanco(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reserva';

  try {
    await mongoose.connect(uri);
    logger.info(`MongoDB conectado em: ${uri}`);
  } catch (erro) {
    logger.error('Falha ao conectar no MongoDB', erro);
    // Sem banco a aplicação não funciona, então encerramos o processo.
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.error('Conexão com o MongoDB foi perdida.');
  });
}
