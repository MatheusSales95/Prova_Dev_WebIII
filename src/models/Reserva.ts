import { Schema, model, InferSchemaType } from 'mongoose';

/** Status possíveis de uma reserva. */
export const STATUS_RESERVA = ['reservado', 'ocupado', 'finalizado', 'cancelado'] as const;
export type StatusReserva = (typeof STATUS_RESERVA)[number];

/** Duração padrão de uma reserva, em minutos (1h30). */
export const DURACAO_PADRAO_MINUTOS = 90;

/**
 * Modelo Reserva.
 * Representa a reserva de uma mesa por um cliente em determinado horário.
 */
const reservaSchema = new Schema(
  {
    nomeCliente: {
      type: String,
      required: [true, 'O nome do cliente é obrigatório.'],
      trim: true,
      minlength: [2, 'O nome do cliente deve ter pelo menos 2 caracteres.'],
    },
    contatoCliente: {
      type: String,
      required: [true, 'O contato do cliente é obrigatório.'],
      trim: true,
    },
    numeroMesa: {
      type: Number,
      required: [true, 'O número da mesa é obrigatório.'],
      min: [1, 'O número da mesa deve ser maior que zero.'],
    },
    quantidadePessoas: {
      type: Number,
      required: [true, 'A quantidade de pessoas é obrigatória.'],
      min: [1, 'A reserva deve ter pelo menos 1 pessoa.'],
    },
    dataHora: {
      type: Date,
      required: [true, 'A data e hora da reserva são obrigatórias.'],
    },
    duracaoMinutos: {
      type: Number,
      default: DURACAO_PADRAO_MINUTOS,
      min: [1, 'A duração deve ser de pelo menos 1 minuto.'],
    },
    observacoes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: STATUS_RESERVA,
        message: 'Status inválido.',
      },
      default: 'reservado',
    },
  },
  { timestamps: true }
);

export type IReserva = InferSchemaType<typeof reservaSchema>;

export const Reserva = model('Reserva', reservaSchema);
