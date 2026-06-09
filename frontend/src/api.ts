import type { ActivityCard, ActivityContext, ActivityRecord, AuthResponse, CreateRecordRequest, User } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export function registerUser(username: string, phoneNumber: string, password: string, nickname?: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      nickname,
      phone_number: phoneNumber,
      username,
      password,
    }),
  })
}

export function loginUser(phoneNumber: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone_number: phoneNumber,
      password,
    }),
  })
}

export function getCurrentUser(token: string): Promise<User> {
  return request<User>('/api/auth/me', undefined, token)
}

export function createRecord(payload: CreateRecordRequest, token: string): Promise<ActivityRecord> {
  return request<ActivityRecord>('/api/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export function listRecords(token: string): Promise<ActivityRecord[]> {
  return request<ActivityRecord[]>('/api/records', undefined, token)
}
