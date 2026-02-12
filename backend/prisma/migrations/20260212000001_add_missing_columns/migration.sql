-- AlterEnum: Add TRUCKING to OrganizationType
ALTER TYPE "OrganizationType" ADD VALUE 'TRUCKING';

-- AlterTable: Add missing columns to listings
ALTER TABLE "listings" ADD COLUMN "bale_type" TEXT;
ALTER TABLE "listings" ADD COLUMN "firm_price" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "is_delivered_price" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN "trucking_coordinated_by" TEXT;

-- AlterTable: Add missing columns to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN "center" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "hay_class" TEXT;

-- AlterTable: Add missing column to trucking_companies
ALTER TABLE "trucking_companies" ADD COLUMN "organization_id" TEXT;

-- CreateTable: invites
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "type" TEXT NOT NULL,
    "organization_id" TEXT,
    "invited_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex (trucking_companies unique org)
CREATE UNIQUE INDEX "trucking_companies_organization_id_key" ON "trucking_companies"("organization_id");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trucking_companies" ADD CONSTRAINT "trucking_companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
