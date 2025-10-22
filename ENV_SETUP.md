# Configuración de Variables de Entorno

Para que el servidor funcione correctamente, necesitas configurar las variables de entorno.

## Crear archivo `.env.development`

Crea un archivo llamado `.env.development` en el directorio `multiPlatformVenue-back` con el siguiente contenido:

```env
# Database
DATABASE_URL=postgresql://usuario:password@localhost:5432/nombre_db

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_UPLOAD_FOLDER=multiPlatformVenue/persons

# Supabase (REQUERIDO para autenticación)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_publica_anon
SUPABASE_SERVICE_ROLE_KEY=tu_clave_service_role_opcional

# CORS
CORS_ORIGIN=http://localhost:3000

# Server
PORT=3001
NODE_ENV=development
```

## Obtener Variables de Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión y selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Copia:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** (opcional) → `SUPABASE_SERVICE_ROLE_KEY`

## Ejecutar el Servidor

```bash
npm run start:dev
```

Si ves el warning:

```
⚠️  WARNING: Supabase environment variables not configured!
```

Significa que necesitas configurar las variables de Supabase en tu archivo `.env.development`.
