import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PreSignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export class StorageService {
  private static client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID || 'mock-account'}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || 'mock-access-key',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'mock-secret-key',
    },
  });

  private static bucketName = process.env.R2_BUCKET_NAME || 'watchparty-media';

  /**
   * Generates a pre-signed S3/R2 direct upload URL with 15-minute expiration.
   */
  static async createPresignedUploadUrl(
    roomId: string,
    uploadId: string,
    filename: string,
    contentType: string
  ): Promise<PreSignedUploadResult> {
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `uploads/${roomId}/${uploadId}/${sanitized}`;

    // 100% Free local server direct upload fallback when R2 credentials are not provided
    const backendUrl = process.env.PUBLIC_SERVER_URL || 'https://watchparty-server-6a3v.onrender.com';
    const hasValidR2 = process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_ACCESS_KEY_ID !== 'mock-access-key' &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_SECRET_ACCESS_KEY !== 'mock-secret-key' &&
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCOUNT_ID !== 'mock-account';

    if (!hasValidR2) {
      return {
        uploadUrl: `${backendUrl}/api/upload/direct/${uploadId}?filename=${encodeURIComponent(sanitized)}`,
        storageKey,
        expiresInSeconds: 900,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: contentType,
    });

    const expiresInSeconds = 900; // 15 minutes
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds,
    };
  }
}
