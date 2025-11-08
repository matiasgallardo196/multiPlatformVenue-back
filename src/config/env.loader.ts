import { config as dotenvConfig } from 'dotenv';

export const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = `.env.${NODE_ENV}`;
dotenvConfig({ path: envFile });

export const PORT = process.env.PORT || 3000;

export const DATABASE_URL = process.env.DATABASE_URL;
//export const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_TEST = NODE_ENV === 'test';
export const IS_DEVELOPMENT = NODE_ENV === 'development';

// Cloudinary
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
export const CLOUDINARY_UPLOAD_FOLDER =
  process.env.CLOUDINARY_UPLOAD_FOLDER || 'multiPlatformVenue/persons';

// Supabase
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Frontend
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Cors
export const CORS_ORIGIN = process.env.CORS_ORIGIN;

// Webhooks
export const BAN_NOTICE_WEBHOOK_URL = process.env.BAN_NOTICE_WEBHOOK_URL;