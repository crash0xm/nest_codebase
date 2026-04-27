-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "TreeRole" AS ENUM ('owner', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'unknown');

-- CreateEnum
CREATE TYPE "LineageSide" AS ENUM ('paternal', 'maternal', 'self');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('parent_child', 'spouse', 'adopted_parent_child', 'step_parent_child');

-- CreateEnum
CREATE TYPE "RelationshipDirection" AS ENUM ('a_is_parent', 'b_is_parent');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('death_anniversary', 'birthday', 'wedding_anniversary', 'tet', 'holiday', 'custom');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('in_app', 'email', 'push', 'system');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed', 'read', 'cancelled');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('photo', 'document', 'audio');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('info', 'warning', 'maintenance');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "avatar_url" TEXT,
    "system_role" "SystemRole" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyTree" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreeMember" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TreeRole" NOT NULL DEFAULT 'viewer',
    "invited_by" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "nickname" TEXT,
    "gender" "Gender",
    "lineage_side" "LineageSide",
    "birth_date" TIMESTAMP(3),
    "death_date" TIMESTAMP(3),
    "is_alive" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" TEXT,
    "biography" TEXT,
    "occupation" TEXT,
    "generation_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "person_a_id" TEXT NOT NULL,
    "person_b_id" TEXT NOT NULL,
    "relationship_type" "RelationshipType" NOT NULL,
    "direction" "RelationshipDirection",
    "marriage_date" TIMESTAMP(3),
    "divorce_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "person_id" TEXT,
    "event_type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "event_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_lunar" BOOLEAN NOT NULL DEFAULT false,
    "lunar_month" INTEGER,
    "lunar_day" INTEGER,
    "is_recurring" BOOLEAN NOT NULL DEFAULT true,
    "reminder_days" INTEGER[] DEFAULT ARRAY[7, 3, 1, 0]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderDays" INTEGER[] DEFAULT ARRAY[7, 3, 1, 0]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonAttachment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT,
    "isAvatar" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyStory" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryPerson" (
    "storyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "StoryPerson_pkey" PRIMARY KEY ("storyId","personId")
);

-- CreateTable
CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_system_role_idx" ON "User"("system_role");

-- CreateIndex
CREATE INDEX "User_is_active_idx" ON "User"("is_active");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- CreateIndex
CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "RefreshToken_token_hash_idx" ON "RefreshToken"("token_hash");

-- CreateIndex
CREATE INDEX "FamilyTree_owner_id_idx" ON "FamilyTree"("owner_id");

-- CreateIndex
CREATE INDEX "FamilyTree_is_public_idx" ON "FamilyTree"("is_public");

-- CreateIndex
CREATE INDEX "FamilyTree_created_at_idx" ON "FamilyTree"("created_at");

-- CreateIndex
CREATE INDEX "TreeMember_tree_id_idx" ON "TreeMember"("tree_id");

-- CreateIndex
CREATE INDEX "TreeMember_user_id_idx" ON "TreeMember"("user_id");

-- CreateIndex
CREATE INDEX "TreeMember_tree_id_role_idx" ON "TreeMember"("tree_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TreeMember_tree_id_user_id_key" ON "TreeMember"("tree_id", "user_id");

-- CreateIndex
CREATE INDEX "Person_tree_id_idx" ON "Person"("tree_id");

-- CreateIndex
CREATE INDEX "Person_tree_id_lineage_side_idx" ON "Person"("tree_id", "lineage_side");

-- CreateIndex
CREATE INDEX "Person_tree_id_is_alive_idx" ON "Person"("tree_id", "is_alive");

-- CreateIndex
CREATE INDEX "Person_tree_id_deleted_at_idx" ON "Person"("tree_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Person_tree_id_created_at_idx" ON "Person"("tree_id", "created_at");

-- CreateIndex
CREATE INDEX "Person_full_name_idx" ON "Person"("full_name");

-- CreateIndex
CREATE INDEX "Relationship_person_a_id_idx" ON "Relationship"("person_a_id");

-- CreateIndex
CREATE INDEX "Relationship_person_b_id_idx" ON "Relationship"("person_b_id");

-- CreateIndex
CREATE INDEX "Relationship_tree_id_idx" ON "Relationship"("tree_id");

-- CreateIndex
CREATE INDEX "Relationship_tree_id_relationship_type_idx" ON "Relationship"("tree_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_tree_id_person_a_id_person_b_id_relationship_t_key" ON "Relationship"("tree_id", "person_a_id", "person_b_id", "relationship_type");

-- CreateIndex
CREATE INDEX "Event_tree_id_idx" ON "Event"("tree_id");

-- CreateIndex
CREATE INDEX "Event_event_date_idx" ON "Event"("event_date");

-- CreateIndex
CREATE INDEX "Event_tree_id_event_type_idx" ON "Event"("tree_id", "event_type");

-- CreateIndex
CREATE INDEX "Event_person_id_idx" ON "Event"("person_id");

-- CreateIndex
CREATE INDEX "Event_tree_id_event_date_event_type_idx" ON "Event"("tree_id", "event_date", "event_type");

-- CreateIndex
CREATE INDEX "Event_tree_id_lunar_month_lunar_day_idx" ON "Event"("tree_id", "lunar_month", "lunar_day");

-- CreateIndex
CREATE INDEX "Notification_user_id_status_idx" ON "Notification"("user_id", "status");

-- CreateIndex
CREATE INDEX "Notification_scheduled_at_idx" ON "Notification"("scheduled_at");

-- CreateIndex
CREATE INDEX "Notification_user_id_read_at_idx" ON "Notification"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_user_id_key" ON "NotificationPreference"("user_id");

-- CreateIndex
CREATE INDEX "PersonAttachment_personId_idx" ON "PersonAttachment"("personId");

-- CreateIndex
CREATE INDEX "PersonAttachment_treeId_idx" ON "PersonAttachment"("treeId");

-- CreateIndex
CREATE INDEX "FamilyStory_treeId_idx" ON "FamilyStory"("treeId");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_isActive_expiresAt_idx" ON "SystemAnnouncement"("isActive", "expiresAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyTree" ADD CONSTRAINT "FamilyTree_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeMember" ADD CONSTRAINT "TreeMember_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "FamilyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeMember" ADD CONSTRAINT "TreeMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "FamilyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_person_a_id_fkey" FOREIGN KEY ("person_a_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_person_b_id_fkey" FOREIGN KEY ("person_b_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "FamilyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAttachment" ADD CONSTRAINT "PersonAttachment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAttachment" ADD CONSTRAINT "PersonAttachment_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyStory" ADD CONSTRAINT "FamilyStory_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPerson" ADD CONSTRAINT "StoryPerson_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "FamilyStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPerson" ADD CONSTRAINT "StoryPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
