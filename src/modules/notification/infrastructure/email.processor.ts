import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationEmailService } from '../application/services/email.service';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from '../notification.constants';
import type {
  SendWelcomeEmailJob,
  SendAccountUpdateEmailJob,
} from '../jobs/send-welcome-email.job';

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

  async process(job: Job): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`[Worker] Processing job id=${job.id} name=${job.name}`);

    try {
      await this.dispatch(job);
    } catch (error) {
      this.logger.error(
        `[Worker] Job id=${job.id} name=${job.name} failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      this.jobDuration.observe({ queue: NOTIFICATION_QUEUE, job: job.name }, duration);
    }
  }

  private async dispatch(job: Job): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOBS.SEND_WELCOME_EMAIL: {
        const data = job.data as SendWelcomeEmailJob;
        await this.emailService.sendWelcomeEmail(data.email, data.firstName);
        break;
      }
      case NOTIFICATION_JOBS.SEND_ACCOUNT_UPDATE_EMAIL: {
        const data = job.data as SendAccountUpdateEmailJob;
        await this.emailService.sendAccountUpdateEmail(data.email, data.firstName, data.changes);
        break;
      }
      case NOTIFICATION_JOBS.SEND_PASSWORD_RESET_EMAIL: {
        this.logger.warn(`[Worker] ${job.name} handler not yet implemented — job id=${job.id}`);
        break;
      }
      default:
        this.logger.warn(`[Worker] Unknown job type: "${job.name}" — skipping id=${job.id}`);
    }
  }
}
