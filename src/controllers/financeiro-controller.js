import { Financeiro, OrdemServico, OrdemItem, Produto, Confeccao } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Listar registros financeiros (Histórico da Tabela Principal)
 */
export const listarFinanceiro = async (req, res) => {
  try {
    const { from, to, page = 1, pageSize = 0 } = req.query;

    const where = {};
    if (from || to) {
      const whereBetween = [];
      if (from) {
        const d = new Date(from);
        whereBetween[0] = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      }
      if (to) {
        const d2 = new Date(to);
        whereBetween[1] = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate(), 23, 59, 59, 999);
      }
      if (whereBetween.length === 2 && whereBetween[0] && whereBetween[1]) {
        where.dataLancamento = { [Op.between]: whereBetween };
      } else if (whereBetween[0]) {
        where.dataLancamento = { [Op.gte]: whereBetween[0] };
      } else if (whereBetween[1]) {
        where.dataLancamento = { [Op.lte]: whereBetween[1] };
      }
    }

    const limit = Number(pageSize) > 0 ? Number(pageSize) : null;
    const offset = limit && Number(page) > 1 ? (Number(page) - 1) * limit : null;

    const findOpts = {
      where,
      include: [
        { model: OrdemServico, as: 'ordem' },
        { model: Confeccao, as: 'confeccao', attributes: ['id', 'nome'] }
      ],
      order: [['dataLancamento', 'DESC']]
    };
    if (limit != null) findOpts.limit = limit;
    if (offset != null) findOpts.offset = offset;

    const result = await Financeiro.findAndCountAll(findOpts);

    const registros = result.rows.map(r => {
      const plain = r.toJSON();
      return {
        id: plain.id,
        ordemId: plain.ordemId,
        confeccaoId: plain.confeccaoId,
        confeccaoNome: plain.confeccao?.nome ?? null,
        valorMaoDeObra: plain.valorMaoDeObra,
        diferenca: plain.diferenca,
        status: plain.status,
        dataLancamento: plain.dataLancamento,
        ordemFinanceiro: plain.ordem
      };
    });

    const pagination = {
      page: Number(page) || 1,
      pageSize: limit || result.count || registros.length,
      total: result.count
    };

    return res.json({ success: true, registros, pagination });
  } catch (error) {
    console.error('[FINANCEIRO][LISTAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Atualizar status de pagamento (PAGO/ABERTO)
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

    return res.json({ success: true, registro: registro.toJSON() });
  } catch (error) {
    await t.rollback();
    console.error('[FINANCEIRO][ATUALIZAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


// ---------------------- RELATÓRIO COM AUDITORIA DE 2% ----------------------
export const relatorioGerar = async (req, res) => {
  try {
    const { ordemIds } = req.body;
    if (!Array.isArray(ordemIds) || ordemIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Informe ordemIds.' });
    }

    const ordens = await OrdemServico.findAll({
      where: { id: { [Op.in]: ordemIds } },
      include: [{ model: Confeccao, as: 'confeccao', attributes: ['id', 'nome'] }]
    });

    const itens = await OrdemItem.findAll({
      where: { ordemId: { [Op.in]: ordemIds } },
      attributes: ['ordemId', 'produtoId', 'pecasReais', 'pecasDefeituosas', 'volumes', 'pecasPorVolume']
    });

    const produtoIds = [...new Set(itens.map(i => i.produtoId))];
    const produtos = await Produto.findAll({ where: { id: { [Op.in]: produtoIds } } });
    const produtoMap = Object.fromEntries(produtos.map(p => [p.id, Number(p.valorMaoDeObraDuzia || 0)]));

    const groups = {};

    for (const it of itens) {
      const ordem = ordens.find(o => o.id === it.ordemId);
      const confId = ordem?.confeccaoId || 'null';
      
      const esperado100 = Number(it.volumes || 0) * Number(it.pecasPorVolume || 0);
      const realProduzido = Number(it.pecasReais || 0) + Number(it.pecasDefeituosas || 0);
      const valorTotalItem = (realProduzido / 12) * (produtoMap[it.produtoId] || 0);

      if (!groups[confId]) {
        groups[confId] = {
          confeccaoNome: ordem?.confeccao?.nome || 'Sem confecção',
          totalEsperado: 0,
          totalReal: 0,
          totalValor: 0,
          ordensDetalhadas: {}
        };
      }

      const g = groups[confId];
      g.totalEsperado += esperado100;
      g.totalReal += realProduzido;
      g.totalValor += valorTotalItem;

      if (!g.ordensDetalhadas[it.ordemId]) {
        g.ordensDetalhadas[it.ordemId] = { ordemId: it.ordemId, esperado: 0, real: 0, valor: 0 };
      }
      g.ordensDetalhadas[it.ordemId].esperado += esperado100;
      g.ordensDetalhadas[it.ordemId].real += realProduzido;
      g.ordensDetalhadas[it.ordemId].valor += valorTotalItem;
    }

    const report = Object.values(groups).map(g => {
      const detalhe = Object.values(g.ordensDetalhadas).map(o => {
        const meta98 = o.esperado * 0.98;
        const saldo = o.real - meta98; // Positivo = Bônus, Negativo = Ônus
        return {
          ...o,
          margem: Math.round(meta98 * 100) / 100,
          falta: Math.round(saldo * 100) / 100 // Agora reflete o saldo real
        };
      });

      const metaGeral98 = g.totalEsperado * 0.98;

      return {
        confeccaoNome: g.confeccaoNome,
        totalPecasEsperadas: g.totalEsperado,
        totalPecasComMargem: Math.round(metaGeral98 * 100) / 100,
        totalPecasProduzidas: g.totalReal,
        totalValor: Math.round(g.totalValor * 100) / 100,
        // Inconsistência = Saldo Líquido da Oficina
        inconsistencias: Math.round((g.totalReal - metaGeral98) * 100) / 100,
        ordensDetalhadas: detalhe
      };
    });

    return res.json({ success: true, report });
  } catch (error) {
    console.error('[FINANCEIRO][RELATORIO] Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};