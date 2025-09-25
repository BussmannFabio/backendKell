// scripts/testFluxo.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Models (usa seu mesmo models/index.js)
import {
  Produto,
  ProdutoTamanho,
  EstoqueProduto,
  Confeccao,
  sequelize
} from '../src/models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPATH = path.join(__dirname, 'testFluxo-output.json');

const API = process.env.API_URL || 'http://localhost:3000';
axios.defaults.baseURL = API;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// presets de preço (dúzia)
const PRESETS_DUZIA = [120, 125, 130, 110, 140];

function makeProdutoPayload(codigo, idx = 0) {
  const valorDuzia = PRESETS_DUZIA[idx % PRESETS_DUZIA.length];
  const valorPeca = Math.round(valorDuzia / 12);
  return {
    codigo: String(codigo),
    valorMaoDeObraDuzia: valorDuzia,
    valorMaoDeObraPeca: valorPeca
  };
}

async function ensureConfeccoes() {
  console.log('\n=== Garantindo confeccões no DB ===');
  const created = [];
  for (let i = 1; i <= 5; i++) {
    const nome = `Oficina ${i}`;
    const [c] = await Confeccao.findOrCreate({
      where: { nome },
      defaults: { nome }
    });
    console.log(`[OK] Oficina -> ${nome} (id=${c.id})`);
    created.push({ id: c.id, nome });
  }
  return created;
}

async function ensureProdutos(produtosDesejados) {
  console.log('\n=== Garantindo produtos + tamanhos + estoques ===');
  const resultados = [];
  let idx = 0;
  for (const p of produtosDesejados) {
    const payload = makeProdutoPayload(p.codigo, idx);
    const [produto, createdProduto] = await Produto.findOrCreate({
      where: { codigo: payload.codigo },
      defaults: payload
    });

    // atualiza preços caso já exista
    if (!createdProduto) {
      produto.valorMaoDeObraDuzia = payload.valorMaoDeObraDuzia;
      produto.valorMaoDeObraPeca = payload.valorMaoDeObraPeca;
      await produto.save();
    }

    const tamanhoNorm = String(p.tamanho || 'M').trim().toUpperCase();
    const [pt] = await ProdutoTamanho.findOrCreate({
      where: { produtoId: produto.id, tamanho: tamanhoNorm },
      defaults: { produtoId: produto.id, tamanho: tamanhoNorm, estoqueMinimo: 0 }
    });

    const [estoque] = await EstoqueProduto.findOrCreate({
      where: { produtoTamanhoId: pt.id },
      defaults: { produtoTamanhoId: pt.id, quantidadeAberta: 0, quantidadePronta: 0 }
    });

    resultados.push({
      codigo: payload.codigo,
      produtoId: produto.id,
      tamanho: tamanhoNorm,
      produtoTamanhoId: pt.id,
      estoqueId: estoque.id,
      valorMaoDeObraDuzia: payload.valorMaoDeObraDuzia,
      valorMaoDeObraPeca: payload.valorMaoDeObraPeca
    });

    console.log(`[Produto] ${payload.codigo} (id=${produto.id}) tamanho=${tamanhoNorm} ptId=${pt.id} estoqueId=${estoque.id}`);
    idx++;
  }
  return resultados;
}

async function registrarOuLoginAdmin(nome = 'admin', senha = '123456') {
  // tenta login primeiro
  try {
    const loginRes = await axios.post('/auth/login', { nome, senha });
    console.log('=== login admin ok ===');
    return { ok: true, token: loginRes.data.token, usuario: loginRes.data.usuario || null };
  } catch (err) {
    // se 404/401 etc, tenta registrar
    console.log('Admin não existe ou login falhou. Tentando registrar...');
    // tenta registrar com roleId:1 primeiro (se seu backend exigir)
    const tryBodies = [
      { nome, senha, roleId: 1 },
      { nome, senha } // fallback
    ];
    for (const body of tryBodies) {
      try {
        const regRes = await axios.post('/auth/register', body);
        // se registrar funcionar, tenta login
        console.log('=== registro admin ok ===', regRes.data);
        const loginRes2 = await axios.post('/auth/login', { nome, senha });
        return { ok: true, token: loginRes2.data.token, usuario: loginRes2.data.usuario || null };
      } catch (e) {
        const status = e.response?.status;
        const data = e.response?.data || e.message;
        console.warn('Tentativa registrar falhou', { body, status, data });
        // continua para próximo body
      }
    }
    return { ok: false, error: 'Falha ao registrar/login admin' };
  }
}

async function criarOrdem(payload) {
  try {
    const res = await axios.post('/ordens', payload);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.response?.data || err.message };
  }
}

async function retornarOrdem(ordemId, payload) {
  try {
    const res = await axios.patch(`/ordens/${ordemId}/retornar`, payload);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.response?.data || err.message };
  }
}

async function main() {
  console.log('=== INICIO TESTE FLUXO MASSIVO ===');

  // lista de produtos que vamos garantir (pode ser ampliada)
  const produtosDesejados = [];
  for (let i = 1; i <= 25; i++) {
    const codigo = (200 + i).toString();
    const tamanho = (i % 2 === 0) ? 'MM' : 'GG';
    produtosDesejados.push({ codigo, tamanho });
  }

  try {
    await sequelize.authenticate();

    // 1) garantir admin e pegar token
    console.log('\n=== Criando/Logando usuário admin ===');
    const admin = await registrarOuLoginAdmin('admin', '123456');
    if (!admin.ok) {
      console.error('❌ Não foi possível obter token admin:', admin.error);
      return;
    }
    const token = admin.token;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('Token obtido e aplicado no axios.');

    // 2) garantir confeccoes e produtos (via modelos)
    const confeccoes = await ensureConfeccoes();
    const produtosInfo = await ensureProdutos(produtosDesejados);

    // 3) criar 500 ordens (vai distribuir entre confeccoes/produtos)
    console.log('\n=== Criando 500 ordens ===');
    const ordensCriadas = [];
    const totalCriar = 500;
    for (let i = 0; i < totalCriar; i++) {
      const pi = produtosInfo[i % produtosInfo.length];
      const oficina = confeccoes[i % confeccoes.length];

      const item = {
        produtoId: pi.produtoId,
        tamanho: pi.tamanho,
        volumes: 1 + (i % 3), // 1..3
        pecasPorVolume: 20 + (i % 5) * 5, // variação
        corte: `AUTO-${pi.codigo}-${i}`
      };

      const payload = { dataInicio: new Date().toISOString(), confeccaoId: oficina.id, itens: [item] };
      const res = await criarOrdem(payload);

      if (!res.ok) {
        console.error(`❌ Erro criando OS #${i + 1}:`, res.error);
        // não aborta, segue
        continue;
      }
      // extrai id (dentro res.data.ordem possivelmente)
      const ordem = res.data.ordem || res.data;
      ordensCriadas.push({ id: ordem.id, produto: pi.codigo, confeccao: oficina.nome });
      if ((i + 1) % 50 === 0) console.log(`-> ${i + 1} ordens criadas`);
    }
    console.log(`✅ Total ordens criadas: ${ordensCriadas.length}`);

    // 4) retornar 470 ordens: se tiver menos que 470 criadas, retorna o máximo possível
    const toReturnCount = Math.min(470, ordensCriadas.length);
    console.log(`\n=== Retornando ${toReturnCount} ordens (de ${ordensCriadas.length}) ===`);
    const retornos = [];
    for (let i = 0; i < toReturnCount; i++) {
      const ordem = ordensCriadas[i];
      // cria payload com retornoTotal true e pecasComDefeito variável
      const defeitos = (i % 10 === 0) ? 2 : 0; // alguns defeitos
      const payload = {
        itens: [], // quando vazio e retornoTotal=true, controlador usa pendentes
        pecasComDefeito: defeitos,
        retornoTotal: true,
        fecharSemQuantidade: false
      };
      const res = await retornarOrdem(ordem.id, payload);
      if (!res.ok) {
        console.error(`❌ Erro retornando OS ${ordem.id}:`, res.error);
        continue;
      }
      retornos.push({ ordemId: ordem.id, produto: ordem.produto, defeitos });
      if ((i + 1) % 50 === 0) console.log(`-> ${i + 1} ordens retornadas`);
    }

    // 5) buscar estoques e financeiro via sequelize (local) para relatório
    const estoques = await EstoqueProduto.findAll({
      include: [{ model: ProdutoTamanho, as: 'produtoTamanhoPai', include: [{ model: Produto, as: 'produtoPai' }] }]
    });

    let financeiro = [];
    try {
      const FinModel = sequelize.models.Financeiro || sequelize.models.financeiro;
      if (FinModel) {
        financeiro = await FinModel.findAll();
      }
    } catch (e) {
      // ignora se não existir
      financeiro = [];
    }

    const output = {
      api: API,
      timestamp: new Date().toISOString(),
      confeccoes,
      produtosInfo,
      ordensCriadasCount: ordensCriadas.length,
      ordensCriadasSample: ordensCriadas.slice(0, 10),
      retornosCount: retornos.length,
      retornosSample: retornos.slice(0, 10),
      estoques: estoques.map(e => ({
        produtoCodigo: e.produtoTamanhoPai?.produtoPai?.codigo,
        tamanho: e.produtoTamanhoPai?.tamanho,
        aberta: e.quantidadeAberta,
        pronta: e.quantidadePronta
      })),
      financeiro: financeiro.map(f => ({
        id: f.id,
        ordemId: f.ordemId,
        valorMaoDeObra: f.valorMaoDeObra,
        status: f.status
      }))
    };

    fs.writeFileSync(OUTPATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n=== Teste finalizado — veja ${OUTPATH} ===`);

  } catch (err) {
    console.error('❌ Erro fatal no script:', err);
  } finally {
    console.log('=== FIM TESTE FLUXO MASSIVO ===');
    try { await sequelize.close(); } catch(e){/*ignore*/ }
  }
}

main();
