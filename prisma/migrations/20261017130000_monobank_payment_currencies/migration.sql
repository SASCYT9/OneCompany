-- plata by mono invoices may now be issued in EUR (978) and USD (840) as well as
-- UAH (980). Widening only: every existing row (980) stays valid.
ALTER TABLE "ShopMonobankPayment" DROP CONSTRAINT "ShopMonobankPayment_amount_check";
ALTER TABLE "ShopMonobankPayment" ADD CONSTRAINT "ShopMonobankPayment_amount_check"
    CHECK ("amount" > 0 AND "ccy" IN (980, 978, 840));
