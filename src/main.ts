import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PORT } from './config/env.loader';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(PORT);

  console.log(`🚀 App listening on port ${PORT}`);
}
bootstrap();
