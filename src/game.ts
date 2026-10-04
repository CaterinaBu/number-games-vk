import rawDataset from './dataset.json';

export type Fact = {
  category: string;
  metric: string;
  object: string;
  unit: string;
  value: number;
};

export type Question = { left: Fact; right: Fact };
export type Difficulty = 'easy' | 'hard';

export type OrderQuestion = {
  metric: string;
  unit: string;
  items: Fact[];
};

export type NearQuestion = {
  reference: Fact;
  left: Fact;
  right: Fact;
};

const dataset = (rawDataset as Fact[]).filter(
  (row) => typeof row.value === 'number' && Number.isFinite(row.value)
);

export function isYearMetric(metric: string): boolean {
  return metric.toLowerCase().includes('год');
}

const guessableDataset = dataset.filter((row) => !isYearMetric(row.metric));

const groups = new Map<string, Fact[]>();
for (const row of dataset) {
  const key = `${row.category}|||${row.metric}|||${row.unit}`;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
}

const playableGroups = [...groups.values()].filter((group) => group.length >= 2);

const orderGroups = [...groups.values()].filter((group) => {
  const uniqueValues = new Set(group.map((fact) => fact.value));
  return uniqueValues.size >= 4;
});

const nearGroups = [...groups.values()].filter((group) => {
  const uniqueValues = new Set(group.map((fact) => fact.value));
  return uniqueValues.size >= 3;
});

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function sameFact(a: Fact, b: Fact): boolean {
  return a.category === b.category && a.metric === b.metric && a.object === b.object;
}

function sameGroup(a: Fact, b: Fact): boolean {
  return a.category === b.category && a.metric === b.metric && a.unit === b.unit;
}

function magnitudeDistance(a: number, b: number): number {
  const aa = Math.abs(a);
  const bb = Math.abs(b);
  if (aa === 0 && bb === 0) return 0;
  if (aa === 0 || bb === 0) return Infinity;
  return Math.abs(Math.log10(aa) - Math.log10(bb));
}

function isMagnitudeClose(a: Fact, b: Fact): boolean {
  return magnitudeDistance(a.value, b.value) <= 0.5;
}

function makeQuestion(a: Fact, b: Fact): Question {
  return Math.random() < 0.5 ? { left: a, right: b } : { left: b, right: a };
}

function createEasyQuestion(previousPairKey?: string): Question {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const first = randomItem(dataset);
    const second = randomItem(dataset);
    if (sameFact(first, second) || first.value === second.value) continue;

    const pairKey = [first.object, second.object].sort().join('|||');
    if (previousPairKey && pairKey === previousPairKey) continue;

    return makeQuestion(first, second);
  }

  return makeQuestion(dataset[0], dataset[1]);
}

function createHardQuestion(previousPairKey?: string): Question {
  if (Math.random() < 0.5) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const group = randomItem(playableGroups);
      const [first, second] = shuffled(group);

      if (!first || !second || first.value === second.value) continue;

      const pairKey = [first.object, second.object].sort().join('|||');
      if (previousPairKey && pairKey === previousPairKey) continue;

      return makeQuestion(first, second);
    }
  }

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const first = randomItem(dataset);
    const second = randomItem(dataset);

    if (sameFact(first, second) || first.value === second.value) continue;
    if (!(sameGroup(first, second) || isMagnitudeClose(first, second))) continue;

    const pairKey = [first.object, second.object].sort().join('|||');
    if (previousPairKey && pairKey === previousPairKey) continue;

    return makeQuestion(first, second);
  }

  const fallback = randomItem(playableGroups);
  const [first, second] = shuffled(fallback);
  return makeQuestion(first, second);
}

export function createQuestion(difficulty: Difficulty, previousPairKey?: string): Question {
  return difficulty === 'hard'
    ? createHardQuestion(previousPairKey)
    : createEasyQuestion(previousPairKey);
}

export function getPairKey(question: Question): string {
  return [question.left.object, question.right.object].sort().join('|||');
}

export function getCorrectSide(question: Question): 'left' | 'right' {
  return question.left.value > question.right.value ? 'left' : 'right';
}

const superscripts: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³',
  '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
};

function toSuperscript(n: number): string {
  return String(n).split('').map((c) => superscripts[c] ?? c).join('');
}

function formatPlainNumber(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1e9 || (abs > 0 && abs < 0.001)) {
    const exponent = Math.floor(Math.log10(abs));
    const mantissa = value / Math.pow(10, exponent);
    const m = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(mantissa);
    return `${m} × 10${toSuperscript(exponent)}`;
  }

  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(value);
}

export function formatValue(fact: Fact): string {
  const { value, unit, metric } = fact;

  if (isYearMetric(metric) && unit === 'год') {
    if (value < 0) return `${formatPlainNumber(Math.abs(value))} до н. э.`;
    return `${formatPlainNumber(value)} г.`;
  }

  return `${formatPlainNumber(value)}${unit ? ` ${unit}` : ''}`;
}

export function formatMetric(fact: Fact): string {
  return fact.unit ? `${fact.metric} · ${fact.unit}` : fact.metric;
}

export function getFactCount(): number {
  return dataset.length;
}

export function createGuessFact(previousObject?: string): Fact {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const fact = randomItem(guessableDataset);
    if (fact.object !== previousObject) return fact;
  }
  return randomItem(guessableDataset);
}

export function parseGuess(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(',', '.');

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateCloseness(guess: number, actual: number): number {
  if (guess === actual) return 100;

  const base = Math.max(Math.abs(actual), 10);
  const error = Math.abs(guess - actual);
  const closeness = 100 - (error / base) * 100;

  return Math.max(0, Math.round(closeness));
}

function takeDistinctValues(group: Fact[], count: number): Fact[] {
  const byValue = new Map<number, Fact>();
  for (const fact of shuffled(group)) {
    if (!byValue.has(fact.value)) byValue.set(fact.value, fact);
    if (byValue.size >= count) break;
  }
  return [...byValue.values()];
}

export function createOrderQuestion(previousMetric?: string): OrderQuestion {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const group = randomItem(orderGroups);
    if (previousMetric && group[0]?.metric === previousMetric && orderGroups.length > 1) continue;

    const picked = takeDistinctValues(group, 4);
    if (picked.length < 4) continue;

    const sorted = [...picked].sort((a, b) => a.value - b.value);
    let mixed = shuffled(picked);

    if (mixed.every((fact, index) => fact.object === sorted[index].object)) {
      mixed = [mixed[1], mixed[0], mixed[3], mixed[2]];
    }

    return {
      metric: picked[0].metric,
      unit: picked[0].unit,
      items: mixed
    };
  }

  const group = orderGroups[0];
  return {
    metric: group[0].metric,
    unit: group[0].unit,
    items: shuffled(takeDistinctValues(group, 4))
  };
}

export function isOrderCorrect(items: Fact[]): boolean {
  return items.every((fact, index) => {
    if (index === 0) return true;
    return items[index - 1].value < fact.value;
  });
}

export function createNearQuestion(previousReference?: string): NearQuestion {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const group = randomItem(nearGroups);
    const [reference, left, right] = takeDistinctValues(group, 3);

    if (!reference || !left || !right) continue;
    if (previousReference && reference.object === previousReference) continue;

    const leftDistance = Math.abs(left.value - reference.value);
    const rightDistance = Math.abs(right.value - reference.value);

    if (leftDistance === rightDistance) continue;

    return Math.random() < 0.5
      ? { reference, left, right }
      : { reference, left: right, right: left };
  }

  const group = nearGroups[0];
  const [reference, left, right] = takeDistinctValues(group, 3);
  return { reference, left, right };
}

export function getNearCorrectSide(question: NearQuestion): 'left' | 'right' {
  const leftDistance = Math.abs(question.left.value - question.reference.value);
  const rightDistance = Math.abs(question.right.value - question.reference.value);
  return leftDistance < rightDistance ? 'left' : 'right';
}

export function getNearPrompt(question: NearQuestion): string {
  const metric = question.reference.metric;
  const object = question.reference.object;

  const exact: Record<string, string> = {
    'Год рождения': `Кто родился ближе по времени к ${object}?`,
    'Год смерти': `Кто умер ближе по времени к ${object}?`,
    'Возраст на момент смерти': `Чей возраст на момент смерти ближе к возрасту ${object}?`,
    'Масса': `Чья масса ближе к массе ${object}?`,
    'Длина тела': `Чья длина тела ближе к длине ${object}?`,
    'Длина': `Чья длина ближе к длине ${object}?`,
    'Скорость': `Чья скорость ближе к скорости ${object}?`,
    'Продолжительность жизни': `Чья продолжительность жизни ближе к ${object}?`,
    'Количество зубов': `У кого количество зубов ближе к ${object}?`,
    'Количество костей': `У кого количество костей ближе к ${object}?`,
    'Количество детёнышей в помёте': `У кого размер помёта ближе к ${object}?`,
    'Диаметр': `Чей диаметр ближе к диаметру ${object}?`,
    'Температура': `Чья температура ближе к температуре ${object}?`,
    'Плотность': `Чья плотность ближе к плотности ${object}?`,
    'Температура плавления': `Чья температура плавления ближе к ${object}?`,
    'Температура кипения': `Чья температура кипения ближе к ${object}?`,
    'Высота': `Чья высота ближе к высоте ${object}?`,
    'Глубина': `Чья глубина ближе к глубине ${object}?`,
    'Площадь': `Чья площадь ближе к площади ${object}?`,
    'Объём': `Чей объём ближе к объёму ${object}?`,
    'Количество этажей': `У какого объекта число этажей ближе к ${object}?`,
    'Длительность строительства': `Чья длительность строительства ближе к ${object}?`,
    'Длительность существования': `Чья длительность существования ближе к ${object}?`,
    'Длительность экспедиции': `Какая экспедиция по длительности ближе к ${object}?`,
    'Длительность произведения': `Какое произведение по длительности ближе к ${object}?`,
    'Количество томов': `У какого произведения число томов ближе к ${object}?`,
    'Атомный номер': `Чей атомный номер ближе к ${object}?`
  };

  if (exact[metric]) return exact[metric];

  if (metric.toLowerCase().includes('год')) {
    return `Какое событие по времени ближе к ${object}?`;
  }

  return `У какого объекта значение «${metric}» ближе к ${object}?`;
}
