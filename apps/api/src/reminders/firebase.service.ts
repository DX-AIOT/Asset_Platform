import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private messaging: admin.messaging.Messaging | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const credentialsJson = this.config.get<string>('FIREBASE_CREDENTIALS_JSON');
    if (!credentialsJson) {
      this.logger.warn('FIREBASE_CREDENTIALS_JSON not set — push notifications disabled');
      return;
    }
    try {
      const credential = admin.credential.cert(JSON.parse(credentialsJson));
      if (!admin.apps.length) {
        admin.initializeApp({ credential });
      }
      this.messaging = admin.messaging();
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.error('Failed to initialize Firebase Admin SDK', err);
    }
  }

  async sendToDevice(token: string, payload: PushPayload): Promise<void> {
    if (!this.messaging) return;
    try {
      await this.messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });
    } catch (err) {
      this.logger.error(`FCM send failed for token ${token.slice(0, 8)}…`, err);
    }
  }
}
