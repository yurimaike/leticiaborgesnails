ALTER TABLE bookings ADD COLUMN paymentAmountCents INTEGER CHECK (paymentAmountCents IS NULL OR paymentAmountCents > 0);
