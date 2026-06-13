CREATE TABLE "ShopWorkingPeriod" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,

  CONSTRAINT "ShopWorkingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShopWorkingPeriod_shopId_dayOfWeek_idx" ON "ShopWorkingPeriod"("shopId", "dayOfWeek");

ALTER TABLE "ShopWorkingPeriod"
ADD CONSTRAINT "ShopWorkingPeriod_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "Shop"
SET
  "logoUrl" = '/barbers/salut.logo.png',
  "primaryColor" = '#0f4f49',
  "bookingSubtitle" = 'SALUT SALAMINA - Κλείσε την υπηρεσία που σου ταιριάζει.'
WHERE "slug" = 'salut';

DELETE FROM "Barber"
WHERE "shopId" = 'shop_salut'
  AND "name" IN ('Antonis M', 'Daniel M', 'Αλέξανδρος Κ');

INSERT INTO "Barber" ("id", "shopId", "name", "image")
VALUES
  ('barber_salut_antonis_m', 'shop_salut', 'Antonis M', NULL),
  ('barber_salut_daniel_m', 'shop_salut', 'Daniel M', NULL),
  ('barber_salut_alexandros_k', 'shop_salut', 'Αλέξανδρος Κ', NULL)
ON CONFLICT ("shopId", "name") DO NOTHING;

DELETE FROM "Service"
WHERE "shopId" = 'shop_salut';

INSERT INTO "Service" ("id", "shopId", "name", "duration", "price")
VALUES
  ('service_salut_mens_cut', 'shop_salut', 'Ανδρικό Κούρεμα', 30, 16),
  ('service_salut_mens_long', 'shop_salut', 'Ανδρικό Μακρύ', 45, 20),
  ('service_salut_womens_cut', 'shop_salut', 'Γυναικείο Κούρεμα', 45, 20),
  ('service_salut_kids_cut', 'shop_salut', 'Παιδικό Κούρεμα', 30, 12),
  ('service_salut_beard_care', 'shop_salut', 'Περιποίηση Γενειάδας', 15, 10),
  ('service_salut_reconstruction', 'shop_salut', 'Θεραπεία Αναδόμησης', 15, 10),
  ('service_salut_hydration', 'shop_salut', 'Θεραπεία Ενυδάτωσης', 15, 10),
  ('service_salut_smoothing', 'shop_salut', 'Θεραπεία Λείανσης', 30, 20),
  ('service_salut_men_combo_smoothing', 'shop_salut', 'Άνδρες: Κούρεμα, Trimming & Θεραπεία Λείανσης', 75, 38),
  ('service_salut_women_combo_treatment', 'shop_salut', 'Γυναίκες: Κούρεμα, Θεραπεία Αναδόμησης ή Ενυδάτωσης', 60, 25);

DELETE FROM "ShopWorkingPeriod"
WHERE "shopId" IN ('shop_twins_bros', 'shop_salut');

-- JavaScript dayOfWeek values: Sunday=0, Monday=1, Tuesday=2, Wednesday=3,
-- Thursday=4, Friday=5, Saturday=6.
INSERT INTO "ShopWorkingPeriod" ("id", "shopId", "dayOfWeek", "startTime", "endTime")
VALUES
  ('wp_twins_tue', 'shop_twins_bros', 2, '09:00', '21:00'),
  ('wp_twins_wed', 'shop_twins_bros', 3, '09:00', '21:00'),
  ('wp_twins_thu', 'shop_twins_bros', 4, '09:00', '21:00'),
  ('wp_twins_fri', 'shop_twins_bros', 5, '09:00', '21:00'),
  ('wp_twins_sat', 'shop_twins_bros', 6, '09:00', '21:00'),
  ('wp_salut_tue', 'shop_salut', 2, '11:00', '19:00'),
  ('wp_salut_wed_morning', 'shop_salut', 3, '09:30', '13:00'),
  ('wp_salut_wed_evening', 'shop_salut', 3, '17:30', '21:00');
