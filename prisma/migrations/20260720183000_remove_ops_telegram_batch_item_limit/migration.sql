ALTER TABLE "OpsTelegramBatch"
  DROP CONSTRAINT IF EXISTS "OpsTelegramBatch_itemCount_check";

ALTER TABLE "OpsTelegramBatch"
  ADD CONSTRAINT "OpsTelegramBatch_itemCount_check"
  CHECK ("itemCount" >= 0);

ALTER TABLE "OpsTelegramBatchItem"
  DROP CONSTRAINT IF EXISTS "OpsTelegramBatchItem_ordinal_check";

ALTER TABLE "OpsTelegramBatchItem"
  ADD CONSTRAINT "OpsTelegramBatchItem_ordinal_check"
  CHECK ("ordinal" >= 1);
