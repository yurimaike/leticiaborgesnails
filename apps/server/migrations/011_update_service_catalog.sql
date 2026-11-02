-- Update the active service catalogue without deleting legacy booking history or old price rows.
INSERT OR IGNORE INTO service_prices (serviceName, priceCents) VALUES
  ('Esmaltação em gel', NULL),
  ('Pés tradicional', NULL),
  ('Mãos tradicional', NULL),
  ('Manutenção', NULL);
