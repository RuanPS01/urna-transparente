import { api } from '../api.js';
import { fmtNum, escapeHtml, avatar } from '../ui.js';
import { barsHtml } from './charts.js';

export async function render(root) {
  const rounds = await api.rounds();
  const round = rounds.current;
  const [stats, presRes, presCand] = await Promise.all([
    api.stats(),
    api.results(round.id, '1'),
    api.candidates('1', 'BR'),
  ]);

  const presidencial = presRes.total > 0
    ? barsHtml(presRes.results, { limit: 6 })
    : presidencialPreview(presCand.candidatos);

  root.innerHTML = `
    <section class="hero">
      <h1>Seu voto, uma <span>argola</span> imutável na corrente.</h1>
      <p>A <strong>Urna Transparente</strong> registra cada voto como um bloco minerado numa blockchain:
         assinado pela sua chave, encadeado ao anterior e impossível de adulterar — rastreável como uma
         criptomoeda, mas para a democracia. Candidatos vêm dos Dados Abertos do governo (TSE).</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#/votar">🗳️ Votar agora</a>
        <a class="btn btn-ghost" href="#/blockchain">⛓ Ver a blockchain</a>
      </div>
    </section>

    <div class="stat-grid">
      <div class="stat"><div class="v">${escapeHtml(round.label)}</div><div class="k">Rodada atual (nova a cada mês)</div></div>
      <div class="stat"><div class="v">${fmtNum(stats.votos)}</div><div class="k">Votos na corrente</div></div>
      <div class="stat"><div class="v">${fmtNum(stats.eleitores)}</div><div class="k">Identidades registradas</div></div>
      <div class="stat"><div class="v ${stats.integro ? 'badge-ok' : 'badge-erro'}">${stats.integro ? 'Íntegra ✅' : 'Violada ❌'}</div><div class="k">Integridade verificada</div></div>
    </div>

    <div class="panel">
      <h2>🇧🇷 Corrida presidencial — ${escapeHtml(round.label)}</h2>
      <p class="source-pill ${presCand.source === 'tse' ? 'tse' : ''}"><span class="dot"></span>
        Fonte dos candidatos: ${sourceLabel(presCand.source)}</p>
      ${presidencial}
      <div style="margin-top:18px"><a class="btn btn-primary" href="#/votar">Votar para presidente</a></div>
    </div>

    <h2 class="section-title" style="margin-top:8px">Como funciona</h2>
    <p class="section-sub">Quatro passos entre a sua escolha e um voto inviolável.</p>
    <div class="steps">
      <div class="step"><div class="n">1</div><h3>Identidade</h3><p>Seu navegador gera um par de chaves ECDSA. A chave privada nunca sai do seu dispositivo.</p></div>
      <div class="step"><div class="n">2</div><h3>Assinatura</h3><p>Ao votar, o voto é assinado digitalmente — provando a autoria sem revelar em quem você votou para terceiros.</p></div>
      <div class="step"><div class="n">3</div><h3>Mineração</h3><p>O voto vira um bloco com prova-de-trabalho, encadeado ao anterior pelo hash. É a argola da corrente.</p></div>
      <div class="step"><div class="n">4</div><h3>Verificação</h3><p>Qualquer pessoa revalida a corrente inteira. Mudar um voto antigo quebraria todos os elos seguintes.</p></div>
    </div>`;
}

function presidencialPreview(cands) {
  const top = cands.slice(0, 8).map((c) => `
    <div class="bar-cand" style="margin:6px 14px 6px 0">
      ${avatar(c.nomeUrna || c.nome, c.partido)}
      <span class="nm">${escapeHtml(c.nomeUrna || c.nome)} <small style="color:var(--txt-fraco)">${escapeHtml(c.partido)} ${escapeHtml(c.numero)}</small></span>
    </div>`).join('');
  return `
    <div class="empty" style="padding:10px 0 18px">Ainda não há votos nesta rodada. ${cands.length} candidatos disponíveis:</div>
    <div style="display:flex;flex-wrap:wrap">${top}</div>`;
}

function sourceLabel(source) {
  return source === 'tse' ? 'API do TSE (ao vivo)'
    : source === 'cache' ? 'API do TSE (cache local)'
    : 'dados-semente de 2022 (fallback offline)';
}
