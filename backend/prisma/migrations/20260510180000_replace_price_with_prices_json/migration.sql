-- Replace single price with per-vehicle-type JSON prices on services.
-- resolvedPrice on appointments is nullable so existing rows are unaffected.

-- 1. Drop old scalar price column
ALTER TABLE "services" DROP COLUMN "price";

-- 2. Add prices JSON column; use a temporary default so existing rows survive.
--    The Joi schema enforces that all three keys are present on the API level.
ALTER TABLE "services" ADD COLUMN "prices" JSONB NOT NULL DEFAULT '{"sedan":0,"suv":0,"van":0}';
ALTER TABLE "services" ALTER COLUMN "prices" DROP DEFAULT;

-- 3. Add resolved_price to appointments (nullable — existing appointments have no resolved price)
ALTER TABLE "appointments" ADD COLUMN "resolved_price" DECIMAL(10,2);
