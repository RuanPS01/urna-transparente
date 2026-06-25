// Bootstrap da SPA: roteamento por hash, navegação e selo da carteira.
import { getWallet, clearWallet } from './wallet.js';
import { openIdentityModal } from './identity.js';
import { escapeHtml, toast } from './ui.js';

import * as home from './views/home.js';
import * as votar from './views/votar.js';
import * as resultados from './views/resultados.js';
import * as explorer from './views/explorer.js';
import * as sobre from './views/sobre.js';

const routes = { '': home, votar, resultados, blockchain: explorer, sobre };

function currentPath() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash.split('?')[0];
}

function setActiveNav(path) {
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === path);
  });
}

async function route() {
  const path = currentPath();
  const view = routes[path] || home;
  setActiveNav(path in routes ? path : '');
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">Carregando…</div>';
  try {
    await view.render(app);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="error">Não foi possível carregar esta tela.<br><small>${escapeHtml(e.message)}</small></div>`;
  }
  window.scrollTo(0, 0);
  document.getElementById('nav').classList.remove('open');
}

function renderWalletBadge() {
  const el = document.getElementById('wallet-badge');
  const w = getWallet();
  if (w) {
    el.innerHTML = `
      <span class="wallet-chip" title="Identidade do eleitor">
        <span class="dot"></span>
        <code>${escapeHtml(w.address)}</code>
        <button data-act="logout" title="Encerrar identidade">⏻</button>
      </span>`;
    el.querySelector('[data-act="logout"]').onclick = () => {
      clearWallet();
      renderWalletBadge();
      toast('Identidade encerrada neste navegador.', 'ok');
    };
  } else {
    el.innerHTML = `
      <span class="wallet-chip none">
        <span class="dot"></span>
        <button data-act="create" style="color:var(--amarelo);font-weight:700">Criar identidade</button>
      </span>`;
    el.querySelector('[data-act="create"]').onclick = () => openIdentityModal();
  }
}

function setupNavToggle() {
  document.getElementById('nav-toggle').onclick = () => {
    document.getElementById('nav').classList.toggle('open');
  };
}

window.addEventListener('hashchange', route);
window.addEventListener('wallet-changed', renderWalletBadge);
window.addEventListener('DOMContentLoaded', () => {
  setupNavToggle();
  renderWalletBadge();
  route();
});
