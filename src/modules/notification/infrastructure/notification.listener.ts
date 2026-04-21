import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from '../notification.constants';
import { UserCreatedEvent } from '../../user/domain/events/user-created.event';
import { UserUpdatedEvent } from '../../user/domain/events/user-events';

interface SendWelcomeEmailJob {
  userId: string;
  email: string;
  firstName: string;
}

interface SendAccountUpdateEmailJob {
  userId: string;
  email: string;
  firstName: string;
  changes: Record<string, unknown>;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue) {}

  @OnEvent('user.created')
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    this.logger.log(`[Notification] Enqueuing welcome email for ${event.email}`);

    const jobData: SendWelcomeEmailJob = {
      userId: event.userId,
      email: event.email,
      firstName: event.firstName,
    };

    await this.notificationQueue.add(NOTIFICATION_JOBS.SEND_WELCOME_EMAIL, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  @OnEvent('user.updated')
  async handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
    this.logger.log(`[Notification] Enqueuing account update alert for ${event.email}`);

    const jobData: SendAccountUpdateEmailJob = {
      userId: event.userId,
      email: event.email,
      firstName: event.firstName,
      changes: event.changes,
    };

    await this.notificationQueue.add('send-account-update-email', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }
}
