import { DataSource, DataSourceOptions } from 'typeorm';
import { registerAs } from '@nestjs/config';
import {
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USERNAME,
  IS_PRODUCTION,
} from './env.loader';

const config = {
  type: 'postgres',
  database: DB_NAME,
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  autoLoadEntities: true,
  entities: ['dist/**/*.entity{.ts,.js}'],
  migrations: ['dist/migrations/*{.ts,.js}'],
  synchronize: !IS_PRODUCTION,
  logging: IS_PRODUCTION,
  //logger: 'advanced-console',
  //logNotifications: true,
  //dropSchema: true,
  ssl: { rejectUnauthorized: false },
};

export default registerAs('typeorm', () => config);

export const connectionSource = new DataSource(config as DataSourceOptions); //migraciones desde cli
