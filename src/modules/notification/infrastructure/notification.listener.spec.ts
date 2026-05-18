import { NotificationListener } from './notification.listener';
import { getQueueToken } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from '../notification.constants';
import { UserCreatedEvent, UserUpdatedEvent } from '../../user/domain/events/user-events';
import { createTestModule } from '@/common/utils/test-helpers';

describe('NotificationListener', () => {
  let listener: NotificationListener;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module = await createTestModule({
      providers: [
        NotificationListener,
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: queue },
      ],
    });

    listener = module.get<NotificationListener>(NotificationListener);
  });

  describe('handleUserCreated', () => {
    it('should enqueue welcome email job', async () => {
      const event = new UserCreatedEvent('user-1', 'test@example.com', 'John', new Date());

      await listener.handleUserCreated(event);

      expect(queue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_WELCOME_EMAIL,
        { userId: 'user-1', email: 'test@example.com', firstName: 'John' },
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('handlePasswordReset', () => {
    it('should enqueue password reset email job', async () => {
      await listener.handlePasswordReset({
        userId: 'user-1',
        email: 'test@example.com',
        resetToken: 'token-123',
        firstName: 'John',
      });

      expect(queue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_PASSWORD_RESET_EMAIL,
        { userId: 'user-1', email: 'test@example.com', resetToken: 'token-123' },
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('handleUserUpdated', () => {
    it('should enqueue account update email job', async () => {
      const event = new UserUpdatedEvent('user-1', 'test@example.com', 'John', 'Doe', {
        firstName: 'Jane',
      });

      await listener.handleUserUpdated(event);

      expect(queue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_ACCOUNT_UPDATE_EMAIL,
        {
          userId: 'user-1',
          email: 'test@example.com',
          firstName: 'John',
          changes: { firstName: 'Jane' },
        },
        expect.objectContaining({ attempts: 2 }),
      );
    });
  });
});
