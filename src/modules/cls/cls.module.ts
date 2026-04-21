import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';
import { FastifyRequest } from 'fastify';

export interface AppClsStore {
  requestId: string;
  traceId: string;
  userId?: string;
  userRole?: string;
  startTime: number;
  [key: symbol]: unknown;
}

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        setup: (cls, req: FastifyRequest) => {
          const traceId = (req.headers['x-trace-id'] as string | undefined) ?? uuidv4();
          const requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();

          cls.set('requestId', requestId);
          cls.set('traceId', traceId);
          cls.set('startTime', Date.now());
        },
      },
    }),
  ],
  exports: [ClsModule],
})
export class AppClsModule {}
