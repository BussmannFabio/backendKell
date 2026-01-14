import { Vendedor, Cliente } from '../models/index.js';

class VendedorController {
    // 1. CADASTRAR (CREATE)
    async create(req, res) {
        try {
            const { nome, telefone } = req.body;
            const novoVendedor = await Vendedor.create({ nome, telefone });

            return res.status(201).json(novoVendedor);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao cadastrar vendedor.' });
        }
    }

    // 2. LISTAR TODOS (READ ALL)
    async index(req, res) {
        try {
            const vendedores = await Vendedor.findAll({
                // Opcional: Inclui a lista de clientes que cada vendedor possui
                include: [{ model: Cliente, as: 'clientes', attributes: ['nome', 'documento'] }]
            });
            return res.status(200).json(vendedores);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao buscar vendedores.' });
        }
    }

    // 3. BUSCAR POR ID (READ ONE)
    async show(req, res) {
        try {
            const { id } = req.params;
            const vendedor = await Vendedor.findByPk(id, {
                include: [{ model: Cliente, as: 'clientes', attributes: ['nome', 'documento'] }]
            });

            if (!vendedor) {
                return res.status(404).json({ error: 'Vendedor não encontrado.' });
            }

            return res.status(200).json(vendedor);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao buscar vendedor.' });
        }
    }

    // 4. ATUALIZAR (UPDATE)
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nome, telefone } = req.body;

            const [updated] = await Vendedor.update({ nome, telefone }, {
                where: { id }
            });

            if (updated) {
                const vendedorAtualizado = await Vendedor.findByPk(id);
                return res.status(200).json(vendedorAtualizado);
            }
            
            return res.status(404).json({ error: 'Vendedor não encontrado para atualização.' });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao atualizar vendedor.' });
        }
    }

    // 5. DELETAR (DELETE)
    async destroy(req, res) {
        try {
            const { id } = req.params;
            
            // Opcional: Verificar se há clientes associados antes de deletar
            const clienteAssociado = await Cliente.findOne({ where: { vendedorId: id } });
            if (clienteAssociado) {
                 return res.status(400).json({ 
                    error: 'Não é possível excluir o vendedor, pois ele possui clientes associados.' 
                });
            }

            const deleted = await Vendedor.destroy({
                where: { id }
            });

            if (deleted) {
                return res.status(204).send();
            }
            
            return res.status(404).json({ error: 'Vendedor não encontrado para exclusão.' });
            
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao excluir vendedor.' });
        }
    }
}

export default new VendedorController();