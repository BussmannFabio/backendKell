import { Cliente, Vendedor } from '../models/index.js';

class ClienteController {
    // 1. CADASTRAR (CREATE)
    async create(req, res) {
        try {
            // Assume que 'vendedorId' será enviado no corpo da requisição
            const { nome, endereco, documento, telefone, vendedorId } = req.body;

            // Opcional: Verifica se o vendedor existe antes de cadastrar o cliente
            if (vendedorId) {
                const vendedor = await Vendedor.findByPk(vendedorId);
                if (!vendedor) {
                    return res.status(404).json({ error: 'Vendedor não encontrado.' });
                }
            }

            const novoCliente = await Cliente.create({
                nome,
                endereco,
                documento,
                telefone,
                vendedorId // O Sequelize lida com a Foreign Key
            });

            return res.status(201).json(novoCliente);
        } catch (error) {
            console.error(error);
            // Captura erro de duplicidade de documento (UNIQUE constraint)
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'Documento (CPF/CNPJ) já cadastrado.' });
            }
            return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
        }
    }

    // 2. LISTAR TODOS (READ ALL)
    async index(req, res) {
        try {
            const clientes = await Cliente.findAll({
                // Inclui o nome do vendedor associado
                include: [{ model: Vendedor, as: 'vendedor', attributes: ['nome'] }] 
            });
            return res.status(200).json(clientes);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao buscar clientes.' });
        }
    }

    // 3. BUSCAR POR ID (READ ONE)
    async show(req, res) {
        try {
            const { id } = req.params;
            const cliente = await Cliente.findByPk(id, {
                include: [{ model: Vendedor, as: 'vendedor', attributes: ['nome'] }]
            });

            if (!cliente) {
                return res.status(404).json({ error: 'Cliente não encontrado.' });
            }

            return res.status(200).json(cliente);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao buscar cliente.' });
        }
    }

    // 4. ATUALIZAR (UPDATE)
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nome, endereco, documento, telefone, vendedorId } = req.body;

            const [updated] = await Cliente.update({
                nome,
                endereco,
                documento,
                telefone,
                vendedorId
            }, {
                where: { id }
            });

            if (updated) {
                const clienteAtualizado = await Cliente.findByPk(id);
                return res.status(200).json(clienteAtualizado);
            }
            
            return res.status(404).json({ error: 'Cliente não encontrado para atualização.' });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
        }
    }

    // 5. DELETAR (DELETE)
    async destroy(req, res) {
        try {
            const { id } = req.params;
            const deleted = await Cliente.destroy({
                where: { id }
            });

            if (deleted) {
                return res.status(204).send(); // 204 No Content para sucesso sem corpo de resposta
            }
            
            return res.status(404).json({ error: 'Cliente não encontrado para exclusão.' });
            
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao excluir cliente.' });
        }
    }
}

export default new ClienteController();