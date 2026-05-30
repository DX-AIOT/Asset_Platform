import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class ExpoNotificationsService {
  private readonly logger = new Logger(ExpoNotificationsService.name);
  private readonly expo: Expo;

  constructor(private readonly config: ConfigService) {
    this.expo = new Expo({
      accessToken: this.config.get<string>('EXPO_ACCESS_TOKEN'),
    });
  }

  /**
   * Sends a push notification to the given Expo token.
   * Returns `deadTokens` containing `token` when Expo reports DeviceNotRegistered,
   * so callers can remove the stale token from the database.
   */
  async sendToDevice(token: string, payload: PushPayload): Promise<{ deadTokens: string[] }> {
    if (!Expo.isExpoPushToken(token)) {
      this.logger.warn(`Skipping invalid Expo push token: ${token.slice(0, 14)}…`);
      return { deadTokens: [] };
    }

    const deadTokens: string[] = [];
    const message: ExpoPushMessage = {
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
    };

    try {
      const chunks = this.expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            this.logger.error(
              `Expo push error (${ticket.details?.error ?? 'unknown'}): ${ticket.message}`,
            );
            if (ticket.details?.error === 'DeviceNotRegistered') {
              deadTokens.push(token);
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Expo push send failed for token ${token.slice(0, 14)}…`, err);
    }

    return { deadTokens };
  }
}
