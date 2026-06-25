import express from 'express';
import { config } from './config.js';
import { getCandidates } from './services/candidates.js';
import { currentRound, describeRound, roundLabel } from './services/rounds.js';
import { register, isRegistered, addressOf, voterCount } from './services/voters.js';
import { computeNullifier } from './blockchain/crypto.js';

/**
 * Monta o roteador da API REST. Recebe a instância da blockchain e a
 * função de persistência por injeção de dependência.
 */
export function createApi({ chain, save }) {
  const r = express.Router();

  r.get('/health', (_req, res) => res.json({ ok: true, time: Date.now() }));

  // --- Metadados -----------------------------------------------------------
  r.get('/cargos', (_req, res) => res.json({ cargos: config.cargos }));

  r.get('/rounds', (_req, res) => {
    const cur = currentRound();
    const ids = new Set(chain.chain.filter((b) => b.vote).map((b) => b.vote.roundId));
    ids.add(cur.id);
    const rounds = [...ids].sort().reverse().map(describeRound);
    res.json({ current: cur, rounds });
  });

  r.get('/stats', (_req, res) => {
    const v = chain.validate();
    res.json({
      blocos: chain.chain.length,
      votos: chain.voteCount,
      eleitores: voterCount(),
      dificuldade: chain.difficulty,
      integro: v.valid,
      rodadaAtual: currentRound(),
    });
  });

  // --- Candidatos ----------------------------------------------------------
  r.get('/candidates', async (req, res) => {
    const cargo = String(req.query.cargo || '1');
    const cargoDef = config.cargos.find((c) => c.code === cargo);
    const uf = String(req.query.uf || cargoDef?.uf || 'BR').toUpperCase();
    try {
      const { source, candidatos } = await getCandidates({ uf, cargo });
      res.json({ uf, cargo, cargoNome: cargoDef?.nome, source, total: candidatos.length, candidatos });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Identidade do eleitor ----------------------------------------------
  r.post('/voters/register', (req, res) => {
    try {
      const { titulo, publicKey } = req.body || {};
      res.json(register({ titulo, publicKey }));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  // Conveniência: calcula o nullifier (o cliente também consegue calcular).
  r.get('/nullifier', (req, res) => {
    const { publicKey, round, cargo } = req.query;
    if (!publicKey || !round || !cargo) {
      return res.status(400).json({ error: 'publicKey, round e cargo são obrigatórios.' });
    }
    res.json({ nullifier: computeNullifier(publicKey, round, String(cargo)) });
  });

  // --- Voto ----------------------------------------------------------------
  r.post('/votes', (req, res) => {
    try {
      const v = req.body || {};
      const req_fields = ['roundId', 'cargo', 'candidateId', 'voterPublicKey', 'signature', 'nullifier'];
      for (const k of req_fields) {
        if (!v[k]) return res.status(400).json({ error: `Campo obrigatório ausente: ${k}` });
      }
      if (v.roundId !== currentRound().id) {
        return res.status(400).json({ error: 'A rodada informada não está aberta para votação.' });
      }
      if (!isRegistered(v.voterPublicKey)) {
        return res.status(403).json({ error: 'Eleitor não registrado. Crie sua identidade antes de votar.' });
      }

      const block = chain.addVote({
        roundId: v.roundId,
        cargo: String(v.cargo),
        candidateId: String(v.candidateId),
        candidateNome: v.candidateNome || '',
        candidateNumero: v.candidateNumero || '',
        candidatePartido: v.candidatePartido || '',
        voterPublicKey: v.voterPublicKey,
        voterAddress: addressOf(v.voterPublicKey),
        nullifier: v.nullifier,
        signature: v.signature,
      });
      save();

      res.status(201).json({
        ok: true,
        block: {
          index: block.index,
          hash: block.hash,
          previousHash: block.previousHash,
          nonce: block.nonce,
          timestamp: block.timestamp,
          vote: block.vote,
        },
      });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  // --- Corrente / explorador ----------------------------------------------
  r.get('/chain', (req, res) => {
    const limit = Math.min(Number(req.query.limit || 50), 500);
    const offset = Number(req.query.offset || 0);
    const all = chain.chain;
    const blocks = all
      .slice()
      .reverse()
      .slice(offset, offset + limit)
      .map((b) => ({
        index: b.index,
        timestamp: b.timestamp,
        vote: b.vote,
        previousHash: b.previousHash,
        nonce: b.nonce,
        hash: b.hash,
      }));
    res.json({ length: all.length, difficulty: chain.difficulty, offset, limit, blocks });
  });

  r.get('/chain/validate', (_req, res) => res.json(chain.validate()));

  // --- Resultados ----------------------------------------------------------
  r.get('/results', (req, res) => {
    const roundId = String(req.query.round || currentRound().id);
    const cargo = String(req.query.cargo || '1');
    res.json({ ...chain.tally(roundId, cargo), label: roundLabel(roundId) });
  });

  return r;
}
