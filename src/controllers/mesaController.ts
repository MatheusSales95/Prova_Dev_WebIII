import { Request, Response } from 'express';
import { Mesa } from '../models/Mesa';
import { Reserva } from '../models/Reserva';
import { obterMesasComStatus, atualizarStatusReservas } from '../services/reservaService';
import { logger } from '../utils/logger';

/**
 * Lista todas as mesas já com o status visual (disponivel/reservado/ocupado)
 * usado pelo Mapa Visual das Mesas.
 * GET /api/mesas
 */
export async function listarMesas(_req: Request, res: Response): Promise<void> {
  try {
    await atualizarStatusReservas();
    const mesas = await obterMesasComStatus();
    res.json({ sucesso: true, total: mesas.length, mesas });
  } catch (erro) {
    logger.error('Erro ao listar mesas', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar mesas.' });
  }
}

/**
 * Detalhes de uma mesa específica, incluindo suas reservas ativas.
 * GET /api/mesas/:numero
 */
export async function obterMesa(req: Request, res: Response): Promise<void> {
  try {
    const numero = Number(req.params.numero);
    const mesa = await Mesa.findOne({ numero });
    if (!mesa) {
      res.status(404).json({ sucesso: false, mensagem: `Mesa ${numero} não encontrada.` });
      return;
    }

    await atualizarStatusReservas();
    const reservas = await Reserva.find({
      numeroMesa: numero,
      status: { $in: ['reservado', 'ocupado'] },
    }).sort({ dataHora: 1 });

    res.json({ sucesso: true, mesa, reservas });
  } catch (erro) {
    logger.error('Erro ao obter mesa', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao obter mesa.' });
  }
}

/**
 * Cadastra uma nova mesa (cadastro inicial opcional via API).
 * POST /api/mesas
 */
export async function criarMesa(req: Request, res: Response): Promise<void> {
  try {
    const { numero, capacidade, localizacao } = req.body;

    const existente = await Mesa.findOne({ numero: Number(numero) });
    if (existente) {
      res.status(409).json({ sucesso: false, mensagem: `A mesa ${numero} já existe.` });
      return;
    }

    const mesa = await Mesa.create({
      numero: Number(numero),
      capacidade: Number(capacidade),
      localizacao,
    });

    logger.info(`Mesa cadastrada: número ${mesa.numero}, capacidade ${mesa.capacidade}`);

    res.status(201).json({ sucesso: true, mensagem: 'Mesa cadastrada com sucesso!', mesa });
  } catch (erro) {
    if (
      erro &&
      typeof erro === 'object' &&
      (erro as { name?: string }).name === 'ValidationError'
    ) {
      const mensagens = Object.values(
        (erro as { errors: Record<string, { message: string }> }).errors
      )
        .map((e) => e.message)
        .join(' ');
      res.status(400).json({ sucesso: false, mensagem: mensagens });
      return;
    }
    logger.error('Erro ao criar mesa', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar mesa.' });
  }
}
