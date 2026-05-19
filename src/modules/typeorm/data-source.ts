import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  entities: [join(__dirname, '../../**/*.orm-entity.{ts,js}')],
  migrations: [join(__dirname, './migrations/**/*.{ts,js}')],
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
