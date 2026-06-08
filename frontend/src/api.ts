import type { ActivityCard, ActivityContext, ActivityRecord, CreateRecordRequest } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function recommendActivity(context: ActivityContext): Promise<ActivityCard> {
  return request<ActivityCard>('/api/activity/recommend', {
    method: 'POST',
    body: JSON.stringify(context),
  })
}

export function createRecord(payload: CreateRecordRequest): Promise<ActivityRecord> {
  return request<ActivityRecord>('/api/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listRecords(): Promise<ActivityRecord[]> {
  return request<ActivityRecord[]>('/api/records')
}
