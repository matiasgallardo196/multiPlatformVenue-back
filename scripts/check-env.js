/**
 * Script para verificar que las variables de entorno estén configuradas correctamente
 * Ejecutar: node scripts/check-env.js
 */

const { config } = require('dotenv');
const path = require('path');

// Cargar variables de entorno
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
config({ path: envFile });

console.log('\n🔍 Verificando configuración de variables de entorno...\n');
console.log(`📄 Archivo: ${envFile}\n`);

const requiredVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL,
};

const optionalVars = {
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

let hasErrors = false;

// Verificar variables requeridas
console.log('✅ Variables Requeridas:\n');
Object.entries(requiredVars).forEach(([key, value]) => {
  if (!value) {
    console.log(`  ❌ ${key}: NO CONFIGURADA`);
    hasErrors = true;
  } else {
    // Mostrar solo los primeros caracteres para seguridad
    const displayValue =
      value.length > 20
        ? `${value.substring(0, 15)}...${value.substring(value.length - 5)}`
        : value;
    console.log(`  ✅ ${key}: ${displayValue}`);
  }
});

// Verificar variables opcionales
console.log('\n⚙️  Variables Opcionales:\n');
Object.entries(optionalVars).forEach(([key, value]) => {
  if (!value) {
    console.log(`  ⚠️  ${key}: No configurada (opcional)`);
  } else {
    const displayValue =
      value.length > 20
        ? `${value.substring(0, 15)}...${value.substring(value.length - 5)}`
        : value;
    console.log(`  ✅ ${key}: ${displayValue}`);
  }
});

console.log('\n' + '='.repeat(60) + '\n');

if (hasErrors) {
  console.log('❌ FALTAN VARIABLES REQUERIDAS\n');
  console.log('📝 Crea o actualiza tu archivo .env.development con:');
  console.log('\nDATABASE_URL=tu_url_de_postgresql');
  console.log('SUPABASE_URL=https://tu-proyecto.supabase.co');
  console.log('SUPABASE_ANON_KEY=tu_anon_key');
  console.log('SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key');
  console.log('FRONTEND_URL=http://localhost:3000\n');
  console.log('🔗 Obtén tus claves de Supabase en:');
  console.log(
    '   https://supabase.com/dashboard → Tu Proyecto → Settings → API\n',
  );
  process.exit(1);
} else {
  console.log('✅ TODAS LAS VARIABLES REQUERIDAS ESTÁN CONFIGURADAS\n');

  // Verificar que SUPABASE_SERVICE_ROLE_KEY no sea la misma que ANON_KEY
  if (
    requiredVars.SUPABASE_SERVICE_ROLE_KEY === requiredVars.SUPABASE_ANON_KEY
  ) {
    console.log(
      '⚠️  ADVERTENCIA: SUPABASE_SERVICE_ROLE_KEY y SUPABASE_ANON_KEY son iguales',
    );
    console.log(
      '   Esto puede ser un error. La service_role key debe ser diferente.\n',
    );
  }

  console.log('🚀 El servidor debería funcionar correctamente\n');
  console.log(
    '📧 Para invitaciones por email, también necesitas configurar SMTP en Supabase:',
  );
  console.log(
    '   https://supabase.com/dashboard → Settings → Auth → SMTP Settings\n',
  );
  console.log(
    '📖 Ver TROUBLESHOOTING_EMAIL_INVITATIONS.md para más información\n',
  );
}
