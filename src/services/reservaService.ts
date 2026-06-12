import { Reserva, StatusReserva, DURACAO_PADRAO_MINUTOS } from '../models/Reserva';
import { Mesa } from '../models/Mesa';
import { logger } from '../utils/logger';

/** Antecedência mínima exigida para uma reserva (1 hora), em milissegundos. */
const ANTECEDENCIA_MINIMA_MS = 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;

/**
 * Erro de regra de negócio. Carrega um statusCode HTTP para o controller
 * retornar a resposta adequada (400, 404, 409...).
 */
export class ErroNegocio extends Error {
  statusCode: number;
  constructor(mensagem: string, statusCode = 400) {
    super(mensagem);
    this.name = 'ErroNegocio';
    this.statusCode = statusCode;
  }
}

/** Dados necessários para validar uma reserva. */
interface DadosReserva {
  numeroMesa: number;
  quantidadePessoas: number;
  dataHora: Date;
  duracaoMinutos: number;
}

/**
 * Calcula o status de uma reserva conforme o tempo atual.
 * Reservas canceladas permanecem canceladas.
 *   - reservado: ainda não chegou o horário
 *   - ocupado: horário atual está dentro do intervalo da reserva
 *   - finalizado: o intervalo já terminou
 */
export function calcularStatusPorTempo(
  reserva: { dataHora: Date; duracaoMinutos: number; status: StatusReserva },
  agora: Date = new Date()
): StatusReserva {
  if (reserva.status === 'cancelado') {
    return 'cancelado';
  }

  const inicio = new Date(reserva.dataHora).getTime();
  const fim = inicio + reserva.duracaoMinutos * MINUTO_MS;
  const t = agora.getTime();

  if (t < inicio) return 'reservado';
  if (t < fim) return 'ocupado';
  return 'finalizado';
}

/**
 * Atualiza no banco o status das reservas (exceto canceladas) conforme o tempo.
 * Chamado periodicamente e antes de listagens para manter os dados coerentes.
 * Retorna a quantidade de reservas atualizadas.
 */
export async function atualizarStatusReservas(agora: Date = new Date()): Promise<number> {
  const reservas = await Reserva.find({ status: { $ne: 'cancelado' } });
  let atualizadas = 0;

  for (const reserva of reservas) {
    const novoStatus = calcularStatusPorTempo(
      {
        dataHora: reserva.dataHora,
        duracaoMinutos: reserva.duracaoMinutos,
        status: reserva.status as StatusReserva,
      },
      agora
    );

    if (novoStatus !== reserva.status) {
      reserva.status = novoStatus;
      await reserva.save();
      atualizadas++;
    }
  }

  if (atualizadas > 0) {
    logger.info(`Atualização automática de status: ${atualizadas} reserva(s) atualizada(s).`);
  }

  return atualizadas;
}

/**
 * Valida as regras de negócio obrigatórias antes de criar/atualizar uma reserva:
 *  - a mesa deve existir;
 *  - a mesa deve comportar a quantidade de pessoas;
 *  - antecedência mínima de 1 hora;
 *  - não pode haver conflito de horário com outra reserva ativa da mesma mesa.
 *
 * @param idIgnorar id de reserva a ignorar na checagem de conflito (usado em updates).
 */
export async function validarRegrasReserva(
  dados: DadosReserva,
  idIgnorar?: string
): Promise<void> {
  const { numeroMesa, quantidadePessoas, dataHora, duracaoMinutos } = dados;

  // 1. A mesa precisa existir.
  const mesa = await Mesa.findOne({ numero: numeroMesa });
  if (!mesa) {
    throw new ErroNegocio(`Mesa ${numeroMesa} não encontrada.`, 404);
  }

  // 2. A mesa deve comportar a quantidade de pessoas.
  if (quantidadePessoas > mesa.capacidade) {
    throw new ErroNegocio(
      `A mesa ${numeroMesa} comporta no máximo ${mesa.capacidade} pessoa(s), ` +
        `mas a reserva é para ${quantidadePessoas}.`
    );
  }

  // 3. Antecedência mínima de 1 hora.
  const inicio = new Date(dataHora).getTime();
  if (Number.isNaN(inicio)) {
    throw new ErroNegocio('Data e hora da reserva inválidas.');
  }
  const agora = Date.now();
  if (inicio < agora + ANTECEDENCIA_MINIMA_MS) {
    throw new ErroNegocio('A reserva deve ser feita com antecedência mínima de 1 hora.');
  }

  // 4. Conflito de horário: nenhuma outra reserva ativa (reservado/ocupado)
  //    da mesma mesa pode se sobrepor ao intervalo desejado.
  const fim = inicio + duracaoMinutos * MINUTO_MS;
  const filtro: Record<string, unknown> = {
    numeroMesa,
    status: { $in: ['reservado', 'ocupado'] },
  };
  if (idIgnorar) {
    filtro._id = { $ne: idIgnorar };
  }

  const reservasDaMesa = await Reserva.find(filtro);
  for (const r of reservasDaMesa) {
    const rInicio = new Date(r.dataHora).getTime();
    const rFim = rInicio + r.duracaoMinutos * MINUTO_MS;
    // Há sobreposição se um intervalo começa antes do outro terminar.
    const sobrepoe = inicio < rFim && rInicio < fim;
    if (sobrepoe) {
      throw new ErroNegocio(
        `Conflito de horário: a mesa ${numeroMesa} já possui uma reserva ` +
          `nesse intervalo (${formatarHora(rInicio)} - ${formatarHora(rFim)}).`,
        409
      );
    }
  }
}

/**
 * Calcula o status visual de cada mesa para o mapa:
 *   - 'ocupado'   (vermelho): há uma reserva acontecendo agora;
 *   - 'reservado' (amarelo): há reserva futura, mas nenhuma em andamento;
 *   - 'disponivel'(verde): nenhuma reserva ativa.
 * Retorna também a próxima reserva relevante de cada mesa.
 */
export async function obterMesasComStatus(agora: Date = new Date()) {
  const mesas = await Mesa.find().sort({ numero: 1 });
  const reservasAtivas = await Reserva.find({
    status: { $in: ['reservado', 'ocupado'] },
  }).sort({ dataHora: 1 });

  return mesas.map((mesa) => {
    const reservasDaMesa = reservasAtivas.filter((r) => r.numeroMesa === mesa.numero);

    let statusVisual: 'disponivel' | 'reservado' | 'ocupado' = 'disponivel';
    let reservaAtual: (typeof reservasDaMesa)[number] | null = null;

    for (const r of reservasDaMesa) {
      const statusTempo = calcularStatusPorTempo(
        {
          dataHora: r.dataHora,
          duracaoMinutos: r.duracaoMinutos,
          status: r.status as StatusReserva,
        },
        agora
      );

      if (statusTempo === 'ocupado') {
        // ocupado tem prioridade máxima — encerra a busca.
        statusVisual = 'ocupado';
        reservaAtual = r;
        break;
      }
      if (statusTempo === 'reservado') {
        statusVisual = 'reservado';
        if (!reservaAtual) reservaAtual = r;
      }
    }

    return {
      _id: mesa._id,
      numero: mesa.numero,
      capacidade: mesa.capacidade,
      localizacao: mesa.localizacao,
      statusVisual,
      reservaAtual: reservaAtual
        ? {
            _id: reservaAtual._id,
            nomeCliente: reservaAtual.nomeCliente,
            quantidadePessoas: reservaAtual.quantidadePessoas,
            dataHora: reservaAtual.dataHora,
            duracaoMinutos: reservaAtual.duracaoMinutos,
          }
        : null,
    };
  });
}

function formatarHora(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export { DURACAO_PADRAO_MINUTOS };
