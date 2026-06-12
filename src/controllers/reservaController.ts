import { Request, Response } from 'express';
import { Reserva, DURACAO_PADRAO_MINUTOS } from '../models/Reserva';
import {
  ErroNegocio,
  validarRegrasReserva,
  atualizarStatusReservas,
} from '../services/reservaService';
import { logger } from '../utils/logger';

/**
 * Trata erros de forma centralizada, retornando mensagens claras ao usuário.
 */
function tratarErro(res: Response, erro: unknown): void {
  if (erro instanceof ErroNegocio) {
    res.status(erro.statusCode).json({ sucesso: false, mensagem: erro.message });
    return;
  }
  // Erros de validação do Mongoose
  if (erro && typeof erro === 'object' && (erro as { name?: string }).name === 'ValidationError') {
    const mensagens = Object.values((erro as { errors: Record<string, { message: string }> }).errors)
      .map((e) => e.message)
      .join(' ');
    res.status(400).json({ sucesso: false, mensagem: mensagens });
    return;
  }
  logger.error('Erro inesperado em reserva', erro);
  res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
}

/**
 * Criar: cadastrar uma nova reserva.
 * POST /api/reservas
 */
export async function criarReserva(req: Request, res: Response): Promise<void> {
  try {
    const {
      nomeCliente,
      contatoCliente,
      numeroMesa,
      quantidadePessoas,
      dataHora,
      observacoes,
      duracaoMinutos,
    } = req.body;

    const duracao = Number(duracaoMinutos) || DURACAO_PADRAO_MINUTOS;

    // Valida regras de negócio antes de persistir.
    await validarRegrasReserva(
      {
        numeroMesa: Number(numeroMesa),
        quantidadePessoas: Number(quantidadePessoas),
        dataHora: new Date(dataHora),
        duracaoMinutos: duracao,
      }
    );

    const reserva = await Reserva.create({
      nomeCliente,
      contatoCliente,
      numeroMesa: Number(numeroMesa),
      quantidadePessoas: Number(quantidadePessoas),
      dataHora: new Date(dataHora),
      duracaoMinutos: duracao,
      observacoes,
      status: 'reservado',
    });

    logger.info(
      `Reserva criada: mesa ${reserva.numeroMesa}, cliente "${reserva.nomeCliente}", ` +
        `id ${reserva._id}`
    );

    res.status(201).json({
      sucesso: true,
      mensagem: 'Reserva criada com sucesso!',
      reserva,
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
}

/**
 * Ler: listar reservas com filtros opcionais por cliente, mesa, data ou status.
 * GET /api/reservas?cliente=&mesa=&data=&status=
 */
export async function listarReservas(req: Request, res: Response): Promise<void> {
  try {
    // Mantém os status coerentes com o tempo antes de listar.
    await atualizarStatusReservas();

    const { cliente, mesa, data, status } = req.query;
    const filtro: Record<string, unknown> = {};

    if (cliente) {
      filtro.nomeCliente = { $regex: String(cliente), $options: 'i' };
    }
    if (mesa) {
      filtro.numeroMesa = Number(mesa);
    }
    if (status) {
      filtro.status = String(status);
    }
    if (data) {
      // Filtra reservas dentro do dia informado (YYYY-MM-DD).
      const inicioDia = new Date(`${data}T00:00:00`);
      const fimDia = new Date(`${data}T23:59:59.999`);
      filtro.dataHora = { $gte: inicioDia, $lte: fimDia };
    }

    const reservas = await Reserva.find(filtro).sort({ dataHora: 1 });

    res.json({
      sucesso: true,
      total: reservas.length,
      reservas,
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
}

/**
 * Ler (uma): obter detalhes de uma reserva por id.
 * GET /api/reservas/:id
 */
export async function obterReserva(req: Request, res: Response): Promise<void> {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) {
      res.status(404).json({ sucesso: false, mensagem: 'Reserva não encontrada.' });
      return;
    }
    res.json({ sucesso: true, reserva });
  } catch (erro) {
    tratarErro(res, erro);
  }
}

/**
 * Atualizar: editar informações de uma reserva existente.
 * PUT /api/reservas/:id
 */
export async function atualizarReserva(req: Request, res: Response): Promise<void> {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) {
      res.status(404).json({ sucesso: false, mensagem: 'Reserva não encontrada.' });
      return;
    }

    if (reserva.status === 'cancelado') {
      throw new ErroNegocio('Não é possível editar uma reserva cancelada.');
    }

    const {
      nomeCliente,
      contatoCliente,
      numeroMesa,
      quantidadePessoas,
      dataHora,
      observacoes,
      duracaoMinutos,
    } = req.body;

    // Monta os valores finais (mantém os atuais quando não enviados).
    const novoNumeroMesa = numeroMesa !== undefined ? Number(numeroMesa) : reserva.numeroMesa;
    const novaQtd =
      quantidadePessoas !== undefined ? Number(quantidadePessoas) : reserva.quantidadePessoas;
    const novaData = dataHora !== undefined ? new Date(dataHora) : reserva.dataHora;
    const novaDuracao =
      duracaoMinutos !== undefined ? Number(duracaoMinutos) : reserva.duracaoMinutos;

    // Revalida as regras de negócio (ignorando a própria reserva no conflito).
    await validarRegrasReserva(
      {
        numeroMesa: novoNumeroMesa,
        quantidadePessoas: novaQtd,
        dataHora: novaData,
        duracaoMinutos: novaDuracao,
      },
      reserva.id
    );

    reserva.nomeCliente = nomeCliente ?? reserva.nomeCliente;
    reserva.contatoCliente = contatoCliente ?? reserva.contatoCliente;
    reserva.numeroMesa = novoNumeroMesa;
    reserva.quantidadePessoas = novaQtd;
    reserva.dataHora = novaData;
    reserva.duracaoMinutos = novaDuracao;
    if (observacoes !== undefined) reserva.observacoes = observacoes;

    await reserva.save();

    logger.info(`Reserva atualizada: id ${reserva._id}, mesa ${reserva.numeroMesa}`);

    res.json({
      sucesso: true,
      mensagem: 'Reserva atualizada com sucesso!',
      reserva,
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
}

/**
 * Excluir: cancelar uma reserva (define status como "cancelado").
 * DELETE /api/reservas/:id
 */
export async function cancelarReserva(req: Request, res: Response): Promise<void> {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) {
      res.status(404).json({ sucesso: false, mensagem: 'Reserva não encontrada.' });
      return;
    }

    if (reserva.status === 'cancelado') {
      res.json({ sucesso: true, mensagem: 'Reserva já estava cancelada.', reserva });
      return;
    }

    reserva.status = 'cancelado';
    await reserva.save();

    logger.info(`Reserva cancelada: id ${reserva._id}, mesa ${reserva.numeroMesa}`);

    res.json({
      sucesso: true,
      mensagem: 'Reserva cancelada com sucesso!',
      reserva,
    });
  } catch (erro) {
    tratarErro(res, erro);
  }
}
