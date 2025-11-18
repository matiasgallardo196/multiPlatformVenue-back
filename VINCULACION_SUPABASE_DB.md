# 🔗 Vinculación Supabase Auth ↔️ Base de Datos PostgreSQL

## ✅ ¿Qué se Implementó?

Ahora **Supabase Auth está completamente vinculado con tu tabla `users`** de PostgreSQL.

Cuando un usuario se loguea con `lewis@gmail.com` en Supabase:

1. ✅ Se valida el token con Supabase Auth
2. ✅ Se busca o crea el usuario en tu tabla `users` de PostgreSQL
3. ✅ Se vincula usando el campo `supabaseUserId`
4. ✅ El backend retorna la información del usuario de tu BD

## 🔄 Flujo de Autenticación

```
Usuario → Login con Supabase (lewis@gmail.com)
         ↓
    Supabase Auth valida
         ↓
    Backend recibe token
         ↓
    AuthService.validateToken()
         ↓
    ┌─────────────────────────────────────┐
    │ UserService.createOrUpdateFromSupabase()  │
    └─────────────────────────────────────┘
         ↓
    ¿Usuario existe con supabaseUserId?
         ├─ SÍ → Actualizar info
         └─ NO → ¿Existe por email o userName?
                 ├─ SÍ → Vincular supabaseUserId
                 └─ NO → Crear nuevo usuario
         ↓
    Retorna usuario de PostgreSQL
```

## 📊 Cambios en la Tabla `users`

### Nuevas Columnas

```sql
-- Email del usuario
email VARCHAR(255) NULLABLE

-- ID de Supabase Auth (vincula ambos sistemas)
supabaseUserId VARCHAR(255) UNIQUE NULLABLE

-- passwordHash ahora es opcional
passwordHash VARCHAR NULLABLE
```

### Nuevos Roles

```typescript
type UserRole = 'admin' | 'manager' | 'staff' | 'head-manager';
```

## 🚀 Cómo Aplicar la Migración

### Opción 1: Ejecutar SQL Manualmente

```bash
# Conecta a tu base de datos PostgreSQL y ejecuta:
psql -U usuario -d nombre_db -f src/db/migrations/001-add-supabase-fields.sql
```

### Opción 2: TypeORM Sync (Solo Desarrollo)

Si tienes `synchronize: true` en tu configuración de TypeORM:

```typescript
// src/config/typeorm.ts
TypeOrmModule.forRoot({
  // ...
  synchronize: true, // Solo en desarrollo
});
```

TypeORM creará las columnas automáticamente cuando levantes el servidor.

## 👥 Escenarios de Uso

### Escenario 1: Usuario Nuevo en Supabase

```typescript
// Usuario se registra en Supabase con:
email: "lewis@gmail.com"
password: "******"
metadata: { userName: "lewis", role: "manager" }

// Al hacer login:
// 1. Supabase valida
// 2. Backend crea usuario en PostgreSQL:
{
  id: "uuid-generado",
  userName: "lewis",
  email: "lewis@gmail.com",
  supabaseUserId: "supabase-uuid",
  role: "manager",
  passwordHash: null
}
```

### Escenario 2: Usuario Existente en PostgreSQL

```typescript
// Ya existe en PostgreSQL:
{
  id: "123",
  userName: "lewis",
  email: null,
  supabaseUserId: null,
  passwordHash: "hash-antiguo"
}

// Usuario se registra en Supabase con userName "lewis"
// Al hacer login:
// 1. Backend encuentra usuario existente por userName
// 2. Vincula con Supabase:
{
  id: "123",
  userName: "lewis",
  email: "lewis@gmail.com",
  supabaseUserId: "supabase-uuid", // ← Vinculado!
  passwordHash: "hash-antiguo"
}
```

### Escenario 3: Re-login de Usuario Vinculado

```typescript
// Usuario ya vinculado hace login:
// 1. Supabase valida token
// 2. Backend encuentra usuario por supabaseUserId
// 3. Actualiza info si cambió algo
// 4. Retorna usuario de PostgreSQL
```

## 🎯 Beneficios

1. **Un solo punto de login**: Supabase Auth
2. **Datos en tu BD**: Toda la info adicional en PostgreSQL
3. **Vinculación automática**: Se crea o vincula automáticamente
4. **Migración suave**: Usuarios existentes se vinculan al hacer login
5. **Control total**: Puedes agregar campos adicionales en PostgreSQL

## 📝 Ejemplo de Uso en el Backend

```typescript
// En cualquier endpoint protegido:
@Get('me')
async getMe(@Req() req) {
  // req.user contiene:
  {
    userId: "uuid-postgresql",      // ← ID de tu BD
    supabaseUserId: "uuid-supabase", // ← ID de Supabase
    userName: "lewis",
    email: "lewis@gmail.com",
    role: "manager"
  }
}
```

## 🔧 Configuración de Usuarios en Supabase

Al crear usuarios en Supabase Dashboard, agrega esto en **User Metadata**:

```json
{
  "userName": "lewis",
  "role": "manager"
}
```

Esto se usará para vincular con tu tabla `users`.

## ✅ Verificación

Para verificar que funciona:

1. Crea un usuario en Supabase con metadata
2. Haz login desde el frontend
3. Verifica en PostgreSQL:
   ```sql
   SELECT * FROM users WHERE email = 'lewis@gmail.com';
   ```
4. Deberías ver el usuario con `supabaseUserId` lleno

## 🚨 Importante

- ✅ Los usuarios nuevos se crean automáticamente
- ✅ Los usuarios existentes se vinculan automáticamente
- ✅ La vinculación es por email o userName
- ⚠️ Asegúrate de ejecutar la migración SQL antes de usar
- ⚠️ Los roles deben coincidir entre Supabase metadata y tu BD

---

**¡La vinculación está completa!** Ahora Supabase y tu BD PostgreSQL trabajan juntos perfectamente. 🎉
