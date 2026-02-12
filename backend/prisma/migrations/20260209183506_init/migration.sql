-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('BUYER', 'GROWER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARM_ADMIN', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoadStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXCEPTION', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ScaleConnectionType" AS ENUM ('MANUAL', 'WEBSOCKET', 'BLUETOOTH', 'API', 'SERIAL');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "ach_routing_number" TEXT,
    "ach_account_number" TEXT,
    "tax_id" TEXT,
    "invoice_email" TEXT,
    "billing_contact_name" TEXT,
    "billing_contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "organization_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_by" TEXT,
    "last_login" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_sites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "site_code" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scale_location_id" TEXT,
    "default_feed_pad_id" TEXT,
    "satellite_image_url" TEXT,
    "site_map_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale_locations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scale_model" TEXT,
    "scale_serial_number" TEXT,
    "connection_type" "ScaleConnectionType" NOT NULL,
    "connection_endpoint" TEXT,
    "weight_unit" TEXT NOT NULL DEFAULT 'lbs',
    "tare_auto_capture" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_reading_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scale_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale_readings" (
    "id" TEXT NOT NULL,
    "scale_location_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "stable" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scale_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "buyer_site_id" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "capacity_tons" DOUBLE PRECISION,
    "current_tons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "satellite_image_url" TEXT,
    "driving_instructions" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "max_capacity_percent" DOUBLE PRECISION NOT NULL DEFAULT 95.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_pads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "satellite_image_url" TEXT,
    "driving_instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_pads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_locations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "farm_location_id" TEXT NOT NULL,
    "stack_id" TEXT NOT NULL,
    "product_type" TEXT,
    "price_per_ton" DOUBLE PRECISION NOT NULL,
    "estimated_tons" DOUBLE PRECISION,
    "bale_count" INTEGER,
    "moisture_percent" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_photos" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_documents" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "document_type" TEXT,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "buyer_org_id" TEXT NOT NULL,
    "grower_org_id" TEXT NOT NULL,
    "destination_site_id" TEXT,
    "contracted_tons" DOUBLE PRECISION NOT NULL,
    "price_per_ton" DOUBLE PRECISION NOT NULL,
    "delivery_start_date" TIMESTAMP(3),
    "delivery_end_date" TIMESTAMP(3),
    "max_moisture_percent" DOUBLE PRECISION,
    "quality_notes" TEXT,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "delivered_tons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contract_file_url" TEXT,
    "signed_by_buyer_id" TEXT,
    "signed_by_grower_id" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_stacks" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "allocated_tons" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_stacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trucking_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trucking_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "trucking_company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "license_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_delivery" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loads" (
    "id" TEXT NOT NULL,
    "load_number" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "trucking_company_id" TEXT,
    "driver_id" TEXT,
    "truck_id" TEXT,
    "gross_weight" DOUBLE PRECISION,
    "tare_weight" DOUBLE PRECISION,
    "gross_weight_timestamp" TIMESTAMP(3),
    "tare_weight_timestamp" TIMESTAMP(3),
    "gross_weight_stable" BOOLEAN NOT NULL DEFAULT false,
    "tare_weight_stable" BOOLEAN NOT NULL DEFAULT false,
    "scale_location_id" TEXT,
    "manual_weight_entry" BOOLEAN NOT NULL DEFAULT false,
    "manual_entry_reason" TEXT,
    "delivery_datetime" TIMESTAMP(3) NOT NULL,
    "total_bale_count" INTEGER,
    "wet_bales_count" INTEGER NOT NULL DEFAULT 0,
    "moisture_percent" DOUBLE PRECISION,
    "quality_notes" TEXT,
    "barn_id" TEXT,
    "feed_pad_id" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "feed_pad_redirect" BOOLEAN NOT NULL DEFAULT false,
    "status" "LoadStatus" NOT NULL DEFAULT 'PENDING',
    "exception_reason" TEXT,
    "exception_resolved_by" TEXT,
    "exception_resolved_at" TIMESTAMP(3),
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_edits" (
    "id" TEXT NOT NULL,
    "load_id" TEXT NOT NULL,
    "edited_by" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "edit_reason" TEXT,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "load_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "barn_id" TEXT NOT NULL,
    "load_id" TEXT,
    "po_id" TEXT,
    "transaction_type" TEXT NOT NULL,
    "tons" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "grower_org_id" TEXT NOT NULL,
    "buyer_org_id" TEXT NOT NULL,
    "total_tons" DOUBLE PRECISION NOT NULL,
    "price_per_ton" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "ach_trace_number" TEXT,
    "ach_transaction_date" TIMESTAMP(3),
    "auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "sent_to_email" TEXT,
    "sent_at" TIMESTAMP(3),
    "email_delivery_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "load_id" TEXT,
    "dispute_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposed_resolution" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "raised_by" TEXT NOT NULL,
    "buyer_admin_id" TEXT,
    "grower_admin_id" TEXT,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_sites_site_code_key" ON "buyer_sites"("site_code");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_sites_organization_id_site_name_key" ON "buyer_sites"("organization_id", "site_name");

-- CreateIndex
CREATE INDEX "scale_readings_scale_location_id_timestamp_idx" ON "scale_readings"("scale_location_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "listings_stack_id_key" ON "listings"("stack_id");

-- CreateIndex
CREATE INDEX "listings_organization_id_status_idx" ON "listings"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_buyer_org_id_status_idx" ON "purchase_orders"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_grower_org_id_status_idx" ON "purchase_orders"("grower_org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "po_stacks_po_id_listing_id_key" ON "po_stacks"("po_id", "listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "trucking_companies_name_key" ON "trucking_companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_trucking_company_id_name_key" ON "drivers"("trucking_company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "loads_load_number_key" ON "loads"("load_number");

-- CreateIndex
CREATE INDEX "loads_po_id_delivery_datetime_idx" ON "loads"("po_id", "delivery_datetime");

-- CreateIndex
CREATE INDEX "loads_scale_location_id_delivery_datetime_idx" ON "loads"("scale_location_id", "delivery_datetime");

-- CreateIndex
CREATE INDEX "load_edits_load_id_idx" ON "load_edits"("load_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_barn_id_created_at_idx" ON "inventory_transactions"("barn_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_buyer_org_id_payment_status_idx" ON "invoices"("buyer_org_id", "payment_status");

-- CreateIndex
CREATE INDEX "invoices_grower_org_id_payment_status_idx" ON "invoices"("grower_org_id", "payment_status");

-- CreateIndex
CREATE INDEX "disputes_po_id_status_idx" ON "disputes"("po_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_sites" ADD CONSTRAINT "buyer_sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_sites" ADD CONSTRAINT "buyer_sites_scale_location_id_fkey" FOREIGN KEY ("scale_location_id") REFERENCES "scale_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_sites" ADD CONSTRAINT "buyer_sites_default_feed_pad_id_fkey" FOREIGN KEY ("default_feed_pad_id") REFERENCES "feed_pads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_readings" ADD CONSTRAINT "scale_readings_scale_location_id_fkey" FOREIGN KEY ("scale_location_id") REFERENCES "scale_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barns" ADD CONSTRAINT "barns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barns" ADD CONSTRAINT "barns_buyer_site_id_fkey" FOREIGN KEY ("buyer_site_id") REFERENCES "buyer_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_pads" ADD CONSTRAINT "feed_pads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_locations" ADD CONSTRAINT "farm_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_farm_location_id_fkey" FOREIGN KEY ("farm_location_id") REFERENCES "farm_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_documents" ADD CONSTRAINT "listing_documents_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_grower_org_id_fkey" FOREIGN KEY ("grower_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_destination_site_id_fkey" FOREIGN KEY ("destination_site_id") REFERENCES "buyer_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_signed_by_buyer_id_fkey" FOREIGN KEY ("signed_by_buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_signed_by_grower_id_fkey" FOREIGN KEY ("signed_by_grower_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_stacks" ADD CONSTRAINT "po_stacks_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_stacks" ADD CONSTRAINT "po_stacks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_trucking_company_id_fkey" FOREIGN KEY ("trucking_company_id") REFERENCES "trucking_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_trucking_company_id_fkey" FOREIGN KEY ("trucking_company_id") REFERENCES "trucking_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_scale_location_id_fkey" FOREIGN KEY ("scale_location_id") REFERENCES "scale_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "barns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_feed_pad_id_fkey" FOREIGN KEY ("feed_pad_id") REFERENCES "feed_pads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_exception_resolved_by_fkey" FOREIGN KEY ("exception_resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_edits" ADD CONSTRAINT "load_edits_load_id_fkey" FOREIGN KEY ("load_id") REFERENCES "loads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_edits" ADD CONSTRAINT "load_edits_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "barns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_load_id_fkey" FOREIGN KEY ("load_id") REFERENCES "loads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_grower_org_id_fkey" FOREIGN KEY ("grower_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_load_id_fkey" FOREIGN KEY ("load_id") REFERENCES "loads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_buyer_admin_id_fkey" FOREIGN KEY ("buyer_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_grower_admin_id_fkey" FOREIGN KEY ("grower_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
