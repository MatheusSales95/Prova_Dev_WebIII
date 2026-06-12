import fs from 'fs';
import path from 'path';

/**
 * Logger simples: imprime no console e registra em arquivo (logs/app.log).
 * Usado para o registro básico de logs exigido (criação, atualização, cancelamento).
 */
const pastaLogs = path.resolve(process.cwd(), 'logs');
const arquivoLog = path.join(pastaLogs, 'app.log');

if (!fs.existsSync(pastaLogs)) {
  fs.mkdirSync(pastaLogs, { recursive: true });
}

function escrever(nivel: string, mensagem: string, extra?: unknown): void {
  const timestamp = new Date().toISOString();
  const detalhe = extra !== undefined ? ` ${formatarExtra(extra)}` : '';
  const linha = `[${timestamp}] [${nivel}] ${mensagem}${detalhe}`;

  // Console (com cor básica por nível)
  if (nivel === 'ERROR') {
    console.error(linha);
  } else {
    console.log(linha);
  }

  // Arquivo
  try {
    fs.appendFileSync(arquivoLog, linha + '\n');
  } catch {
    // Se não conseguir escrever no arquivo, não derruba a aplicação.
  }
}

function formatarExtra(extra: unknown): string {
  if (extra instanceof Error) {
    return extra.message;
  }
  if (typeof extra === 'object') {
    try {
      return JSON.stringify(extra);
    } catch {
      return String(extra);
    }
  }
  return String(extra);
}

export const logger = {
  info: (mensagem: string, extra?: unknown) => escrever('INFO', mensagem, extra),
  error: (mensagem: string, extra?: unknown) => escrever('ERROR', mensagem, extra),
};
