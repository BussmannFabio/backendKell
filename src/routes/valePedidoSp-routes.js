import express from 'express';
import {
  criarValePedidoSp,
  listarValesPedidoSp,
  deletarValePedidoSp
} from '../controllers/valePedidoSp-controller.js';

const router = express.Router();

router.post('/', criarValePedidoSp);
router.get('/', listarValesPedidoSp);
router.delete('/:id', deletarValePedidoSp);

export default router;
