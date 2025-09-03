import OrdemServico from '../models/ordemServico-model.js';
import OrdemItem from '../models/ordemItem-model.js';
import Produto from '../models/produto-model.js';
import Financeiro from '../models/financeiro-model.js';

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
        pecasEsperadas
      });
    }

    const ordemCompleta = await OrdemServico.findByPk(ordem.id, { include: 'itens' });
    res.status(201).json(ordemCompleta);
  } catch (error) {
    console.error('Erro ao criar ordem:', error);
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

// Atualizar status e retorno da OS + gerar financeiro
export const atualizarOrdem = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dataInicio, dataRetorno, pecasReais } = req.body;

    console.log('--- Atualizando Ordem ---');
    console.log('ID da Ordem:', id);
    console.log('Status enviado:', status);
    console.log('Data de Retorno:', dataRetorno);
    console.log('Pecas Reais:', pecasReais);

    const ordem = await OrdemServico.findByPk(id, { include: 'itens' });
    if (!ordem) {
      console.log('Ordem não encontrada');
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }

    await ordem.update({ status, dataInicio, dataRetorno });
    console.log('Ordem atualizada no banco');

    if (pecasReais && pecasReais.length > 0) {
      console.log('Processando pecasReais...');
      for (const pr of pecasReais) {
        console.log('Atualizando item:', pr);

        const item = await OrdemItem.findByPk(pr.itemId);
        if (!item) {
          console.log('Item não encontrado para itemId:', pr.itemId);
          continue;
        }

        await item.update({ pecasReais: pr.pecasReais });
        console.log(`Item ${item.id} atualizado com pecasReais = ${pr.pecasReais}`);

        const diferenca = pr.pecasReais - item.pecasEsperadas;
        const produto = await Produto.findByPk(item.produtoId);
        if (!produto) {
          console.log('Produto não encontrado para produtoId:', item.produtoId);
          continue;
        }

        const duzias = pr.pecasReais / 12;
        const valorMaoDeObra = duzias * produto.valorMaoDeObraDuzia;

        console.log('Criando registro Financeiro:', {
          ordemId: ordem.id,
          confeccaoId: ordem.confeccaoId,
          valorMaoDeObra,
          diferenca,
          status: 'ABERTO'
        });

        await Financeiro.create({
          ordemId: ordem.id,
          confeccaoId: ordem.confeccaoId,
          valorMaoDeObra,
          diferenca,
          status: 'ABERTO'
        });

        console.log('Financeiro criado com sucesso para itemId:', item.id);
      }
    } else {
      console.log('Nenhum pecasReais enviado ou array vazio');
    }

    const ordemAtualizada = await OrdemServico.findByPk(id, { include: 'itens' });
    res.json(ordemAtualizada);

  } catch (error) {
    console.error('Erro ao atualizar ordem:', error);
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

    await ordem.destroy(); // remove OS e itens relacionados
    res.json({ message: 'Ordem deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar ordem:', error);
    res.status(500).json({ error: error.message });
  }
};
