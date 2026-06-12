import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import { conectarBanco } from './config/db';
import { logger } from './utils/logger';
import { atualizarStatusReservas } from './services/reservaService';
import reservaRoutes from './routes/reservaRoutes';
import mesaRoutes from './routes/mesaRoutes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Log simples de cada requisição
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Rotas da API
app.use('/api/reservas', reservaRoutes);
app.use('/api/mesas', mesaRoutes);

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ sucesso: true, mensagem: 'API no ar', timestamp: new Date().toISOString() });
});

// Frontend estático (HTML/CSS/JS)
const pastaPublic = path.resolve(__dirname, '..', 'public');
app.use(express.static(pastaPublic));

// Qualquer rota não-API serve o index.html (SPA simples)
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(pastaPublic, 'index.html'));
});

async function iniciar(): Promise<void> {
  await conectarBanco();

  // Atualiza o status das reservas conforme o tempo, periodicamente (a cada 1 min).
  atualizarStatusReservas().catch((e) => logger.error('Erro na atualização inicial de status', e));
  setInterval(() => {
    atualizarStatusReservas().catch((e) =>
      logger.error('Erro na atualização periódica de status', e)
    );
  }, 60 * 1000);

  app.listen(PORT, () => {
    logger.info(`Servidor rodando em http://localhost:${PORT}`);
  });
}

iniciar();
