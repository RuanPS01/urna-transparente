import { avatar, escapeHtml, partyColor, fmtNum } from '../ui.js';

/** Gráfico de barras horizontais para um array de resultados apurados. */
export function barsHtml(results, { limit = 99 } = {}) {
  if (!results.length) {
    return `<div class="empty">Nenhum voto registrado ainda nesta rodada/cargo.<br>Seja o primeiro a votar!</div>`;
  }
  const max = Math.max(...results.map((r) => r.votos), 1);
  const rows = results.slice(0, limit).map((r) => {
    const w = Math.max((r.votos / max) * 100, 2);
    return `
      <div class="bar-row">
        <div class="bar-cand">
          ${avatar(r.nome, r.partido)}
          <span class="nm" title="${escapeHtml(r.nome)}">${escapeHtml(r.nome)} <small style="color:var(--txt-fraco)">${escapeHtml(r.partido)}</small></span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${partyColor(r.partido)}"></div></div>
        <div>
          <div class="bar-val">${r.percentual}%</div>
          <div class="bar-votes">${fmtNum(r.votos)} ${r.votos === 1 ? 'voto' : 'votos'}</div>
        </div>
      </div>`;
  }).join('');
  return `<div class="bars">${rows}</div>`;
}
