import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { CORS_ORIGIN, PORT } from './config/env.loader';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', `${CORS_ORIGIN}`],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

<<<<<<< HEAD
  await app.listen(PORT, '0.0.0.0');

=======
  await app.listen(PORT ? Number(PORT) : 3001, '0.0.0.0');
>>>>>>> a046d4e0cc46dda01b8447d62d15d62df39be10b
  console.log(`🚀 App listening on port ${PORT}`);
}
bootstrap();
