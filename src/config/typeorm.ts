import { DataSource, DataSourceOptions } from 'typeorm';
import { registerAs } from '@nestjs/config';
import { IS_PRODUCTION } from './env.loader';

const config = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  autoLoadEntities: true,
  entities: ['dist/**/*.entity{.ts,.js}'],
  migrations: ['dist/migrations/*{.ts,.js}'],
  synchronize: !IS_PRODUCTION,
  logging: IS_PRODUCTION,
  //logger: 'advanced-console',
  //logNotifications: true,
  //dropSchema: true,
  // ssl: { rejectUnauthorized: false },
  // uuidExtension: 'pgcrypto',
};

export default registerAs('typeorm', () => config);

export const connectionSource = new DataSource(config as DataSourceOptions); //migraciones desde cli
