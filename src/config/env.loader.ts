import { config as dotenvConfig } from 'dotenv';

const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = `.env.${NODE_ENV}`;
dotenvConfig({ path: envFile });

export const PORT = process.env.PORT || 3000;

export const DATABASE_URL = process.env.DATABASE_URL;
//export const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_TEST = NODE_ENV === 'test';
export const IS_DEVELOPMENT = NODE_ENV === 'development';
