import crypto from 'node:crypto';

/**
 * Um bloco da corrente — a "argola". Em geral carrega exatamente UM voto,
 * tornando cada voto um elo imutável e rastreável da blockchain.
 * O bloco gênese (índice 0) tem `vote = null`.
 */
export class Block {
  constructor({ index, timestamp, vote, previousHash, nonce = 0, hash = null }) {
    this.index = index;
    this.timestamp = timestamp;
    this.vote = vote ?? null;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = hash || this.computeHash();
  }

  /** Hash SHA-256 de todo o conteúdo do bloco (inclui o nonce). */
  computeHash() {
    const data = JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      vote: this.vote,
      previousHash: this.previousHash,
      nonce: this.nonce,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Prova-de-trabalho: itera o nonce até o hash começar com `difficulty`
   * zeros. É o "esforço" que forja a argola e torna a reescrita cara.
   */
  mine(difficulty) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.computeHash();
    }
    return this;
  }
}
