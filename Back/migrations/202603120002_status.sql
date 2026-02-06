ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offline';

UPDATE users
SET status = 'offline'
WHERE status IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_users_status'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_status
            CHECK (status IN ('online', 'offline', 'dnd'));
    END IF;
END $$;
