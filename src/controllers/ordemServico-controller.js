import { OrdemServico, OrdemItem, Produto, Financeiro, ProdutoTamanho } from '../models/index.js';

// Criar OS com itens
export const criarOrdem = async (req, res) => {
  try {
    const { itens, dataInicio, confeccaoId } = req.body;
    if (!confeccaoId) return res.status(400).json({ error: 'confeccaoId é obrigatório' });

    const ordem = await OrdemServico.create({
      status: 'CRIADA',
      dataInicio,
      confeccaoId
    });

    for (const item of itens) {
      const pecasEsperadas = item.volumes * item.pecasPorVolume;
      await OrdemItem.create({
        ordemId: ordem.id,
        produtoId: item.produtoId,
        tamanho: item.tamanho,
        volumes: item.volumes,
        pecasPorVolume: item.pecasPorVolume,
        pecasEsperadas,
        corte: item.corte   
      });
    }


    const ordemCompleta = await OrdemServico.findByPk(ordem.id, { include: 'itens' });
    res.status(201).json(ordemCompleta);
  } catch (error) {
    console.error('Erro ao criar ordem:', error);
    res.status(500).json({ error: error.message });
  }
};

// Atualizar status e retorno da OS + gerar financeiro
export const atualizarOrdem = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dataInicio, dataRetorno, pecasReais } = req.body;

    const ordem = await OrdemServico.findByPk(id, { include: 'itens' });
    if (!ordem) return res.status(404).json({ error: 'Ordem não encontrada' });

    await ordem.update({ status, dataInicio, dataRetorno });

    if (pecasReais && pecasReais.length > 0) {
      for (const pr of pecasReais) {
        const item = await OrdemItem.findByPk(pr.itemId);
        if (!item) continue;

        await item.update({ pecasReais: pr.pecasReais });

        const produtoTamanho = await ProdutoTamanho.findOne({
          where: {
            produtoId: item.produtoId,
            tamanho: item.tamanho
          },
          include: 'produtoPai'
        });

        if (!produtoTamanho) continue;

        const produto = produtoTamanho.produtoPai;
        const diferenca = pr.pecasReais - item.pecasEsperadas;
        const duzias = pr.pecasReais / 12;
        const valorMaoDeObra = duzias * produto.valorMaoDeObraDuzia;

        await Financeiro.create({
          ordemId: ordem.id,
          confeccaoId: ordem.confeccaoId,
          valorMaoDeObra,
          diferenca,
          status: 'ABERTO'
        });
      }
    }
    const ordemAtualizada = await OrdemServico.findByPk(id, { include: ['itens'] });
    res.json(ordemAtualizada);

  } catch (error) {
    console.error('Erro ao atualizar ordem:', error);
    res.status(500).json({ error: error.message });
  }
};

// Listar OS
export const listarOrdens = async (req, res) => {
  try {
    const ordens = await OrdemServico.findAll({ include: 'itens' });
    res.json(ordens);
  } catch (error) {
    console.error('Erro ao listar ordens:', error);
    res.status(500).json({ error: error.message });
  }
};

// Buscar por ID
export const buscarOrdemPorId = async (req, res) => {
  try {
    const ordem = await OrdemServico.findByPk(req.params.id, { include: 'itens' });
    if (!ordem) return res.status(404).json({ error: 'Ordem não encontrada' });
    res.json(ordem);
  } catch (error) {
    console.error('Erro ao buscar ordem por ID:', error);
    res.status(500).json({ error: error.message });
  }
};

// Deletar OS
export const deletarOrdem = async (req, res) => {
  try {
    const ordem = await OrdemServico.findByPk(req.params.id);
    if (!ordem) return res.status(404).json({ error: 'Ordem não encontrada' });

    await ordem.destroy();
    res.json({ message: 'Ordem deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar ordem:', error);
    res.status(500).json({ error: error.message });
  }
};