-- EM3 server: one row per (school, Moodle user). Every other table hangs off users.id
-- and is deleted with it (DELETE /api/account), so ON DELETE CASCADE everywhere.

CREATE TABLE users (
	id INTEGER PRIMARY KEY,
	site TEXT NOT NULL,
	moodle_userid INTEGER NOT NULL,
	fullname TEXT NOT NULL,
	-- AES-GCM sealed Moodle token (worker/crypto.ts).
	token TEXT NOT NULL,
	-- 0 once Moodle answered invalidtoken; background jobs skip the user until the next sign-in.
	token_ok INTEGER NOT NULL DEFAULT 1,
	-- UI locale for notifications: zh-TW, en, ja or emoji.
	locale TEXT NOT NULL DEFAULT 'zh-TW',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	UNIQUE (site, moodle_userid)
);

CREATE TABLE sessions (
	-- SHA-256 of the em3_server cookie; the cookie itself is never stored.
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE prefs (
	user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	data TEXT NOT NULL,
	-- Client clock (ms) of the change; the newer side wins.
	updated_at INTEGER NOT NULL
);

CREATE TABLE notify_settings (
	user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	enabled INTEGER NOT NULL DEFAULT 0,
	-- JSON array of hours before a deadline, e.g. [24, 3].
	lead_hours TEXT NOT NULL DEFAULT '[24,3]',
	-- Student deadlines (submit) and teacher/TA grading reminders.
	deadlines INTEGER NOT NULL DEFAULT 1,
	grading INTEGER NOT NULL DEFAULT 1,
	-- Sealed Discord webhook URL, or NULL.
	discord_webhook TEXT,
	updated_at INTEGER NOT NULL
);

CREATE TABLE push_subscriptions (
	id INTEGER PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	endpoint TEXT NOT NULL UNIQUE,
	p256dh TEXT NOT NULL,
	auth TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX push_user ON push_subscriptions (user_id);

-- One row per notification already sent, so each event × lead time goes out once.
CREATE TABLE sent_notifications (
	user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	key TEXT NOT NULL,
	sent_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, key)
);

-- TA collaboration. Rows are keyed by school and Moodle ids, not by EM3 user, because
-- several graders share them; author columns point at the EM3 user who wrote them.

-- Which grader takes which student, per course.
CREATE TABLE grading_allocations (
	site TEXT NOT NULL,
	course_id INTEGER NOT NULL,
	student_id INTEGER NOT NULL,
	grader_id INTEGER NOT NULL,
	grader_name TEXT NOT NULL,
	updated_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (site, course_id, student_id)
);

-- "Someone is grading this student right now"; expires without a heartbeat.
CREATE TABLE grading_locks (
	site TEXT NOT NULL,
	assign_id INTEGER NOT NULL,
	student_id INTEGER NOT NULL,
	grader_id INTEGER NOT NULL,
	grader_name TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	PRIMARY KEY (site, assign_id, student_id)
);

-- Scheduled grade release for one assignment.
CREATE TABLE grading_releases (
	site TEXT NOT NULL,
	assign_id INTEGER NOT NULL,
	course_id INTEGER NOT NULL,
	-- The EM3 user whose token writes the grades at release time.
	owner_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	release_at INTEGER NOT NULL,
	notify_students INTEGER NOT NULL DEFAULT 1,
	-- scheduled, released, failed, cancelled
	status TEXT NOT NULL DEFAULT 'scheduled',
	error TEXT,
	released_at INTEGER,
	PRIMARY KEY (site, assign_id)
);

-- Grades held back until the release.
CREATE TABLE grading_drafts (
	site TEXT NOT NULL,
	assign_id INTEGER NOT NULL,
	student_id INTEGER NOT NULL,
	grade REAL,
	feedback TEXT,
	grader_id INTEGER NOT NULL,
	grader_name TEXT NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (site, assign_id, student_id)
);

-- Cached syllabus times from NYCU's timetable system (public data).
CREATE TABLE nycu_schedules (
	-- "115-1-515516"
	course_key TEXT PRIMARY KEY,
	cos_time TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
