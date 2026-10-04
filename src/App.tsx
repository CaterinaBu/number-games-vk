import { useState } from 'react';
import {
  calculateCloseness,
  createGuessFact,
  createNearQuestion,
  createOrderQuestion,
  createQuestion,
  formatMetric,
  formatValue,
  getCorrectSide,
  getFactCount,
  getNearCorrectSide,
  getPairKey,
  isOrderCorrect,
  parseGuess,
  type Difficulty,
  type Fact,
  type NearQuestion,
  type Question
} from './game';
import { donateToCommunity, inviteFriends, isDonationConfigured, isVKEnvironment, joinCommunity, registerCompletedRound, shareApp, showInterstitialIfAvailable } from './vk';
import { trackEvent } from './analytics';

type Side = 'left' | 'right';
type GameTab = 'compare' | 'guess' | 'order' | 'near';

type RecordEntry = {
  plays: number;
  bestScore: number;
  bestStreak: number;
  bestAverage: number;
};

type Records = Record<GameTab, RecordEntry>;

type FinishResult = {
  score?: number;
  maxStreak?: number;
  average?: number;
};

const ROUND_LENGTH = 10;
const STORAGE_KEY = 'number-games-records-v1';

const emptyEntry = (): RecordEntry => ({
  plays: 0,
  bestScore: 0,
  bestStreak: 0,
  bestAverage: 0
});

const emptyRecords = (): Records => ({
  compare: emptyEntry(),
  guess: emptyEntry(),
  order: emptyEntry(),
  near: emptyEntry()
});

function loadRecords(): Records {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyRecords();

    const parsed = JSON.parse(raw) as Partial<Records>;
    const base = emptyRecords();

    (Object.keys(base) as GameTab[]).forEach((key) => {
      base[key] = { ...base[key], ...(parsed[key] ?? {}) };
    });

    return base;
  } catch {
    return emptyRecords();
  }
}

function FactCard({
  fact,
  side,
  selected,
  correctSide,
  answered,
  onChoose
}: {
  fact: Question['left'];
  side: Side;
  selected: Side | null;
  correctSide: Side;
  answered: boolean;
  onChoose: (side: Side) => void;
}) {
  let stateClass = '';

  if (answered) {
    if (side === correctSide) stateClass = ' correct';
    else if (selected === side) stateClass = ' wrong';
    else stateClass = ' muted';
  }

  return (
    <button
      className={`choice${stateClass}`}
      onClick={() => onChoose(side)}
      disabled={answered}
    >
      <span className="metric">{formatMetric(fact)}</span>
      <span className="object">{fact.object}</span>
      <span className={`value ${answered ? 'show' : ''}`}>
        {answered ? formatValue(fact) : '\u00A0'}
      </span>
    </button>
  );
}

function RoundProgress({
  answered,
  currentAnswered
}: {
  answered: number;
  currentAnswered: boolean;
}) {
  const current = Math.min(
    ROUND_LENGTH,
    answered + (currentAnswered ? 0 : 1)
  );
  const filled = Math.min(100, (answered / ROUND_LENGTH) * 100);

  return (
    <div className="roundProgress">
      <div className="roundProgressText">
        Вопрос <b>{current}</b> из {ROUND_LENGTH}
      </div>
      <div className="roundProgressTrack">
        <div className="roundProgressFill" style={{ width: `${filled}%` }} />
      </div>
    </div>
  );
}

function Score({
  score,
  streak
}: {
  score: number;
  streak: number;
}) {
  return (
    <div className="stats">
      <span><b>{score}</b> верно</span>
      <span><b>{streak}</b> серия</span>
    </div>
  );
}

function DonateButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={`donateButton ${className}`} onClick={() => { trackEvent('donate_opened'); setOpen(true); }}>
        ♡ Поддержать игру
      </button>
      {open && <DonateModal onClose={() => setOpen(false)} />}
    </>
  );
}

function DonateModal({ onClose }: { onClose: () => void }) {
  const [customAmount, setCustomAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const configured = isDonationConfigured();
  const insideVK = isVKEnvironment();
  const parsedCustom = Number(customAmount.replace(',', '.').trim());
  const customValid = Number.isFinite(parsedCustom) && parsedCustom >= 1;

  async function pay(amount: number) {
    if (!configured || !insideVK || status === 'loading') return;

    setStatus('loading');
    trackEvent('donation_attempt', { amount });
    const ok = await donateToCommunity(amount);
    trackEvent(ok ? 'donation_success' : 'donation_failed', { amount });
    setStatus(ok ? 'success' : 'error');
  }

  return (
    <div className="donateOverlay" onMouseDown={onClose}>
      <div className="donateModal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="donateClose" onClick={onClose} aria-label="Закрыть">×</button>

        <div className="donateEyebrow">Добровольная поддержка</div>
        <h3>Поддержать игру</h3>
        <p>
          Игра остаётся бесплатной. Если хочется поддержать проект,
          можно отправить любую сумму через VK Pay.
        </p>

        <div className="donateAmounts">
          {[50, 100, 300].map((amount) => (
            <button
              key={amount}
              onClick={() => { void pay(amount); }}
              disabled={!configured || !insideVK || status === 'loading'}
            >
              {amount} ₽
            </button>
          ))}
        </div>

        <div className="donateCustom">
          <input
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Своя сумма"
          />
          <button
            onClick={() => { void pay(parsedCustom); }}
            disabled={!customValid || !configured || !insideVK || status === 'loading'}
          >
            Отправить
          </button>
        </div>

        {!configured && (
          <div className="donateNote">
            Получатель пока не настроен. После создания сообщества достаточно добавить его ID.
          </div>
        )}

        {configured && !insideVK && (
          <div className="donateNote">
            Оплата откроется, когда приложение запущено внутри VK.
          </div>
        )}

        {status === 'loading' && <div className="donateStatus">Открываем VK Pay…</div>}
        {status === 'success' && <div className="donateStatus success">Спасибо за поддержку!</div>}
        {status === 'error' && <div className="donateStatus error">Платёж не завершён. Можно попробовать ещё раз.</div>}
      </div>
    </div>
  );
}

function SocialActions({
  compact = false
}: {
  compact?: boolean;
}) {
  const [message, setMessage] = useState('');

  async function handleShare() {
    trackEvent('share_result');
    const ok = await shareApp(window.location.href);
    setMessage(ok ? 'Окно публикации открыто' : 'Доступно при запуске внутри VK');
  }

  async function handleInvite() {
    trackEvent('invite_friends');
    const ok = await inviteFriends();
    setMessage(ok ? 'Можно выбрать друзей' : 'Доступно при запуске внутри VK');
  }

  async function handleCommunity() {
    trackEvent('join_community');
    const ok = await joinCommunity();
    setMessage(ok ? 'Готово' : 'Сообщество пока не настроено или приложение открыто не в VK');
  }

  return (
    <div className={`socialActions ${compact ? 'compact' : ''}`}>
      <button onClick={() => { void handleShare(); }}>Поделиться</button>
      <button onClick={() => { void handleInvite(); }}>Пригласить друзей</button>
      <button onClick={() => { void handleCommunity(); }}>Сообщество игры</button>
      {message && <div className="socialMessage">{message}</div>}
    </div>
  );
}

function ResultScreen({
  title,
  primary,
  primaryLabel,
  secondary,
  record,
  onAgain,
  onHome,
  onBeforeLeave
}: {
  title: string;
  primary: string;
  primaryLabel: string;
  secondary?: string[];
  record: string;
  onAgain: () => void;
  onHome: () => void;
  onBeforeLeave: (action: () => void) => Promise<void>;
}) {
  return (
    <section className="resultScreen">
      <div className="resultCard">
        <div className="resultEyebrow">Партия завершена</div>
        <h2>{title}</h2>

        <div className="resultPrimary">{primary}</div>
        <div className="resultPrimaryLabel">{primaryLabel}</div>

        {secondary && secondary.length > 0 && (
          <div className="resultDetails">
            {secondary.map((item) => <span key={item}>{item}</span>)}
          </div>
        )}

        <div className="recordLine">{record}</div>

        <DonateButton className="resultDonate" />
        <SocialActions compact />

        <div className="resultActions">
          <button className="next" onClick={() => { trackEvent('play_again'); void onBeforeLeave(onAgain); }}>Ещё раз</button>
          <button className="secondaryButton" onClick={() => { trackEvent('return_home'); void onBeforeLeave(onHome); }}>Все игры</button>
        </div>
      </div>
    </section>
  );
}

type GameProps = {
  onFinish: (game: GameTab, result: FinishResult) => RecordEntry;
  onHome: () => void;
  onBeforeLeave: (action: () => void) => Promise<void>;
};

function CompareGame({ onFinish, onHome, onBeforeLeave }: GameProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [question, setQuestion] = useState<Question>(() => createQuestion('easy'));
  const [selected, setSelected] = useState<Side | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedRecord, setSavedRecord] = useState<RecordEntry | null>(null);

  const correctSide = getCorrectSide(question);
  const isAnswered = selected !== null;

  function choose(side: Side) {
    if (isAnswered || answered >= ROUND_LENGTH) return;

    setSelected(side);
    setAnswered((x) => x + 1);

    if (side === correctSide) {
      const nextStreak = streak + 1;
      setScore((x) => x + 1);
      setStreak(nextStreak);
      setMaxStreak((x) => Math.max(x, nextStreak));
    } else {
      setStreak(0);
    }
  }

  function finish() {
    const record = onFinish('compare', { score, maxStreak });
    setSavedRecord(record);
    setShowResult(true);
  }

  function nextQuestion() {
    if (answered >= ROUND_LENGTH) {
      finish();
      return;
    }

    setQuestion(createQuestion(difficulty, getPairKey(question)));
    setSelected(null);
  }

  function resetRound(nextDifficulty = difficulty) {
    setDifficulty(nextDifficulty);
    setQuestion(createQuestion(nextDifficulty));
    setSelected(null);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setAnswered(0);
    setShowResult(false);
    setSavedRecord(null);
  }

  function changeDifficulty(next: Difficulty) {
    if (next === difficulty) return;
    resetRound(next);
  }

  if (showResult && savedRecord) {
    return (
      <ResultScreen
        title="Что больше?"
        primary={`${score} из ${ROUND_LENGTH}`}
        primaryLabel="верных ответов"
        secondary={[
          `Точность ${Math.round((score / ROUND_LENGTH) * 100)}%`,
          `Лучшая серия ${maxStreak}`
        ]}
        record={`Рекорд: ${savedRecord.bestScore} из ${ROUND_LENGTH} · лучшая серия ${savedRecord.bestStreak}`}
        onAgain={() => resetRound()}
        onHome={onHome}
        onBeforeLeave={onBeforeLeave}
      />
    );
  }

  return (
    <>
      <div className="toolbar">
        <div className="modeSwitch">
          <button className={difficulty === 'easy' ? 'active' : ''} onClick={() => changeDifficulty('easy')}>
            Простой
          </button>
          <button className={difficulty === 'hard' ? 'active' : ''} onClick={() => changeDifficulty('hard')}>
            Сложный
          </button>
        </div>
        <Score score={score} streak={streak} />
      </div>

      <RoundProgress answered={answered} currentAnswered={isAnswered} />

      <section className="gameArea">
        <div className="choices">
          <FactCard fact={question.left} side="left" selected={selected} correctSide={correctSide} answered={isAnswered} onChoose={choose} />
          <div className="versus">или</div>
          <FactCard fact={question.right} side="right" selected={selected} correctSide={correctSide} answered={isAnswered} onChoose={choose} />
        </div>

        <section className="feedback">
          {isAnswered ? (
            <>
              <div className={`resultText ${selected === correctSide ? 'success' : 'fail'}`}>
                {selected === correctSide ? 'Верно' : 'Неверно'}
              </div>
              <button className="next" onClick={nextQuestion}>
                {answered >= ROUND_LENGTH ? 'Результаты' : 'Следующий'} <span>→</span>
              </button>
            </>
          ) : (
            <div className="hint">Нажми на карточку</div>
          )}
        </section>
      </section>
    </>
  );
}

function GuessGame({ onFinish, onHome, onBeforeLeave }: GameProps) {
  const [fact, setFact] = useState<Fact>(() => createGuessFact());
  const [input, setInput] = useState('');
  const [submittedGuess, setSubmittedGuess] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [totalCloseness, setTotalCloseness] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedRecord, setSavedRecord] = useState<RecordEntry | null>(null);

  const answered = submittedGuess !== null;
  const closeness = answered ? calculateCloseness(submittedGuess, fact.value) : null;
  const averageScore = rounds > 0 ? Math.round(totalCloseness / rounds) : 0;

  function submit() {
    if (answered || rounds >= ROUND_LENGTH) return;

    const guess = parseGuess(input);
    if (guess === null) return;

    const value = calculateCloseness(guess, fact.value);
    setSubmittedGuess(guess);
    setRounds((x) => x + 1);
    setTotalCloseness((x) => x + value);
  }

  function finish() {
    const record = onFinish('guess', { average: averageScore });
    setSavedRecord(record);
    setShowResult(true);
  }

  function next() {
    if (rounds >= ROUND_LENGTH) {
      finish();
      return;
    }

    setFact(createGuessFact(fact.object));
    setInput('');
    setSubmittedGuess(null);
  }

  function resetRound() {
    setFact(createGuessFact());
    setInput('');
    setSubmittedGuess(null);
    setRounds(0);
    setTotalCloseness(0);
    setShowResult(false);
    setSavedRecord(null);
  }

  if (showResult && savedRecord) {
    return (
      <ResultScreen
        title="Ближе к правде"
        primary={`${averageScore}%`}
        primaryLabel="средняя близость"
        secondary={[`10 оценок за партию`]}
        record={`Рекорд: ${savedRecord.bestAverage}% средней близости`}
        onAgain={resetRound}
        onHome={onHome}
        onBeforeLeave={onBeforeLeave}
      />
    );
  }

  return (
    <>
      <div className="toolbar guessToolbar">
        <div className="stats">
          {rounds > 0 && <span className="accuracy"><b>{averageScore}%</b> средняя близость</span>}
        </div>
      </div>

      <RoundProgress answered={rounds} currentAnswered={answered} />

      <section className="guessArea">
        <div className="guessCard">
          <span className="metric">{formatMetric(fact)}</span>
          <span className="object">{fact.object}</span>

          <div className="guessInputRow">
            <input
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !answered) submit(); }}
              placeholder="Твой ответ"
              disabled={answered}
            />
            <span className="unitBadge">{fact.unit || 'число'}</span>
          </div>

          {answered && (
            <div className="guessResult">
              <div className="actualValue">{formatValue(fact)}</div>
              <div className="closeness">Близость: <b>{closeness}%</b></div>
            </div>
          )}

          <div className="guessAction">
            {answered
              ? (
                <button className="next" onClick={next}>
                  {rounds >= ROUND_LENGTH ? 'Результаты' : 'Следующий'} <span>→</span>
                </button>
              )
              : <button className="next" onClick={submit} disabled={parseGuess(input) === null}>Проверить</button>}
          </div>
        </div>
      </section>
    </>
  );
}

function OrderGame({ onFinish, onHome, onBeforeLeave }: GameProps) {
  const [question, setQuestion] = useState(() => createOrderQuestion());
  const [items, setItems] = useState<Fact[]>(question.items);
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedRecord, setSavedRecord] = useState<RecordEntry | null>(null);

  function move(index: number, direction: -1 | 1) {
    if (answered) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const next = [...items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setItems(next);
  }

  function check() {
    if (answered || rounds >= ROUND_LENGTH) return;

    const correct = isOrderCorrect(items);
    setAnswered(true);
    setWasCorrect(correct);
    setRounds((x) => x + 1);

    if (correct) {
      const nextStreak = streak + 1;
      setScore((x) => x + 1);
      setStreak(nextStreak);
      setMaxStreak((x) => Math.max(x, nextStreak));
    } else {
      setStreak(0);
      setItems([...items].sort((a, b) => a.value - b.value));
    }
  }

  function finish() {
    const record = onFinish('order', { score, maxStreak });
    setSavedRecord(record);
    setShowResult(true);
  }

  function next() {
    if (rounds >= ROUND_LENGTH) {
      finish();
      return;
    }

    const nextQuestion = createOrderQuestion(question.metric);
    setQuestion(nextQuestion);
    setItems(nextQuestion.items);
    setAnswered(false);
    setWasCorrect(false);
  }

  function resetRound() {
    const nextQuestion = createOrderQuestion();
    setQuestion(nextQuestion);
    setItems(nextQuestion.items);
    setAnswered(false);
    setWasCorrect(false);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setRounds(0);
    setShowResult(false);
    setSavedRecord(null);
  }

  if (showResult && savedRecord) {
    return (
      <ResultScreen
        title="По порядку"
        primary={`${score} из ${ROUND_LENGTH}`}
        primaryLabel="правильных порядков"
        secondary={[
          `Точность ${Math.round((score / ROUND_LENGTH) * 100)}%`,
          `Лучшая серия ${maxStreak}`
        ]}
        record={`Рекорд: ${savedRecord.bestScore} из ${ROUND_LENGTH} · лучшая серия ${savedRecord.bestStreak}`}
        onAgain={resetRound}
        onHome={onHome}
        onBeforeLeave={onBeforeLeave}
      />
    );
  }

  return (
    <>
      <div className="toolbar">
        <Score score={score} streak={streak} />
      </div>

      <RoundProgress answered={rounds} currentAnswered={answered} />

      <section className="orderArea">
        <div className="orderCard">
          <div className="orderPrompt">
            <div>
              <span className="orderEyebrow">От меньшего к большему</span>
              <strong>{question.metric}{question.unit ? ` · ${question.unit}` : ''}</strong>
            </div>
            <span className="orderHint">Меняй строки местами стрелками</span>
          </div>

          {answered && (
            <div className={`orderAnswerBanner ${wasCorrect ? 'success' : 'fail'}`}>
              {wasCorrect ? 'Верно' : 'Правильный порядок:'}
            </div>
          )}

          <div className="orderList">
            {items.map((fact, index) => (
              <div className={`orderItem ${answered ? 'revealed' : ''}`} key={`${fact.object}-${fact.value}`}>
                <div className="orderPosition">{index + 1}</div>
                <div className="orderName">
                  <span>{fact.object}</span>
                  {answered && <small>{formatValue(fact)}</small>}
                </div>
                {!answered && (
                  <div className="orderControls">
                    <button onClick={() => move(index, -1)} disabled={index === 0} aria-label="Поднять">↑</button>
                    <button onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Опустить">↓</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="guessAction">
            {answered
              ? (
                <button className="next" onClick={next}>
                  {rounds >= ROUND_LENGTH ? 'Результаты' : 'Следующий'} <span>→</span>
                </button>
              )
              : <button className="next" onClick={check}>Проверить</button>}
          </div>
        </div>
      </section>
    </>
  );
}

function NearGame({ onFinish, onHome, onBeforeLeave }: GameProps) {
  const [question, setQuestion] = useState<NearQuestion>(() => createNearQuestion());
  const [selected, setSelected] = useState<Side | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedRecord, setSavedRecord] = useState<RecordEntry | null>(null);

  const correctSide = getNearCorrectSide(question);
  const answered = selected !== null;

  function choose(side: Side) {
    if (answered || rounds >= ROUND_LENGTH) return;

    setSelected(side);
    setRounds((x) => x + 1);

    if (side === correctSide) {
      const nextStreak = streak + 1;
      setScore((x) => x + 1);
      setStreak(nextStreak);
      setMaxStreak((x) => Math.max(x, nextStreak));
    } else {
      setStreak(0);
    }
  }

  function finish() {
    const record = onFinish('near', { score, maxStreak });
    setSavedRecord(record);
    setShowResult(true);
  }

  function next() {
    if (rounds >= ROUND_LENGTH) {
      finish();
      return;
    }

    setQuestion(createNearQuestion(question.reference.object));
    setSelected(null);
  }

  function resetRound() {
    setQuestion(createNearQuestion());
    setSelected(null);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setRounds(0);
    setShowResult(false);
    setSavedRecord(null);
  }

  function candidateClass(side: Side) {
    if (!answered) return '';
    if (side === correctSide) return ' correct';
    if (side === selected) return ' wrong';
    return ' muted';
  }

  if (showResult && savedRecord) {
    return (
      <ResultScreen
        title="Что ближе?"
        primary={`${score} из ${ROUND_LENGTH}`}
        primaryLabel="верных ответов"
        secondary={[
          `Точность ${Math.round((score / ROUND_LENGTH) * 100)}%`,
          `Лучшая серия ${maxStreak}`
        ]}
        record={`Рекорд: ${savedRecord.bestScore} из ${ROUND_LENGTH} · лучшая серия ${savedRecord.bestStreak}`}
        onAgain={resetRound}
        onHome={onHome}
        onBeforeLeave={onBeforeLeave}
      />
    );
  }

  return (
    <>
      <div className="toolbar">
        <Score score={score} streak={streak} />
      </div>

      <RoundProgress answered={rounds} currentAnswered={answered} />

      <section className="nearArea">
        <div className="nearQuestionTitle">Что ближе к ориентиру?</div>

        <div className="referenceCard">
          <span className="referenceLabel">Ориентир</span>
          <div className="referenceMetric">{question.reference.metric}</div>
          <div className="referenceValue">{formatValue(question.reference)}</div>
          <div className="referenceObject">{question.reference.object}</div>
        </div>

        <div className="nearChoices">
          <button className={`nearChoice${candidateClass('left')}`} onClick={() => choose('left')} disabled={answered}>
            <span className="nearLetter">A</span>
            <span className="nearMetric">{question.left.metric}</span>
            <span className="nearObject">{question.left.object}</span>
            {answered && <small>{formatValue(question.left)}</small>}
          </button>

          <button className={`nearChoice${candidateClass('right')}`} onClick={() => choose('right')} disabled={answered}>
            <span className="nearLetter">B</span>
            <span className="nearMetric">{question.right.metric}</span>
            <span className="nearObject">{question.right.object}</span>
            {answered && <small>{formatValue(question.right)}</small>}
          </button>
        </div>

        <div className="feedback">
          {answered ? (
            <>
              <div className={`resultText ${selected === correctSide ? 'success' : 'fail'}`}>
                {selected === correctSide ? 'Верно' : 'Неверно'}
              </div>
              <button className="next" onClick={next}>
                {rounds >= ROUND_LENGTH ? 'Результаты' : 'Следующий'} <span>→</span>
              </button>
            </>
          ) : (
            <div className="hint">Выбери один из двух вариантов</div>
          )}
        </div>
      </section>
    </>
  );
}

const titles: Record<GameTab, { title: string; subtitle: string }> = {
  compare: {
    title: 'Какое число больше?',
    subtitle: 'Сравни два факта и выбери большее значение'
  },
  guess: {
    title: 'Ближе к правде',
    subtitle: 'Попробуй угадать значение как можно точнее'
  },
  order: {
    title: 'Расставь по порядку',
    subtitle: 'Расположи четыре объекта от меньшего значения к большему'
  },
  near: {
    title: 'Что ближе?',
    subtitle: 'Найди значение, которое ближе к заданному ориентиру'
  }
};

const homeGames: Array<{
  id: GameTab;
  title: string;
  description: string;
  number: string;
}> = [
  {
    id: 'compare',
    title: 'Что больше?',
    description: 'Сравни два любых факта и выбери большее число.',
    number: '01'
  },
  {
    id: 'guess',
    title: 'Ближе к правде',
    description: 'Оцени значение и постарайся попасть как можно точнее.',
    number: '02'
  },
  {
    id: 'order',
    title: 'По порядку',
    description: 'Расставь четыре объекта от меньшего значения к большему.',
    number: '03'
  },
  {
    id: 'near',
    title: 'Что ближе?',
    description: 'Выбери значение, которое ближе к заданному ориентиру.',
    number: '04'
  }
];

function HomeScreen({
  records,
  onStart
}: {
  records: Records;
  onStart: (game: GameTab) => void;
}) {
  function recordCopy(game: GameTab) {
    const record = records[game];
    if (record.plays === 0) return 'Ещё не сыграно';

    if (game === 'guess') {
      return `Рекорд ${record.bestAverage}% · партий ${record.plays}`;
    }

    return `Рекорд ${record.bestScore}/${ROUND_LENGTH} · партий ${record.plays}`;
  }

  return (
    <main className="home">
      <header className="homeHero">
        <div className="homeEyebrow">4 мини-игры · {new Intl.NumberFormat('ru-RU').format(getFactCount())} фактов</div>
        <h1>Игры с числами</h1>
        <p>Выбери режим. Одна партия — 10 заданий.</p>
      </header>

      <section className="homeGrid">
        {homeGames.map((game) => (
          <button className="homeGameCard" key={game.id} onClick={() => onStart(game.id)}>
            <span className="homeGameNumber">{game.number}</span>
            <span className="homeGameTitle">{game.title}</span>
            <span className="homeGameDescription">{game.description}</span>
            <span className="homeGameRecord">{recordCopy(game.id)}</span>
            <span className="homeGameArrow">→</span>
          </button>
        ))}
      </section>

      <div className="homeSupport">
        <DonateButton />
      </div>
      <SocialActions />
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [tab, setTab] = useState<GameTab>('compare');
  const [records, setRecords] = useState<Records>(() => loadRecords());
  const [adPending, setAdPending] = useState(false);

  function startGame(game: GameTab) {
    trackEvent('game_selected', { game });
    trackEvent('round_started', { game });
    setTab(game);
    setScreen('game');
  }

  function goHome() {
    setScreen('home');
  }

  function saveResult(game: GameTab, result: FinishResult): RecordEntry {
    trackEvent('round_completed', {
      game,
      score: result.score,
      best_streak: result.maxStreak,
      average: result.average
    });

    const current = records[game];
    const updated: RecordEntry = {
      plays: current.plays + 1,
      bestScore: Math.max(current.bestScore, result.score ?? 0),
      bestStreak: Math.max(current.bestStreak, result.maxStreak ?? 0),
      bestAverage: Math.max(current.bestAverage, result.average ?? 0)
    };

    const nextRecords = {
      ...records,
      [game]: updated
    };

    setRecords(nextRecords);

    if (registerCompletedRound()) {
      setAdPending(true);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    } catch {
      // Игра остаётся полностью рабочей, даже если браузер запретил localStorage.
    }

    return updated;
  }

  async function runPostRoundAction(action: () => void) {
    if (adPending) {
      setAdPending(false);
      trackEvent('ad_requested');
      const shown = await showInterstitialIfAvailable();
      trackEvent(shown ? 'ad_shown' : 'ad_unavailable');
    }

    action();
  }

  if (screen === 'home') {
    return <HomeScreen records={records} onStart={startGame} />;
  }

  const copy = titles[tab];

  return (
    <main className="app appWithBack">
      <button className="backHome" onClick={goHome}>← Все игры</button>

      <nav className="gameTabs topTabs">
        <button className={tab === 'compare' ? 'active' : ''} onClick={() => setTab('compare')}>Что больше?</button>
        <button className={tab === 'guess' ? 'active' : ''} onClick={() => setTab('guess')}>Ближе к правде</button>
        <button className={tab === 'order' ? 'active' : ''} onClick={() => setTab('order')}>По порядку</button>
        <button className={tab === 'near' ? 'active' : ''} onClick={() => setTab('near')}>Что ближе?</button>
      </nav>

      <header className="hero">
        <h1>{copy.title}</h1>
        <p className="subtitle">{copy.subtitle}</p>
      </header>

      {tab === 'compare' && <CompareGame onFinish={saveResult} onHome={goHome} onBeforeLeave={runPostRoundAction} />}
      {tab === 'guess' && <GuessGame onFinish={saveResult} onHome={goHome} onBeforeLeave={runPostRoundAction} />}
      {tab === 'order' && <OrderGame onFinish={saveResult} onHome={goHome} onBeforeLeave={runPostRoundAction} />}
      {tab === 'near' && <NearGame onFinish={saveResult} onHome={goHome} onBeforeLeave={runPostRoundAction} />}

      <footer>{new Intl.NumberFormat('ru-RU').format(getFactCount())} фактов в базе</footer>
    </main>
  );
}
