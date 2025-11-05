// debug-assocs.mjs
import './src/models/index.js';
import { Produto } from './src/models/index.js';

console.log('Produto.associations keys:', Object.keys(Produto.associations || {}));
console.log('tamanhos exists?', !!(Produto.associations && Produto.associations.tamanhos));
process.exit(0);
