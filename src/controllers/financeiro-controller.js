// controllers/financeiro-controller.js
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

/**
 * Gerar relatório financeiro COM AUDITORIA DE QUEBRA (2.5%)
 */
export const relatorioGerar = async (req, res) => {
  try {
    const { ordemIds } = req.body;
    if (!Array.isArray(ordemIds) || ordemIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Informe ordemIds: array de ids.' });
    }

    // 1. Buscar ordens e seus nomes de confecção
    const ordens = await OrdemServico.findAll({
      where: { id: { [Op.in]: ordemIds } },
      include: [{ model: Confeccao, as: 'confeccao', attributes: ['id', 'nome'] }]
    });

    // 2. Buscar itens das ordens INCLUINDO pecasEsperadas para comparar com pecasReais
    const itens = await OrdemItem.findAll({
      where: { ordemId: { [Op.in]: ordemIds } },
      attributes: ['id', 'ordemId', 'produtoId', 'pecasReais', 'pecasEsperadas']
    });

    if (!itens || itens.length === 0) {
      return res.json({ success: true, report: [] });
    }

    // 3. Mapear preços dos produtos (valor por dúzia)
    const produtoIds = Array.from(new Set(itens.map(i => i.produtoId).filter(Boolean)));
    const produtos = await Produto.findAll({
      where: { id: { [Op.in]: produtoIds } },
      attributes: ['id', 'valorMaoDeObraDuzia']
    });
    const produtoMap = {};
    produtos.forEach(p => { 
      produtoMap[String(p.id)] = Number(p.valorMaoDeObraDuzia || 0); 
    });

    const groups = {};

    // 4. Processar itens e agrupar por Oficina/Confecção
    for (const it of itens) {
      const ordem = ordens.find(o => o.id === it.ordemId);
      const confId = ordem?.confeccaoId ?? 'null';
      const confNome = ordem?.confeccao?.nome ?? 'Sem confecção';

      const esperado = Number(it.pecasEsperadas || 0);
      const real = Number(it.pecasReais || 0);
      const valorMaoDeObra = (real / 12) * (produtoMap[String(it.produtoId)] || 0);

      const key = String(confId);
      if (!groups[key]) {
        groups[key] = {
          confeccaoId: confId === 'null' ? null : confId,
          confeccaoNome: confNome,
          totalPecasEsperadas: 0,
          totalPecasProduzidas: 0,
          totalValor: 0,
          ordensCount: 0,
          ordensIdsSet: new Set(),
          ordensDetalhadas: {} // Usado para agrupar itens por Ordem dentro da mesma oficina
        };
      }

      const g = groups[key];
      g.totalPecasEsperadas += esperado;
      g.totalPecasProduzidas += real;
      g.totalValor += valorMaoDeObra;
      g.ordensIdsSet.add(it.ordemId);

      // Agrupamento detalhado por Ordem para o PDF
      if (!g.ordensDetalhadas[it.ordemId]) {
        g.ordensDetalhadas[it.ordemId] = {
          ordemId: it.ordemId,
          esperado: 0,
          real: 0,
          valor: 0
        };
      }
      g.ordensDetalhadas[it.ordemId].esperado += esperado;
      g.ordensDetalhadas[it.ordemId].real += real;
      g.ordensDetalhadas[it.ordemId].valor += valorMaoDeObra;
    }

    // 5. Finalizar cálculos (Margem de 2.5%, Inconsistências e Formatação)
    const report = Object.values(groups).map(g => {
      const listaOrdens = Object.values(g.ordensDetalhadas).map(o => {
        const margemOrdem = o.esperado * 0.975; // 100% - 2.5%
        return {
          ...o,
          margem: Math.round((margemOrdem + Number.EPSILON) * 100) / 100,
          falta: o.real < margemOrdem ? (margemOrdem - o.real) : 0
        };
      });

      const totalEsperado = g.totalPecasEsperadas;
      const totalComMargem = totalEsperado * 0.975;
      const inconsistenciaGeral = g.totalPecasProduzidas < totalComMargem ? (totalComMargem - g.totalPecasProduzidas) : 0;

      return {
        confeccaoId: g.confeccaoId,
        confeccaoNome: g.confeccaoNome,
        totalPecasEsperadas: Math.round(totalEsperado),
        totalPecasComMargem: Math.round((totalComMargem + Number.EPSILON) * 100) / 100,
        totalPecasProduzidas: Math.round(g.totalPecasProduzidas),
        totalDuzias: Math.round((g.totalPecasProduzidas / 12 + Number.EPSILON) * 100) / 100,
        totalValor: Math.round((g.totalValor + Number.EPSILON) * 100) / 100,
        ordensCount: g.ordensIdsSet.size,
        inconsistencias: Math.round((inconsistenciaGeral + Number.EPSILON) * 100) / 100,
        ordensDetalhadas: listaOrdens
      };
    });

    report.sort((a, b) => (a.confeccaoNome).localeCompare(b.confeccaoNome));

    // Totais gerais para o rodapé do sistema
    const totals = report.reduce((acc, cur) => {
      acc.totalPecasProduzidas += cur.totalPecasProduzidas;
      acc.totalValor += cur.totalValor;
      acc.totalOrdens += cur.ordensCount;
      acc.totalInconsistencias += cur.inconsistencias;
      return acc;
    }, { totalPecasProduzidas: 0, totalValor: 0, totalOrdens: 0, totalInconsistencias: 0 });

    return res.json({ success: true, report, totals });
  } catch (error) {
    console.error('[FINANCEIRO][RELATORIO-GERAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};