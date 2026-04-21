import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  StorageDeleteResult,
  StorageListResult,
  StorageConfig,
} from '../storage.interface';
import { STORAGE_CONFIG_KEY } from '../storage.interface';

@Injectable()
export class AwsS3Provider implements StorageProvider {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const storageConfig = this.configService.get<StorageConfig>(STORAGE_CONFIG_KEY)!;

    this.s3Client = new S3Client({
      region: storageConfig.awsS3!.region,
      credentials: {
        accessKeyId: storageConfig.awsS3!.accessKeyId,
        secretAccessKey: storageConfig.awsS3!.secretAccessKey,
      },
      endpoint: storageConfig.awsS3!.endpoint,
      forcePathStyle: storageConfig.awsS3!.forcePathStyle ?? false,
    });

    this.bucket = storageConfig.awsS3!.bucket;
  }

  async upload(
    key: string,
    buffer: Buffer | Readable,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        ACL: options?.isPublic ? 'public-read' : 'private',
        Expires: options?.expiresAt,
      });

      const response = await this.s3Client.send(command);

      return {
        success: true,
        key,
        url: `https://${this.bucket}.s3.${this.configService.get('storage.awsS3.region')}.${this.configService.get('AWS_S3_DOMAIN', 'amazonaws.com')}/${key}`,
        etag: response.ETag,
        providerResponse: {
          ETag: response.ETag,
          RequestId: response.$metadata.requestId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async download(key: string): Promise<StorageDownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        success: true,
        stream: response.Body as Readable,
        contentType: response.ContentType,
        size: response.ContentLength,
        providerResponse: {
          ETag: response.ETag,
          RequestId: response.$metadata.requestId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  async delete(key: string): Promise<StorageDeleteResult> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        success: true,
        providerResponse: {
          RequestId: response.$metadata.requestId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  async list(prefix?: string, maxKeys?: number): Promise<StorageListResult> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);

      return {
        success: true,
        files: response.Contents?.map((obj) => ({
          key: obj.Key!,
          size: obj.Size!,
          lastModified: obj.LastModified!,
          etag: obj.ETag,
        })),
        providerResponse: {
          RequestId: response.$metadata.requestId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List failed',
      };
    }
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    return url;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<{
    size: number;
    contentType?: string;
    lastModified: Date;
    etag?: string;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength!,
        contentType: response.ContentType,
        lastModified: response.LastModified!,
        etag: response.ETag,
      };
    } catch {
      return null;
    }
  }

  getProviderName(): string {
    return 'AWS S3';
  }

  async validateConfig(): Promise<boolean> {
    try {
      const storageConfig = this.configService.get<StorageConfig>(STORAGE_CONFIG_KEY)!;

      if (
        !storageConfig.awsS3?.accessKeyId ||
        !storageConfig.awsS3?.secretAccessKey ||
        !storageConfig.awsS3?.bucket
      ) {
        return false;
      }

      const validationMaxKeys = parseInt(this.configService.get('AWS_S3_VALIDATION_MAX_KEYS', '1'));
      await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: validationMaxKeys,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
