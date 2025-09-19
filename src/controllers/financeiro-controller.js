import { Financeiro, OrdemServico, OrdemItem, Produto, Confeccao } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Listar registros financeiros
 */
export const listarFinanceiro = async (req, res) => {
  try {
    const registros = await Financeiro.findAll({
      include: [
        { model: OrdemServico, as: 'ordemFinanceiro' },
        { model: Confeccao, as: 'confeccaoFinanceiro', attributes: ['id', 'nome'] }
      ],
      order: [['dataLancamento', 'DESC']]
    });

    const resposta = registros.map(r => {
      const plain = r.toJSON();
      return {
        id: plain.id,
        ordemId: plain.ordemId,
        confeccaoId: plain.confeccaoId,
        confeccaoNome: plain.confeccaoFinanceiro?.nome ?? null,
        valorMaoDeObra: plain.valorMaoDeObra,
        diferenca: plain.diferenca,
        status: plain.status,
        dataLancamento: plain.dataLancamento,
        ordemFinanceiro: plain.ordemFinanceiro
      };
    });

    return res.json({ success: true, registros: resposta });
  } catch (error) {
    console.error('[FINANCEIRO][LISTAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Atualizar status de pagamento
 */
export const atualizarStatusFinanceiro = async (req, res) => {
  const t = await Financeiro.sequelize.transaction();
  try {
    const { id } = req.params;
    const { status } = req.body;

    const registro = await Financeiro.findByPk(id, { transaction: t });
    if (!registro) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }

    const allowed = ['ABERTO', 'PAGO'];
    let novoStatus = registro.status;

    if (status !== undefined && status !== null) {
      if (!allowed.includes(String(status).toUpperCase())) {
        await t.rollback();
        return res.status(400).json({ success: false, error: `status inválido. Valores permitidos: ${allowed.join(', ')}` });
      }
      novoStatus = String(status).toUpperCase();
    } else {
      novoStatus = registro.status === 'PAGO' ? 'ABERTO' : 'PAGO';
    }

    registro.status = novoStatus;
    await registro.save({ transaction: t });
    await t.commit();

    console.log(`[FINANCEIRO] registro ${id} atualizado -> status=${novoStatus}`);
    return res.json({ success: true, registro });
  } catch (error) {
    await t.rollback();
    console.error('[FINANCEIRO][ATUALIZAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Gerar relatório financeiro a partir de ordens selecionadas
 */
export const relatorioGerar = async (req, res) => {
  try {
    const { ordemIds } = req.body;
    if (!Array.isArray(ordemIds) || ordemIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Informe ordemIds: array de ids (não vazio).' });
    }

    const ordens = await OrdemServico.findAll({
      where: { id: { [Op.in]: ordemIds } },
      attributes: ['id', 'confeccaoId']
    });
    const ordemToConfeccao = {};
    ordens.forEach(o => { ordemToConfeccao[String(o.id)] = o.confeccaoId; });

    const itens = await OrdemItem.findAll({
      where: { ordemId: { [Op.in]: ordemIds } },
      attributes: ['id', 'ordemId', 'produtoId', 'pecasReais']
    });

    if (!itens || itens.length === 0) {
      return res.json({ success: true, report: [] });
    }

    const produtoIds = Array.from(new Set(itens.map(i => i.produtoId).filter(Boolean)));
    const produtos = produtoIds.length > 0 ? await Produto.findAll({
      where: { id: { [Op.in]: produtoIds } },
      attributes: ['id', 'valorMaoDeObraDuzia']
    }) : [];
    const produtoMap = {};
    produtos.forEach(p => { produtoMap[String(p.id)] = { valorMaoDeObraDuzia: Number(p.valorMaoDeObraDuzia || 0) }; });

    const groups = {};
    for (const it of itens) {
      const ordemId = it.ordemId;
      const confeccaoId = ordemToConfeccao[String(ordemId)] ?? null;
      const pecas = Number(it.pecasReais || 0);
      if (pecas <= 0) continue;
      const duzias = pecas / 12;
      const produto = produtoMap[String(it.produtoId)];
      const valorDuzia = produto ? Number(produto.valorMaoDeObraDuzia || 0) : 0;
      const valor = duzias * valorDuzia;

      const key = String(confeccaoId ?? 'null');
      if (!groups[key]) groups[key] = { confeccaoId: confeccaoId, totalPecas: 0, totalDuzias: 0, totalValor: 0 };
      groups[key].totalPecas += pecas;
      groups[key].totalDuzias += duzias;
      groups[key].totalValor += valor;
    }

    const confeccaoIds = Object.values(groups).map(g => g.confeccaoId).filter(id => id != null);
    let confeccoes = [];
    if (confeccaoIds.length > 0) {
      confeccoes = await Confeccao.findAll({ where: { id: { [Op.in]: confeccaoIds } }, attributes: ['id', 'nome'] });
    }
    const confeccaoMap = {};
    confeccoes.forEach(c => { confeccaoMap[String(c.id)] = c.nome; });

    const report = Object.values(groups).map(g => ({
      confeccaoId: g.confeccaoId,
      confeccaoNome: g.confeccaoId ? (confeccaoMap[String(g.confeccaoId)] ?? `#${g.confeccaoId}`) : 'Sem confecção',
      totalPecas: Math.round(g.totalPecas),
      totalDuzias: Math.round((g.totalDuzias + Number.EPSILON) * 100) / 100,
      totalValor: Math.round((g.totalValor + Number.EPSILON) * 100) / 100
    }));

    report.sort((a, b) => (a.confeccaoNome || '').localeCompare(b.confeccaoNome || ''));

    return res.json({ success: true, report });
  } catch (error) {
    console.error('[FINANCEIRO][RELATORIO-GERAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
