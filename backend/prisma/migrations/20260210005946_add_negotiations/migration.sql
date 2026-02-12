-- CreateTable
CREATE TABLE "negotiations" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "buyer_org_id" TEXT NOT NULL,
    "grower_org_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "offered_price_per_ton" DOUBLE PRECISION NOT NULL,
    "offered_tons" DOUBLE PRECISION,
    "message" TEXT,
    "offered_by_org_id" TEXT NOT NULL,
    "offered_by_user_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "negotiations_listing_id_status_idx" ON "negotiations"("listing_id", "status");

-- CreateIndex
CREATE INDEX "negotiations_buyer_org_id_idx" ON "negotiations"("buyer_org_id");

-- CreateIndex
CREATE INDEX "negotiations_grower_org_id_idx" ON "negotiations"("grower_org_id");

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_grower_org_id_fkey" FOREIGN KEY ("grower_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_offered_by_user_id_fkey" FOREIGN KEY ("offered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "negotiations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
