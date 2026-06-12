import 'dotenv/config';
import mongoose from 'mongoose';
import { Reserva } from './models/Reserva';
import { conectarBanco } from './config/db';
import { logger } from './utils/logger';

/**
 * Seed de reservas de demonstração.
 *
 * Cria reservas cobrindo todos os estados possíveis para visualizar/testar o
 * mapa de mesas. As datas são RELATIVAS ao horário atual, então o seed sempre
 * gera os mesmos estados independentemente de quando for executado.
 *
 * Obs.: a inserção é feita direto no banco (Mongoose), ignorando a regra de
 * antecedência mínima de 1h — necessário para simular uma mesa "ocupada" agora.
 */
const agora = Date.now();
const MIN = 60 * 1000;
const HORA = 60 * MIN;

/** Data deslocada em relação a agora (delta em milissegundos). */
function em(deltaMs: number): Date {
  return new Date(agora + deltaMs);
}

/** Amanhã às HH:00. */
function amanhaAs(h: number): Date {
  const d = new Date(agora);
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d;
}

const DEMO_RESERVAS = [
  // 🔴 OCUPADO — reserva acontecendo agora (já começou e ainda não terminou)
  {
    nomeCliente: 'Ana Beatriz',
    contatoCliente: '(11) 98877-1234',
    numeroMesa: 5,
    quantidadePessoas: 4,
    dataHora: em(-40 * MIN),
    duracaoMinutos: 90,
    observacoes: 'Almoço de negócios',
    status: 'ocupado',
  },
  {
    nomeCliente: 'Carlos Souza',
    contatoCliente: '(11) 97766-4321',
    numeroMesa: 9,
    quantidadePessoas: 6,
    dataHora: em(-20 * MIN),
    duracaoMinutos: 90,
    observacoes: 'Confraternização da equipe',
    status: 'ocupado',
  },

  // 🟡 RESERVADO — reservas futuras
  {
    nomeCliente: 'Júlia Lima',
    contatoCliente: '(11) 96655-8765',
    numeroMesa: 2,
    quantidadePessoas: 2,
    dataHora: em(2 * HORA),
    observacoes: '',
    status: 'reservado',
  },
  {
    nomeCliente: 'Pedro Alves',
    contatoCliente: '(11) 95544-2211',
    numeroMesa: 7,
    quantidadePessoas: 3,
    dataHora: em(3 * HORA),
    observacoes: 'Prefere mesa na varanda',
    status: 'reservado',
  },
  {
    nomeCliente: 'Família Mendes',
    contatoCliente: '(11) 94433-9900',
    numeroMesa: 11,
    quantidadePessoas: 8,
    dataHora: amanhaAs(20),
    duracaoMinutos: 120,
    observacoes: 'Aniversário 🎂 — levar bolo',
    status: 'reservado',
  },

  // ⚫ FINALIZADO — reserva que já encerrou (mesa volta a ficar disponível)
  {
    nomeCliente: 'Rafael Dias',
    contatoCliente: '(11) 93322-1100',
    numeroMesa: 3,
    quantidadePessoas: 2,
    dataHora: em(-3 * HORA),
    duracaoMinutos: 90,
    observacoes: '',
    status: 'finalizado',
  },

  // 🚫 CANCELADO — reserva cancelada pelo cliente
  {
    nomeCliente: 'Marina Costa',
    contatoCliente: '(11) 92211-0099',
    numeroMesa: 8,
    quantidadePessoas: 2,
    dataHora: em(5 * HORA),
    observacoes: 'Cancelou por imprevisto',
    status: 'cancelado',
  },
];

async function seed(): Promise<void> {
  await conectarBanco();

  // Limpa as reservas existentes para uma demonstração consistente.
  await Reserva.deleteMany({});
  await Reserva.insertMany(DEMO_RESERVAS);

  logger.info(`Seed de reservas concluído: ${DEMO_RESERVAS.length} reservas inseridas.`);
  console.log('\nReservas de demonstração:');
  console.table(
    DEMO_RESERVAS.map((r) => ({
      mesa: r.numeroMesa,
      cliente: r.nomeCliente,
      pessoas: r.quantidadePessoas,
      status: r.status,
      quando: new Date(r.dataHora).toLocaleString('pt-BR'),
    }))
  );

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((erro) => {
  logger.error('Erro ao executar seed de reservas', erro);
  process.exit(1);
});
