import {
  Check,
  Clock3,
  Heart,
  Leaf,
  Loader2,
  MapPinHouse,
  MoonStar,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

import { createRecord, getCurrentUser, listRecords, loginUser, recommendActivity, registerUser } from './api'
import type { ActivityCard, ActivityContext, ActivityRecord, User } from './types'

type Locale = 'zh' | 'en'
type Stage = 'home' | 'activity' | 'doing' | 'reflect' | 'memory'
type DurationKey = '5' | '10' | '15'
type LocationKey = 'home' | 'go' | 'outdoors'
type MaterialsKey = 'none' | 'paper' | 'nearby'
type ChildStateKey = 'calm' | 'energy' | 'quiet' | 'moody'
type MoodKey = 'amazing' | 'happy' | 'calm' | 'silly' | 'tiring'

type UiContext = {
  duration: DurationKey
  location: LocationKey
  materials: MaterialsKey
  childState: ChildStateKey
}

const DEFAULT_CONTEXT: UiContext = {
  duration: '5',
  location: 'home',
  materials: 'none',
  childState: 'calm',
}

const durationLabels: Record<Locale, Record<DurationKey, string>> = {
  zh: { '5': '5分钟', '10': '10分钟', '15': '15分钟' },
  en: { '5': '5 min', '10': '10 min', '15': '15 min' },
}

const locationLabels: Record<Locale, Record<LocationKey, string>> = {
  zh: { home: '家里', go: '路上', outdoors: '户外' },
  en: { home: 'At home', go: 'On the go', outdoors: 'Outdoors' },
}

const materialLabels: Record<Locale, Record<MaterialsKey, string>> = {
  zh: { none: '不用材料', paper: '纸笔即可', nearby: '手边材料' },
  en: { none: 'No materials', paper: 'Paper + pen', nearby: 'Anything nearby' },
}

const childStateLabels: Record<Locale, Record<ChildStateKey, string>> = {
  zh: { calm: '随便推荐', energy: '精力旺盛', quiet: '想安静', moody: '情绪不好' },
  en: { calm: 'Calm mode', energy: 'Full energy', quiet: 'Need quiet', moody: 'Moody' },
}

const moodLabels: Record<Locale, Record<MoodKey, string>> = {
  zh: { amazing: '超棒', happy: '开心', calm: '平静', silly: '好笑', tiring: '有点累' },
  en: { amazing: 'Amazing', happy: 'Happy', calm: 'Calm', silly: 'Silly', tiring: 'Tiring' },
}

const moodKeys: MoodKey[] = ['amazing', 'happy', 'calm', 'silly', 'tiring']
const durationKeys: DurationKey[] = ['5', '10', '15']
const locationKeys: LocationKey[] = ['home', 'go', 'outdoors']
const materialKeys: MaterialsKey[] = ['none', 'paper', 'nearby']
const childStateKeys: ChildStateKey[] = ['calm', 'energy', 'quiet', 'moody']

const sampleActivities: Record<Locale, ActivityCard> = {
  zh: {
    title: '影子模仿',
    tags: ['5分钟', '家里', '不用材料'],
    intro: '用灯光在墙上玩影子，一人做动作，一人马上跟着学。',
    steps: ['打开一盏灯，找一面空墙。', '一个人先做影子动作，另一个人跟着模仿。', '交换角色，看看谁的影子最搞笑。'],
    question: '你觉得今天最像小动物的影子是哪一个？',
    record_prompt: '刚才哪一瞬间最让孩子笑出来？',
    sprite_tip: '我先帮你挑一张，简单一点，马上就能开始。',
  },
  en: {
    title: 'Shadow Mimic',
    tags: ['5 min', 'At home', 'No materials'],
    intro: 'Make funny wall shadows together and copy each other’s shapes.',
    steps: [
      'Turn on a lamp and face a blank wall.',
      'One person makes a shadow shape and the other copies it.',
      'Swap roles and laugh at the silliest shadow.',
    ],
    question: 'What is the funniest shadow your family can make today?',
    record_prompt: 'What tiny moment made your child laugh the most?',
    sprite_tip: 'Here’s a fun one for you. Keep it simple and playful.',
  },
}

const PLAY_SPRITE_SRC = '/sprites/play-sprite.png'
const REFLECT_SPRITE_SRC = '/sprites/reflect-sprite.png'
const AUTH_TOKEN_STORAGE_KEY = 'wanwu_auth_token'

const localeCopy = {
  zh: {
    heroSubtitle: '小活动，长记忆。',
    heroSupport: '抽一张亲子活动卡，马上开始玩，再把一句话整理成值得回看的成长瞬间。',
    switchZh: '中文',
    switchEn: 'English',
    meetSprites: '认识精灵',
    playSprite: '玩精灵',
    playSpriteRole: '活动',
    reflectSprite: '忆精灵',
    reflectSpriteRole: '记忆',
    mission: '两个精灵，一个任务：多玩一点，多记一点。',
    recentMemories: '最近记忆',
    emptyMemories: '完成一次活动后，你们的亲子记忆会出现在这里。',
    panelHome: '首页',
    panelHomeCaption: '先抽一张卡。',
    panelActivity: '活动卡',
    panelActivityCaption: '三步以内，立刻开始。',
    panelDoing: '进行 / 完成',
    panelDoingCaption: '玩完就结束。',
    panelReflect: '回忆',
    panelReflectCaption: '把这一刻留下来。',
    homePrompt: '今天玩什么？',
    drawCard: '抽一张卡',
    playBubble: '给你挑了个轻松好玩的。',
    simpleSteps: '3步以内',
    start: '开始',
    swap: '换一张',
    niceJob: '太棒了！',
    youDidIt: '你们完成啦。',
    wellPlayed: '玩得真好',
    done: '完成',
    reflectBubble: '来，把这一刻记下来。',
    howDidItFeel: '感觉怎么样？',
    oneLineNote: '一句话记录',
    helpWrite: '帮我起个头',
    save: '保存',
    saved: '已保存',
    aiMemoryPreview: 'AI记忆预览',
    tinyActivities: '小活动',
    tinyActivitiesText: '精选、快速、好玩。',
    familyTime: '陪伴时光',
    familyTimeText: '随时随地一起玩。',
    lastingMemories: '长记忆',
    lastingMemoriesText: '把当下保存下来。',
    kidFriendly: '亲子友好',
    kidFriendlyText: '简单、安全、无干扰。',
    drawError: '抽卡失败，请稍后重试。',
    saveError: '保存失败，请稍后重试。',
    fallbackMemory: (title: string, prompt: string) => `你和孩子刚一起完成了《${title}》。${prompt}`,
    spriteMission: 'Wanwu Sprites',
  },
  en: {
    heroSubtitle: 'Tiny activities, lasting memories.',
    heroSupport: 'Draw one tiny activity card, play right away, and turn a one-line note into a keepsake.',
    switchZh: '中文',
    switchEn: 'English',
    meetSprites: 'Meet the Sprites',
    playSprite: 'Play Sprite',
    playSpriteRole: 'Activities',
    reflectSprite: 'Reflect Sprite',
    reflectSpriteRole: 'Memories',
    mission: 'Two sprites. One mission: play more, remember more.',
    recentMemories: 'Recent memories',
    emptyMemories: 'Finish one activity and your keepsakes will appear here.',
    panelHome: 'Home',
    panelHomeCaption: 'Start with one card.',
    panelActivity: 'Activity',
    panelActivityCaption: 'Simple steps. Easy to start.',
    panelDoing: 'During / Finish',
    panelDoingCaption: 'Celebrate and complete.',
    panelReflect: 'Reflection',
    panelReflectCaption: 'Remember the moment.',
    homePrompt: 'What should we play today?',
    drawCard: 'Draw a Card',
    playBubble: 'Here’s a fun one for you!',
    simpleSteps: '3 simple steps',
    start: 'Start',
    swap: 'Swap',
    niceJob: 'Nice job!',
    youDidIt: 'You did it.',
    wellPlayed: 'Well played!',
    done: 'Done',
    reflectBubble: 'Let’s capture this memory.',
    howDidItFeel: 'How did it feel?',
    oneLineNote: 'One-line note',
    helpWrite: 'Help me write it',
    save: 'Save',
    saved: 'Saved',
    aiMemoryPreview: 'AI memory preview',
    tinyActivities: 'Tiny activities',
    tinyActivitiesText: 'Curated, quick, and fun.',
    familyTime: 'Family time',
    familyTimeText: 'Play together, anywhere.',
    lastingMemories: 'Lasting memories',
    lastingMemoriesText: 'Capture and cherish.',
    kidFriendly: 'Kid friendly',
    kidFriendlyText: 'Simple, safe, and ad-free.',
    drawError: 'Failed to draw a card. Please try again.',
    saveError: 'Failed to save this memory.',
    fallbackMemory: (title: string, prompt: string) => `You and your child tried "${title}" together. ${prompt}`,
    spriteMission: 'Wanwu Sprites',
  },
} as const

export default function App() {
  const [locale, setLocale] = useState<Locale>('zh')
  const [stage, setStage] = useState<Stage>('home')
  const [context, setContext] = useState<UiContext>(DEFAULT_CONTEXT)
  const [activity, setActivity] = useState<ActivityCard | null>(null)
  const [records, setRecords] = useState<ActivityRecord[]>([])
  const [mood, setMood] = useState<MoodKey>('happy')
  const [note, setNote] = useState('')
  const [lastRecord, setLastRecord] = useState<ActivityRecord | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authToken, setAuthToken] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register')
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const copy = localeCopy[locale]
  const latestRecords = useMemo(() => records.slice(0, 3), [records])
  const activeActivity = activity
  const activeStageIndex = stage === 'memory' ? 4 : ['home', 'activity', 'doing', 'reflect'].indexOf(stage) + 1
  const memoryPreview = lastRecord?.ai_memory || (activeActivity ? copy.fallbackMemory(activeActivity.title, note || activeActivity.record_prompt) : '')

  useEffect(() => {
    void bootstrapSession()
  }, [])

  async function bootstrapSession() {
    const savedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (!savedToken) return

    try {
      const currentUser = await getCurrentUser(savedToken)
      setUser(currentUser)
      setAuthToken(savedToken)
      await refreshRecords(savedToken)
    } catch {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    }
  }

  async function refreshRecords(token: string) {
    try {
      const result = await listRecords(token)
      setRecords(result)
    } catch {
      // Ignore history fetch failures in the visual demo.
    }
  }

  function completeAuth(nextUser: User, token: string) {
    setUser(nextUser)
    setAuthToken(token)
    setUsername('')
    setPhoneNumber('')
    setPassword('')
    setNickname('')
    setError('')
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  }

  async function submitAuth() {
    setLoading(true)
    setError('')
    try {
      const response =
        authMode === 'register'
          ? await registerUser(username, phoneNumber, password, nickname || undefined)
          : await loginUser(phoneNumber, password)
      completeAuth(response.user, response.token)
      await refreshRecords(response.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录或注册失败。')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setUser(null)
    setAuthToken('')
    setRecords([])
    setLastRecord(null)
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  }

  function buildApiContext(currentContext: UiContext, currentLocale: Locale): ActivityContext {
    return {
      duration: durationLabels[currentLocale][currentContext.duration],
      location: locationLabels[currentLocale][currentContext.location],
      materials: materialLabels[currentLocale][currentContext.materials],
      child_state: childStateLabels[currentLocale][currentContext.childState],
      child_age: null,
    }
  }

  async function drawCard(nextContext = context) {
    setLoading(true)
    setError('')
    try {
      const result = await recommendActivity(buildApiContext(nextContext, locale))
      setActivity(result)
      setStage('activity')
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.drawError)
    } finally {
      setLoading(false)
    }
  }

  function updateContext<K extends keyof UiContext>(key: K, value: UiContext[K]) {
    setContext((current) => ({ ...current, [key]: value }))
  }

  async function saveReflection() {
    if (!activity) return
    if (!user || !authToken) {
      setError(copy.saveError)
      return
    }
    setLoading(true)
    setError('')
    try {
      const record = await createRecord({
        activity,
        mood: moodLabels[locale][mood],
        one_line_note: note || activity.record_prompt,
      }, authToken)
      setLastRecord(record)
      setStage('memory')
      setNote('')
      await refreshRecords(authToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveError)
    } finally {
      setLoading(false)
    }
  }

  function fillPrompt() {
    if (!activeActivity) return
    setStage('reflect')
    setNote(activeActivity.record_prompt)
  }

  return (
    <main className="showcase-shell">
      <div className="backdrop-stars" aria-hidden="true">
        <span className="star a">✦</span>
        <span className="star b">✦</span>
        <span className="star c">✦</span>
        <span className="star d">✦</span>
      </div>

      <section className="brand-hero">
        <div className="brand-copy">
          <div className="locale-switch" role="tablist" aria-label="Language switch">
            <button className={locale === 'zh' ? 'active' : ''} onClick={() => setLocale('zh')}>
              {copy.switchZh}
            </button>
            <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>
              {copy.switchEn}
            </button>
          </div>

          <div className="wordmark">
            <span className="wordmark-dark">Wanwu</span>
            <span className="wordmark-rainbow">Sprites</span>
          </div>
          <p className="hero-subtitle">{copy.heroSubtitle}</p>
          <p className="hero-support">{copy.heroSupport}</p>
        </div>

        <div className="hero-sprites" aria-hidden="true">
          <div className="sprite-orbit play">
            <PlaySprite size="hero" />
          </div>
          <div className="sprite-orbit reflect">
            <ReflectSprite size="hero" />
          </div>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="poster-board">
        <aside className="sprite-rail">
          <div className="rail-card auth-card">
            <div className="rail-card-head">
              <h2>{user ? '当前账号' : authMode === 'register' ? '注册账号' : '登录账号'}</h2>
            </div>
            {user ? (
              <div className="account-summary">
                <strong>{user.nickname}</strong>
                <p>{user.phone_number || user.username || '已登录'}</p>
                <button className="ghost-button auth-action" onClick={logout}>
                  退出登录
                </button>
              </div>
            ) : (
              <div className="auth-form">
                <div className="auth-toggle">
                  <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>
                    注册
                  </button>
                  <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
                    登录
                  </button>
                </div>
                {authMode === 'register' && (
                  <input
                    className="auth-input"
                    value={nickname}
                    placeholder="家庭昵称（选填）"
                    onChange={(event) => setNickname(event.target.value)}
                  />
                )}
                {authMode === 'register' && (
                  <input
                    className="auth-input"
                    value={username}
                    placeholder="用户名（必填，可重复）"
                    onChange={(event) => setUsername(event.target.value)}
                  />
                )}
                <input
                  className="auth-input"
                  value={phoneNumber}
                  placeholder="手机号（必填，唯一）"
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
                <input
                  className="auth-input"
                  type="password"
                  value={password}
                  placeholder="密码（必填）"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="cta-button auth-submit"
                  onClick={submitAuth}
                  disabled={loading || !phoneNumber || !password || (authMode === 'register' && !username)}
                >
                  {authMode === 'register' ? '立即注册' : '立即登录'}
                </button>
              </div>
            )}
          </div>

          <div className="rail-card">
            <h2>{copy.meetSprites}</h2>
            <div className="rail-divider">★</div>

            <div className="sprite-profile">
              <div className="sprite-circle warm">
                <PlaySprite size="medium" />
              </div>
              <div>
                <h3>{copy.playSprite}</h3>
                <p>{copy.playSpriteRole}</p>
              </div>
            </div>

            <div className="sprite-profile">
              <div className="sprite-circle cool">
                <ReflectSprite size="medium" />
              </div>
              <div>
                <h3>{copy.reflectSprite}</h3>
                <p>{copy.reflectSpriteRole}</p>
              </div>
            </div>

            <div className="mission-chip">
              <Heart size={16} />
              <span>{copy.mission}</span>
            </div>
          </div>

          <div className="rail-card memories-card">
            <div className="rail-card-head">
              <h2>{copy.recentMemories}</h2>
              <ReflectSprite size="tiny" />
            </div>
            {latestRecords.length === 0 ? (
              <p className="rail-empty">{copy.emptyMemories}</p>
            ) : (
              <div className="memory-stack">
                {latestRecords.map((record) => (
                  <article key={record.id} className="memory-stack-item">
                    <strong>{record.activity_title}</strong>
                    <p>{record.ai_memory}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="interactive-stage">
          <div className="main-device-column">
            <div className="experience-copy">
              <h2>{copy.panelHome} → {copy.panelReflect}</h2>
              <p>{locale === 'zh' ? '现在是可操作版本：中间只有一个当前页面，按流程逐步切换。' : 'This is now a usable flow: one active screen in the middle, switching step by step.'}</p>
            </div>

            <PhoneFrame
              title={
                activeStageIndex === 1
                  ? copy.spriteMission
                  : activeStageIndex === 2
                    ? copy.playSprite
                    : activeStageIndex === 3
                      ? activeActivity?.title || copy.playSprite
                      : copy.reflectSprite
              }
              tone={activeStageIndex === 4 ? 'cool' : 'warm'}
            >
              {activeStageIndex === 1 && (
                <HomePhone
                  locale={locale}
                  prompt={copy.homePrompt}
                  drawLabel={copy.drawCard}
                  context={context}
                  loading={loading}
                  onDraw={() => drawCard()}
                  onContextChange={updateContext}
                />
              )}

              {activeStageIndex === 2 && activeActivity && (
                <ActivityPhone
                  locale={locale}
                  bubble={copy.playBubble}
                  stepsLabel={copy.simpleSteps}
                  startLabel={copy.start}
                  swapLabel={copy.swap}
                  activity={activeActivity}
                  loading={loading}
                  onSwap={() => drawCard()}
                  onStart={() => setStage('doing')}
                  ready={activeActivity !== null}
                />
              )}

              {activeStageIndex === 3 && activeActivity && (
                <DoingPhone
                  niceJob={copy.niceJob}
                  youDidIt={copy.youDidIt}
                  wellPlayed={copy.wellPlayed}
                  doneLabel={copy.done}
                  activity={activeActivity}
                  onDone={() => setStage('reflect')}
                />
              )}

              {activeStageIndex === 4 && activeActivity && (
                <ReflectPhone
                  locale={locale}
                  bubble={copy.reflectBubble}
                  feelingLabel={copy.howDidItFeel}
                  noteLabel={copy.oneLineNote}
                  helpLabel={copy.helpWrite}
                  saveLabel={copy.save}
                  savedLabel={copy.saved}
                  previewLabel={copy.aiMemoryPreview}
                  activity={activeActivity}
                  mood={mood}
                  note={note}
                  memoryPreview={memoryPreview}
                  loading={loading}
                  saved={stage === 'memory'}
                  onMoodChange={setMood}
                  onNoteChange={setNote}
                  onFillPrompt={fillPrompt}
                  onSave={saveReflection}
                />
              )}
            </PhoneFrame>
          </div>

          <aside className="stage-dock">
            <StagePreview
              number={1}
              label={copy.panelHome}
              caption={copy.panelHomeCaption}
              active={activeStageIndex === 1}
              onClick={() => setStage('home')}
            />
            <StagePreview
              number={2}
              label={copy.panelActivity}
              caption={copy.panelActivityCaption}
              active={activeStageIndex === 2}
              onClick={() => activeActivity && setStage('activity')}
            />
            <StagePreview
              number={3}
              label={copy.panelDoing}
              caption={copy.panelDoingCaption}
              active={activeStageIndex === 3}
              onClick={() => activeActivity && setStage('doing')}
            />
            <StagePreview
              number={4}
              label={copy.panelReflect}
              caption={copy.panelReflectCaption}
              active={activeStageIndex === 4}
              onClick={() => activeActivity && setStage(stage === 'memory' ? 'memory' : 'reflect')}
            />
          </aside>
        </div>
      </section>

      <section className="value-strip">
        <FeatureItem icon={<Wand2 size={18} />} title={copy.tinyActivities} text={copy.tinyActivitiesText} />
        <FeatureItem icon={<Heart size={18} />} title={copy.familyTime} text={copy.familyTimeText} />
        <FeatureItem icon={<Sparkles size={18} />} title={copy.lastingMemories} text={copy.lastingMemoriesText} />
        <FeatureItem icon={<Check size={18} />} title={copy.kidFriendly} text={copy.kidFriendlyText} />
      </section>
    </main>
  )
}

function StagePreview({
  number,
  label,
  caption,
  active,
  onClick,
}: {
  number: number
  label: string
  caption: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button className={`stage-preview ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="phone-step">{number}</div>
      <div>
        <strong>{label}</strong>
        <p>{caption}</p>
      </div>
    </button>
  )
}

function PhoneFrame({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'warm' | 'cool'
  children: ReactNode
}) {
  return (
    <div className={`device-shell app-surface ${tone}`}>
      <div className="device-screen surface-screen">
        <div className="device-status surface-header">
          <span className="surface-brand">Wanwu Sprites</span>
          <span className="surface-title">{title}</span>
          <span className="surface-menu">⋯</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function HomePhone({
  locale,
  prompt,
  drawLabel,
  context,
  loading,
  onDraw,
  onContextChange,
}: {
  locale: Locale
  prompt: string
  drawLabel: string
  context: UiContext
  loading: boolean
  onDraw: () => void
  onContextChange: <K extends keyof UiContext>(key: K, value: UiContext[K]) => void
}) {
  return (
    <div className="phone-screen home-phone">
      <div className="mini-brand">
        <div className="mini-wordmark">
          <span>Wanwu</span>
          <span>Sprites</span>
        </div>
        <button className="mini-menu" type="button" aria-label="Open menu">
          ≡
        </button>
      </div>

      <div className="sky-stage">
        <div className="cloud cloud-left" />
        <div className="cloud cloud-right" />
        <PlaySprite size="large" />
      </div>

      <section className="prompt-card">
        <h2>{prompt}</h2>
        <button className="cta-button" onClick={onDraw} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
          {drawLabel}
        </button>
      </section>

      <ChipGroup
        icon={<Clock3 size={14} />}
        value={context.duration}
        options={durationKeys.map((key) => ({ key, label: durationLabels[locale][key] }))}
        onChange={(value) => onContextChange('duration', value)}
      />
      <ChipGroup
        icon={<MapPinHouse size={14} />}
        value={context.location}
        options={locationKeys.map((key) => ({ key, label: locationLabels[locale][key] }))}
        onChange={(value) => onContextChange('location', value)}
      />
      <ChipGroup
        icon={<Leaf size={14} />}
        value={context.materials}
        options={materialKeys.map((key) => ({ key, label: materialLabels[locale][key] }))}
        onChange={(value) => onContextChange('materials', value)}
      />
      <ChipGroup
        icon={<MoonStar size={14} />}
        value={context.childState}
        options={childStateKeys.map((key) => ({ key, label: childStateLabels[locale][key] }))}
        onChange={(value) => onContextChange('childState', value)}
      />
    </div>
  )
}

function ActivityPhone({
  bubble,
  stepsLabel,
  startLabel,
  swapLabel,
  activity,
  loading,
  onSwap,
  onStart,
  ready,
}: {
  locale: Locale
  bubble: string
  stepsLabel: string
  startLabel: string
  swapLabel: string
  activity: ActivityCard
  loading: boolean
  onSwap: () => void
  onStart: () => void
  ready: boolean
}) {
  return (
    <div className="phone-screen activity-phone">
      <div className="speech-row">
        <PlaySprite size="small" />
        <div className="speech-bubble">{bubble}</div>
      </div>

      <section className="activity-card">
        <h2>{activity.title}</h2>
        <div className="cover-scene">
          <div className="cover-shadow child">◖</div>
          <div className="cover-shadow bunny">🐰</div>
        </div>

        <div className="pill-row">
          {activity.tags.slice(0, 3).map((tag) => (
            <span className="meta-pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <div className="steps-copy">
          <p className="kicker">{stepsLabel}</p>
          {activity.steps.slice(0, 3).map((step, index) => (
            <div className="step-line" key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>

        <div className="question-callout">
          <Sparkles size={16} />
          <p>{activity.question}</p>
        </div>
      </section>

      <div className="double-actions">
        <button className="cta-button small" onClick={onStart} disabled={!ready}>
          {startLabel}
        </button>
        <button className="ghost-button small" onClick={onSwap} disabled={loading}>
          {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          {swapLabel}
        </button>
      </div>
    </div>
  )
}

function DoingPhone({
  niceJob,
  youDidIt,
  wellPlayed,
  doneLabel,
  activity,
  onDone,
}: {
  niceJob: string
  youDidIt: string
  wellPlayed: string
  doneLabel: string
  activity: ActivityCard
  onDone: () => void
}) {
  return (
    <div className="phone-screen doing-phone">
      <div className="success-stars" aria-hidden="true">
        ✦ ✦ ✦
      </div>
      <div className="finish-copy">
        <h2>{niceJob}</h2>
        <p>{youDidIt}</p>
      </div>

      <div className="family-wall">
        <div className="kid big" />
        <div className="kid small" />
        <div className="wall-shadow fox" />
      </div>

      <div className="done-badge">
        <Sparkles size={16} />
        <span>{wellPlayed}</span>
      </div>

      <div className="tiny-step-list">
        {activity.steps.slice(0, 3).map((step, index) => (
          <div className="mini-step" key={step}>
            <strong>{index + 1}</strong>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <button className="cta-button finish" onClick={onDone}>
        <Check size={18} />
        {doneLabel}
      </button>
    </div>
  )
}

function ReflectPhone({
  locale,
  bubble,
  feelingLabel,
  noteLabel,
  helpLabel,
  saveLabel,
  savedLabel,
  previewLabel,
  activity,
  mood,
  note,
  memoryPreview,
  loading,
  saved,
  onMoodChange,
  onNoteChange,
  onFillPrompt,
  onSave,
}: {
  locale: Locale
  bubble: string
  feelingLabel: string
  noteLabel: string
  helpLabel: string
  saveLabel: string
  savedLabel: string
  previewLabel: string
  activity: ActivityCard
  mood: MoodKey
  note: string
  memoryPreview: string
  loading: boolean
  saved: boolean
  onMoodChange: (mood: MoodKey) => void
  onNoteChange: (note: string) => void
  onFillPrompt: () => void
  onSave: () => void
}) {
  return (
    <div className="phone-screen reflect-phone">
      <div className="speech-row cool">
        <ReflectSprite size="small" />
        <div className="speech-bubble cool">{bubble}</div>
      </div>

      <div className="reflect-section">
        <div className="section-label">{feelingLabel}</div>
        <div className="mood-row">
          {moodKeys.map((option) => (
            <button
              key={option}
              className={`mood-pill ${option === mood ? 'active' : ''}`}
              onClick={() => onMoodChange(option)}
            >
              {moodLabels[locale][option]}
            </button>
          ))}
        </div>

        <label className="section-label" htmlFor="note">
          {noteLabel}
        </label>
        <textarea
          id="note"
          value={note}
          maxLength={80}
          placeholder={activity.record_prompt}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onNoteChange(event.target.value)}
        />
        <div className="note-counter">{note.length}/80</div>

        <div className="memory-preview-box">
          <div className="preview-head">
            <Sparkles size={14} />
            <span>{previewLabel}</span>
          </div>
          <p>{memoryPreview}</p>
        </div>
      </div>

      <div className="double-actions">
        <button className="ghost-button blue" onClick={onFillPrompt}>
          {helpLabel}
        </button>
        <button className="save-button" onClick={onSave} disabled={loading}>
          {loading ? <Loader2 className="spin" size={16} /> : <Heart size={16} />}
          {saved ? savedLabel : saveLabel}
        </button>
      </div>
    </div>
  )
}

function ChipGroup<T extends string>({
  icon,
  value,
  options,
  onChange,
}: {
  icon: ReactNode
  value: T
  options: Array<{ key: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="chip-row">
      {options.map((option) => (
        <button
          key={option.key}
          className={`context-chip ${option.key === value ? 'active' : ''}`}
          onClick={() => onChange(option.key)}
        >
          {icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

function FeatureItem({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="feature-item">
      <div className="feature-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

function PlaySprite({
  size = 'medium',
}: {
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'hero'
}) {
  return (
    <img className={`sprite-svg sprite-raster play-sprite ${size}`} src={PLAY_SPRITE_SRC} alt="Play Sprite" />
  )
}

function ReflectSprite({
  size = 'medium',
}: {
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'hero'
}) {
  return (
    <img
      className={`sprite-svg sprite-raster reflect-sprite ${size}`}
      src={REFLECT_SPRITE_SRC}
      alt="Reflect Sprite"
    />
  )
}
