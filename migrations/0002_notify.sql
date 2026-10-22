-- Reminders: the cron checks the users it saw longest ago first, so a run that can't
-- reach everyone spreads the work over the next runs instead of starving anyone.
ALTER TABLE notify_settings ADD COLUMN checked_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX notify_due ON notify_settings (enabled, checked_at);

-- Rows older than 30 days are cleaned up on every run.
CREATE INDEX sent_notifications_at ON sent_notifications (sent_at);
