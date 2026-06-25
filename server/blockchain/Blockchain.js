import { Block } from './Block.js';
import { verifyVoteSignature, computeNullifier } from './crypto.js';

const GENESIS_TS = Date.UTC(2024, 0, 1); // marco fixo para o bloco gênese

function fail(message, status) {
  return Object.assign(new Error(message), { status });
}

/**
 * A corrente de votos. Mantém a lista de blocos, valida integridade,
 * impede voto duplo (via nullifier) e apura resultados por rodada/cargo.
 */
export class Blockchain {
  constructor({ difficulty = 3, blocks = null } = {}) {
    this.difficulty = difficulty;
    this.chain = blocks?.length
      ? blocks.map((b) => new Block(b))
      : [this.#createGenesis()];
    this.#reindexNullifiers();
  }

  #createGenesis() {
    return new Block({
      index: 0,
      timestamp: GENESIS_TS,
      vote: null,
      previousHash: '0'.repeat(64),
    }).mine(this.difficulty);
  }

  #reindexNullifiers() {
    this.nullifiers = new Set();
    for (const b of this.chain) {
      if (b.vote?.nullifier) this.nullifiers.add(b.vote.nullifier);
    }
  }

  get latest() {
    return this.chain[this.chain.length - 1];
  }

  hasVoted(nullifier) {
    return this.nullifiers.has(nullifier);
  }

  /**
   * Valida e adiciona um voto como novo bloco minerado.
   * Lança erro (com `.status`) se algo não confere.
   */
  addVote(vote) {
    const cargo = String(vote.cargo);

    const expected = computeNullifier(vote.voterPublicKey, vote.roundId, cargo);
    if (vote.nullifier !== expected) {
      throw fail('Nullifier inválido para este eleitor/rodada/cargo.', 400);
    }
    if (this.hasVoted(vote.nullifier)) {
      throw fail('Este eleitor já votou nesta rodada para este cargo.', 409);
    }

    const payload = `${vote.roundId}|${cargo}|${vote.candidateId}|${vote.nullifier}`;
    if (!verifyVoteSignature(vote.voterPublicKey, payload, vote.signature)) {
      throw fail('Assinatura digital inválida.', 400);
    }

    const block = new Block({
      index: this.latest.index + 1,
      timestamp: Date.now(),
      vote: { ...vote, cargo },
      previousHash: this.latest.hash,
    }).mine(this.difficulty);

    this.chain.push(block);
    this.nullifiers.add(vote.nullifier);
    return block;
  }

  /**
   * Revalida a corrente inteira: hashes, prova-de-trabalho e os elos
   * entre blocos. Retorna o ponto exato de qualquer adulteração.
   */
  validate() {
    const target = '0'.repeat(this.difficulty);
    for (let i = 0; i < this.chain.length; i++) {
      const b = this.chain[i];
      if (b.computeHash() !== b.hash) {
        return { valid: false, index: i, reason: 'Conteúdo do bloco foi adulterado (hash não confere).' };
      }
      if (!b.hash.startsWith(target)) {
        return { valid: false, index: i, reason: 'Prova-de-trabalho inválida.' };
      }
      if (i > 0 && b.previousHash !== this.chain[i - 1].hash) {
        return { valid: false, index: i, reason: 'Elo quebrado com o bloco anterior.' };
      }
    }
    return { valid: true, length: this.chain.length };
  }

  /** Apura os votos de uma rodada/cargo a partir da própria corrente. */
  tally(roundId, cargo) {
    const c = String(cargo);
    const counts = new Map();
    let total = 0;
    for (const b of this.chain) {
      const v = b.vote;
      if (!v || v.roundId !== roundId || String(v.cargo) !== c) continue;
      const cur = counts.get(v.candidateId) || {
        candidateId: v.candidateId,
        nome: v.candidateNome,
        numero: v.candidateNumero,
        partido: v.candidatePartido,
        votos: 0,
      };
      cur.votos++;
      counts.set(v.candidateId, cur);
      total++;
    }
    const results = [...counts.values()]
      .sort((a, b) => b.votos - a.votos)
      .map((r) => ({ ...r, percentual: total ? +((r.votos / total) * 100).toFixed(2) : 0 }));
    return { roundId, cargo: c, total, results };
  }

  /** Quantos votos (blocos não-gênese) existem no total. */
  get voteCount() {
    return this.chain.length - 1;
  }

  toJSON() {
    return {
      difficulty: this.difficulty,
      chain: this.chain.map((b) => ({
        index: b.index,
        timestamp: b.timestamp,
        vote: b.vote,
        previousHash: b.previousHash,
        nonce: b.nonce,
        hash: b.hash,
      })),
    };
  }
}
