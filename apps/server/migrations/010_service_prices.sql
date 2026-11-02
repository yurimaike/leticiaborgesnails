CREATE TABLE IF NOT EXISTS service_prices (
  serviceName TEXT PRIMARY KEY,
  priceCents INTEGER CHECK (priceCents IS NULL OR priceCents >= 100),
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO service_prices (serviceName, priceCents) VALUES
  ('Manicure e pedicure', NULL),
  ('Esmaltação em gel', NULL),
  ('Banho de gel', NULL),
  ('Manutenção', NULL);
