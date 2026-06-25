import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Blockchain } from '../server/blockchain/Blockchain.js';
import { computeNullifier } from '../server/blockchain/crypto.js';

// Cria uma carteira e uma função para assinar votos, como faz o navegador.
function makeWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return {
    publicKey: pub,
    sign(round, cargo, candidateId) {
      const nullifier = computeNullifier(pub, round, String(cargo));
      const payload = `${round}|${cargo}|${candidateId}|${nullifier}`;
      const signature = crypto
        .sign('sha256', Buffer.from(payload), { key: privateKey, dsaEncoding: 'ieee-p1363' })
        .toString('base64');
      return { roundId: round, cargo: String(cargo), candidateId, voterPublicKey: pub, nullifier, signature };
    },
  };
}

test('gênese é criado e a corrente nasce íntegra', () => {
  const bc = new Blockchain({ difficulty: 2 });
  assert.equal(bc.chain.length, 1);
  assert.equal(bc.chain[0].index, 0);
  assert.equal(bc.validate().valid, true);
});

test('prova-de-trabalho satisfaz a dificuldade', () => {
  const bc = new Blockchain({ difficulty: 3 });
  const w = makeWallet();
  const block = bc.addVote(w.sign('2026-06', '1', 'BR1-13'));
  assert.ok(block.hash.startsWith('000'));
  assert.equal(block.previousHash, bc.chain[0].hash);
});

test('voto válido é adicionado e contado na apuração', () => {
  const bc = new Blockchain({ difficulty: 2 });
  makeWallet().publicKey; // só para garantir variedade
  bc.addVote(makeWallet().sign('2026-06', '1', 'BR1-13'));
  bc.addVote(makeWallet().sign('2026-06', '1', 'BR1-13'));
  bc.addVote(makeWallet().sign('2026-06', '1', 'BR1-22'));
  const r = bc.tally('2026-06', '1');
  assert.equal(r.total, 3);
  assert.equal(r.results[0].candidateId, 'BR1-13');
  assert.equal(r.results[0].votos, 2);
  assert.equal(r.results[0].percentual, 66.67);
});

test('voto duplo (mesmo eleitor/rodada/cargo) é rejeitado', () => {
  const bc = new Blockchain({ difficulty: 2 });
  const w = makeWallet();
  bc.addVote(w.sign('2026-06', '1', 'BR1-13'));
  assert.throws(() => bc.addVote(w.sign('2026-06', '1', 'BR1-22')), /já votou/);
});

test('mesmo eleitor pode votar em cargos diferentes', () => {
  const bc = new Blockchain({ difficulty: 2 });
  const w = makeWallet();
  bc.addVote(w.sign('2026-06', '1', 'BR1-13'));
  assert.doesNotThrow(() => bc.addVote(w.sign('2026-06', '3', 'SP3-10')));
});

test('assinatura inválida é rejeitada', () => {
  const bc = new Blockchain({ difficulty: 2 });
  const vote = makeWallet().sign('2026-06', '1', 'BR1-13');
  vote.signature = Buffer.from('assinatura-falsa').toString('base64');
  assert.throws(() => bc.addVote(vote), /Assinatura/);
});

test('nullifier forjado é rejeitado', () => {
  const bc = new Blockchain({ difficulty: 2 });
  const vote = makeWallet().sign('2026-06', '1', 'BR1-13');
  vote.nullifier = 'f'.repeat(64);
  assert.throws(() => bc.addVote(vote), /Nullifier/);
});

test('adulterar um voto antigo quebra a integridade', () => {
  const bc = new Blockchain({ difficulty: 2 });
  bc.addVote(makeWallet().sign('2026-06', '1', 'BR1-13'));
  bc.addVote(makeWallet().sign('2026-06', '1', 'BR1-13'));
  // Fraude: muda o candidato do bloco 1 sem refazer a corrente
  bc.chain[1].vote.candidateId = 'BR1-22';
  const v = bc.validate();
  assert.equal(v.valid, false);
  assert.equal(v.index, 1);
});

test('serialização e recarga preservam a corrente', () => {
  const bc = new Blockchain({ difficulty: 2 });
  bc.addVote(makeWallet().sign('2026-06', '1', 'BR1-13'));
  const json = bc.toJSON();
  const restored = new Blockchain({ difficulty: json.difficulty, blocks: json.chain });
  assert.equal(restored.validate().valid, true);
  assert.equal(restored.chain.length, bc.chain.length);
});
