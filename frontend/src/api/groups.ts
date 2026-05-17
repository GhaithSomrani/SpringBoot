import api from './axios';
import type { ApiResponse, Permission } from '@/types';

export interface GroupMemberDto {
  userId: string;
  email: string;
  permission: Permission;
  joinedAt: string;
}

export interface GroupDto {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: GroupMemberDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  totalAmount: number;
  byCategory: Array<{ categoryId: string; categoryName: string; total: number }>;
  byMonth: Array<{ month: string; total: number }>;
}

export interface InvitationResult {
  id: string;
  groupId: string;
  invitedEmail: string;
  invitedBy: string;
  permission: Permission;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  acceptUrl: string;
}

export async function getMyGroups() {
  const res = await api.get<ApiResponse<GroupDto[]>>('/api/groups/my');
  return res.data.data;
}

export async function getGroup(id: string) {
  const res = await api.get<ApiResponse<GroupDto>>(`/api/groups/${id}`);
  return res.data.data;
}

export async function createGroup(data: { name: string; description?: string }) {
  const res = await api.post<ApiResponse<GroupDto>>('/api/groups', data);
  return res.data.data;
}

export async function updateMemberPermission(
  groupId: string,
  userId: string,
  permission: Permission,
) {
  const res = await api.put<ApiResponse<GroupDto>>(
    `/api/groups/${groupId}/members/${userId}/permission`,
    { permission },
  );
  return res.data.data;
}

export async function removeMember(groupId: string, userId: string) {
  const res = await api.delete<ApiResponse<GroupDto>>(
    `/api/groups/${groupId}/members/${userId}`,
  );
  return res.data.data;
}

export async function sendInvitation(
  groupId: string,
  data: { email: string; permission: Permission },
) {
  const res = await api.post<ApiResponse<InvitationResult>>(
    `/api/groups/${groupId}/invitations`,
    data,
  );
  return res.data.data;
}

export async function getExpenseSummary(groupId: string) {
  const res = await api.get<ApiResponse<ExpenseSummary>>(
    `/api/groups/${groupId}/expenses/summary`,
  );
  return res.data.data;
}

export async function getGroupInvitations(groupId: string): Promise<InvitationResult[]> {
  const res = await api.get<ApiResponse<InvitationResult[]>>(
    `/api/groups/${groupId}/invitations`,
  );
  return res.data.data;
}

export async function updateGroup(
  groupId: string,
  data: { name: string; description?: string },
): Promise<GroupDto> {
  const res = await api.put<ApiResponse<GroupDto>>(`/api/groups/${groupId}`, data);
  return res.data.data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await api.delete(`/api/groups/${groupId}`);
}

export async function cancelInvitation(groupId: string, invitationId: string): Promise<void> {
  await api.delete(`/api/groups/${groupId}/invitations/${invitationId}`);
}
