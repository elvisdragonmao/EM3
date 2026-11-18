-- Available assignments and quizzes are tracked by course module ID per account.
ALTER TABLE notify_settings ADD COLUMN new_activities INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notify_settings ADD COLUMN activity_snapshot TEXT;
