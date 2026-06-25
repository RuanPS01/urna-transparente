// Cliente de dados da Urna Transparente.
//
// Funciona em dois modos, detectados automaticamente:
//  • "server"  → há um backend Node respondendo em /api (ex.: `npm start`).
//  • "static"  → não há backend (ex.: GitHub Pages): a blockchain roda no
//                 próprio navegador via ./local-backend.js.
const BASE = '/api';

let _mode = null;
let _local = null;
let _probe = null;

async function detectMode() {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) { _mode = 'server'; return _mode; }
  } catch { /* sem servidor → estático */ }
  _mode = 'static';
  _local = await import('./local-backend.js');
  await _local.init();
  return _mode;
}

// Detecta o modo uma única vez; chamadas concorrentes compartilham a sondagem.
function ensureMode() {
  if (_mode) return Promise.resolve(_mode);
  if (!_probe) _probe = detectMode();
  return _probe;
}

/** Retorna o modo atual ('server' | 'static'), garantindo a detecção. */
export async function getMode() {
  return ensureMode();
}

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const msg = data?.error || `Erro ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }
  return data;
}

// Cada método escolhe a implementação conforme o modo, mantendo a mesma
// interface para todas as telas.
export const api = {
  async stats() {
    return (await ensureMode()) === 'server' ? req('/stats') : _local.stats();
  },
  async cargos() {
    return (await ensureMode()) === 'server' ? req('/cargos') : _local.cargos();
  },
  async rounds() {
    return (await ensureMode()) === 'server' ? req('/rounds') : _local.rounds();
  },
  async candidates(cargo, uf) {
    return (await ensureMode()) === 'server'
      ? req(`/candidates?cargo=${encodeURIComponent(cargo)}${uf ? `&uf=${uf}` : ''}`)
      : _local.candidates(cargo, uf);
  },
  async registerVoter(titulo, publicKey) {
    return (await ensureMode()) === 'server'
      ? req('/voters/register', { method: 'POST', body: JSON.stringify({ titulo, publicKey }) })
      : _local.registerVoter(titulo, publicKey);
  },
  async vote(payload) {
    return (await ensureMode()) === 'server'
      ? req('/votes', { method: 'POST', body: JSON.stringify(payload) })
      : _local.vote(payload);
  },
  async chain(limit = 50, offset = 0) {
    return (await ensureMode()) === 'server'
      ? req(`/chain?limit=${limit}&offset=${offset}`)
      : _local.chainView(limit, offset);
  },
  async validate() {
    return (await ensureMode()) === 'server' ? req('/chain/validate') : _local.validate();
  },
  async results(round, cargo) {
    return (await ensureMode()) === 'server'
      ? req(`/results?round=${encodeURIComponent(round)}&cargo=${encodeURIComponent(cargo)}`)
      : _local.results(round, cargo);
  },
};
