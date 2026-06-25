import { api } from '../api.js';
import { escapeHtml, fmtNum } from '../ui.js';
import { barsHtml } from './charts.js';

const state = { round: null, cargo: '1', cargos: [], rounds: [], rootRef: null };

export async function render(root) {
  state.rootRef = root;
  const [cargosRes, roundsRes] = await Promise.all([api.cargos(), api.rounds()]);
  state.cargos = cargosRes.cargos;
  state.rounds = roundsRes.rounds;
  if (!state.round) state.round = roundsRes.current.id;

  root.innerHTML = `
    <h1 class="section-title">Resultados</h1>
    <p class="section-sub">Apuração contada diretamente da blockchain — qualquer um pode reconferir.</p>
    <div class="round-select">
      <label for="round-sel">Rodada:</label>
      <select id="round-sel">
        ${state.rounds.map((r) => `<option value="${r.id}" ${r.id === state.round ? 'selected' : ''}>${escapeHtml(r.label)}${r.status === 'aberta' ? ' • aberta' : ''}</option>`).join('')}
      </select>
      <button class="btn btn-ghost" id="refresh">↻ Atualizar</button>
    </div>
    <div class="cargo-tabs" id="cargo-tabs"></div>
    <div class="panel" id="res-area"></div>`;

  root.querySelector('#round-sel').onchange = async (e) => {
    state.round = e.target.value;
    await renderResults();
  };
  root.querySelector('#refresh').onclick = async () => {
    await renderResults();
  };

  renderTabs();
  await renderResults();
}

function renderTabs() {
  const wrap = state.rootRef.querySelector('#cargo-tabs');
  wrap.innerHTML = state.cargos.map((c) => `
    <button class="cargo-tab ${c.code === state.cargo ? 'active' : ''}" data-cargo="${c.code}">
      <strong>${escapeHtml(c.nome)}</strong>
      <small>${c.uf === 'BR' ? 'Brasil' : 'UF: ' + escapeHtml(c.uf)}</small>
    </button>`).join('');
  wrap.querySelectorAll('.cargo-tab').forEach((b) => {
    b.onclick = async () => {
      state.cargo = b.dataset.cargo;
      renderTabs();
      await renderResults();
    };
  });
}

async function renderResults() {
  const area = state.rootRef.querySelector('#res-area');
  area.innerHTML = '<div class="loading">Apurando…</div>';
  const data = await api.results(state.round, state.cargo);
  const cargoDef = state.cargos.find((c) => c.code === state.cargo);
  area.innerHTML = `
    <h2>${escapeHtml(cargoDef?.nome || 'Cargo')} — ${escapeHtml(data.label)}</h2>
    <p class="section-sub">${fmtNum(data.total)} ${data.total === 1 ? 'voto apurado' : 'votos apurados'}</p>
    ${barsHtml(data.results)}`;
}
