import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { ChangePasswordDto } from '../src/auth/dto/change-password.dto';
import { AdminResetPasswordDto } from '../src/auth/dto/admin-reset-password.dto';
import { COMMON_PASSWORDS } from '../src/auth/validators/common-passwords';

describe('NIST Password Policy', () => {
  describe('COMMON_PASSWORDS blocklist', () => {
    it('contains well-known weak passwords', () => {
      expect(COMMON_PASSWORDS.has('password')).toBe(true);
      expect(COMMON_PASSWORDS.has('123456')).toBe(true);
      expect(COMMON_PASSWORDS.has('password1')).toBe(true);
      expect(COMMON_PASSWORDS.has('qwerty')).toBe(true);
      expect(COMMON_PASSWORDS.has('abc123')).toBe(true);
    });

    it('does not contain strong passwords', () => {
      expect(COMMON_PASSWORDS.has('Tr0ub4dor&3')).toBe(false);
      expect(COMMON_PASSWORDS.has('correct-horse-battery')).toBe(false);
    });
  });

  describe('RegisterDto', () => {
    async function validateDto(data: Partial<RegisterDto>) {
      const dto = plainToInstance(RegisterDto, data);
      return validate(dto);
    }

    it('accepts a valid 8+ character unique password', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'Secur3P@ss',
      });
      expect(errors.length).toBe(0);
    });

    it('rejects password shorter than 8 characters', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'short',
      });
      const pwErrors = errors.find((e) => e.property === 'password');
      expect(pwErrors).toBeDefined();
      const msgs = Object.values(pwErrors!.constraints!);
      expect(msgs.some((m) => m.includes('at least 8 characters'))).toBe(true);
    });

    it('rejects exactly 7-character password', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'abcdefg',
      });
      expect(errors.find((e) => e.property === 'password')).toBeDefined();
    });

    it('accepts exactly 8-character password', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'abcdefgh',
      });
      expect(errors.find((e) => e.property === 'password')).toBeUndefined();
    });

    it('rejects password exceeding 64 characters', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'a'.repeat(65),
      });
      const pwErrors = errors.find((e) => e.property === 'password');
      expect(pwErrors).toBeDefined();
      const msgs = Object.values(pwErrors!.constraints!);
      expect(msgs.some((m) => m.includes('not exceed 64 characters'))).toBe(true);
    });

    it('accepts exactly 64-character password', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'a'.repeat(64),
      });
      expect(errors.find((e) => e.property === 'password')).toBeUndefined();
    });

    it('rejects "password1" as a common password', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'password1',
      });
      const pwErrors = errors.find((e) => e.property === 'password');
      expect(pwErrors).toBeDefined();
      const msgs = Object.values(pwErrors!.constraints!);
      expect(msgs.some((m) => m.includes('too commonly used'))).toBe(true);
    });

    it('rejects "qwerty" as a common password', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'qwerty',
      });
      expect(errors.find((e) => e.property === 'password')).toBeDefined();
    });

    it('rejects "admin123" as a common password', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'admin123',
      });
      expect(errors.find((e) => e.property === 'password')).toBeDefined();
    });

    it('common password check is case-insensitive', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        password: 'PASSWORD1',
      });
      expect(errors.find((e) => e.property === 'password')).toBeDefined();
    });

    it('rejects invalid email', async () => {
      const errors = await validateDto({
        email: 'not-an-email',
        password: 'Secur3P@ss',
      });
      expect(errors.find((e) => e.property === 'email')).toBeDefined();
    });
  });

  describe('ChangePasswordDto', () => {
    async function validateDto(data: Partial<ChangePasswordDto>) {
      const dto = plainToInstance(ChangePasswordDto, data);
      return validate(dto);
    }

    it('accepts valid current and new passwords', async () => {
      const errors = await validateDto({
        currentPassword: 'OldP@ss1',
        newPassword: 'NewSecure#99',
      });
      expect(errors.length).toBe(0);
    });

    it('rejects new password shorter than 8 characters', async () => {
      const errors = await validateDto({
        currentPassword: 'OldP@ss1',
        newPassword: 'short',
      });
      expect(errors.find((e) => e.property === 'newPassword')).toBeDefined();
    });

    it('rejects new password exceeding 64 characters', async () => {
      const errors = await validateDto({
        currentPassword: 'OldP@ss1',
        newPassword: 'b'.repeat(65),
      });
      expect(errors.find((e) => e.property === 'newPassword')).toBeDefined();
    });

    it('rejects common new password', async () => {
      const errors = await validateDto({
        currentPassword: 'OldP@ss1',
        newPassword: 'password1',
      });
      expect(errors.find((e) => e.property === 'newPassword')).toBeDefined();
    });

    it('requires currentPassword', async () => {
      const errors = await validateDto({ newPassword: 'NewSecure#99' });
      expect(errors.find((e) => e.property === 'currentPassword')).toBeDefined();
    });
  });

  describe('AdminResetPasswordDto', () => {
    async function validateDto(data: object) {
      const dto = plainToInstance(AdminResetPasswordDto, data);
      return validate(dto);
    }

    it('accepts valid UUID and strong new password', async () => {
      const errors = await validateDto({
        userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newPassword: 'AdminReset#2024',
      });
      expect(errors.length).toBe(0);
    });

    it('rejects non-UUID userId', async () => {
      const errors = await validateDto({
        userId: 'not-a-uuid',
        newPassword: 'AdminReset#2024',
      });
      expect(errors.find((e) => e.property === 'userId')).toBeDefined();
    });

    it('rejects new password shorter than 8 characters', async () => {
      const errors = await validateDto({
        userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newPassword: 'short',
      });
      expect(errors.find((e) => e.property === 'newPassword')).toBeDefined();
    });

    it('rejects common new password', async () => {
      const errors = await validateDto({
        userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newPassword: 'admin123',
      });
      expect(errors.find((e) => e.property === 'newPassword')).toBeDefined();
    });
  });
});
