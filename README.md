# 🗳️ Urna Transparente

> Plataforma web de votação em candidatos do governo do Brasil onde **cada voto é uma argola imutável e rastreável de uma blockchain** — como uma criptomoeda, mas para a democracia.

Destaque para a corrida **presidencial**, com apoio a outros cargos (Governador, Senador, Deputado Federal e Estadual). Os candidatos vêm da **API de Dados Abertos do TSE**, e a cada mês começa uma **nova rodada de votação**.

> ⚠️ **Aviso:** projeto **educacional e demonstrativo**. Não é, e não substitui, o sistema oficial de eleições brasileiro. O voto oficial no Brasil é responsabilidade exclusiva da Justiça Eleitoral (TSE).

---

## ✨ Destaques

- **Blockchain própria** — cada voto é minerado (prova-de-trabalho) e encadeado ao anterior pelo hash SHA-256. Mudar um voto antigo quebra todos os elos seguintes.
- **Assinatura digital por voto** — cada eleitor tem uma carteira `ECDSA P-256` gerada no navegador. A chave privada nunca sai do dispositivo e assina o voto localmente.
- **Anti-fraude** — *nullifier* determinístico impede voto duplo (um voto por eleitor, por cargo, por rodada) sem registrar em quem você votou.
- **Candidatos oficiais** — integração com a API DivulgaCandContas do TSE, com cache local e **fallback offline** (dados-semente de 2022).
- **Rodadas mensais** — identificadas por `AAAA-MM`, apuradas separadamente a partir da própria corrente.
- **Verificação aberta** — explorador da blockchain revalida a corrente inteira; a apuração é recontada dos blocos, sem placar paralelo.
- **Zero dependências de front-end** — SPA em JavaScript puro (sem build). Backend usa apenas Express.
- **Funciona no GitHub Pages** — modo híbrido: com servidor Node usa a API; sem servidor (Pages), a blockchain inteira roda no navegador (`localStorage`).

## 🧱 Como um voto vira uma "argola"

```
[Gênese] ─⛓→ [Voto #1] ─⛓→ [Voto #2] ─⛓→ [Voto #3] → ...
              hash←prevHash   hash←prevHash   hash←prevHash
```

1. **Identidade** — o navegador gera um par de chaves ECDSA P-256 (a carteira).
2. **Elegibilidade** — a chave pública é vinculada a um título de eleitor no cadastro (guardamos só o *hash* do título; cada título → uma carteira).
3. **Assinatura** — ao votar, o cliente assina `roundId|cargo|candidatoId|nullifier` com a chave privada.
4. **Validação** — o servidor confere a assinatura, recalcula o *nullifier* e rejeita votos duplicados.
5. **Mineração** — o voto vira um bloco; o `nonce` é iterado até o hash começar com N zeros (prova-de-trabalho).
6. **Encadeamento** — o bloco guarda o hash do anterior, formando a corrente.

## 🛠️ Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js + Express (ES Modules) |
| Blockchain | Implementação própria (SHA-256, PoW, ECDSA P-256) |
| Persistência | Arquivos JSON (corrente + cadastro de eleitores) |
| Frontend | SPA em JavaScript puro + Web Crypto API |
| Dados | API de Dados Abertos do TSE (DivulgaCandContas) |

## 🚀 Começando

Requisitos: **Node.js 18+**.

```bash
npm install
npm start
# Acesse http://localhost:3000
```

Modo desenvolvimento (reinício automático):

```bash
npm run dev
```

Rodar os testes da blockchain:

```bash
npm test
```

## ⚙️ Configuração (variáveis de ambiente)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta do servidor |
| `CHAIN_DIFFICULTY` | `3` | Zeros exigidos na prova-de-trabalho |
| `TSE_ENABLED` | `true` | Liga/desliga a busca na API do TSE |
| `TSE_YEAR` | `2022` | Ano da eleição consultada |
| `TSE_ELECTION` | `544` | Código da eleição no TSE |

> Em ambientes sem acesso à internet (ou quando a API do TSE está fora do ar), a plataforma usa automaticamente os dados-semente em `server/data/candidates.seed.json`.

## 🔌 API REST

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/stats` | Métricas gerais e integridade da corrente |
| `GET` | `/api/cargos` | Cargos disponíveis para votação |
| `GET` | `/api/rounds` | Rodada atual e histórico |
| `GET` | `/api/candidates?cargo=&uf=` | Candidatos (TSE → cache → seed) |
| `POST` | `/api/voters/register` | Registra a identidade do eleitor |
| `POST` | `/api/votes` | Registra um voto (vira um bloco) |
| `GET` | `/api/chain?limit=&offset=` | Blocos da corrente |
| `GET` | `/api/chain/validate` | Revalida a corrente inteira |
| `GET` | `/api/results?round=&cargo=` | Apuração por rodada/cargo |

## 📁 Estrutura

```
urna-transparente/
├── server/
│   ├── index.js              # Entrada do servidor Express
│   ├── api.js                # Rotas da API REST
│   ├── config.js             # Configuração central
│   ├── blockchain/
│   │   ├── Block.js          # O bloco — a "argola"
│   │   ├── Blockchain.js     # A corrente: validação, apuração, anti-fraude
│   │   ├── crypto.js         # Hash, nullifier e verificação de assinatura
│   │   └── store.js          # Persistência em disco
│   ├── services/
│   │   ├── tse.js            # Cliente da API do TSE
│   │   ├── candidates.js     # Cache + fallback de candidatos
│   │   ├── rounds.js         # Rodadas mensais
│   │   └── voters.js         # Cadastro de eleitores (hash do título)
│   └── data/
│       └── candidates.seed.json  # Dados-semente (fallback offline)
├── public/                   # Front-end (SPA)
│   ├── index.html
│   ├── css/styles.css
│   ├── data/candidates.json  # Cópia do seed (usada no modo estático)
│   └── js/                   # app, api, wallet, identity, ui, views/
│       └── local-backend.js  # Blockchain no navegador (modo GitHub Pages)
├── .github/workflows/        # CI (testes) e deploy do GitHub Pages
└── test/blockchain.test.js   # Testes automatizados
```

## 🤖 Integração contínua (CI)

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda `npm ci` e
`npm test` a cada push e pull request, garantindo que a blockchain continua íntegra.

## 🌐 Implantação no GitHub Pages

O GitHub Pages serve apenas conteúdo estático — e a Urna Transparente foi
preparada para isso. Sem um backend Node, o front-end detecta a ausência da API
e passa a rodar a **blockchain inteiramente no navegador** (mineração, assinatura,
apuração e persistência em `localStorage`). Um aviso de "modo demonstração" é
exibido nesse caso.

> No modo Pages, cada navegador tem a sua própria corrente local (não há um
> placar global compartilhado). Para uma corrente única e compartilhada, rode o
> servidor Node (`npm start`) ou hospede o backend separadamente.

O deploy é automático via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
Para ativar (uma única vez):

1. No GitHub, vá em **Settings → Pages** e em **Build and deployment → Source**
   selecione **GitHub Actions**.
2. Faça merge desta branch na `main` (ou rode o workflow manualmente em
   **Actions → Deploy GitHub Pages → Run workflow**).
3. O site ficará disponível em `https://<usuário>.github.io/urna-transparente/`.

## 🔐 Segurança e limitações (é uma demonstração!)

- A blockchain roda em **um único nó** — não há consenso distribuído entre validadores independentes.
- A autenticação do eleitor é **simulada**; um sistema real usaria identidade forte (ex.: gov.br) e prova de unicidade.
- O **sigilo do voto é parcial**: a escolha fica pública na corrente. Sistemas reais usariam provas de conhecimento-zero (ZKP) para sigilo total.
- A persistência em arquivo JSON é adequada para demonstração, não para produção em larga escala.

## 📄 Licença

MIT.
