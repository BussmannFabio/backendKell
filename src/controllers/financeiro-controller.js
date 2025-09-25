// controllers/financeiro-controller.js
import { Financeiro, OrdemServico, OrdemItem, Produto, Confeccao } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Listar registros financeiros
 * Suporta query params opcionais:
 *  - from (yyyy-mm-dd) inclusive
 *  - to   (yyyy-mm-dd) inclusive
 *  - page (1-based)
 *  - pageSize
 *
 * Retorno:
 * { success:true, registros: [...], pagination: { page, pageSize, total } }
 */
export const listarFinanceiro = async (req, res) => {
  try {
    const { from, to, page = 1, pageSize = 0 } = req.query;

    const where = {};
    if (from || to) {
      const whereBetween = [];
      if (from) {
        const d = new Date(from);
        // início do dia
        whereBetween[0] = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      }
      if (to) {
        const d2 = new Date(to);
        // fim do dia
        whereBetween[1] = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate(), 23, 59, 59, 999);
      }
      // se apenas um lado informado, ajusta adequadamente
      if (whereBetween.length === 2 && whereBetween[0] && whereBetween[1]) {
        where.dataLancamento = { [Op.between]: whereBetween };
      } else if (whereBetween[0]) {
        where.dataLancamento = { [Op.gte]: whereBetween[0] };
      } else if (whereBetween[1]) {
        where.dataLancamento = { [Op.lte]: whereBetween[1] };
      }
    }

    // Configuração de paginação
    const limit = Number(pageSize) > 0 ? Number(pageSize) : null;
    const offset = (Number(page) > 1 && limit) ? (Number(page) - 1) * limit : null;

    // usar findAndCountAll para facilitar paginação
    const findOpts = {
      where,
      include: [
        { model: OrdemServico, as: 'ordemFinanceiro' },
        { model: Confeccao, as: 'confeccaoFinanceiro', attributes: ['id', 'nome'] }
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
        confeccaoNome: plain.confeccaoFinanceiro?.nome ?? null,
        valorMaoDeObra: plain.valorMaoDeObra,
        diferenca: plain.diferenca,
        status: plain.status,
        dataLancamento: plain.dataLancamento,
        ordemFinanceiro: plain.ordemFinanceiro
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
    return res.json({ success: true, registro: registro.toJSON() });
  } catch (error) {
    await t.rollback();
    console.error('[FINANCEIRO][ATUALIZAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Gerar relatório financeiro a partir de ordens selecionadas
 * Retorna: { success:true, report: [...], totals: { totalPecasProduzidas, totalDuzias, totalValor, totalOrdens } }
 */
export const relatorioGerar = async (req, res) => {
  try {
    const { ordemIds } = req.body;
    if (!Array.isArray(ordemIds) || ordemIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Informe ordemIds: array de ids (não vazio).' });
    }

    // map ordem -> confeccaoId
    const ordens = await OrdemServico.findAll({
      where: { id: { [Op.in]: ordemIds } },
      attributes: ['id', 'confeccaoId']
    });
    const ordemToConfeccao = {};
    ordens.forEach(o => { ordemToConfeccao[String(o.id)] = o.confeccaoId; });

    // buscar itens
    const itens = await OrdemItem.findAll({
      where: { ordemId: { [Op.in]: ordemIds } },
      attributes: ['id', 'ordemId', 'produtoId', 'pecasReais']
    });

    if (!itens || itens.length === 0) {
      return res.json({ success: true, report: [], totals: { totalPecasProduzidas: 0, totalDuzias: 0, totalValor: 0, totalOrdens: 0 } });
    }

    // produtos envolvidos para recuperar valor por dúzia
    const produtoIds = Array.from(new Set(itens.map(i => i.produtoId).filter(Boolean)));
    const produtos = produtoIds.length > 0 ? await Produto.findAll({
      where: { id: { [Op.in]: produtoIds } },
      attributes: ['id', 'valorMaoDeObraDuzia']
    }) : [];
    const produtoMap = {};
    produtos.forEach(p => { produtoMap[String(p.id)] = { valorMaoDeObraDuzia: Number(p.valorMaoDeObraDuzia || 0) }; });

    // agrupar por confeccaoId
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
      if (!groups[key]) {
        groups[key] = {
          confeccaoId: confeccaoId,
          totalPecas: 0,
          totalDuzias: 0,
          totalValor: 0,
          ordensSet: new Set()
        };
      }

      groups[key].totalPecas += pecas;
      groups[key].totalDuzias += duzias;
      groups[key].totalValor += valor;
      groups[key].ordensSet.add(String(ordemId));
    }

    // buscar nomes das confecções
    const confeccaoIds = Object.values(groups).map(g => g.confeccaoId).filter(id => id != null);
    let confeccoes = [];
    if (confeccaoIds.length > 0) {
      confeccoes = await Confeccao.findAll({ where: { id: { [Op.in]: confeccaoIds } }, attributes: ['id', 'nome'] });
    }
    const confeccaoMap = {};
    confeccoes.forEach(c => { confeccaoMap[String(c.id)] = c.nome; });

    // montar report e totals
    const report = Object.values(groups).map(g => ({
      confeccaoId: g.confeccaoId,
      confeccaoNome: g.confeccaoId ? (confeccaoMap[String(g.confeccaoId)] ?? `#${g.confeccaoId}`) : 'Sem confecção',
      totalPecasProduzidas: Math.round(g.totalPecas),
      totalDuzias: Math.round((g.totalDuzias + Number.EPSILON) * 100) / 100,
      totalValor: Math.round((g.totalValor + Number.EPSILON) * 100) / 100,
      ordensCount: g.ordensSet.size
    }));

    // ordenar por nome da confecção
    report.sort((a, b) => (a.confeccaoNome || '').localeCompare(b.confeccaoNome || ''));

    // totals gerais
    const totals = report.reduce((acc, cur) => {
      acc.totalPecasProduzidas += Number(cur.totalPecasProduzidas || 0);
      acc.totalDuzias += Number(cur.totalDuzias || 0);
      acc.totalValor += Number(cur.totalValor || 0);
      acc.totalOrdens += Number(cur.ordensCount || 0);
      return acc;
    }, { totalPecasProduzidas: 0, totalDuzias: 0, totalValor: 0, totalOrdens: 0 });

    // ajustar arredondamento do totalDuzias/totalValor
    totals.totalDuzias = Math.round((totals.totalDuzias + Number.EPSILON) * 100) / 100;
    totals.totalValor = Math.round((totals.totalValor + Number.EPSILON) * 100) / 100;

    return res.json({ success: true, report, totals });
  } catch (error) {
    console.error('[FINANCEIRO][RELATORIO-GERAR][ERRO]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
