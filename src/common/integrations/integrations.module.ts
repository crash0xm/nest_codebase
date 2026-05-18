import { Module, DynamicModule } from '@nestjs/common';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';

export interface IntegrationsModuleOptions {
  email?: boolean;
  storage?: boolean;
}

@Module({})
export class IntegrationsModule {
  static forRoot(options: IntegrationsModuleOptions = {}): DynamicModule {
    const imports: DynamicModule[] = [];

    if (options.email !== false) {
      imports.push(EmailModule.forRoot());
    }

    if (options.storage !== false) {
      imports.push(StorageModule.forRoot());
    }

    return {
      module: IntegrationsModule,
      imports,
      exports: imports,
    };
  }
}
