import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationEmailService } from '../application/services/email.service';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from '../notification.constants';

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

@Processor(NOTIFICATION_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: NotificationEmailService,
    @InjectMetric('queue_job_duration_seconds')
    private readonly jobDuration: Histogram,
  ) {
    super();
  }

  async process(job: Job): Promise<object | undefined> {
    const startTime = Date.now();
    this.logger.log(`[Queue] Processing job: ${job.id} type: ${job.name}`);

    try {
      let result: object | undefined;
      switch (job.name) {
        case NOTIFICATION_JOBS.SEND_WELCOME_EMAIL: {
          const welcomeData = job.data as SendWelcomeEmailJob;
          await this.emailService.sendWelcomeEmail(
            welcomeData.email,
            welcomeData.firstName,
          );
          result = undefined;
          break;
        }
        case 'send-account-update-email': {
          const updateData = job.data as SendAccountUpdateEmailJob;
          await this.emailService.sendAccountUpdateEmail(
            updateData.email,
            updateData.firstName,
            updateData.changes,
          );
          result = undefined;
          break;
        }
        default:
          this.logger.warn(`[Queue] Unknown job type: ${job.name}`);
      }

      const duration = (Date.now() - startTime) / 1000;
      this.jobDuration.observe({ queue: NOTIFICATION_QUEUE, job: job.name }, duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.jobDuration.observe({ queue: NOTIFICATION_QUEUE, job: job.name }, duration);
      this.logger.error(
        `[Queue] Job ${job.id} failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
