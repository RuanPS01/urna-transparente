import crypto from 'node:crypto';

/** SHA-256 em hexadecimal. */
export function sha256hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Nullifier determinístico que identifica unicamente um eleitor numa
 * combinação rodada+cargo SEM revelar sua identidade. Como deriva da
 * chave pública, o mesmo eleitor sempre gera o mesmo nullifier — o que
 * permite bloquear voto duplicado sem guardar quem votou em quem.
 */
export function computeNullifier(publicKeyB64, roundId, cargo) {
  return sha256hex(`${publicKeyB64}:${roundId}:${cargo}`);
}

/**
 * Verifica a assinatura ECDSA (P-256 / SHA-256) de um voto.
 * A chave pública chega como SPKI em base64 (exportada pelo Web Crypto
 * do navegador) e a assinatura no formato bruto r||s (IEEE P-1363).
 */
export function verifyVoteSignature(publicKeyB64, payload, signatureB64) {
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      'sha256',
      Buffer.from(payload, 'utf8'),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureB64, 'base64'),
    );
  } catch {
    return false;
  }
}
