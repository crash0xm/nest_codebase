export enum SystemRole {
  admin = 'admin',
  user = 'user',
}

export enum Gender {
  male = 'male',
  female = 'female',
  unknown = 'unknown',
}

export enum NotificationType {
  in_app = 'in_app',
  email = 'email',
  push = 'push',
  system = 'system',
}

export enum NotificationStatus {
  pending = 'pending',
  sent = 'sent',
  failed = 'failed',
  read = 'read',
  cancelled = 'cancelled',
}

export enum AttachmentType {
  photo = 'photo',
  document = 'document',
  audio = 'audio',
}

export enum AnnouncementType {
  info = 'info',
  warning = 'warning',
  maintenance = 'maintenance',
}
