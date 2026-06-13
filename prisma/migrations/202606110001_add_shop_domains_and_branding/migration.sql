ALTER TABLE "Shop"
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#800020',
ADD COLUMN "bookingSubtitle" TEXT;

CREATE TABLE "ShopDomain" (
  "id" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShopDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopDomain_hostname_key" ON "ShopDomain"("hostname");
CREATE INDEX "ShopDomain_shopId_idx" ON "ShopDomain"("shopId");

ALTER TABLE "ShopDomain"
ADD CONSTRAINT "ShopDomain_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "Shop"
SET
  "logoUrl" = '/logo.webp',
  "primaryColor" = '#800020',
  "bookingSubtitle" = 'Καθαρή επιλογή, ακριβής διάρκεια, premium αποτέλεσμα.'
WHERE "slug" = 'twins-bros';

UPDATE "Shop"
SET
  "logoUrl" = '/logo.webp',
  "primaryColor" = '#0f766e',
  "bookingSubtitle" = 'Κλείσε το ραντεβού σου στο SALUT.'
WHERE "slug" = 'salut';

INSERT INTO "ShopDomain" ("id", "hostname", "shopId")
SELECT 'domain_twinsbros_gr', 'twinsbros.gr', "id"
FROM "Shop"
WHERE "slug" = 'twins-bros'
ON CONFLICT ("hostname") DO NOTHING;

INSERT INTO "ShopDomain" ("id", "hostname", "shopId")
SELECT 'domain_www_twinsbros_gr', 'www.twinsbros.gr', "id"
FROM "Shop"
WHERE "slug" = 'twins-bros'
ON CONFLICT ("hostname") DO NOTHING;

INSERT INTO "ShopDomain" ("id", "hostname", "shopId")
SELECT 'domain_salut_gr', 'salut.gr', "id"
FROM "Shop"
WHERE "slug" = 'salut'
ON CONFLICT ("hostname") DO NOTHING;

INSERT INTO "ShopDomain" ("id", "hostname", "shopId")
SELECT 'domain_www_salut_gr', 'www.salut.gr', "id"
FROM "Shop"
WHERE "slug" = 'salut'
ON CONFLICT ("hostname") DO NOTHING;
