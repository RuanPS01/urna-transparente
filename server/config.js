import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Diretório de dados gravável. Em produção (ex.: Render) pode apontar para
// um volume persistente via DATA_DIR. O seed continua versionado no repo.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

/**
 * Configuração central da Urna Transparente.
 * Valores podem ser sobrescritos por variáveis de ambiente.
 */
export const config = {
  port: Number(process.env.PORT || 3000),

  // Dificuldade da prova-de-trabalho (nº de zeros no início do hash).
  // 3 mantém a mineração rápida (poucos ms) e ainda demonstra o conceito.
  difficulty: Number(process.env.CHAIN_DIFFICULTY || 3),

  // Banco de dados (Postgres/Neon). Quando ausente, usa persistência em arquivo.
  databaseUrl: process.env.DATABASE_URL || null,

  // Arquivos e diretórios de dados
  dataDir: DATA_DIR,
  chainFile: path.join(DATA_DIR, 'chain.json'),
  votersFile: path.join(DATA_DIR, 'voters.json'),
  cacheDir: path.join(DATA_DIR, 'cache'),
  seedFile: path.join(__dirname, 'data', 'candidates.seed.json'),

  // Integração com a API de Dados Abertos do TSE (DivulgaCandContas)
  tse: {
    enabled: process.env.TSE_ENABLED !== 'false',
    baseUrl: process.env.TSE_BASE_URL ||
      'https://divulgacandcontas.tse.jus.br/divulga/rest/v1',
    year: process.env.TSE_YEAR || '2022',
    electionCode: process.env.TSE_ELECTION || '544', // Eleições Gerais 2022 (1º turno)
    timeoutMs: 15000,
    cacheTtlMs: 1000 * 60 * 60 * 24, // 24h
  },

  // Cargos disponíveis para votação (códigos oficiais do TSE).
  // `uf` é a unidade federativa padrão usada na consulta/seed.
  cargos: [
    { code: '1', nome: 'Presidente',        uf: 'BR', destaque: true,  cor: '#009b3a' },
    { code: '3', nome: 'Governador',        uf: 'SP', destaque: false, cor: '#002776' },
    { code: '5', nome: 'Senador',           uf: 'SP', destaque: false, cor: '#7b2cbf' },
    { code: '6', nome: 'Deputado Federal',  uf: 'SP', destaque: false, cor: '#d00000' },
    { code: '7', nome: 'Deputado Estadual', uf: 'SP', destaque: false, cor: '#e08e0b' },
  ],
};

export const CARGO_NOMES = {
  '1': 'Presidente',
  '3': 'Governador',
  '5': 'Senador',
  '6': 'Deputado Federal',
  '7': 'Deputado Estadual',
  '8': 'Deputado Distrital',
  '11': 'Prefeito',
  '13': 'Vereador',
};
