import { api } from '../api.js';
import { fmtHash, fmtDateTime, escapeHtml, avatar, toast, fmtNum } from '../ui.js';
import { icons } from '../icons.js';

const LIMIT = 25;
const state = { offset: 0, total: 0, rootRef: null };

export async function render(root) {
  state.rootRef = root;
  state.offset = 0;
  root.innerHTML = `
    <h1 class="section-title">Explorador da Blockchain</h1>
    <p class="section-sub">Cada bloco é uma <strong>argola</strong>: um voto encadeado ao anterior pelo seu hash. Mude um voto antigo e todos os elos seguintes quebram.</p>
    <div id="status-area"></div>
    <div class="blocks" id="blocks"></div>
    <div style="text-align:center;margin-top:22px">
      <button class="btn btn-ghost" id="more">Carregar blocos anteriores</button>
    </div>`;

  await renderStatus();
  await loadMore();
  root.querySelector('#more').onclick = loadMore;
}

async function renderStatus() {
  const el = state.rootRef.querySelector('#status-area');
  const [v, stats] = await Promise.all([api.validate(), api.stats()]);
  state.total = stats.blocos;
  el.innerHTML = `
    <div class="chain-status ${v.valid ? 'ok' : 'bad'}">
      <span class="ic" style="color:${v.valid ? 'var(--ok)' : 'var(--erro)'}">${v.valid ? icons.lock : icons.alert}</span>
      <div style="flex:1">
        <strong>${v.valid ? 'Corrente íntegra' : 'Corrente comprometida!'}</strong><br>
        <span style="color:var(--txt-suave);font-size:.9rem">
          ${v.valid
            ? `${fmtNum(stats.blocos)} blocos validados • ${fmtNum(stats.votos)} votos • prova-de-trabalho de ${stats.dificuldade} zeros`
            : `Falha no bloco #${v.index}: ${escapeHtml(v.reason)}`}
        </span>
      </div>
      <button class="btn btn-ghost" id="revalidate">${icons.refresh} Revalidar</button>
    </div>`;
  el.querySelector('#revalidate').onclick = async () => {
    await renderStatus();
    toast('Corrente revalidada.', 'ok');
  };
}

async function loadMore() {
  const wrap = state.rootRef.querySelector('#blocks');
  const data = await api.chain(LIMIT, state.offset);
  state.total = data.length;
  const startEmpty = wrap.children.length === 0;
  const html = data.blocks.map((b, i) => {
    const connector = (startEmpty && i === 0) ? '' : `<div class="chain-link" aria-hidden="true">${icons.link}</div>`;
    return connector + blockHtml(b);
  }).join('');
  wrap.insertAdjacentHTML('beforeend', html);
  state.offset += data.blocks.length;
  const moreBtn = state.rootRef.querySelector('#more');
  moreBtn.style.display = state.offset >= data.length ? 'none' : '';
}

function blockHtml(b) {
  const isGenesis = b.index === 0;
  const v = b.vote;
  const body = isGenesis
    ? `<dl class="kv"><dt>Tipo</dt><dd>Bloco gênese (origem da corrente)</dd></dl>`
    : `
      <div class="vote-line">
        ${avatar(v.candidateNome, v.candidatePartido, '')}
        <strong>${escapeHtml(v.candidateNome || 'Candidato')}</strong>
        <span class="numero">${escapeHtml(v.candidateNumero || '-')}</span>
        <span class="tag-party">${escapeHtml(v.candidatePartido || '')}</span>
        <span style="color:var(--txt-suave);font-size:.85rem">• cargo ${escapeHtml(v.cargo)} • rodada ${escapeHtml(v.roundId)}</span>
      </div>
      <dl class="kv" style="margin-top:10px">
        <dt>Eleitor</dt><dd><code>${escapeHtml(v.voterAddress || '')}</code></dd>
        <dt>Nullifier</dt><dd><code>${escapeHtml(fmtHash(v.nullifier, 16, 8))}</code></dd>
      </dl>`;

  return `
    <div class="block">
      <div class="block-head">
        <span class="block-idx ${isGenesis ? 'genesis' : ''}">#${b.index}</span>
        ${isGenesis ? '<strong>Gênese</strong>' : '<strong>Voto</strong>'}
        <span class="block-time">${fmtDateTime(b.timestamp)}</span>
      </div>
      ${body}
      <dl class="kv" style="margin-top:10px">
        <dt>Hash</dt><dd><code>${escapeHtml(b.hash)}</code></dd>
        <dt class="hash-prev">Hash anterior</dt><dd class="hash-prev"><code>${escapeHtml(b.previousHash)}</code></dd>
        <dt>Nonce</dt><dd>${fmtNum(b.nonce)}</dd>
      </dl>
    </div>`;
}
