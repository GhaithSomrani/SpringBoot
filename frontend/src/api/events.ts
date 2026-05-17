import api from './axios';

export type EventStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED';

export interface EventDto {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  creatorId: string;
  categories: string[]; // categoryIds
  status: EventStatus;
  expenseTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  categories?: string[];
  status: EventStatus;
}

export async function getEvents(groupId: string): Promise<EventDto[]> {
  const res = await api.get<{ data: EventDto[] }>(`/api/groups/${groupId}/events`);
  return res.data.data;
}

export async function createEvent(groupId: string, payload: CreateEventPayload): Promise<EventDto> {
  const res = await api.post<{ data: EventDto }>(`/api/groups/${groupId}/events`, payload);
  return res.data.data;
}

export async function updateEvent(
  groupId: string,
  eventId: string,
  payload: CreateEventPayload,
): Promise<EventDto> {
  const res = await api.put<{ data: EventDto }>(`/api/groups/${groupId}/events/${eventId}`, payload);
  return res.data.data;
}

export async function deleteEvent(groupId: string, eventId: string): Promise<void> {
  await api.delete(`/api/groups/${groupId}/events/${eventId}`);
}
