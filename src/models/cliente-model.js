// src/models/cliente-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Cliente = sequelize.define('Cliente', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    nome: { 
        type: DataTypes.STRING(255), 
        allowNull: false 
    },
    endereco: { 
        type: DataTypes.STRING(500), 
        allowNull: false 
    },
    documento: { // CPF/CNPJ
        type: DataTypes.STRING(20), 
        allowNull: false, 
        unique: true 
    },
    telefone: { 
        type: DataTypes.STRING(50), 
        allowNull: true // Se não for obrigatório, use 'true'
    }
}, {
    tableName: 'clientes',
    timestamps: false, // Recomendo manter, mas se quiser seguir o padrão do seu Produto, use 'false'
    modelName: 'Cliente'
});

export default Cliente;