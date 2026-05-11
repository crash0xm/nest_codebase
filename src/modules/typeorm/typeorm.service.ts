import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

@Injectable()
export class TypeOrmService implements OnModuleDestroy {
  constructor(public readonly dataSource: DataSource) {}

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  get manager(): EntityManager {
    return this.dataSource.manager;
  }

  getRepository<T extends object>(entity: new () => T): Repository<T> {
    return this.dataSource.getRepository(entity);
  }
}
