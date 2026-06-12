import { Schema, model, InferSchemaType } from 'mongoose';

/**
 * Modelo Mesa.
 * Representa uma mesa física do restaurante.
 */
const mesaSchema = new Schema(
  {
    numero: {
      type: Number,
      required: [true, 'O número da mesa é obrigatório.'],
      unique: true,
      min: [1, 'O número da mesa deve ser maior que zero.'],
    },
    capacidade: {
      type: Number,
      required: [true, 'A capacidade da mesa é obrigatória.'],
      min: [1, 'A capacidade deve ser de pelo menos 1 pessoa.'],
    },
    localizacao: {
      type: String,
      required: [true, 'A localização da mesa é obrigatória.'],
      enum: {
        values: ['Salão', 'Varanda', 'Área Interna'],
        message: 'Localização inválida. Use: Salão, Varanda ou Área Interna.',
      },
    },
  },
  { timestamps: true }
);

export type IMesa = InferSchemaType<typeof mesaSchema>;

export const Mesa = model('Mesa', mesaSchema);
