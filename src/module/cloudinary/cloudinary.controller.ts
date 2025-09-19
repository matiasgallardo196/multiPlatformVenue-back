import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import * as crypto from 'crypto';
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_UPLOAD_FOLDER,
} from '../../config/env.loader';

@Controller('cloudinary')
export class CloudinaryController {
  @Roles('manager')
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
