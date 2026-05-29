import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharingService } from '../src/sharing/sharing.service';
import { FamilyShare, SharePermission, ShareStatus } from '../src/sharing/entities/family-share.entity';
import { User } from '../src/users/entities/user.entity';
import { MailService } from '../src/mail/mail.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

const OWNER: Partial<User> = {
  id: 'owner-id',
  email: 'owner@test.com',
  firstName: 'Alice',
  lastName: 'Smith',
  isActive: true,
};

const INVITEE_EMAIL = 'invitee@test.com';

const makeShare = (overrides: Partial<FamilyShare> = {}): FamilyShare =>
  ({
    id: 'share-id',
    ownerId: 'owner-id',
    sharedWithEmail: INVITEE_EMAIL,
    sharedWithUserId: null,
    permission: SharePermission.VIEW,
    status: ShareStatus.PENDING,
    token: 'abc123token',
    expiresAt: new Date(Date.now() + 86_400_000 * 7),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FamilyShare);

describe('SharingService', () => {
  let service: SharingService;
  let shareRepo: jest.Mocked<Repository<FamilyShare>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharingService,
        { provide: getRepositoryToken(FamilyShare), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockRepo },
        {
          provide: MailService,
          useValue: { sendShareInvite: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => def ?? '') },
        },
      ],
    }).compile();

    service = module.get(SharingService);
    shareRepo = module.get(getRepositoryToken(FamilyShare));
    userRepo = module.get(getRepositoryToken(User));
    mailService = module.get(MailService);
  });

  describe('invite', () => {
    it('creates a pending share and sends email', async () => {
      userRepo.findOneBy.mockResolvedValue(OWNER as User);
      shareRepo.findOne.mockResolvedValue(null);
      const share = makeShare();
      shareRepo.create.mockReturnValue(share);
      shareRepo.save.mockResolvedValue(share);

      const result = await service.invite('owner-id', { email: INVITEE_EMAIL });

      expect(result.sharedWithEmail).toBe(INVITEE_EMAIL);
      expect(result.status).toBe(ShareStatus.PENDING);
      expect(mailService.sendShareInvite).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: INVITEE_EMAIL }),
      );
    });

    it('throws BadRequestException when owner invites themselves', async () => {
      userRepo.findOneBy.mockResolvedValue(OWNER as User);
      await expect(service.invite('owner-id', { email: OWNER.email! })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when share is already active', async () => {
      userRepo.findOneBy.mockResolvedValue(OWNER as User);
      shareRepo.findOne.mockResolvedValue(makeShare({ status: ShareStatus.ACTIVE }));

      await expect(service.invite('owner-id', { email: INVITEE_EMAIL })).rejects.toThrow(
        ConflictException,
      );
    });

    it('refreshes token when pending invite already exists', async () => {
      userRepo.findOneBy.mockResolvedValue(OWNER as User);
      const existing = makeShare({ status: ShareStatus.PENDING });
      shareRepo.findOne.mockResolvedValue(existing);
      shareRepo.save.mockResolvedValue(existing);

      await service.invite('owner-id', { email: INVITEE_EMAIL });

      expect(shareRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ShareStatus.PENDING }),
      );
      expect(mailService.sendShareInvite).toHaveBeenCalled();
    });
  });

  describe('acceptInvite', () => {
    it('activates a valid pending invite', async () => {
      const share = makeShare({ owner: OWNER as User });
      shareRepo.findOne.mockResolvedValue(share);
      userRepo.findOneBy.mockResolvedValue(null);
      shareRepo.save.mockResolvedValue({ ...share, status: ShareStatus.ACTIVE });

      const result = await service.acceptInvite('abc123token');

      expect(result.message).toContain('inventory');
      expect(shareRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ShareStatus.ACTIVE }),
      );
    });

    it('throws NotFoundException for unknown token', async () => {
      shareRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptInvite('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for expired invite', async () => {
      shareRepo.findOne.mockResolvedValue(
        makeShare({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.acceptInvite('abc123token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeAccess', () => {
    it('marks share as revoked', async () => {
      const share = makeShare({ status: ShareStatus.ACTIVE, sharedWithUserId: 'user-b' });
      shareRepo.findOne.mockResolvedValue(share);
      shareRepo.save.mockResolvedValue({ ...share, status: ShareStatus.REVOKED });

      await service.revokeAccess('owner-id', 'user-b');

      expect(shareRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ShareStatus.REVOKED }),
      );
    });

    it('throws NotFoundException when no share exists', async () => {
      shareRepo.findOne.mockResolvedValue(null);
      await expect(service.revokeAccess('owner-id', 'user-b')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMembers', () => {
    it('returns mapped member DTOs', async () => {
      const shares = [
        makeShare({ status: ShareStatus.ACTIVE, sharedWithUser: { email: INVITEE_EMAIL, firstName: 'Bob', lastName: 'Jones' } as User }),
      ];
      shareRepo.find.mockResolvedValue(shares);

      const members = await service.listMembers('owner-id');

      expect(members).toHaveLength(1);
      expect(members[0].email).toBe(INVITEE_EMAIL);
    });
  });

  describe('listSharedWithMe', () => {
    it('returns inventories shared with the user', async () => {
      const shares = [
        makeShare({ status: ShareStatus.ACTIVE, ownerId: 'other-owner', owner: { email: 'other@test.com', firstName: 'Carol', lastName: 'White' } as User }),
      ];
      shareRepo.find.mockResolvedValue(shares);

      const result = await service.listSharedWithMe('user-id');

      expect(result).toHaveLength(1);
      expect(result[0].ownerEmail).toBe('other@test.com');
    });
  });
});
