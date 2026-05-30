import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      // Dev/test: log-only transport
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  async sendShareInvite(opts: {
    toEmail: string;
    ownerName: string;
    acceptUrl: string;
  }): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'AIoT Asset Platform <noreply@aiot-asset.app>');

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to view an asset inventory</h2>
        <p><strong>${opts.ownerName}</strong> has shared their asset inventory with you on the AIoT Asset Platform.</p>
        <p style="margin: 24px 0;">
          <a href="${opts.acceptUrl}"
             style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Accept Invitation
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;">This invitation expires in 7 days. If you did not expect this email, you can ignore it.</p>
      </div>
    `;

    const info = await this.transporter.sendMail({
      from,
      to: opts.toEmail,
      subject: `${opts.ownerName} has shared their asset inventory with you`,
      html,
    });

    this.logger.log(`Invite sent to ${opts.toEmail} — messageId: ${info.messageId}`);
  }
}
