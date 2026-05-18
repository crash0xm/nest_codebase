export type StorageConfig = {
  provider: 'aws-s3' | 'cloudinary' | 'google-cloud';
  awsS3?: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    forcePathStyle?: boolean;
  };
};
