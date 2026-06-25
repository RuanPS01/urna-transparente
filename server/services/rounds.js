const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Id da rodada (AAAA-MM) para uma data. Cada mês = uma nova rodada. */
export function roundIdForDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function roundLabel(id) {
  const [y, m] = id.split('-').map(Number);
  return `${MESES[m - 1]} de ${y}`;
}

function bounds(id) {
  const [y, m] = id.split('-').map(Number);
  return {
    inicio: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    fim: new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString(),
  };
}

/** A rodada do mês corrente — sempre aberta para votação. */
export function currentRound() {
  const id = roundIdForDate();
  return { id, label: roundLabel(id), status: 'aberta', ...bounds(id) };
}

/** Descreve qualquer rodada definindo seu status relativo ao mês atual. */
export function describeRound(id) {
  const atual = currentRound().id;
  const status = id === atual ? 'aberta' : id < atual ? 'encerrada' : 'futura';
  return { id, label: roundLabel(id), status, ...bounds(id) };
}
