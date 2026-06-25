import { api } from '../api.js';
import { ensureIdentity } from '../identity.js';
import { getWallet, computeNullifier, signPayload } from '../wallet.js';
import { avatar, escapeHtml, toast, openModal, fmtHash } from '../ui.js';
import { icons } from '../icons.js';

const VOTED_LS = 'urna_voted';
const votedSet = () => {
  try { return new Set(JSON.parse(localStorage.getItem(VOTED_LS) || '[]')); } catch { return new Set(); }
};
const markVoted = (key) => {
  const s = votedSet(); s.add(key);
  localStorage.setItem(VOTED_LS, JSON.stringify([...s]));
};
const votedKey = (round, cargo) => `${round}:${cargo}`;

const state = { cargo: '1', round: null, cargos: [], rootRef: null };

export async function render(root) {
  state.rootRef = root;
  const [cargosRes, roundsRes] = await Promise.all([api.cargos(), api.rounds()]);
  state.cargos = cargosRes.cargos;
  state.round = roundsRes.current;

  root.innerHTML = `
    <h1 class="section-title">Votar - ${escapeHtml(state.round.label)}</h1>
    <p class="section-sub">Rodada <strong style="color:var(--ok)">aberta</strong>. Escolha o cargo e registre seu voto na corrente.</p>
    <div class="cargo-tabs" id="cargo-tabs"></div>
    <div id="cand-area"></div>`;

  renderTabs();
  await renderCandidates();
}

function renderTabs() {
  const wrap = state.rootRef.querySelector('#cargo-tabs');
  wrap.innerHTML = state.cargos.map((c) => `
    <button class="cargo-tab ${c.code === state.cargo ? 'active' : ''}" data-cargo="${c.code}">
      <strong>${escapeHtml(c.nome)}</strong>
      <small>${c.uf === 'BR' ? 'Brasil' : 'UF: ' + escapeHtml(c.uf)}</small>
      ${c.destaque ? '<span class="destaque">DESTAQUE</span>' : ''}
    </button>`).join('');
  wrap.querySelectorAll('.cargo-tab').forEach((b) => {
    b.onclick = async () => {
      state.cargo = b.dataset.cargo;
      renderTabs();
      await renderCandidates();
    };
  });
}

async function renderCandidates() {
  const area = state.rootRef.querySelector('#cand-area');
  area.innerHTML = '<div class="loading">Buscando candidatos...</div>';
  const cargoDef = state.cargos.find((c) => c.code === state.cargo);
  const data = await api.candidates(state.cargo, cargoDef?.uf);

  const already = votedSet().has(votedKey(state.round.id, state.cargo));
  const banner = already
    ? `<div class="callout" style="margin-bottom:16px"><span style="color:var(--ok)">${icons.circleCheck}</span> Você já votou para <strong>${escapeHtml(cargoDef?.nome)}</strong> nesta rodada.
        <a href="#/resultados" style="color:var(--amarelo);font-weight:700">Ver resultados ${icons.arrowRight}</a></div>`
    : '';

  if (!data.candidatos.length) {
    area.innerHTML = `${banner}<div class="empty">Nenhum candidato disponível para este cargo.</div>`;
    return;
  }

  const cards = data.candidatos.map((c, i) => `
    <div class="cand">
      <div class="cand-top">
        ${avatar(c.nomeUrna || c.nome, c.partido)}
        <div>
          <div class="cand-name">${escapeHtml(c.nomeUrna || c.nome)}</div>
          <div class="cand-meta"><span class="numero">${escapeHtml(c.numero || '-')}</span><span class="tag-party">${escapeHtml(c.partido)}</span></div>
        </div>
      </div>
      <div class="cand-meta" style="font-size:.8rem">${escapeHtml(c.partidoNome || c.cargoNome || '')}</div>
      <button class="btn btn-primary btn-block" data-vote="${i}" ${already ? 'disabled' : ''}>
        ${already ? 'Voto já registrado' : 'Votar'}
      </button>
    </div>`).join('');

  area.innerHTML = `
    ${banner}
    <p class="source-pill ${data.source === 'tse' ? 'tse' : ''}"><span class="dot"></span>
      ${data.total} candidatos • fonte: ${sourceLabel(data.source)}</p>
    <div class="candidates">${cards}</div>`;

  if (!already) {
    area.querySelectorAll('[data-vote]').forEach((btn) => {
      btn.onclick = () => castVote(data.candidatos[Number(btn.dataset.vote)]);
    });
  }
}

async function castVote(cand) {
  const hadWallet = !!getWallet();
  const wallet = await ensureIdentity();
  if (!wallet) return;
  // Se a identidade acabou de ser criada, evita empilhar modais:
  // o eleitor confirma o voto num segundo clique.
  if (!hadWallet) {
    await renderCandidates();
    toast('Identidade criada! Clique em "Votar" para confirmar.', 'ok');
    return;
  }

  const round = state.round.id;
  const cargo = state.cargo;
  confirmVote(cand, async () => {
    try {
      const nullifier = await computeNullifier(wallet.publicKey, round, cargo);
      const payload = `${round}|${cargo}|${cand.id}|${nullifier}`;
      const signature = await signPayload(wallet.privateKey, payload);
      const res = await api.vote({
        roundId: round, cargo, candidateId: cand.id,
        candidateNome: cand.nomeUrna || cand.nome,
        candidateNumero: cand.numero, candidatePartido: cand.partido,
        voterPublicKey: wallet.publicKey, nullifier, signature,
      });
      markVoted(votedKey(round, cargo));
      toast(`Voto confirmado! Bloco #${res.block.index} minerado.`, 'ok');
      showReceipt(cand, res.block);
      await renderCandidates();
    } catch (e) {
      if (e.status === 409) {
        markVoted(votedKey(round, cargo));
        toast('Você já votou neste cargo nesta rodada.', 'error');
        await renderCandidates();
      } else {
        toast(e.message || 'Falha ao registrar voto.', 'error');
      }
    }
  });
}

function confirmVote(cand, onConfirm) {
  openModal((dismiss) => {
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Confirmar voto</h3>
      <p>Você está prestes a assinar e registrar seu voto na blockchain. Esta ação é definitiva e única para este cargo na rodada atual.</p>
      <div class="cand-top" style="background:var(--bg-2);padding:14px;border-radius:12px;margin-bottom:16px">
        ${avatar(cand.nomeUrna || cand.nome, cand.partido)}
        <div><div class="cand-name">${escapeHtml(cand.nomeUrna || cand.nome)}</div>
        <div class="cand-meta"><span class="numero">${escapeHtml(cand.numero || '-')}</span><span class="tag-party">${escapeHtml(cand.partido)}</span></div></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-act="cancel">Cancelar</button>
        <button class="btn btn-primary" data-act="ok">Assinar e votar</button>
      </div>`;
    box.querySelector('[data-act="cancel"]').onclick = dismiss;
    box.querySelector('[data-act="ok"]').onclick = async () => {
      box.querySelector('[data-act="ok"]').disabled = true;
      box.querySelector('[data-act="ok"]').textContent = 'Minerando...';
      dismiss();
      await onConfirm();
    };
    return box;
  });
}

function showReceipt(cand, block) {
  openModal((dismiss) => {
    const box = document.createElement('div');
    box.innerHTML = `
      <h3 class="modal-title">${icons.receipt} Comprovante de voto</h3>
      <p>Seu voto em <strong>${escapeHtml(cand.nomeUrna || cand.nome)}</strong> virou a argola <strong>#${block.index}</strong> da corrente.</p>
      <div class="key-box">
        <div><span style="color:var(--txt-fraco)">Hash do bloco:</span><br><code style="color:var(--amarelo)">${escapeHtml(block.hash)}</code></div>
        <div style="margin-top:8px"><span style="color:var(--txt-fraco)">Bloco anterior:</span><br><code>${escapeHtml(fmtHash(block.previousHash, 20, 10))}</code></div>
        <div style="margin-top:8px"><span style="color:var(--txt-fraco)">Nonce (prova-de-trabalho):</span> ${block.nonce}</div>
      </div>
      <div class="modal-actions">
        <a class="btn btn-ghost" href="#/blockchain" data-act="explorer">Ver na blockchain</a>
        <button class="btn btn-primary" data-act="ok">Pronto</button>
      </div>`;
    box.querySelector('[data-act="ok"]').onclick = dismiss;
    box.querySelector('[data-act="explorer"]').onclick = dismiss;
    return box;
  });
}

function sourceLabel(source) {
  return source === 'tse' ? 'API do TSE (ao vivo)'
    : source === 'cache' ? 'API do TSE (cache)'
    : 'dados-semente 2022 (offline)';
}
