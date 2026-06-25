// Fluxo de criação da identidade do eleitor (a carteira).
import { api } from './api.js';
import { createWallet, getWallet, clearWallet } from './wallet.js';
import { openModal, toast, escapeHtml } from './ui.js';
import { icons } from './icons.js';

function randomTitulo() {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function notifyChanged() {
  window.dispatchEvent(new CustomEvent('wallet-changed'));
}

/** Abre o modal de criação de identidade. Resolve com a carteira ou null. */
export function openIdentityModal() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (w) => { if (!settled) { settled = true; resolve(w); } };

    const close = openModal((dismiss) => {
      const box = document.createElement('div');
      box.innerHTML = `
        <h3 class="modal-title">${icons.idCard} Criar identidade de eleitor</h3>
        <p>Geramos um par de chaves criptográficas no seu navegador. A chave
        privada fica só com você e assina seus votos - como uma carteira de criptomoeda.</p>
        <div class="field">
          <label for="titulo">Título de eleitor (simulado)</label>
          <input id="titulo" inputmode="numeric" maxlength="14" value="${randomTitulo()}" />
        </div>
        <p style="font-size:.82rem">Cada título pode registrar apenas <strong>uma</strong> identidade. Guarde sua carteira: ela vive neste navegador.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">Cancelar</button>
          <button class="btn btn-primary" data-act="create">Gerar identidade</button>
        </div>`;

      box.querySelector('[data-act="cancel"]').onclick = () => { dismiss(); done(null); };
      box.querySelector('[data-act="create"]').onclick = async () => {
        const titulo = box.querySelector('#titulo').value.trim() || randomTitulo();
        const btn = box.querySelector('[data-act="create"]');
        btn.disabled = true; btn.textContent = 'Gerando...';
        try {
          const wallet = await createWallet(titulo);
          await api.registerVoter(titulo, wallet.publicKey);
          dismiss();
          showSuccess(wallet);
          notifyChanged();
          toast('Identidade criada e registrada!', 'ok');
          done(wallet);
        } catch (e) {
          clearWallet(); // não mantém carteira que o servidor recusou
          btn.disabled = false; btn.textContent = 'Gerar identidade';
          toast(e.message || 'Falha ao registrar identidade', 'error');
        }
      };
      return box;
    });

    // se o overlay for fechado por fora
    void close;
  });
}

function showSuccess(wallet) {
  openModal((dismiss) => {
    const box = document.createElement('div');
    box.innerHTML = `
      <h3 class="modal-title"><span style="color:var(--ok)">${icons.circleCheck}</span> Identidade pronta</h3>
      <p>Seu endereço de eleitor (derivado da chave pública):</p>
      <div class="key-box"><strong style="color:var(--amarelo)">${escapeHtml(wallet.address)}</strong></div>
      <p style="font-size:.82rem">Sua chave privada está salva apenas neste navegador. Já pode votar na rodada atual.</p>
      <div class="modal-actions">
        <button class="btn btn-primary" data-act="ok">Entendi</button>
      </div>`;
    box.querySelector('[data-act="ok"]').onclick = dismiss;
    return box;
  });
}

/** Retorna a carteira atual ou abre o modal para criar uma. */
export async function ensureIdentity() {
  return getWallet() || (await openIdentityModal());
}
