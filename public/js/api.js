// Cliente da API REST da Urna Transparente.
const BASE = '/api';

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

export const api = {
  stats: () => req('/stats'),
  cargos: () => req('/cargos'),
  rounds: () => req('/rounds'),
  candidates: (cargo, uf) => req(`/candidates?cargo=${encodeURIComponent(cargo)}${uf ? `&uf=${uf}` : ''}`),
  registerVoter: (titulo, publicKey) =>
    req('/voters/register', { method: 'POST', body: JSON.stringify({ titulo, publicKey }) }),
  vote: (payload) => req('/votes', { method: 'POST', body: JSON.stringify(payload) }),
  chain: (limit = 50, offset = 0) => req(`/chain?limit=${limit}&offset=${offset}`),
  validate: () => req('/chain/validate'),
  results: (round, cargo) => req(`/results?round=${encodeURIComponent(round)}&cargo=${encodeURIComponent(cargo)}`),
};
