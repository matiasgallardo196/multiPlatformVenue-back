import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import * as crypto from 'crypto';
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_UPLOAD_FOLDER,
} from '../../config/env.loader';

@Controller('cloudinary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CloudinaryController {
  @Roles(UserRole.MANAGER)
  @Post('signature')
  createSignature(
    @Body()
    body: {
      timestamp?: number;
      folder?: string;
    },
  ) {
    if (!CLOUDINARY_API_SECRET || !CLOUDINARY_API_KEY) {
      throw new BadRequestException('Cloudinary credentials not configured');
    }

    const timestamp = body.timestamp ?? Math.floor(Date.now() / 1000);
    const folder = body.folder || CLOUDINARY_UPLOAD_FOLDER;

    // Build params string in alphabetical order
    const params = [`folder=${folder}`, `timestamp=${timestamp}`].join('&');
    const signature = crypto
      .createHash('sha1')
      .update(params + CLOUDINARY_API_SECRET)
      .digest('hex');

    return {
      timestamp,
      folder,
      signature,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }
}
