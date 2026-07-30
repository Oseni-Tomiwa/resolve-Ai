import { Injectable } from '@nestjs/common';

export type InvitationEmail = {
  invitationUrl: string;
  inviterName: string;
  organizationName: string;
  workspaceName: string;
  email: string;
  role: string;
  expiresAt: Date;
};

export type LifecycleEmail = {
  email: string;
  url: string;
  expiresAt: Date;
};

@Injectable()
export class EmailService {
  async sendInvitation(message: InvitationEmail): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      // Development-only delivery substitute; the URL is intentionally not persisted.
      // eslint-disable-next-line no-console
      console.info(`[ResolveAI development invitation] ${message.invitationUrl}`);
    }
  }

  async sendVerification(message: LifecycleEmail): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(`[ResolveAI development verification] ${message.url}`);
    }
  }

  async sendPasswordReset(message: LifecycleEmail): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(`[ResolveAI development password reset] ${message.url}`);
    }
  }
}
