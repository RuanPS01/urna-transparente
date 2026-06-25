import pg from 'pg';
import { Blockchain } from '../blockchain/Blockchain.js';
import { sha256hex, addressOf } from '../blockchain/crypto.js';

const { Pool } = pg;
const fail = (m, s) => Object.assign(new Error(m), { status: s });

/**
 * Persistência em Postgres (Neon) — a corrente vira a fonte única e durável
 * da contagem global. A blockchain é mantida em memória para validação e
 * apuração rápidas; cada bloco novo é gravado como uma linha.
 *
 * Observação importante: a coluna `vote` é TEXT (não JSONB) para preservar
 * EXATAMENTE a serialização original — o hash do bloco depende da ordem das
 * chaves, que o JSONB normalizaria, quebrando a validação.
 */
export function createPgStorage(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false }, // Neon exige TLS
    max: 5,
  });
  let chainRef = null;

  async function init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        index         INTEGER PRIMARY KEY,
        timestamp     BIGINT  NOT NULL,
        vote          TEXT,
        previous_hash TEXT    NOT NULL,
        nonce         BIGINT  NOT NULL,
        hash          TEXT    NOT NULL,
        nullifier     TEXT    UNIQUE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voters (
        titulo_hash   TEXT PRIMARY KEY,
        public_key    TEXT NOT NULL UNIQUE,
        registered_at BIGINT NOT NULL
      );
    `);
  }

  async function insertBlock(b) {
    await pool.query(
      `INSERT INTO blocks (index, timestamp, vote, previous_hash, nonce, hash, nullifier)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [b.index, b.timestamp, b.vote ? JSON.stringify(b.vote) : null,
        b.previousHash, b.nonce, b.hash, b.vote?.nullifier ?? null],
    );
  }

  async function loadChain(difficulty) {
    const { rows } = await pool.query(
      'SELECT index, timestamp, vote, previous_hash, nonce, hash FROM blocks ORDER BY index ASC',
    );
    if (rows.length === 0) {
      chainRef = new Blockchain({ difficulty }); // cria o gênese em memória
      await insertBlock(chainRef.chain[0]);
      return chainRef;
    }
    const blocks = rows.map((r) => ({
      index: r.index,
      timestamp: Number(r.timestamp),
      vote: r.vote ? JSON.parse(r.vote) : null,
      previousHash: r.previous_hash,
      nonce: Number(r.nonce),
      hash: r.hash,
    }));
    chainRef = new Blockchain({ difficulty, blocks });
    return chainRef;
  }

  async function appendBlock(block) {
    try {
      await insertBlock(block);
    } catch (e) {
      // 23505 = unique_violation (nullifier já existe = voto duplicado/corrida)
      if (e.code === '23505') throw fail('Este eleitor já votou nesta rodada para este cargo.', 409);
      throw e;
    }
  }

  async function registerVoter(titulo, publicKey) {
    if (!titulo || !publicKey) throw fail('Título e chave pública são obrigatórios.', 400);
    const th = sha256hex(String(titulo).trim());
    try {
      await pool.query(
        'INSERT INTO voters (titulo_hash, public_key, registered_at) VALUES ($1, $2, $3)',
        [th, publicKey, Date.now()],
      );
    } catch (e) {
      if (e.code === '23505') {
        // já existe: idempotente se for o mesmo par título+chave
        const { rows } = await pool.query('SELECT public_key FROM voters WHERE titulo_hash = $1', [th]);
        if (rows[0]?.public_key === publicKey) return { address: addressOf(publicKey), registeredAt: Date.now() };
        if (rows[0]) throw fail('Este título de eleitor já possui uma identidade registrada.', 409);
        throw fail('Esta chave já está vinculada a outro título.', 409);
      }
      throw e;
    }
    return { address: addressOf(publicKey), registeredAt: Date.now() };
  }

  async function isRegistered(publicKey) {
    const { rows } = await pool.query('SELECT 1 FROM voters WHERE public_key = $1 LIMIT 1', [publicKey]);
    return rows.length > 0;
  }

  async function voterCount() {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM voters');
    return rows[0].n;
  }

  return { kind: 'postgres', init, loadChain, appendBlock, registerVoter, isRegistered, voterCount };
}
