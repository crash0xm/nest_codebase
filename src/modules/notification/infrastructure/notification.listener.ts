import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from '../notification.constants';
import { UserCreatedEvent, UserUpdatedEvent } from '../../user/domain/events/user-events';
import type {
  SendWelcomeEmailJob,
  SendAccountUpdateEmailJob,
  SendPasswordResetEmailJob,
} from '../jobs/send-welcome-email.job';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue) {}

  @OnEvent('user.created')
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    this.logger.log(`[Notification] Enqueuing welcome email for userId=${event.userId}`);

    const jobData: SendWelcomeEmailJob = {
      userId: event.userId,
      email: event.email,
      firstName: event.firstName,
    };

    await this.notificationQueue.add(NOTIFICATION_JOBS.SEND_WELCOME_EMAIL, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
  }

  @OnEvent('user.password-reset-requested')
  async handlePasswordReset(event: {
    userId: string;
    email: string;
    resetToken: string;
    firstName: string;
  }): Promise<void> {
    this.logger.log(`[Notification] Enqueuing password reset email for userId=${event.userId}`);

    const jobData: SendPasswordResetEmailJob = {
      userId: event.userId,
      email: event.email,
      resetToken: event.resetToken,
    };

    await this.notificationQueue.add(NOTIFICATION_JOBS.SEND_PASSWORD_RESET_EMAIL, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
  }

  @OnEvent('user.updated')
  async handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
    this.logger.log(`[Notification] Enqueuing account-update email for userId=${event.userId}`);

    const jobData: SendAccountUpdateEmailJob = {
      userId: event.userId,
      email: event.email,
      firstName: event.firstName,
      changes: event.changes,
    };

    await this.notificationQueue.add(NOTIFICATION_JOBS.SEND_ACCOUNT_UPDATE_EMAIL, jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
  }
}
