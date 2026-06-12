import { Router } from 'express';
import { listarMesas, obterMesa, criarMesa } from '../controllers/mesaController';

const router = Router();

router.get('/', listarMesas); // Lista mesas com status visual (mapa)
router.get('/:numero', obterMesa); // Detalhes de uma mesa
router.post('/', criarMesa); // Cadastro de mesa (opcional)

export default router;
