import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Mock fs before importing StorageService (hoisted by jest)
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

const mockUploadDone = jest.fn().mockResolvedValue({});
const mockS3Send = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({ done: mockUploadDone })),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
}));

import * as fs from 'fs';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

function buildModule(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    S3_LOCAL_MODE: 'true',
    AWS_BUCKET: undefined,
    AWS_REGION: 'ap-southeast-1',
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    CLOUDFRONT_DOMAIN: undefined,
    ...overrides,
  };
}

async function createService(env: Record<string, string | undefined>): Promise<StorageService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StorageService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback?: string) => env[key] ?? fallback,
          getOrThrow: (key: string) => {
            if (!env[key]) throw new Error(`Missing config: ${key}`);
            return env[key];
          },
        },
      },
    ],
  }).compile();
  return module.get<StorageService>(StorageService);
}

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => undefined);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.unlinkSync as jest.Mock).mockImplementation(() => undefined);
  });

  describe('local mode (S3_LOCAL_MODE=true)', () => {
    let service: StorageService;

    beforeEach(async () => {
      service = await createService(buildModule({ S3_LOCAL_MODE: 'true' }));
    });

    it('should be in local mode when S3_LOCAL_MODE is true', () => {
      expect(service.localMode).toBe(true);
    });

    it('should be in local mode when AWS_BUCKET is not set', async () => {
      const s = await createService(buildModule({ S3_LOCAL_MODE: undefined, AWS_BUCKET: undefined }));
      expect(s.localMode).toBe(true);
    });

    describe('uploadFile()', () => {
      it('should write buffer to disk and return /uploads/ URL', async () => {
        const buf = Buffer.from('test-image');
        const url = await service.uploadFile(buf, 'items/abc.jpg', 'image/jpeg');
        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('items/abc.jpg'), buf);
        expect(url).toBe('/uploads/items/abc.jpg');
      });

      it('should create parent directory before writing', async () => {
        await service.uploadFile(Buffer.from('x'), 'items/nested/abc.jpg', 'image/jpeg');
        expect(fs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('items/nested'),
          { recursive: true },
        );
      });
    });

    describe('deleteFile()', () => {
      it('should delete the file if it exists', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        await service.deleteFile('items/abc.jpg');
        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('items/abc.jpg'));
      });

      it('should not throw if the file does not exist', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        await expect(service.deleteFile('items/missing.jpg')).resolves.toBeUndefined();
        expect(fs.unlinkSync).not.toHaveBeenCalled();
      });
    });
  });

  describe('S3 mode (S3_LOCAL_MODE=false, AWS_BUCKET set)', () => {
    const s3Env = buildModule({
      S3_LOCAL_MODE: 'false',
      AWS_BUCKET: 'my-bucket',
      AWS_REGION: 'ap-southeast-1',
      AWS_ACCESS_KEY_ID: 'AKID',
      AWS_SECRET_ACCESS_KEY: 'secret',
      CLOUDFRONT_DOMAIN: undefined,
    });

    let service: StorageService;

    beforeEach(async () => {
      service = await createService(s3Env);
    });

    it('should be in S3 mode', () => {
      expect(service.localMode).toBe(false);
    });

    describe('uploadFile()', () => {
      it('should upload to S3 via Upload', async () => {
        mockUploadDone.mockResolvedValue({});
        await service.uploadFile(Buffer.from('img'), 'items/photo.jpg', 'image/jpeg');
        expect(Upload).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({
              Bucket: 'my-bucket',
              Key: 'items/photo.jpg',
              ContentType: 'image/jpeg',
            }),
          }),
        );
        expect(mockUploadDone).toHaveBeenCalled();
      });

      it('should return CloudFront URL when CLOUDFRONT_DOMAIN is set', async () => {
        const s = await createService({ ...s3Env, CLOUDFRONT_DOMAIN: 'cdn.example.com' });
        const url = await s.uploadFile(Buffer.from('img'), 'items/photo.jpg', 'image/jpeg');
        expect(url).toBe('https://cdn.example.com/items/photo.jpg');
      });

      it('should return S3 URL when CLOUDFRONT_DOMAIN is not set', async () => {
        const url = await service.uploadFile(Buffer.from('img'), 'items/photo.jpg', 'image/jpeg');
        expect(url).toBe('https://my-bucket.s3.ap-southeast-1.amazonaws.com/items/photo.jpg');
      });
    });

    describe('deleteFile()', () => {
      it('should send DeleteObjectCommand with correct bucket and key', async () => {
        await service.deleteFile('items/photo.jpg');
        expect(DeleteObjectCommand).toHaveBeenCalledWith({
          Bucket: 'my-bucket',
          Key: 'items/photo.jpg',
        });
        expect(mockS3Send).toHaveBeenCalled();
      });
    });
  });
});
