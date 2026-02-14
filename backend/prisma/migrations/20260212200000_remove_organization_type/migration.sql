-- AlterTable: drop the "type" column from organizations
ALTER TABLE "organizations" DROP COLUMN "type";

-- DropEnum
DROP TYPE "OrganizationType";
