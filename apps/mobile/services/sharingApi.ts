import { api } from './api';

export type SharePermission = 'view' | 'edit';
export type ShareStatus = 'pending' | 'active' | 'revoked';

export interface InviteResponse {
  id: string;
  sharedWithEmail: string;
  permission: SharePermission;
  status: ShareStatus;
  expiresAt: string;
}

export interface ShareMember {
  userId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  permission: SharePermission;
  status: ShareStatus;
  sharedAt: string;
}

export interface SharedInventory {
  shareId: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  permission: SharePermission;
  sharedAt: string;
}

export const sharingApi = {
  invite: (email: string, permission: SharePermission = 'view') =>
    api.post<InviteResponse>('/sharing/invite', { email, permission }),

  listMembers: () =>
    api.get<ShareMember[]>('/sharing/members'),

  revokeMember: (userId: string) =>
    api.delete(`/sharing/members/${userId}`),

  listSharedWithMe: () =>
    api.get<SharedInventory[]>('/sharing/shared-with-me'),

  acceptInvite: (token: string) =>
    api.get<{ message: string }>(`/sharing/invites/${token}/accept`),
};
