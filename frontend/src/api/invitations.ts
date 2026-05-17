import api from './axios';
import type {
  ApiResponse,
  Invitation,
  InvitationAcceptResponse,
  InvitationDeclineResponse,
} from '@/types';

export async function getMyInvitations(): Promise<Invitation[]> {
  const res = await api.get<ApiResponse<Invitation[]>>('/api/users/me/invitations');
  return res.data.data;
}

export async function acceptInvitation(token: string): Promise<InvitationAcceptResponse> {
  const res = await api.get<ApiResponse<InvitationAcceptResponse>>('/api/invitations/accept', {
    params: { token },
  });
  return res.data.data;
}

export async function declineInvitation(token: string): Promise<InvitationDeclineResponse> {
  const res = await api.get<ApiResponse<InvitationDeclineResponse>>('/api/invitations/decline', {
    params: { token },
  });
  return res.data.data;
}
