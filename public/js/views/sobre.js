export async function render(root) {
  root.innerHTML = `
    <h1 class="section-title">Sobre a Urna Transparente</h1>
    <p class="section-sub">Um experimento educacional de voto sobre blockchain.</p>

    <div class="prose">
      <div class="callout">
        ⚠️ <strong>Aviso:</strong> esta é uma plataforma <strong>educacional e demonstrativa</strong>.
        Não é, e não substitui, o sistema oficial de eleições brasileiro. O voto oficial no Brasil é
        responsabilidade exclusiva da Justiça Eleitoral (TSE).
      </div>

      <h2>A ideia</h2>
      <p>Cada voto é uma <strong>argola</strong> de uma corrente (blockchain). Assim como em uma
      criptomoeda, cada elo é selado por criptografia e ligado ao anterior — o que torna o histórico
      de votos <strong>rastreável</strong> e <strong>inviolável</strong>: adulterar um voto antigo
      exigiria refazer a prova-de-trabalho de todos os blocos seguintes.</p>

      <h2>Como um voto é registrado</h2>
      <ul>
        <li><strong>Identidade:</strong> seu navegador gera um par de chaves <code>ECDSA P-256</code>. A chave privada nunca sai do dispositivo.</li>
        <li><strong>Elegibilidade:</strong> a chave pública é vinculada a um título de eleitor no cadastro (guardamos apenas o <em>hash</em> do título).</li>
        <li><strong>Assinatura:</strong> o voto é assinado localmente, provando autoria sem expor a chave privada.</li>
        <li><strong>Nullifier:</strong> um identificador determinístico por eleitor/rodada/cargo impede voto duplo <em>sem</em> registrar em quem você votou.</li>
        <li><strong>Mineração:</strong> o voto vira um bloco com prova-de-trabalho e é encadeado ao anterior.</li>
      </ul>

      <h2>Rodadas mensais</h2>
      <p>A cada mês começa uma nova rodada (identificada por <code>AAAA-MM</code>). Os votos de cada
      rodada são apurados separadamente, direto da corrente. Os blocos de todas as rodadas convivem
      na mesma blockchain, preservando o histórico completo.</p>

      <h2>Candidatos oficiais</h2>
      <p>A lista de candidatos vem da <strong>API de Dados Abertos do TSE</strong> (DivulgaCandContas):
      Presidente, Governador, Senador e Deputados. Quando a API está indisponível, a plataforma usa um
      conjunto de <em>dados-semente</em> de 2022 como fallback offline.</p>

      <h2>Verificação aberta</h2>
      <p>Na aba <a href="#/blockchain" style="color:var(--amarelo)">Blockchain</a> qualquer pessoa
      revalida a corrente inteira: hashes, prova-de-trabalho e os elos entre blocos. A apuração em
      <a href="#/resultados" style="color:var(--amarelo)">Resultados</a> é recontada a partir dos
      próprios blocos — não há um placar paralelo.</p>

      <h2>Limitações conhecidas (é uma demo!)</h2>
      <ul>
        <li>A blockchain roda em um único nó (não é distribuída entre validadores independentes).</li>
        <li>A autenticação do eleitor é simulada — um sistema real usaria identidade forte (ex.: gov.br).</li>
        <li>O sigilo do voto aqui é parcial: a escolha fica pública na corrente. Sistemas reais usam provas de conhecimento-zero para sigilo total.</li>
      </ul>

      <p style="margin-top:20px"><a class="btn btn-primary" href="#/votar">Experimentar votar</a></p>
    </div>`;
}
