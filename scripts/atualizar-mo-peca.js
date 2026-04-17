/**
 * Script de migração: recalcula valorMaoDeObraPeca para todos os produtos.
 * Nova fórmula: valorMaoDeObraPeca = valorMaoDeObraDuzia * 1.70
 *
 * Uso: node scripts/atualizar-mo-peca.js
 */

import { Produto } from '../src/models/index.js';
import sequelize from '../src/config/database.js';

async function atualizarMoPeca() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de dados.');

    const produtos = await Produto.findAll();
    console.log(`📦 ${produtos.length} produto(s) encontrado(s). Atualizando...`);

    let atualizados = 0;
    for (const p of produtos) {
      const moBase      = Number(p.valorMaoDeObraDuzia || 0);
      const moExcedente = parseFloat((moBase * 1.70).toFixed(4));

      console.log(`  Produto ${p.codigo}: M.O peça = ${moBase} → M.O +70% = ${moExcedente}`);

      await p.update({ valorMaoDeObraPeca: moExcedente });
      atualizados++;
    }

    console.log(`\n✅ ${atualizados} produto(s) atualizado(s) com sucesso!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao atualizar produtos:', err);
    process.exit(1);
  }
}

atualizarMoPeca();
