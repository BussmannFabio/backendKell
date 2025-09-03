import Financeiro from '../models/financeiro-model.js';
import OrdemServico from '../models/ordemServico-model.js';

// Listar todos registros financeiros
export const listarFinanceiro = async (req, res) => {
  try {
    const registros = await Financeiro.findAll({
      include: [
        { model: OrdemServico, as: 'ordem' }
      ]
    });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualizar status de pagamento (ABERTO -> PAGO)
export const atualizarStatusFinanceiro = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await Financeiro.findByPk(id);
    if (!registro) return res.status(404).json({ error: 'Registro não encontrado' });

    registro.status = 'PAGO';
    await registro.save();

    res.json({ message: 'Pagamento registrado', registro });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
