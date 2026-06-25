// Pequenos utilitários de interface compartilhados pelas telas.

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const PARTY_COLORS = {
  PT: '#c0212b', PL: '#1a4ba0', PDT: '#e23b2e', MDB: '#0a7d3a', NOVO: '#ff6a00',
  UNIÃO: '#1e6fd9', PSDB: '#0a73c4', PSB: '#e0a800', PSOL: '#7b2cbf', PCdoB: '#b00000',
  REPUBLICANOS: '#0d3b66', PTB: '#1f9c4a', PCB: '#9b1b1b', PSTU: '#cc2222', DC: '#2e7d32',
  UP: '#b71c1c', PRTB: '#1565c0', REDE: '#2e8b57',
};

export function partyColor(sigla) {
  if (PARTY_COLORS[sigla]) return PARTY_COLORS[sigla];
  // cor estável derivada do texto
  let h = 0;
  for (const ch of String(sigla || '?')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

export function initials(nome) {
  const parts = String(nome || '?').trim().split(/\s+/);
  const first = parts[0]?.[0] || '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function avatar(nome, sigla, cls = '') {
  return `<div class="avatar ${cls}" style="background:${partyColor(sigla)}">${escapeHtml(initials(nome))}</div>`;
}

export function fmtHash(hash, head = 10, tail = 6) {
  if (!hash) return '';
  return hash.length <= head + tail ? hash : `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

export function fmtDateTime(ts) {
  try {
    return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch { return String(ts); }
}

export function fmtNum(n) {
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function toast(message, type = 'ok') {
  const area = document.getElementById('toast-area');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'err' : type}`;
  el.textContent = message;
  area.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

// Modal genérico. `buildContent` recebe a função de fechar e retorna um nó.
export function openModal(buildContent) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const box = document.createElement('div');
  box.className = 'modal';
  box.appendChild(buildContent(close));
  overlay.appendChild(box);
  root.appendChild(overlay);
  return close;
}
