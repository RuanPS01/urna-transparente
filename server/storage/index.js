import { createFileStorage } from './file.js';
import { createPgStorage } from './postgres.js';

/**
 * Escolhe a persistência: Postgres quando há DATABASE_URL (produção com
 * contagem global durável), senão arquivo JSON (dev/local/testes).
 *
 * Toda implementação expõe a mesma interface assíncrona:
 *   init()                       -> prepara o armazenamento
 *   loadChain(difficulty)        -> retorna uma Blockchain (em memória)
 *   appendBlock(block)           -> persiste um novo bloco
 *   registerVoter(titulo, pub)   -> { address, registeredAt } (lança em conflito)
 *   isRegistered(publicKey)      -> boolean
 *   voterCount()                 -> number
 *   kind                         -> 'postgres' | 'file'
 */
export function createStorage(config) {
  return config.databaseUrl ? createPgStorage(config) : createFileStorage(config);
}
