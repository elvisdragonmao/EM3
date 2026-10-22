-- TA collaboration (worker/grading). Grader ids in grading_allocations, grading_locks and
-- grading_drafts are Moodle user ids, since graders don't need to be EM3 users.

-- Whether an EM3 user can grade in a course, checked with their own token and kept for
-- a few minutes so heartbeats don't call Moodle every time.
CREATE TABLE grading_access (
	user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	course_id INTEGER NOT NULL,
	can_grade INTEGER NOT NULL,
	-- JSON {assignment instance id: max grade} for the course, so routes can check that an
	-- assignment belongs to it and drafts stay in range.
	assignments TEXT NOT NULL DEFAULT '{}',
	checked_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, course_id)
);

-- Failed releases are retried a few times; a release stuck in "running" (the Worker died
-- mid-write) is picked up again after a while.
ALTER TABLE grading_releases ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE grading_releases ADD COLUMN claimed_at INTEGER;
ALTER TABLE grading_releases ADD COLUMN owner_name TEXT NOT NULL DEFAULT '';
ALTER TABLE grading_releases ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX grading_releases_due ON grading_releases (status, release_at);

CREATE INDEX grading_locks_expiry ON grading_locks (expires_at);
