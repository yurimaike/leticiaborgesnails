-- Add the schema fields required by Better Auth's restricted admin plugin.
-- Existing users remain unbanned and existing sessions remain unchanged.
ALTER TABLE user
  ADD COLUMN banned INTEGER NOT NULL DEFAULT 0
  CHECK (banned IN (0, 1));

ALTER TABLE user ADD COLUMN banReason TEXT;
ALTER TABLE user ADD COLUMN banExpires INTEGER;
ALTER TABLE session ADD COLUMN impersonatedBy TEXT;
