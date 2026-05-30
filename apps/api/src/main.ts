import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  // Serve locally-stored uploads when S3 is not configured
  if (!process.env.AWS_BUCKET || process.env.S3_LOCAL_MODE === 'true') {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
  }

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') || [] : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DX Solutions Asset Platform API')
    .setDescription(
      'REST API for the AIoT Asset Platform. ' +
      'Authentication uses httpOnly cookies (web) or Bearer tokens (mobile). ' +
      'All mutating endpoints require a valid CSRF token header (`x-csrf-token`).',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addCookieAuth('access_token')
    .addTag('auth', 'Registration, login, token refresh, OAuth')
    .addTag('items', 'Asset inventory — CRUD and depreciation')
    .addTag('ai', 'Vision recognition, OCR, barcode lookup, market valuation')
    .addTag('reports', 'PDF insurance report generation')
    .addTag('sharing', 'Family / multi-user inventory sharing')
    .addTag('reminders', 'Maintenance reminder scheduling and notifications')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.API_PORT || process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API Server running on http://localhost:${port}/api`);
  console.log(`📚 Swagger docs at   http://localhost:${port}/api/docs`);
}

void bootstrap();
