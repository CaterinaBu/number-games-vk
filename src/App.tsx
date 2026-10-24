import { useEffect, useRef, useState } from 'react';
import homePenguinPart1 from './assets/homePenguinPart1';
import homePenguinPart2 from './assets/homePenguinPart2';
import homePenguinPart3 from './assets/homePenguinPart3';
import resultPenguin from './assets/penguin-result.webp';
import homeGameGuess from './assets/homeGameGuess';
import homeGameCompare from './assets/home/game-compare.webp';
import homeGameOrder from './assets/home/game-order.webp';
import homeGameNear from './assets/home/game-near.webp';
import homeLibrary from './assets/home/library.webp';

const penguinMascot = 'data:image/webp;base64,' + homePenguinPart1 + homePenguinPart2 + homePenguinPart3;
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
import { donateToCommunity, isDonationConfigured, isVKEnvironment, openCommunity, registerCompletedRound, resizeDesktopWindowToContent, shareApp, showAdIfAvailable } from './vk';
import { trackEvent } from './analytics';
import { loadProgress, saveProgress, type PlayerProgress } from './progress';

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
  currentAnswered,
  total = ROUND_LENGTH,
  label = 'Вопрос'
}: {
  answered: number;
  currentAnswered: boolean;
  total?: number;
  label?: string;
}) {
  const current = Math.min(
    total,
    answered + (currentAnswered ? 0 : 1)
  );
  const filled = Math.min(100, (answered / total) * 100);

  return (
    <div className="roundProgress">
      <div className="roundProgressText">
        {label} <b>{current}</b> из {total}
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
    setMessage('');
    trackEvent('share_result');
    const ok = await shareApp();
    if (!ok) setMessage('Не удалось открыть отправку ссылки');
  }

  function handleCommunity() {
    setMessage('');
    trackEvent('community_open');
    const ok = openCommunity();
    if (!ok) setMessage('Сообщество пока не настроено');
  }

  return (
    <div className={`socialActions ${compact ? 'compact' : ''}`}>
      <button onClick={() => { void handleShare(); }}>Поделиться</button>
      <button onClick={handleCommunity}>Сообщество игры</button>
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
        <img className="resultMascot" src={resultPenguin} alt="" aria-hidden="true" />
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
  onAttempt: () => void;
  onRestartRound: (game: GameTab, action: () => void) => void;
};

function CompareGame({ onFinish, onHome, onBeforeLeave, onAttempt, onRestartRound }: GameProps) {
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

    onAttempt();
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
    onRestartRound('compare', () => resetRound(next));
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
        onAgain={() => onRestartRound('compare', () => resetRound())}
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
            <div className="hint">Нажмите на карточку</div>
          )}
        </section>
      </section>
    </>
  );
}

type GuessGameProps = GameProps & {
  tutorialMode: boolean;
  onTutorialComplete: () => void;
};

function GuessGame({
  onFinish,
  onHome,
  onBeforeLeave,
  onAttempt,
  onRestartRound,
  tutorialMode,
  onTutorialComplete
}: GuessGameProps) {
  const [fact, setFact] = useState<Fact>(() => createGuessFact());
  const [input, setInput] = useState('');
  const [submittedGuess, setSubmittedGuess] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [totalCloseness, setTotalCloseness] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedRecord, setSavedRecord] = useState<RecordEntry | null>(null);
  const [replayTutorial, setReplayTutorial] = useState(false);
  const [tutorialIntroOpen, setTutorialIntroOpen] = useState(tutorialMode);
  const [tutorialCompleteOpen, setTutorialCompleteOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [useMobileKeypad] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  );

  const training = tutorialMode || replayTutorial;
  const roundLength = training ? 3 : ROUND_LENGTH;
  const answered = submittedGuess !== null;
  const closeness = answered ? calculateCloseness(submittedGuess, fact.value) : null;
  const averageScore = rounds > 0 ? Math.round(totalCloseness / rounds) : 0;

  const tutorialHints = [
    'Попробуйте угадать значение факта. Знать точно не обязательно: достаточно приближённого значения.',
    'После ответа сравним вашу оценку с настоящим значением. Чем ближе числа, тем выше результат.',
    'В полной партии итог считается по средней близости всех 10 ответов.'
  ];

  function addKey(token: string) {
    if (answered) return;

    setInput((current) => {
      if (token === 'backspace') return current.slice(0, -1);
      if (token === 'clear') return '';
      if (token === 'minus') return current.startsWith('-') ? current.slice(1) : `-${current}`;

      if (token === ',') {
        if (current.includes(',') || current.includes('.')) return current;
        if (current === '') return '0,';
        if (current === '-') return '-0,';
      }

      return current + token;
    });
  }

  function submit() {
    if (answered || rounds >= roundLength) return;

    const guess = parseGuess(input);
    if (guess === null) return;

    inputRef.current?.blur();

    onAttempt();
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

  function completeTraining() {
    onTutorialComplete();
    setTutorialCompleteOpen(true);
  }

  function next() {
    if (rounds >= roundLength) {
      if (training) {
        completeTraining();
      } else {
        finish();
      }
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

  function startTutorialReplay() {
    resetRound();
    setReplayTutorial(true);
    setTutorialIntroOpen(true);
    trackEvent('tutorial_restarted', { game: 'guess' });
  }

  function startFullRoundAfterTutorial() {
    setTutorialCompleteOpen(false);
    setReplayTutorial(false);
    resetRound();
    trackEvent('round_started', { game: 'guess', source: 'tutorial_complete' });
  }

  if (showResult && savedRecord) {
    return (
      <ResultScreen
        title="Ближе к правде"
        primary={`${averageScore}%`}
        primaryLabel="средняя близость"
        secondary={[`10 оценок за партию`]}
        record={`Рекорд: ${savedRecord.bestAverage}% средней близости`}
        onAgain={() => onRestartRound('guess', resetRound)}
        onHome={onHome}
        onBeforeLeave={onBeforeLeave}
      />
    );
  }

  return (
    <>
      {!training && (
        <section className="guessQuickRules">
          <div>
            <strong>Как играть</strong>
            <span>Попробуйте угадать значение факта. Точное число знать не обязательно — важна близость ответа.</span>
          </div>
          <button type="button" onClick={startTutorialReplay}>Пройти обучение ещё раз</button>
        </section>
      )}

      <div className="toolbar guessToolbar">
        <div className="stats">
          {training
            ? <span className="tutorialModeLabel">Обучение · 3 задания</span>
            : rounds > 0 && <span className="accuracy"><b>{averageScore}%</b> средняя близость</span>}
        </div>
      </div>

      <RoundProgress
        answered={rounds}
        currentAnswered={answered}
        total={roundLength}
        label={training ? 'Задание' : 'Вопрос'}
      />

      {training && (
        <div className="tutorialHintBar">
          <span>💡</span>
          <div>
            <strong>Подсказка</strong>
            <p>{tutorialHints[Math.min(rounds, tutorialHints.length - 1)]}</p>
          </div>
        </div>
      )}

      <section className={`guessArea ${training ? 'guessAreaTutorial' : ''}`}>
        <div className="guessCard">
          <span className="metric">{formatMetric(fact)}</span>
          <span className="object">{fact.object}</span>

          {useMobileKeypad && !answered && (
            <div className="mobileGuessInstruction">
              Для ввода используйте кнопки ниже — выбранные цифры появятся в поле автоматически.
            </div>
          )}

          <div className="guessInputRow">
            <input
              ref={inputRef}
              inputMode={useMobileKeypad ? 'none' : 'decimal'}
              value={input}
              onChange={(e) => {
                if (!useMobileKeypad) setInput(e.target.value);
              }}
              onFocus={(e) => {
                if (useMobileKeypad) e.currentTarget.blur();
              }}
              onKeyDown={(e) => {
                if (!useMobileKeypad && e.key === 'Enter' && !answered) submit();
              }}
              placeholder={useMobileKeypad ? 'Ввод — кнопками ниже' : 'Ваш ответ'}
              readOnly={answered || useMobileKeypad}
              aria-readonly={answered || useMobileKeypad}
            />
            <span className="unitBadge">{fact.unit || 'число'}</span>
          </div>

          {useMobileKeypad && !answered && (
            <div className="mobileGuessPad" aria-label="Цифровая клавиатура">
              <div className="mobileGuessPadTools">
                <button
                  type="button"
                  className="mobileGuessKey utility"
                  onClick={() => addKey('clear')}
                  aria-label="Очистить"
                >
                  C
                </button>
                <button
                  type="button"
                  className="mobileGuessKey utility"
                  onClick={() => addKey('backspace')}
                  aria-label="Удалить символ"
                >
                  ⌫
                </button>
              </div>

              <div className="mobileGuessPadDigits">
                {['7','8','9','4','5','6','1','2','3','minus','0',','].map((key) => (
                  <button
                    type="button"
                    key={key}
                    className={`mobileGuessKey ${key === 'minus' ? 'utility' : ''}`}
                    onClick={() => addKey(key)}
                    aria-label={key === 'minus' ? 'Изменить знак' : key}
                  >
                    {key === 'minus' ? '−' : key}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answered && (
            <div className="guessResult">
              <div className="actualValue">{formatValue(fact)}</div>
              <div className="closeness">Близость: <b>{closeness}%</b></div>
              {training && (
                <div className="tutorialAnswerNote">
                  {closeness !== null && closeness >= 80
                    ? 'Очень близко — отличный ориентир.'
                    : closeness !== null && closeness >= 50
                      ? 'Неплохо: направление верное, но можно приблизиться ещё.'
                      : 'Здесь промах заметный — ничего страшного, важна именно оценка масштаба.'}
                </div>
              )}
            </div>
          )}

          <div className="guessAction">
            {answered
              ? (
                <button type="button" className="next" onClick={next}>
                  {rounds >= roundLength
                    ? training ? 'Завершить обучение' : 'Результаты'
                    : 'Следующий'} <span>→</span>
                </button>
              )
              : <button type="button" className="next" onClick={submit} disabled={parseGuess(input) === null}>Проверить</button>}
          </div>
        </div>
      </section>

      {tutorialIntroOpen && (
        <div className="tutorialOverlay" role="presentation" onMouseDown={() => setTutorialIntroOpen(false)}>
          <section
            className="tutorialModal tutorialIntroModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guess-tutorial-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="tutorialClose" onClick={() => setTutorialIntroOpen(false)} aria-label="Закрыть">×</button>

            <div className="tutorialHero tutorialHeroIntro">
              <img src={guessTutorialIntroArt} alt="" aria-hidden="true" />
              <div className="tutorialHeroShade" aria-hidden="true" />
              <div className="tutorialHeroCopy">
                <div className="tutorialEyebrow">Ближе к правде</div>
                <h2 id="guess-tutorial-title">Давайте попробуем!</h2>
                <p>Сначала — 3 тренировочных задания,<br />чтобы разобраться с механикой.</p>
              </div>
            </div>

            <div className="tutorialRules tutorialRulesCompact">
              <div><b>🎯</b><span>Оцените значение факта</span></div>
              <div><b>#</b><span>Точное число знать<br />не обязательно</span></div>
              <div><b>⭐</b><span>Чем ближе ответ,<br />тем выше результат</span></div>
            </div>

            <button
              className="next tutorialPrimary"
              onClick={() => {
                setTutorialIntroOpen(false);
                trackEvent('tutorial_started', { game: 'guess' });
              }}
            >
              Начать обучение
            </button>
          </section>
        </div>
      )}

      {tutorialCompleteOpen && (
        <div className="tutorialOverlay tutorialCompleteOverlay" role="presentation">
          <section
            className="tutorialModal tutorialCompleteModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guess-tutorial-complete-title"
          >
            <div
              className="tutorialHero tutorialHeroComplete"
              style={{ backgroundImage: `url(${guessTutorialCompleteArt})` }}
            >
              <div className="tutorialHeroShade" aria-hidden="true" />
              <div className="tutorialHeroCopy">
                <div className="tutorialEyebrow">Обучение завершено</div>
                <h2 id="guess-tutorial-complete-title">Игра освоена!</h2>
                <p>Теперь доступны партии из 10 заданий.<br />Итог — средняя близость всех ответов.</p>
              </div>
            </div>

            <div className="tutorialCompleteBottom">
              <div className="tutorialCompleteStat">
                <strong>{averageScore}%</strong>
                <span>средняя близость в обучении</span>
              </div>
              <div className="tutorialCompleteActions">
                <button className="next tutorialPrimary" onClick={startFullRoundAfterTutorial}>
                  Сыграть полную партию
                </button>
                <button
                  className="secondaryButton tutorialSecondary"
                  onClick={() => {
                    setTutorialCompleteOpen(false);
                    setReplayTutorial(false);
                    resetRound();
                    onHome();
                  }}
                >
                  Вернуться на главную
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function OrderGame({ onFinish, onHome, onBeforeLeave, onAttempt, onRestartRound }: GameProps) {
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
  const [submittedItems, setSubmittedItems] = useState<Fact[] | null>(null);

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

    onAttempt();
    const correct = isOrderCorrect(items);
    setSubmittedItems([...items]);
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
    setSubmittedItems(null);
  }

  function resetRound() {
    const nextQuestion = createOrderQuestion();
    setQuestion(nextQuestion);
    setItems(nextQuestion.items);
    setAnswered(false);
    setWasCorrect(false);
    setSubmittedItems(null);
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
        onAgain={() => onRestartRound('order', resetRound)}
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
            <span className="orderHint">Меняйте строки местами стрелками</span>
          </div>

          {answered && (
            <div className={`orderAnswerBanner ${wasCorrect ? 'success' : 'fail'}`}>
              {wasCorrect ? 'Верно' : 'Есть ошибка в порядке'}
            </div>
          )}

          {answered && !wasCorrect && submittedItems ? (
            <div className="orderComparison">
              <div className="orderColumn">
                <div className="orderColumnTitle">Ваш ответ</div>
                <div className="orderList compact">
                  {submittedItems.map((fact, index) => {
                    const correctAtPosition = items[index]?.object === fact.object && items[index]?.value === fact.value;
                    return (
                      <div
                        className={`orderItem revealed submitted ${correctAtPosition ? 'positionCorrect' : 'positionWrong'}`}
                        key={`submitted-${fact.object}-${fact.value}-${index}`}
                      >
                        <div className="orderPosition">{index + 1}</div>
                        <div className="orderName">
                          <span>{fact.object}</span>
                          <small>{formatValue(fact)}</small>
                        </div>
                        <div className="orderPositionMark" aria-label={correctAtPosition ? 'Верная позиция' : 'Неверная позиция'}>
                          {correctAtPosition ? '✓' : '×'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="orderColumn">
                <div className="orderColumnTitle correctTitle">Правильный порядок</div>
                <div className="orderList compact">
                  {items.map((fact, index) => (
                    <div className="orderItem revealed correctOrder" key={`correct-${fact.object}-${fact.value}-${index}`}>
                      <div className="orderPosition">{index + 1}</div>
                      <div className="orderName">
                        <span>{fact.object}</span>
                        <small>{formatValue(fact)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
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
          )}

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

function NearGame({ onFinish, onHome, onBeforeLeave, onAttempt, onRestartRound }: GameProps) {
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

    onAttempt();
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
        onAgain={() => onRestartRound('near', resetRound)}
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
            <div className="hint">Выберите один из двух вариантов</div>
          )}
        </div>
      </section>
    </>
  );
}

const titles: Record<GameTab, { title: string; subtitle: string }> = {
  compare: {
    title: 'Какое число больше?',
    subtitle: 'Сравните два факта и выберите большее значение'
  },
  guess: {
    title: 'Ближе к правде',
    subtitle: 'Попробуйте угадать значение как можно точнее'
  },
  order: {
    title: 'Расставьте по порядку',
    subtitle: 'Расположите четыре объекта от меньшего значения к большему'
  },
  near: {
    title: 'Что ближе?',
    subtitle: 'Найдите значение, которое ближе к заданному ориентиру'
  }
};

const homeGameArt: Record<GameTab, string> = {
  compare: homeGameCompare,
  guess: homeGameGuess,
  order: homeGameOrder,
  near: homeGameNear
};

const HOME_ASSET_BASE = `${import.meta.env.BASE_URL}assets/home/`;

const TUTORIAL_ASSET_BASE = `${import.meta.env.BASE_URL}assets/tutorial/`;
const guessTutorialIntroArt = `${HOME_ASSET_BASE}game-guess.avif`;
const guessTutorialCompleteArt = `${TUTORIAL_ASSET_BASE}guess-tutorial-complete-wide.webp`;

const hqHomeGameArt: Record<GameTab, string> = {
  compare: `${HOME_ASSET_BASE}game-compare.avif`,
  guess: `${HOME_ASSET_BASE}game-guess.avif`,
  order: `${HOME_ASSET_BASE}game-order.avif`,
  near: `${HOME_ASSET_BASE}game-near.avif`
};

const hqHomeLibrary = `${HOME_ASSET_BASE}library.avif`;

function HomeAssetImage({
  preferred,
  fallback
}: {
  preferred: string;
  fallback: string;
}) {
  const [src, setSrc] = useState(preferred);

  useEffect(() => {
    setSrc(preferred);
  }, [preferred]);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}

const homeGames: Array<{
  id: GameTab;
  title: string;
  description: string;
  number: string;
  icon: string;
}> = [
  {
    id: 'compare',
    title: 'Что больше?',
    description: 'Сравните два любых факта и выберите большее число.',
    number: '01',
    icon: '↗'
  },
  {
    id: 'guess',
    title: 'Ближе к правде',
    description: 'Оцените значение и постарайтесь попасть как можно точнее.',
    number: '02',
    icon: '?'
  },
  {
    id: 'order',
    title: 'По порядку',
    description: 'Расставьте четыре объекта от меньшего значения к большему.',
    number: '03',
    icon: '123'
  },
  {
    id: 'near',
    title: 'Что ближе?',
    description: 'Выберите значение, которое ближе к заданному ориентиру.',
    number: '04',
    icon: '◎'
  }
];

function HomeScreen({
  records,
  progress,
  onStart
}: {
  records: Records;
  progress: PlayerProgress;
  onStart: (game: GameTab) => void;
}) {
  const masteredCount = homeGames.filter((game) => progress.status[game.id] === 'mastered').length;
  const newGame = homeGames.find((game) => progress.status[game.id] === 'new');
  const tutorialGame = homeGames.find((game) => progress.status[game.id] === 'tutorial');

  const featuredGame = newGame
    ?? tutorialGame
    ?? homeGames[Math.floor(Date.now() / 86_400_000) % homeGames.length];

  const otherGames = homeGames.filter((game) => game.id !== featuredGame.id);

  function recordCopy(game: GameTab) {
    const record = records[game];
    if (record.plays === 0) return 'Первый результат ещё впереди';

    if (game === 'guess') {
      return `Рекорд ${record.bestAverage}% · партий ${record.plays}`;
    }

    return `Рекорд ${record.bestScore}/${ROUND_LENGTH} · партий ${record.plays}`;
  }

  function statusCopy(game: GameTab) {
    if (progress.status[game] === 'new') return 'NEW';
    if (progress.status[game] === 'tutorial') return 'Обучение';
    return null;
  }

  return (
    <main className="home homeDashboard">
      <header className="dashboardHeader">
        <div className="dashboardIdentity">
          <img src={penguinMascot} alt="" aria-hidden="true" />
          <div>
            <h1>Игры с числами</h1>
            <p>Открывайте удивительные факты и тренируйте интуицию</p>
          </div>
        </div>

        <div className="dashboardTopLinks" aria-label="Разделы игры">
          <span className="dashboardTopLink">
            <b>🏆</b>
            <span>Рейтинг</span>
            <small>скоро</small>
          </span>
          <span className="dashboardTopLink">
            <b>🛍</b>
            <span>Магазин</span>
            <small>скоро</small>
          </span>
          <span className="dashboardTopLink">
            <b>📚</b>
            <span>Библиотека</span>
          </span>
        </div>
      </header>

      <section className="dashboardMetaRow">
        <div className="masteryCard">
          <div className="masteryIcon">🎮</div>
          <div className="masteryCopy">
            <strong>Освоено {masteredCount} из 4 игр</strong>
            <div className="masterySteps" aria-hidden="true">
              {homeGames.map((game) => (
                <span key={game.id} className={progress.status[game.id] === 'mastered' ? 'done' : ''} />
              ))}
            </div>
          </div>
        </div>

        <div className={`dailyCard ${masteredCount === 4 ? 'unlocked' : 'locked'}`}>
          <div className="dailyIcon">{masteredCount === 4 ? '📅' : '🔒'}</div>
          <div>
            <strong>Задание дня</strong>
            <span>
              {masteredCount === 4
                ? 'Скоро здесь появится новое испытание каждый день'
                : `Освойте ещё ${4 - masteredCount}, чтобы открыть`}
            </span>
          </div>
        </div>
      </section>

      <section className="dashboardMainGrid">
        <div className="dashboardGames">
          <div className="featuredLabel">
            {progress.status[featuredGame.id] === 'mastered'
              ? 'Сегодня рекомендуем'
              : progress.status[featuredGame.id] === 'tutorial'
                ? 'Продолжить обучение'
                : 'Начните отсюда'}
          </div>

          <button
            className={`dashboardFeatured dashboardFeatured-${featuredGame.id}`}
            onClick={() => onStart(featuredGame.id)}
          >
            <span className="dashboardFeaturedImage" aria-hidden="true">
              <HomeAssetImage
                preferred={hqHomeGameArt[featuredGame.id]}
                fallback={homeGameArt[featuredGame.id]}
              />
            </span>
            <span className="dashboardFeaturedShade" aria-hidden="true" />
            <span className="dashboardFeaturedCopy">
              {statusCopy(featuredGame.id) && (
                <span className={`gameStatusBadge ${progress.status[featuredGame.id]}`}>
                  {statusCopy(featuredGame.id)}
                </span>
              )}
              <span className="dashboardFeaturedTitle">{featuredGame.title}</span>
              <span className="dashboardFeaturedDescription">{featuredGame.description}</span>
              <span className="dashboardFeaturedRecord">{recordCopy(featuredGame.id)}</span>
              <span className="dashboardFeaturedCta">Играть <b>→</b></span>
            </span>
          </button>

          <div className="dashboardMiniGrid">
            {otherGames.map((game) => (
              <button
                className={`dashboardMiniGame dashboardMiniGame-${game.id}`}
                key={game.id}
                onClick={() => onStart(game.id)}
              >
                <span className="dashboardMiniImage" aria-hidden="true">
                  <HomeAssetImage
                    preferred={hqHomeGameArt[game.id]}
                    fallback={homeGameArt[game.id]}
                  />
                  {statusCopy(game.id) && (
                    <span className={`gameStatusBadge ${progress.status[game.id]}`}>
                      {statusCopy(game.id)}
                    </span>
                  )}
                </span>
                <span className="dashboardMiniCopy">
                  <span className="dashboardMiniTitle">{game.title}</span>
                  <span className="dashboardMiniDescription">{game.description}</span>
                  <span className="dashboardMiniRecord">{recordCopy(game.id)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="dashboardSide">
          <section className="sideQuickCard ratingQuickCard">
            <div className="sideQuickIcon">🏆</div>
            <div>
              <strong>Рейтинг</strong>
              <span>Сравнивайте результаты с другими игроками</span>
            </div>
            <small>Скоро</small>
          </section>

          <section className="sideQuickCard shopQuickCard">
            <div className="sideQuickIcon">🛍</div>
            <div>
              <strong>Магазин</strong>
              <span>Фактобаллы, бонусы и украшения</span>
            </div>
            <small>Скоро</small>
          </section>

          <section className="libraryPreview">
            <div className="libraryPreviewImage">
              <HomeAssetImage
                preferred={hqHomeLibrary}
                fallback={homeLibrary}
              />
            </div>
            <div className="libraryPreviewCopy">
              <span className="sideEyebrow">Ваш прогресс</span>
              <h2>Библиотека пингвина</h2>
              <p>Собирайте факты, открывайте достижения и развивайте историю своего исследователя.</p>
              <span className="sideSoon">Раздел появится следующим этапом</span>
            </div>
          </section>
        </aside>
      </section>

      <div className="dashboardFooterActions">
        <DonateButton />
        <SocialActions compact />
      </div>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [tab, setTab] = useState<GameTab>('compare');
  const [records, setRecords] = useState<Records>(() => loadRecords());
  const [progress, setProgress] = useState<PlayerProgress>(() => {
    const stored = loadProgress();
    const migrated: PlayerProgress = {
      status: {
        compare: records.compare.plays > 0 ? 'mastered' : stored.status.compare,
        guess: records.guess.plays > 0 ? 'mastered' : stored.status.guess,
        order: records.order.plays > 0 ? 'mastered' : stored.status.order,
        near: records.near.plays > 0 ? 'mastered' : stored.status.near
      }
    };
    saveProgress(migrated);
    return migrated;
  });
  const [adPending, setAdPending] = useState(false);
  const [hasAttemptedAnswer, setHasAttemptedAnswer] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<{
    action: () => void;
  } | null>(null);


  useEffect(() => {
    let frame = 0;
    let stopped = false;

    const syncWindowSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!stopped) void resizeDesktopWindowToContent();
      });
    };

    syncWindowSize();

    const main = document.querySelector('main');
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncWindowSize)
      : null;

    if (main && observer) observer.observe(main);
    window.addEventListener('resize', syncWindowSize);

    const delayedSync = window.setTimeout(syncWindowSize, 160);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(delayedSync);
      observer?.disconnect();
      window.removeEventListener('resize', syncWindowSize);
    };
  }, [screen, tab]);

  function startGame(game: GameTab) {
    setHasAttemptedAnswer(false);

    if (progress.status[game] === 'new') {
      const nextProgress: PlayerProgress = {
        ...progress,
        status: {
          ...progress.status,
          [game]: 'tutorial'
        }
      };
      setProgress(nextProgress);
      saveProgress(nextProgress);
    }

    trackEvent('game_selected', { game, source: 'home' });
    trackEvent('round_started', { game, source: 'home' });
    setTab(game);
    setScreen('game');
  }

  function markAttempted() {
    setHasAttemptedAnswer(true);
  }

  function requestRoundExit(action: () => void) {
    if (!hasAttemptedAnswer) {
      action();
      return;
    }

    setLeaveConfirm({ action });
  }

  function closeLeaveConfirm() {
    setLeaveConfirm(null);
  }

  function confirmRoundExit() {
    const action = leaveConfirm?.action;
    setLeaveConfirm(null);
    action?.();
  }

  function goHome() {
    requestRoundExit(() => {
      if (hasAttemptedAnswer) {
        trackEvent('round_abandoned', { game: tab, destination: 'home' });
      }

      setHasAttemptedAnswer(false);
      setScreen('home');
    });
  }

  function switchGame(game: GameTab) {
    if (game === tab) return;

    requestRoundExit(() => {
      if (hasAttemptedAnswer) {
        trackEvent('round_abandoned', { game: tab, destination: 'another_game' });
      }

      setHasAttemptedAnswer(false);
      trackEvent('game_selected', { game, source: 'top_tabs' });
      trackEvent('round_started', { game, source: 'top_tabs' });
      setTab(game);
    });
  }

  function restartRound(game: GameTab, action: () => void) {
    requestRoundExit(() => {
      if (hasAttemptedAnswer) {
        trackEvent('round_abandoned', { game, destination: 'restart' });
      }

      setHasAttemptedAnswer(false);
      trackEvent('round_started', { game, source: 'restart' });
      action();
    });
  }

  function completeTutorial(game: GameTab) {
    setHasAttemptedAnswer(false);

    if (progress.status[game] !== 'mastered') {
      const nextProgress: PlayerProgress = {
        ...progress,
        status: {
          ...progress.status,
          [game]: 'mastered'
        }
      };

      setProgress(nextProgress);
      saveProgress(nextProgress);
    }

    trackEvent('tutorial_completed', { game });
  }

  function saveResult(game: GameTab, result: FinishResult): RecordEntry {
    setHasAttemptedAnswer(false);
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

    if (progress.status[game] !== 'mastered') {
      const nextProgress: PlayerProgress = {
        ...progress,
        status: {
          ...progress.status,
          [game]: 'mastered'
        }
      };
      setProgress(nextProgress);
      saveProgress(nextProgress);
    }

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
      const adFormat = await showAdIfAvailable();
      if (adFormat) {
        trackEvent('ad_shown', { format: adFormat });
      } else {
        trackEvent('ad_unavailable');
      }
    }

    action();
  }

  function goHomeFromTopBar() {
    void runPostRoundAction(goHome);
  }

  function switchGameFromTopBar(game: GameTab) {
    void runPostRoundAction(() => switchGame(game));
  }

  if (screen === 'home') {
    return <HomeScreen records={records} progress={progress} onStart={startGame} />;
  }

  const copy = titles[tab];

  return (
    <main className={`app appWithBack app-${tab}`}>
      <button className="backHome" onClick={goHomeFromTopBar}>← Все игры</button>

      <nav className="gameTabs topTabs">
        <button className={tab === 'compare' ? 'active' : ''} onClick={() => switchGameFromTopBar('compare')}>Что больше?</button>
        <button className={tab === 'guess' ? 'active' : ''} onClick={() => switchGameFromTopBar('guess')}>Ближе к правде</button>
        <button className={tab === 'order' ? 'active' : ''} onClick={() => switchGameFromTopBar('order')}>По порядку</button>
        <button className={tab === 'near' ? 'active' : ''} onClick={() => switchGameFromTopBar('near')}>Что ближе?</button>
      </nav>

      <header className="hero">
        <h1>{copy.title}</h1>
        <p className="subtitle">{copy.subtitle}</p>
      </header>

      {tab === 'compare' && <CompareGame onFinish={saveResult} onHome={goHome} onBeforeLeave={runPostRoundAction} onAttempt={markAttempted} onRestartRound={restartRound} />}
      {tab === 'guess' && (
        <GuessGame
          onFinish={saveResult}
          onHome={goHome}
          onBeforeLeave={runPostRoundAction}
          onAttempt={markAttempted}
          onRestartRound={restartRound}
          tutorialMode={progress.status.guess === 'tutorial'}
          onTutorialComplete={() => completeTutorial('guess')}
        />
      )}
      {tab === 'order' && <OrderGame onFinish={saveResult} onHome={goHome} onBeforeLeave={runPostRoundAction} onAttempt={markAttempted} onRestartRound={restartRound} />}
      {tab === 'near' && <NearGame onFinish={saveResult} onHome={goHome} onBeforeLeave={runPostRoundAction} onAttempt={markAttempted} onRestartRound={restartRound} />}

      {leaveConfirm && (
        <div className="gameConfirmBackdrop" role="presentation" onMouseDown={closeLeaveConfirm}>
          <section
            className="gameConfirmModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="gameConfirmSparkle">✦</div>
            <div className="gameConfirmIcon" aria-hidden="true">?</div>
            <h2 id="game-confirm-title">Выйти из текущей партии?</h2>
            <p>Прогресс этой партии не сохранится.</p>
            <div className="gameConfirmActions">
              <button className="secondaryButton" onClick={closeLeaveConfirm}>Остаться</button>
              <button className="next gameConfirmLeave" onClick={confirmRoundExit}>Выйти</button>
            </div>
          </section>
        </div>
      )}

      <footer>{new Intl.NumberFormat('ru-RU').format(getFactCount())} фактов в базе</footer>
    </main>
  );
}
