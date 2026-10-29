import type { PlayerProgress } from './progress';
import {
  getDailyLibraryStats,
  getLibraryFactOverview,
  type LibraryProgress
} from './library';

type GameTab = 'compare' | 'guess' | 'order' | 'near';

type GameRecord = {
  plays: number;
  bestScore: number;
  bestStreak: number;
  bestAverage: number;
};

type Records = Record<GameTab, GameRecord>;

type LibraryScreenProps = {
  records: Records;
  progress: PlayerProgress;
  libraryProgress: LibraryProgress;
  todayKey: string;
  onHome: () => void;
  onStartGame: (game: GameTab) => void;
  onOpenDaily: () => void;
};

const GAME_INFO: Record<GameTab, { title: string; icon: string }> = {
  compare: { title: 'Что больше?', icon: '01' },
  guess: { title: 'Ближе к правде', icon: '02' },
  order: { title: 'По порядку', icon: '03' },
  near: { title: 'Что ближе?', icon: '04' }
};

const JOURNEY_ASSET_BASE = `${import.meta.env.BASE_URL}assets/library/`;
const JOURNEY_FALLBACK = `${import.meta.env.BASE_URL}assets/home/library.avif`;

const JOURNEY_STAGES = [
  {
    title: 'Любопытство',
    short: 'Первая книга',
    image: '01-curiosity.avif',
    description: 'Пингвин получает первую книгу и начинает собирать удивительные факты о мире.'
  },
  {
    title: 'Мечта',
    short: 'Мечта об экспедиции',
    image: '02-dream.avif',
    description: 'Среди книг и карт появляется мечта: однажды собрать собственную исследовательскую экспедицию.'
  },
  {
    title: 'Учёба',
    short: 'Учёба',
    image: '03-study.avif',
    description: 'Пингвин понимает, что одной любознательности мало, и начинает учиться по-настоящему.'
  },
  {
    title: 'Первая экспедиция',
    short: 'Первая экспедиция',
    image: '04-first-expedition.avif',
    description: 'Его берут в настоящую экспедицию. Теперь знания впервые приходится применять вдали от дома.'
  },
  {
    title: 'Музей',
    short: 'Музей',
    image: '05-museum.avif',
    description: 'После возвращения пингвин начинает работать в музее и помогает сохранять открытия для других.'
  },
  {
    title: 'Исследователь',
    short: 'Исследователь',
    image: '06-researcher.avif',
    description: 'У пингвина появляются собственные исследовательские задачи, проекты и профессиональный опыт.'
  },
  {
    title: 'Своя экспедиция',
    short: 'Своя экспедиция',
    image: '07-own-expedition.avif',
    description: 'Пингвин готов сам выбрать маршрут, собрать команду и возглавить исследовательскую экспедицию.'
  },
  {
    title: 'Финал',
    short: 'Своя книга',
    image: '08-finale.avif',
    description: 'Пройдя большой путь, пингвин возвращается к книгам — и теперь уже пишет собственную.'
  }
] as const;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function LibraryProgressBar({ value }: { value: number }) {
  return (
    <span className="libraryProgressTrack" aria-hidden="true">
      <span className="libraryProgressFill" style={{ width: `${clampPercent(value)}%` }} />
    </span>
  );
}

function journeyStageIndex({
  openedFacts,
  totalFacts,
  masteredCount,
  totalPlays,
  dailyTotal,
  achievements
}: {
  openedFacts: number;
  totalFacts: number;
  masteredCount: number;
  totalPlays: number;
  dailyTotal: number;
  achievements: number;
}): number {
  const factShare = totalFacts > 0 ? openedFacts / totalFacts : 0;
  if (factShare >= .75 && totalPlays >= 150 && dailyTotal >= 30) return 7;
  if (openedFacts >= 600 && totalPlays >= 75 && dailyTotal >= 10) return 6;
  if (openedFacts >= 350 && achievements >= 5) return 5;
  if (openedFacts >= 200 && totalPlays >= 25) return 4;
  if (openedFacts >= 120 && masteredCount === 4) return 3;
  if (openedFacts >= 60 && masteredCount >= 2) return 2;
  if (openedFacts >= 20) return 1;
  return 0;
}

export default function LibraryScreen({
  records,
  progress,
  libraryProgress,
  todayKey,
  onHome,
  onStartGame,
  onOpenDaily
}: LibraryScreenProps) {
  const factOverview = getLibraryFactOverview(libraryProgress);
  const dailyStats = getDailyLibraryStats(libraryProgress, todayKey);
  const totalPlays = Object.values(records).reduce((sum, record) => sum + record.plays, 0);
  const masteredCount = (Object.keys(progress.status) as GameTab[])
    .filter((game) => progress.status[game] === 'mastered').length;
  const hasPerfectGame = (Object.keys(records) as GameTab[]).some((game) => (
    game === 'guess'
      ? records[game].bestAverage >= 100
      : records[game].bestScore >= 10
  ));
  const hardDailyCount = dailyStats.difficultyCounts.hard;

  const coreAchievements = [
    { icon: '📖', title: 'Первый шаг', note: 'Сыграть первую партию', unlocked: totalPlays >= 1 },
    { icon: '🧠', title: '100 фактов', note: 'Открыть 100 уникальных фактов', unlocked: factOverview.opened >= 100 },
    { icon: '🎮', title: 'Все игры', note: 'Освоить все четыре игры', unlocked: masteredCount === 4 },
    { icon: '🔥', title: 'Серия 7 дней', note: 'Выполнять задания дня неделю', unlocked: dailyStats.bestStreak >= 7 },
    { icon: '🏔', title: '500 фактов', note: 'Открыть 500 уникальных фактов', unlocked: factOverview.opened >= 500 }
  ];

  const coreUnlockedAchievements = coreAchievements.filter((item) => item.unlocked).length;
  const stageIndex = journeyStageIndex({
    openedFacts: factOverview.opened,
    totalFacts: factOverview.total,
    masteredCount,
    totalPlays,
    dailyTotal: dailyStats.total,
    achievements: coreUnlockedAchievements
  });
  const stage = JOURNEY_STAGES[stageIndex];
  const achievements = [
    ...coreAchievements.slice(0, 4),
    { icon: '🧭', title: 'Первая экспедиция', note: 'Дойти до главы экспедиции', unlocked: stageIndex >= 3 },
    coreAchievements[4]
  ];
  const unlockedAchievements = achievements.filter((item) => item.unlocked).length;

  const journeyPercent = clampPercent(((stageIndex + .35) / JOURNEY_STAGES.length) * 100);
  const factPercent = factOverview.total > 0
    ? clampPercent((factOverview.opened / factOverview.total) * 100)
    : 0;

  const favoriteGame = (Object.keys(records) as GameTab[])
    .sort((a, b) => records[b].plays - records[a].plays)[0];
  const favoriteGameHasData = favoriteGame && records[favoriteGame].plays > 0;

  const nextFactTarget = Math.min(
    factOverview.total,
    Math.max(20, Math.ceil((factOverview.opened + 1) / 20) * 20)
  );
  const factsToNext = Math.max(0, nextFactTarget - factOverview.opened);
  const nextMasteryTarget = Math.min(4, Math.max(1, masteredCount + 1));
  const gamesToNext = Math.max(0, nextMasteryTarget - masteredCount);
  const nextDailyTarget = Math.max(1, Math.ceil((dailyStats.total + 1) / 5) * 5);
  const dailyToNext = Math.max(0, nextDailyTarget - dailyStats.total);

  const startedAt = new Date(libraryProgress.startedAt);
  const startedLabel = Number.isNaN(startedAt.getTime())
    ? 'недавно'
    : startedAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <main className="libraryPage">
      <nav className="libraryNav" aria-label="Разделы игры">
        <button onClick={onHome}><span>⌂</span>Главная</button>
        <button onClick={() => onStartGame('compare')}><span>🎮</span>Игры</button>
        <button onClick={onOpenDaily}><span>▣</span>Задание дня</button>
        <button className="disabled" disabled><span>🛍</span>Магазин <small>скоро</small></button>
        <button className="active"><span>▤</span>Библиотека</button>
        <div className="libraryNavBalance"><b>✦</b>{progress.factPoints.toLocaleString('ru-RU')}</div>
      </nav>

      <section className="libraryProfileHero libraryProfileHeroPlain">
        <div className="libraryProfileCopy">
          <span className="libraryKicker">Личная история</span>
          <div className="libraryProfileTitleRow">
            <h1>Мой пингвин</h1>
            <span>{stage.title}</span>
          </div>
          <div className="libraryProfileMeta">
            <span><b>◷</b> Учёт прогресса с {startedLabel}</span>
            <span><b>▤</b> {factOverview.opened} фактов</span>
            <span><b>🏆</b> {unlockedAchievements} достижений</span>
            <span><b>▣</b> {dailyStats.total} заданий дня</span>
          </div>
        </div>
      </section>

      <section className="libraryTopGrid">
        <article className="libraryCard libraryFactsCard">
          <div className="librarySectionHead">
            <div>
              <span className="libraryKicker">Коллекция</span>
              <h2>Открытые факты</h2>
            </div>
            <span className="librarySectionIcon">📚</span>
          </div>

          <div className="libraryFactTotal">
            <strong>{factOverview.opened.toLocaleString('ru-RU')}</strong>
            <span>из {factOverview.total.toLocaleString('ru-RU')}</span>
            <b>{factPercent}%</b>
          </div>
          <LibraryProgressBar value={factPercent} />

          <div className="libraryCategoryList">
            {factOverview.categories.map((category) => {
              const percent = category.total > 0
                ? (category.opened / category.total) * 100
                : 0;

              return (
                <div className="libraryCategoryRow" key={category.category}>
                  <div className="libraryCategoryLabel">
                    <strong>{category.category}</strong>
                    <span>{category.opened} / {category.total} · {clampPercent(percent)}%</span>
                  </div>
                  <LibraryProgressBar value={percent} />
                </div>
              );
            })}
          </div>
        </article>

        <div className="libraryJourneyColumn">
          <article className="libraryCard libraryJourneyCard">
            <div className="libraryJourneyImage">
              <img
                src={`${JOURNEY_ASSET_BASE}${stage.image}`}
                alt=""
                aria-hidden="true"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = JOURNEY_FALLBACK;
                }}
              />
              <span aria-hidden="true" />
            </div>
            <div className="libraryJourneyCopy">
              <span className="libraryKicker">Путь пингвина · глава {stageIndex + 1} из {JOURNEY_STAGES.length}</span>
              <h2>{stage.title}</h2>
              <p>{stage.description}</p>
            </div>

            <div className="libraryJourneySteps">
              {JOURNEY_STAGES.map((item, index) => (
                <div
                  key={item.title}
                  className={index < stageIndex ? 'done' : index === stageIndex ? 'current' : ''}
                >
                  <span />
                  <small>{item.short}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="libraryCard libraryDreamCard">
            <div className="libraryDreamIcon">🧭</div>
            <div className="libraryDreamMain">
              <span className="libraryKicker">Мечта пингвина</span>
              <h2>Возглавить собственную экспедицию</h2>
              <div className="libraryDreamProgress">
                <LibraryProgressBar value={journeyPercent} />
                <b>{journeyPercent}% пути</b>
              </div>
            </div>
            <div className="libraryDreamMountain">🏔</div>
          </article>

          <article className="libraryCard libraryNextGoals">
            <h3>Что приблизит следующую главу</h3>
            <div className="libraryGoalGrid">
              <div>
                <span>📘</span>
                <strong>{factsToNext > 0 ? `Открыть ещё ${factsToNext} фактов` : 'Цель по фактам выполнена'}</strong>
                <small>{factOverview.opened} / {nextFactTarget}</small>
              </div>
              <div>
                <span>🎮</span>
                <strong>{gamesToNext > 0 ? `Освоить ещё ${gamesToNext} ${gamesToNext === 1 ? 'игру' : 'игры'}` : 'Все игры освоены'}</strong>
                <small>{masteredCount} / {nextMasteryTarget}</small>
              </div>
              <div>
                <span>▣</span>
                <strong>{dailyToNext > 0 ? `Выполнить ещё ${dailyToNext} заданий дня` : 'Цель выполнена'}</strong>
                <small>{dailyStats.total} / {nextDailyTarget}</small>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="libraryCompactGrid">
        <section className="libraryCard libraryHistoryCard">
          <div className="librarySectionHead">
            <div>
              <span className="libraryKicker">Биография</span>
              <h2>История развития пингвина</h2>
            </div>
            <span className="libraryMutedAction">Дальние главы пока скрыты</span>
          </div>
          <div className="libraryHistoryTrack">
            {JOURNEY_STAGES.map((item, index) => {
              const visible = index <= stageIndex + 1;
              return (
                <div
                  className={`libraryHistoryItem ${index < stageIndex ? 'done' : index === stageIndex ? 'current' : ''} ${visible ? '' : 'locked'}`}
                  key={item.title}
                >
                  <div className="libraryHistoryImage">
                    {visible ? (
                      <img
                        src={`${JOURNEY_ASSET_BASE}${item.image}`}
                        alt=""
                        aria-hidden="true"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = JOURNEY_FALLBACK;
                        }}
                      />
                    ) : <span>?</span>}
                  </div>
                  <strong>{visible ? item.short : '???'}</strong>
                  <small>{index < stageIndex ? 'Пройдено' : index === stageIndex ? 'Текущий этап' : visible ? 'Следующая глава' : 'Скрыто'}</small>
                </div>
              );
            })}
          </div>
        </section>

        <article className="libraryCard libraryAchievementsCard">
          <div className="librarySectionHead">
            <div>
              <h2>Достижения</h2>
            </div>
            <strong>{unlockedAchievements} / {achievements.length}</strong>
          </div>
          <div className="libraryAchievementGrid">
            {achievements.map((achievement) => (
              <div className={achievement.unlocked ? 'unlocked' : 'locked'} key={achievement.title}>
                <span>{achievement.unlocked ? achievement.icon : '🔒'}</span>
                <strong>{achievement.title}</strong>
                <small>{achievement.note}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="libraryCard libraryMilestonesCard">
          <div className="librarySectionHead">
            <div>
              <h2>Крупные вехи</h2>
            </div>
          </div>
          <div className="libraryMilestoneList">
            <div className={masteredCount === 4 ? 'done' : ''}><span>🎮</span><p>Освоены все четыре игры</p><b>{masteredCount}/4</b></div>
            <div className={factOverview.opened >= 100 ? 'done' : ''}><span>📚</span><p>Открыт 100-й факт</p><b>{Math.min(100, factOverview.opened)}/100</b></div>
            <div className={hardDailyCount > 0 ? 'done' : ''}><span>🏔</span><p>Выполнено сложное задание дня</p><b>{hardDailyCount > 0 ? '✓' : '—'}</b></div>
            <div className={hasPerfectGame ? 'done' : ''}><span>★</span><p>Получен идеальный результат</p><b>{hasPerfectGame ? '✓' : '—'}</b></div>
          </div>
        </article>
      </section>

      <section className="libraryStatsGrid">
        <article className="libraryCard libraryGameStats">
          <div className="librarySectionHead">
            <div>
              <h2>Статистика игр</h2>
            </div>
            <strong>{totalPlays} партий</strong>
          </div>
          <div className="libraryGameStatGrid">
            {(Object.keys(records) as GameTab[]).map((game) => (
              <button key={game} onClick={() => onStartGame(game)}>
                <span>{GAME_INFO[game].icon}</span>
                <strong>{GAME_INFO[game].title}</strong>
                <small>
                  {game === 'guess'
                    ? `рекорд ${records[game].bestAverage}%`
                    : `рекорд ${records[game].bestScore}/10`}
                </small>
                <b>{records[game].plays} партий</b>
              </button>
            ))}
            <div className="libraryFavoriteGame">
              <span>★</span>
              <small>Любимая игра</small>
              <strong>{favoriteGameHasData ? GAME_INFO[favoriteGame].title : 'Ещё определяется'}</strong>
            </div>
          </div>
        </article>

        <article className="libraryCard libraryDailyStats">
          <div className="librarySectionHead">
            <div>
              <span className="libraryKicker">Регулярность</span>
              <h2>Задания дня</h2>
            </div>
            <button onClick={onOpenDaily}>Открыть →</button>
          </div>
          <div className="libraryDailyNumbers">
            <div><strong>{dailyStats.total}</strong><span>выполнено всего</span></div>
            <div><strong>{dailyStats.currentStreak}</strong><span>дней подряд</span></div>
            <div><strong>{dailyStats.bestStreak}</strong><span>лучшая серия</span></div>
          </div>
          <div className="libraryDifficultyStats">
            <span className="easy">Лёгкие <b>{dailyStats.difficultyCounts.easy}</b></span>
            <span className="medium">Средние <b>{dailyStats.difficultyCounts.medium}</b></span>
            <span className="hard">Сложные <b>{dailyStats.difficultyCounts.hard}</b></span>
          </div>
        </article>
      </section>

      <section className="librarySocialGrid">
        <article className="libraryCard libraryFriendsCard">
          <div className="librarySectionHead">
            <div>
              <span className="libraryKicker">Социальное</span>
              <h2>Друзья</h2>
            </div>
            <span className="librarySoonBadge">следующий этап</span>
          </div>
          <div className="libraryFriendPlaceholders">
            {[1, 2, 3, 4].map((item) => (
              <div key={item}>
                <span className="libraryFriendAvatar">🐧</span>
                <strong>Друг</strong>
                <small>прогресс появится здесь</small>
              </div>
            ))}
            <button disabled>＋<small>Добавить друзей</small></button>
          </div>
          <p>После подключения VK здесь появятся друзья, их этапы развития и последние достижения.</p>
        </article>

        <article className="libraryCard libraryRatingCard">
          <div className="librarySectionHead">
            <div>
              <span className="libraryKicker">Соревнование</span>
              <h2>Рейтинг</h2>
            </div>
            <div className="libraryRatingTabs"><b>Друзья</b><span>Все игроки</span></div>
          </div>
          <div className="libraryRatingPlaceholder">
            <div><span>1</span><i>🐧</i><p>Место игрока</p><b>—</b></div>
            <div className="you"><span>—</span><i>🐧</i><p>Вы</p><b>подключим позже</b></div>
            <div><span>3</span><i>🐧</i><p>Сосед по рейтингу</p><b>—</b></div>
          </div>
          <p>Рейтинг будет накопительным и не уменьшится, когда фактобаллы тратятся в магазине.</p>
        </article>
      </section>
    </main>
  );
}
