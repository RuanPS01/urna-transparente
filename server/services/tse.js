import { config, CARGO_NOMES } from '../config.js';

/**
 * Cliente da API de Dados Abertos do TSE (DivulgaCandContas).
 * Documentação: https://dadosabertos.tse.jus.br/
 *
 * Endpoint de listagem de candidatos:
 *   {base}/candidatura/listar/{ano}/{uf}/{codEleicao}/{codCargo}/candidatos
 * Para Presidente a UF é "BR".
 */
export async function fetchCandidatesFromTSE({ uf, cargo }) {
  const { baseUrl, year, electionCode, timeoutMs } = config.tse;
  const url = `${baseUrl}/candidatura/listar/${year}/${uf}/${electionCode}/${cargo}/candidatos`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; UrnaTransparente/1.0)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) throw new Error(`TSE respondeu HTTP ${res.status}`);

  const data = await res.json();
  const lista = data.candidatos || [];
  return lista.map((c) => normalizeCandidate(c, { uf, cargo }));
}

/** Converte o formato do TSE no formato interno da aplicação. */
function normalizeCandidate(c, { uf, cargo }) {
  const id = String(c.id ?? c.sequencialCandidato ?? c.numero ?? cryptoRandom());
  return {
    id,
    nome: c.nomeCompleto || c.nomeUrna || c.nome || 'Candidato',
    nomeUrna: c.nomeUrna || c.nome || c.nomeCompleto || 'Candidato',
    numero: String(c.numero ?? ''),
    partido: c.partido?.sigla || c.siglaPartido || '',
    partidoNome: c.partido?.nome || c.nomePartido || '',
    cargo: String(cargo),
    cargoNome: CARGO_NOMES[String(cargo)] || '',
    uf,
    foto: c.id
      ? `${config.tse.baseUrl}/candidato/foto/${config.tse.year}/${uf}/${config.tse.electionCode}/${c.id}`
      : null,
    situacao: c.descricaoSituacao || c.nomeSituacaoCandidato || 'Deferido',
  };
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}
