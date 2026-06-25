// "Backend local" — usado quando NÃO há servidor Node (ex.: GitHub Pages).
// Reimplementa a mesma blockchain do servidor, mas 100% no navegador:
// mineração e validação com Web Crypto (SHA-256), assinatura ECDSA P-256 e
// persistência em localStorage. A interface espelha a do servidor para que
// as telas funcionem sem qualquer mudança.

import { sha256hex } from './wallet.js';

const DIFFICULTY = 3;
const GENESIS_TS = Date.UTC(2024, 0, 1);
const LS_CHAIN = 'urna_chain_v1';
const LS_VOTERS = 'urna_voters_v1';

const CARGOS = [
  { code: '1', nome: 'Presidente', uf: 'BR', destaque: true, cor: '#009b3a' },
  { code: '3', nome: 'Governador', uf: 'SP', destaque: false, cor: '#002776' },
  { code: '5', nome: 'Senador', uf: 'SP', destaque: false, cor: '#7b2cbf' },
  { code: '6', nome: 'Deputado Federal', uf: 'SP', destaque: false, cor: '#d00000' },
  { code: '7', nome: 'Deputado Estadual', uf: 'SP', destaque: false, cor: '#e08e0b' },
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const err = (m, s) => Object.assign(new Error(m), { status: s });

function b64ToBuf(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

// --- criptografia --------------------------------------------------------
async function verifySig(publicKeyB64, payload, signatureB64) {
  try {
    const key = await crypto.subtle.importKey('spki', b64ToBuf(publicKeyB64),
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
      b64ToBuf(signatureB64), new TextEncoder().encode(payload));
  } catch { return false; }
}
const computeNullifier = (pub, round, cargo) => sha256hex(`${pub}:${round}:${cargo}`);
const addressOf = async (pub) => (await sha256hex(pub)).slice(0, 16);

// --- bloco (mesma serialização do servidor) ------------------------------
const hashBlock = (b) => sha256hex(JSON.stringify({
  index: b.index, timestamp: b.timestamp, vote: b.vote, previousHash: b.previousHash, nonce: b.nonce,
}));

async function mine(b) {
  const target = '0'.repeat(DIFFICULTY);
  b.nonce = 0;
  b.hash = await hashBlock(b);
  while (!b.hash.startsWith(target)) {
    b.nonce++;
    b.hash = await hashBlock(b);
  }
  return b;
}

// --- estado da corrente --------------------------------------------------
let chain = [];
let nullifiers = new Set();

const reindex = () => {
  nullifiers = new Set();
  for (const b of chain) if (b.vote?.nullifier) nullifiers.add(b.vote.nullifier);
};
const persist = () => localStorage.setItem(LS_CHAIN, JSON.stringify({ difficulty: DIFFICULTY, chain }));

async function makeGenesis() {
  return mine({ index: 0, timestamp: GENESIS_TS, vote: null, previousHash: '0'.repeat(64), nonce: 0, hash: null });
}

export async function init() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_CHAIN));
    if (s?.chain?.length) { chain = s.chain; reindex(); return; }
  } catch { /* recria abaixo */ }
  chain = [await makeGenesis()];
  reindex();
  persist();
}

// --- cadastro de eleitores ----------------------------------------------
const loadVoters = () => {
  try { return JSON.parse(localStorage.getItem(LS_VOTERS)) || { byTitulo: {}, byKey: {} }; }
  catch { return { byTitulo: {}, byKey: {} }; }
};
const saveVoters = (db) => localStorage.setItem(LS_VOTERS, JSON.stringify(db));

// --- candidatos (JSON estático) -----------------------------------------
let candCache = null;
async function loadCandidates() {
  if (candCache) return candCache;
  const url = new URL('../data/candidates.json', import.meta.url);
  candCache = await (await fetch(url)).json();
  return candCache;
}

// --- rodadas -------------------------------------------------------------
const roundId = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const roundLabel = (id) => { const [y, m] = id.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; };
function bounds(id) {
  const [y, m] = id.split('-').map(Number);
  return { inicio: new Date(Date.UTC(y, m - 1, 1)).toISOString(), fim: new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString() };
}
const currentRound = () => { const id = roundId(); return { id, label: roundLabel(id), status: 'aberta', ...bounds(id) }; };
function describeRound(id) {
  const cur = currentRound().id;
  const status = id === cur ? 'aberta' : id < cur ? 'encerrada' : 'futura';
  return { id, label: roundLabel(id), status, ...bounds(id) };
}

// --- API (espelha o servidor) -------------------------------------------
export async function stats() {
  const v = await validate();
  return {
    blocos: chain.length, votos: chain.length - 1,
    eleitores: Object.keys(loadVoters().byKey).length,
    dificuldade: DIFFICULTY, integro: v.valid, rodadaAtual: currentRound(),
  };
}

export async function cargos() { return { cargos: CARGOS }; }

export async function rounds() {
  const cur = currentRound();
  const ids = new Set(chain.filter((b) => b.vote).map((b) => b.vote.roundId));
  ids.add(cur.id);
  return { current: cur, rounds: [...ids].sort().reverse().map(describeRound) };
}

export async function candidates(cargo, uf) {
  const all = await loadCandidates();
  const c = String(cargo);
  const def = CARGOS.find((x) => x.code === c);
  const u = (uf || def?.uf || 'BR').toUpperCase();
  const list = all[`${u}_${c}`] || all[c] || [];
  return { uf: u, cargo: c, cargoNome: def?.nome, source: 'seed', total: list.length, candidatos: list };
}

export async function registerVoter(titulo, publicKey) {
  if (!titulo || !publicKey) throw err('Título e chave pública são obrigatórios.', 400);
  const db = loadVoters();
  const th = await sha256hex(String(titulo).trim());
  if (db.byTitulo[th] && db.byTitulo[th] !== publicKey) throw err('Este título de eleitor já possui uma identidade registrada.', 409);
  if (db.byKey[publicKey] && db.byKey[publicKey] !== th) throw err('Esta chave já está vinculada a outro título.', 409);
  db.byTitulo[th] = publicKey;
  db.byKey[publicKey] = th;
  saveVoters(db);
  return { address: await addressOf(publicKey), registeredAt: Date.now() };
}

export async function vote(v) {
  for (const k of ['roundId', 'cargo', 'candidateId', 'voterPublicKey', 'signature', 'nullifier']) {
    if (!v[k]) throw err(`Campo obrigatório ausente: ${k}`, 400);
  }
  if (v.roundId !== currentRound().id) throw err('A rodada informada não está aberta para votação.', 400);
  if (!loadVoters().byKey[v.voterPublicKey]) throw err('Eleitor não registrado. Crie sua identidade antes de votar.', 403);

  const cargo = String(v.cargo);
  if (v.nullifier !== await computeNullifier(v.voterPublicKey, v.roundId, cargo)) throw err('Nullifier inválido para este eleitor/rodada/cargo.', 400);
  if (nullifiers.has(v.nullifier)) throw err('Este eleitor já votou nesta rodada para este cargo.', 409);

  const payload = `${v.roundId}|${cargo}|${v.candidateId}|${v.nullifier}`;
  if (!await verifySig(v.voterPublicKey, payload, v.signature)) throw err('Assinatura digital inválida.', 400);

  const prev = chain[chain.length - 1];
  const block = await mine({
    index: prev.index + 1, timestamp: Date.now(),
    vote: {
      roundId: v.roundId, cargo, candidateId: String(v.candidateId),
      candidateNome: v.candidateNome || '', candidateNumero: v.candidateNumero || '', candidatePartido: v.candidatePartido || '',
      voterPublicKey: v.voterPublicKey, voterAddress: await addressOf(v.voterPublicKey),
      nullifier: v.nullifier, signature: v.signature,
    },
    previousHash: prev.hash, nonce: 0, hash: null,
  });
  chain.push(block);
  nullifiers.add(v.nullifier);
  persist();
  return { ok: true, block: { index: block.index, hash: block.hash, previousHash: block.previousHash, nonce: block.nonce, timestamp: block.timestamp, vote: block.vote } };
}

export async function chainView(limit = 50, offset = 0) {
  const blocks = chain.slice().reverse().slice(offset, offset + limit);
  return { length: chain.length, difficulty: DIFFICULTY, offset, limit, blocks };
}

export async function validate() {
  const target = '0'.repeat(DIFFICULTY);
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    if (await hashBlock(b) !== b.hash) return { valid: false, index: i, reason: 'Conteúdo do bloco foi adulterado (hash não confere).' };
    if (!b.hash.startsWith(target)) return { valid: false, index: i, reason: 'Prova-de-trabalho inválida.' };
    if (i > 0 && b.previousHash !== chain[i - 1].hash) return { valid: false, index: i, reason: 'Elo quebrado com o bloco anterior.' };
  }
  return { valid: true, length: chain.length };
}

export async function results(round, cargo) {
  const c = String(cargo);
  const counts = new Map();
  let total = 0;
  for (const b of chain) {
    const v = b.vote;
    if (!v || v.roundId !== round || String(v.cargo) !== c) continue;
    const cur = counts.get(v.candidateId) || { candidateId: v.candidateId, nome: v.candidateNome, numero: v.candidateNumero, partido: v.candidatePartido, votos: 0 };
    cur.votos++;
    counts.set(v.candidateId, cur);
    total++;
  }
  const list = [...counts.values()].sort((a, b) => b.votos - a.votos)
    .map((r) => ({ ...r, percentual: total ? +((r.votos / total) * 100).toFixed(2) : 0 }));
  return { roundId: round, cargo: c, total, results: list, label: roundLabel(round) };
}
