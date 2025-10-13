import { Router } from 'express';
import { criarValeSaida, listarVales } from '../controllers/vale-material-controller.js';

const router = Router();

router.post('/vales/saida', criarValeSaida);
router.get('/vales', listarVales);

export default router;
