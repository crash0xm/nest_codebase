import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import type {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  StorageDeleteResult,
  StorageListResult,
} from './storage.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: StorageProvider;

  constructor(
    @Inject('ConfigService') private readonly configService: ConfigService,
    @Inject('StorageProvider') provider: StorageProvider,
  ) {
    this.provider = provider;
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    key: string,
    buffer: Buffer | Readable,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    try {
      this.logger.log(`Uploading file via ${this.provider.getProviderName()}`);

      const result = await this.provider.upload(key, buffer, options);

      if (result.success) {
        this.logger.log(`File uploaded successfully. Key: ${result.key}`);
      } else {
        this.logger.error(`Failed to upload file: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Unexpected error in StorageService.uploadFile', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(key: string): Promise<StorageDownloadResult> {
    try {
      this.logger.log(`Downloading file via ${this.provider.getProviderName()}`);

      const result = await this.provider.download(key);

      if (result.success) {
        this.logger.log(`File downloaded successfully. Key: ${key}`);
      } else {
        this.logger.error(`Failed to download file: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Unexpected error in StorageService.downloadFile', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<StorageDeleteResult> {
    try {
      this.logger.log(`Deleting file via ${this.provider.getProviderName()}`);

      const result = await this.provider.delete(key);

      if (result.success) {
        this.logger.log(`File deleted successfully. Key: ${key}`);
      } else {
        this.logger.error(`Failed to delete file: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Unexpected error in StorageService.deleteFile', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List files in storage
   */
  async listFiles(prefix?: string, maxKeys?: number): Promise<StorageListResult> {
    try {
      this.logger.log(`Listing files via ${this.provider.getProviderName()}`);

      const result = await this.provider.list(prefix, maxKeys);

      if (result.success) {
        this.logger.log(`Files listed successfully. Count: ${result.files?.length}`);
      } else {
        this.logger.error(`Failed to list files: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Unexpected error in StorageService.listFiles', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a signed URL for temporary access
   */
  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    try {
      this.logger.log(`Getting signed URL via ${this.provider.getProviderName()}`);

      const defaultExpiresIn = parseInt(
        this.configService.get('STORAGE_SIGNED_URL_EXPIRES_IN', '3600'),
      );
      const url = await this.provider.getSignedUrl(key, expiresIn ?? defaultExpiresIn);

      this.logger.log(`Signed URL generated successfully. Key: ${key}`);

      return url;
    } catch (error) {
      this.logger.error('Unexpected error in StorageService.getSignedUrl', error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      this.logger.log(`Checking file existence via ${this.provider.getProviderName()}`);

      const exists = await this.provider.exists(key);

      this.logger.log(`File existence check completed. Key: ${key}, Exists: ${exists}`);

      return exists;
    } catch (error) {
      this.logger.error('Unexpected error in StorageService.fileExists', error);
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    key: string,
  ): Promise<{ size: number; contentType?: string; lastModified: Date; etag?: string } | null> {
    try {
      this.logger.log(`Getting file metadata via ${this.provider.getProviderName()}`);

      const metadata = await this.provider.getMetadata(key);

      if (metadata) {
        this.logger.log(`File metadata retrieved successfully. Key: ${key}`);
      } else {
        this.logger.log(`File not found. Key: ${key}`);
      }

      return metadata;
    } catch (error) {
      this.logger.error('Unexpected error in StorageService.getFileMetadata', error);
      return null;
    }
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }
}
