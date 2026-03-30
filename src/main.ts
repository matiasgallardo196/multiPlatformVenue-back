import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { CORS_ORIGIN, PORT } from './config/env.loader';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['warn', 'error']
        : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

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

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('MultiPlatformVenue API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(PORT, '0.0.0.0');

  console.log(`🚀 App listening on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📄 Swagger disponible en http://localhost:${PORT}/api/docs`);
  }
}
bootstrap();
