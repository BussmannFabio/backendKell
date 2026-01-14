// src/models/vendedor-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Vendedor = sequelize.define('Vendedor', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    nome: { 
        type: DataTypes.STRING(255), 
        allowNull: false 
    },
    telefone: { 
        type: DataTypes.STRING(50), 
        allowNull: true // Permite telefone opcional, ajuste para false se for obrigatório
    }
}, {
    tableName: 'vendedores',
    timestamps: true, // Mantendo o padrão
    modelName: 'Vendedor'
});

export default Vendedor;