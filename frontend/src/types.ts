export type ActivityContext = {
  duration: string
  location: string
  materials: string
  child_state: string
  child_age?: number | null
}

export type ActivityCard = {
  title: string
  tags: string[]
  intro: string
  steps: string[]
  question: string
  record_prompt: string
  sprite_tip: string
}

export type CreateRecordRequest = {
  activity: ActivityCard
  mood: string
  one_line_note: string
}

export type ActivityRecord = {
  id: number
  activity_title: string
  activity_tags: string[]
  activity_steps: string[]
  activity_question: string
  record_prompt: string
  mood: string
  one_line_note: string
  ai_memory: string
  created_at: string
}
