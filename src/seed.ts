import 'dotenv/config';
import mongoose from 'mongoose';
import { Mesa } from './models/Mesa';
import { conectarBanco } from './config/db';
import { logger } from './utils/logger';

/**
 * Arquivo pré-pronto de mesas. Popula o banco com um conjunto inicial de mesas
 * (números, capacidades e localizações) para o restaurante.
 */
const MESAS_INICIAIS = [
  { numero: 1, capacidade: 2, localizacao: 'Salão' },
  { numero: 2, capacidade: 2, localizacao: 'Salão' },
  { numero: 3, capacidade: 4, localizacao: 'Salão' },
  { numero: 4, capacidade: 4, localizacao: 'Salão' },
  { numero: 5, capacidade: 6, localizacao: 'Salão' },
  { numero: 6, capacidade: 4, localizacao: 'Varanda' },
  { numero: 7, capacidade: 4, localizacao: 'Varanda' },
  { numero: 8, capacidade: 2, localizacao: 'Varanda' },
  { numero: 9, capacidade: 8, localizacao: 'Área Interna' },
  { numero: 10, capacidade: 6, localizacao: 'Salão' },
  { numero: 11, capacidade: 10, localizacao: 'Área Interna' },
  { numero: 12, capacidade: 4, localizacao: 'Área Interna' },
];

async function seed(): Promise<void> {
  await conectarBanco();

  // Limpa as mesas existentes para repopular de forma consistente.
  await Mesa.deleteMany({});
  await Mesa.insertMany(MESAS_INICIAIS);

  logger.info(`Seed concluído: ${MESAS_INICIAIS.length} mesas cadastradas.`);
  console.log('\nMesas cadastradas:');
  console.table(MESAS_INICIAIS);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((erro) => {
  logger.error('Erro ao executar seed', erro);
  process.exit(1);
});
