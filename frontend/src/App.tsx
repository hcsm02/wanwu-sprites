import { Check, Heart, Home, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { createRecord, listRecords, recommendActivity } from './api'
import type { ActivityCard, ActivityContext, ActivityRecord } from './types'

const DEFAULT_CONTEXT: ActivityContext = {
  duration: '5-15分钟',
  location: '家里',
  materials: '不用材料',
  child_state: '随便推荐',
  child_age: null,
}

const moodOptions = ['开心', '平静', '好笑', '有点累', '不配合']
const durationOptions = ['5分钟', '10分钟', '15分钟']
const locationOptions = ['家里', '路上', '户外']
const materialOptions = ['不用材料', '纸笔即可', '随便推荐']
const stateOptions = ['随便推荐', '精力旺盛', '想安静', '情绪不好']

type Stage = 'home' | 'activity' | 'doing' | 'reflect' | 'memory'

export default function App() {
  const [stage, setStage] = useState<Stage>('home')
  const [context, setContext] = useState<ActivityContext>(DEFAULT_CONTEXT)
  const [activity, setActivity] = useState<ActivityCard | null>(null)
  const [records, setRecords] = useState<ActivityRecord[]>([])
  const [mood, setMood] = useState('开心')
  const [note, setNote] = useState('')
  const [lastRecord, setLastRecord] = useState<ActivityRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const latestRecords = useMemo(() => records.slice(0, 3), [records])

  useEffect(() => {
    refreshRecords()
  }, [])

  async function refreshRecords() {
    try {
      const result = await listRecords()
      setRecords(result)
    } catch {
      // MVP：历史记录加载失败不阻塞主流程。
    }
  }

  async function drawCard(nextContext = context) {
    setLoading(true)
    setError('')
    try {
      const result = await recommendActivity(nextContext)
      setActivity(result)
      setStage('activity')
    } catch (err) {
      setError(err instanceof Error ? err.message : '抽卡失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  function updateContext<K extends keyof ActivityContext>(key: K, value: ActivityContext[K]) {
    const nextContext = { ...context, [key]: value }
    setContext(nextContext)
  }

  async function saveReflection() {
    if (!activity) return
    setLoading(true)
    setError('')
    try {
      const record = await createRecord({
        activity,
        mood,
        one_line_note: note || activity.record_prompt,
      })
      setLastRecord(record)
      setStage('memory')
      setNote('')
      await refreshRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <Header stage={stage} onHome={() => setStage('home')} />
        {error && <div className="error-banner">{error}</div>}

        {stage === 'home' && (
          <HomeScreen
            context={context}
            latestRecords={latestRecords}
            loading={loading}
            onDraw={() => drawCard()}
            onContextChange={updateContext}
          />
        )}

        {stage === 'activity' && activity && (
          <ActivityScreen
            activity={activity}
            loading={loading}
            onStart={() => setStage('doing')}
            onSwap={() => drawCard()}
          />
        )}

        {stage === 'doing' && activity && (
          <DoingScreen activity={activity} onDone={() => setStage('reflect')} />
        )}

        {stage === 'reflect' && activity && (
          <ReflectScreen
            activity={activity}
            mood={mood}
            note={note}
            loading={loading}
            onMoodChange={setMood}
            onNoteChange={setNote}
            onSave={saveReflection}
          />
        )}

        {stage === 'memory' && lastRecord && (
          <MemoryScreen
            record={lastRecord}
            records={latestRecords}
            onDrawAgain={() => drawCard()}
            onHome={() => setStage('home')}
          />
        )}
      </section>
    </main>
  )
}

function Header({ stage, onHome }: { stage: Stage; onHome: () => void }) {
  const title = stage === 'reflect' || stage === 'memory' ? '悟精灵' : '玩悟精灵'
  return (
    <header className="app-header">
      <button className="icon-button" onClick={onHome} aria-label="返回首页">
        <Home size={19} />
      </button>
      <div>
        <div className="brand-title">{title}</div>
        <div className="brand-subtitle">抽一张就能玩，一句话也能保存</div>
      </div>
      <div className="sprite-mini">{stage === 'reflect' || stage === 'memory' ? '💙' : '⭐'}</div>
    </header>
  )
}

function HomeScreen({
  context,
  latestRecords,
  loading,
  onDraw,
  onContextChange,
}: {
  context: ActivityContext
  latestRecords: ActivityRecord[]
  loading: boolean
  onDraw: () => void
  onContextChange: <K extends keyof ActivityContext>(key: K, value: ActivityContext[K]) => void
}) {
  return (
    <div className="screen home-screen">
      <div className="hero-card">
        <div className="sprite play-sprite" aria-hidden="true">
          <span className="sprite-face">⭐</span>
        </div>
        <p className="eyebrow">玩精灵推荐</p>
        <h1>今天玩什么？</h1>
        <p className="hero-copy">少想一点，直接抽一张低门槛亲子活动卡。</p>
        <button className="primary-button" onClick={onDraw} disabled={loading}>
          {loading ? <Loader2 className="spin" size={20} /> : <Wand2 size={20} />}
          抽一张活动卡
        </button>
      </div>

      <QuickChips
        title="现在的情况"
        value={context.duration}
        options={durationOptions}
        onChange={(value) => onContextChange('duration', value)}
      />
      <QuickChips
        value={context.location}
        options={locationOptions}
        onChange={(value) => onContextChange('location', value)}
      />
      <QuickChips
        value={context.materials}
        options={materialOptions}
        onChange={(value) => onContextChange('materials', value)}
      />
      <QuickChips
        value={context.child_state}
        options={stateOptions}
        onChange={(value) => onContextChange('child_state', value)}
      />

      <RecordPreview records={latestRecords} />
    </div>
  )
}

function QuickChips({
  title,
  value,
  options,
  onChange,
}: {
  title?: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <section className="chip-section">
      {title && <div className="section-title">{title}</div>}
      <div className="chip-row">
        {options.map((option) => (
          <button
            key={option}
            className={`chip ${option === value ? 'active' : ''}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  )
}

function ActivityScreen({
  activity,
  loading,
  onStart,
  onSwap,
}: {
  activity: ActivityCard
  loading: boolean
  onStart: () => void
  onSwap: () => void
}) {
  return (
    <div className="screen activity-screen">
      <div className="assistant-bubble warm">
        <div className="sprite small">⭐</div>
        <span>{activity.sprite_tip}</span>
      </div>

      <article className="activity-card">
        <div className="card-image shadow-scene">
          <span>🧒</span>
          <span className="shadow">🐰</span>
        </div>
        <h1>{activity.title}</h1>
        <p>{activity.intro}</p>
        <div className="tag-row">
          {activity.tags.map((tag) => (
            <span className="tag" key={tag}>{tag}</span>
          ))}
        </div>

        <div className="steps">
          <div className="section-title">3步以内</div>
          {activity.steps.slice(0, 3).map((step, index) => (
            <div className="step" key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>

        <div className="question-box">
          <Sparkles size={18} />
          <div>
            <strong>可以问：</strong>
            <p>{activity.question}</p>
          </div>
        </div>
      </article>

      <div className="button-row sticky-actions">
        <button className="primary-button" onClick={onStart}>开始做</button>
        <button className="secondary-button" onClick={onSwap} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          换一张
        </button>
      </div>
    </div>
  )
}

function DoingScreen({ activity, onDone }: { activity: ActivityCard; onDone: () => void }) {
  return (
    <div className="screen doing-screen">
      <div className="done-scene">
        <div className="family-scene">👩‍👧</div>
        <h1>只做这几步</h1>
        {activity.steps.slice(0, 3).map((step, index) => (
          <div className="step large" key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>
      <button className="primary-button sticky-single" onClick={onDone}>
        <Check size={20} />
        做完了
      </button>
    </div>
  )
}

function ReflectScreen({
  activity,
  mood,
  note,
  loading,
  onMoodChange,
  onNoteChange,
  onSave,
}: {
  activity: ActivityCard
  mood: string
  note: string
  loading: boolean
  onMoodChange: (mood: string) => void
  onNoteChange: (note: string) => void
  onSave: () => void
}) {
  return (
    <div className="screen reflect-screen">
      <div className="assistant-bubble cool">
        <div className="sprite small blue">💙</div>
        <span>悟精灵：不用写作文，一句话就可以。</span>
      </div>

      <section className="reflect-card">
        <p className="eyebrow">刚才玩了</p>
        <h1>{activity.title}</h1>
        <p className="muted">{activity.record_prompt}</p>

        <div className="section-title">感觉如何？</div>
        <div className="mood-grid">
          {moodOptions.map((option) => (
            <button
              key={option}
              className={`mood ${option === mood ? 'active' : ''}`}
              onClick={() => onMoodChange(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="note-label" htmlFor="note">
          一句话记录
        </label>
        <textarea
          id="note"
          value={note}
          maxLength={80}
          placeholder="例如：孩子看到影子变成小兔子时笑了很久。"
          onChange={(event) => onNoteChange(event.target.value)}
        />
        <div className="counter">{note.length}/80</div>
      </section>

      <button className="primary-button blue sticky-single" onClick={onSave} disabled={loading}>
        {loading ? <Loader2 className="spin" size={20} /> : <Heart size={20} />}
        帮我整理并保存
      </button>
    </div>
  )
}

function MemoryScreen({
  record,
  records,
  onDrawAgain,
  onHome,
}: {
  record: ActivityRecord
  records: ActivityRecord[]
  onDrawAgain: () => void
  onHome: () => void
}) {
  return (
    <div className="screen memory-screen">
      <div className="memory-success">
        <div className="sprite reflect-sprite">💙</div>
        <p className="eyebrow">已保存</p>
        <h1>这一刻留下来了</h1>
      </div>

      <article className="memory-card">
        <div className="tag-row">
          <span className="tag blue-tag">{record.mood}</span>
          <span className="tag blue-tag">{record.activity_title}</span>
        </div>
        <p>{record.ai_memory}</p>
      </article>

      <div className="button-row">
        <button className="primary-button" onClick={onDrawAgain}>明天再抽一张</button>
        <button className="secondary-button" onClick={onHome}>回首页</button>
      </div>

      <RecordPreview records={records} />
    </div>
  )
}

function RecordPreview({ records }: { records: ActivityRecord[] }) {
  return (
    <section className="records-panel">
      <div className="section-title">最近记忆</div>
      {records.length === 0 ? (
        <p className="empty-text">还没有记录。完成一次小活动后，会出现在这里。</p>
      ) : (
        <div className="record-list">
          {records.map((record) => (
            <article className="record-item" key={record.id}>
              <div>
                <strong>{record.activity_title}</strong>
                <p>{record.ai_memory}</p>
              </div>
              <span>{new Date(record.created_at).toLocaleDateString()}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
