-- Add a first-login password-change flag to Better Auth users.
-- Existing users remain unaffected (0); newly provisioned accounts can be
-- marked with 1 by the administrator provisioning flow.
ALTER TABLE user
  ADD COLUMN mustChangePassword INTEGER NOT NULL DEFAULT 0
  CHECK (mustChangePassword IN (0, 1));
