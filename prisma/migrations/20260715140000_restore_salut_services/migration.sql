-- Preserve the existing service row (and any bookings that reference it) while
-- restoring the canonical name, duration, and price from Salut's service list.
UPDATE "Service"
SET
  "name" = 'Ανδρικό Κούρεμα',
  "duration" = 30,
  "price" = 16
WHERE "shopId" = (SELECT "id" FROM "Shop" WHERE "slug" = 'salut')
  AND "name" = 'Ανδρικό κούρεμα'
  AND NOT EXISTS (
    SELECT 1
    FROM "Service" existing
    WHERE existing."shopId" = (SELECT "id" FROM "Shop" WHERE "slug" = 'salut')
      AND existing."name" = 'Ανδρικό Κούρεμα'
  );

INSERT INTO "Service" ("id", "shopId", "name", "duration", "price")
SELECT service_data."id", shop."id", service_data."name", service_data."duration", service_data."price"
FROM "Shop" shop
CROSS JOIN (
  VALUES
    ('service_salut_mens_cut', 'Ανδρικό Κούρεμα', 30, 16),
    ('service_salut_mens_long', 'Ανδρικό Μακρύ', 45, 20),
    ('service_salut_womens_cut', 'Γυναικείο Κούρεμα', 45, 20),
    ('service_salut_kids_cut', 'Παιδικό Κούρεμα', 30, 12),
    ('service_salut_beard_care', 'Περιποίηση Γενειάδας', 15, 10),
    ('service_salut_reconstruction', 'Θεραπεία Αναδόμησης', 15, 10),
    ('service_salut_hydration', 'Θεραπεία Ενυδάτωσης', 15, 10),
    ('service_salut_smoothing', 'Θεραπεία Λείανσης', 30, 20),
    ('service_salut_men_combo_smoothing', 'Άνδρες: Κούρεμα, Trimming & Θεραπεία Λείανσης', 75, 38),
    ('service_salut_women_combo_treatment', 'Γυναίκες: Κούρεμα, Θεραπεία Αναδόμησης ή Ενυδάτωσης', 60, 25)
) AS service_data("id", "name", "duration", "price")
WHERE shop."slug" = 'salut'
ON CONFLICT ("shopId", "name") DO UPDATE
SET
  "duration" = EXCLUDED."duration",
  "price" = EXCLUDED."price";
