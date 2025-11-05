// src/sync.js
import { QueryTypes } from 'sequelize';
import { sequelize } from './src/models/index.js'; // ajusta se o path do seu index for diferente

async function getColumnDataType(schema, table, column) {
  const sql = `
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = :schema
      AND table_name = :table
      AND column_name = :column
    LIMIT 1
  `;
  const rows = await sequelize.query(sql, {
    type: QueryTypes.SELECT,
    replacements: { schema, table, column }
  });
  return rows && rows.length ? rows[0].data_type : null;
}

async function convertToDate(table, column, transaction) {
  const sql = `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE date USING ("${column}"::date)`;
  console.log('[SYNC] Executando SQL:', sql);
  await sequelize.query(sql, { transaction });
}

async function run() {
  console.log('[SYNC] Iniciando sync seguro (verifica colunas e converte se necessário)...');
  const t = await sequelize.transaction();
  try {
    const schema = 'public';
    const table = 'ordens_servico';
    const cols = ['dataInicio', 'dataRetorno'];

    for (const col of cols) {
      const dt = await getColumnDataType(schema, table, col);
      console.log(`[SYNC] coluna ${col} tipo atual:`, dt);
      if (!dt) {
        console.warn(`[SYNC] coluna ${col} não encontrada — pulei.`);
        continue;
      }
      // se não for 'date' (Postgres), converte
      if (dt !== 'date') {
        console.log(`[SYNC] convertendo coluna ${col} para DATE.`);
        await convertToDate(table, col, t);
      } else {
        console.log(`[SYNC] coluna ${col} já é DATE — nada a fazer.`);
      }
    }

    await t.commit();
    console.log('[SYNC] ALTER TABLE (se necessária) aplicada com sucesso.');

    // Agora sincroniza os models (ajustes de schema)
    console.log('[SYNC] executando sequelize.sync({ alter: true }) — isso alinhará o schema do Sequelize.');
    await sequelize.sync({ alter: true });
    console.log('[SYNC] sequelize.sync({ alter: true }) concluído.');

    console.log('[SYNC] Concluído com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('[SYNC][ERRO] ocorreu um erro:', err);
    try { await t.rollback(); } catch (e) { console.error('[SYNC] rollback falhou', e); }
    process.exit(1);
  }
}

run();
