import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly localMode: boolean;
  private readonly uploadsDir: string;
  private s3Client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {
    this.localMode =
      config.get<string>('S3_LOCAL_MODE') === 'true' ||
      !config.get<string>('AWS_BUCKET');
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (this.localMode) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    if (this.localMode) {
      return this.saveLocally(buffer, key);
    }
    return this.uploadToS3(buffer, key, mimeType);
  }

  async deleteFile(key: string): Promise<void> {
    if (this.localMode) {
      this.deleteLocally(key);
      return;
    }
    await this.deleteFromS3(key);
  }

  private saveLocally(buffer: Buffer, key: string): string {
    const filePath = path.join(this.uploadsDir, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${key}`;
  }

  private deleteLocally(key: string): void {
    const filePath = path.join(this.uploadsDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private async uploadToS3(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    const upload = new Upload({
      client: this.getS3Client(),
      params: {
        Bucket: this.config.getOrThrow<string>('AWS_BUCKET'),
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      },
    });
    await upload.done();

    const domain = this.config.get<string>('CLOUDFRONT_DOMAIN');
    if (domain) {
      return `https://${domain}/${key}`;
    }
    const bucket = this.config.getOrThrow<string>('AWS_BUCKET');
    const region = this.config.getOrThrow<string>('AWS_REGION');
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private async deleteFromS3(key: string): Promise<void> {
    await this.getS3Client().send(
      new DeleteObjectCommand({
        Bucket: this.config.getOrThrow<string>('AWS_BUCKET'),
        Key: key,
      }),
    );
  }

  private getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: this.config.getOrThrow<string>('AWS_REGION'),
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
        },
      });
    }
    return this.s3Client;
  }
}
