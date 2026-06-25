import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createStorage } from './storage/index.js';
import { createApi } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const storage = createStorage(config);
await storage.init();
const chain = await storage.loadChain(config.difficulty);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api', createApi({ chain, storage }));

// Frontend estático (SPA com rotas por hash)
app.use(express.static(publicDir));
app.get(/.*/, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(config.port, () => {
  const v = chain.validate();
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║            🗳️   URNA TRANSPARENTE             ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`  ➜ http://localhost:${config.port}`);
  console.log(`  ➜ Persistência: ${storage.kind === 'postgres' ? 'Postgres (contagem global)' : 'arquivo local'}`);
  console.log(`  ➜ Blocos: ${chain.chain.length}  |  Votos: ${chain.voteCount}  |  PoW: ${config.difficulty} zeros`);
  console.log(`  ➜ Integridade da corrente: ${v.valid ? 'OK ✅' : 'FALHA ❌ (bloco ' + v.index + ')'}`);
  console.log(`  ➜ API do TSE: ${config.tse.enabled ? 'habilitada (com fallback p/ dados-semente)' : 'desabilitada'}\n`);
});
