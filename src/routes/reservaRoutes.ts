import { Router } from 'express';
import {
  criarReserva,
  listarReservas,
  obterReserva,
  atualizarReserva,
  cancelarReserva,
} from '../controllers/reservaController';

const router = Router();

// CRUD de Reservas
router.post('/', criarReserva); // Criar
router.get('/', listarReservas); // Ler (com filtros: cliente, mesa, data, status)
router.get('/:id', obterReserva); // Ler (uma)
router.put('/:id', atualizarReserva); // Atualizar
router.delete('/:id', cancelarReserva); // Excluir (cancelar)

export default router;
