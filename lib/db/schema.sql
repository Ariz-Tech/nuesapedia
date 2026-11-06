-- NUESApedia Canonical PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL,
  avatar TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(60) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(255) PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits (reset_at);

CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  course_code VARCHAR(50) NOT NULL,
  department VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL,
  semester VARCHAR(50) NOT NULL DEFAULT 'First Semester',
  session_year VARCHAR(20) DEFAULT '2025/2026',
  type VARCHAR(100) NOT NULL,
  medium VARCHAR(50) NOT NULL DEFAULT 'PDF',
  description TEXT,
  file_url TEXT,
  file_name VARCHAR(255),
  file_size VARCHAR(50),
  file_size_bytes BIGINT,
  r2_key TEXT,
  cloudinary_public_id VARCHAR(255),
  youtube_url TEXT,
  youtube_video_id VARCHAR(50),
  thumbnail_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255),
  reviewed_by_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS r2_key TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS session_year VARCHAR(20) DEFAULT '2025/2026';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS downloads INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_by_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_dept_lower ON submissions(LOWER(department));
CREATE INDEX IF NOT EXISTS idx_submissions_course_lower ON submissions(LOWER(course_code));
CREATE INDEX IF NOT EXISTS idx_submissions_level ON submissions(level);
CREATE INDEX IF NOT EXISTS idx_submissions_fts ON submissions USING GIN (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(course_code, '') || ' ' || coalesce(description, ''))
);

CREATE TABLE IF NOT EXISTS saved_resources (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id VARCHAR(50) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  course_code VARCHAR(50) NOT NULL,
  department VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  file_size VARCHAR(50) NOT NULL DEFAULT 'PDF Document',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_resource ON saved_resources(resource_id);

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id VARCHAR(50) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  percentage INTEGER NOT NULL DEFAULT 0,
  page INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_resource ON reading_progress(resource_id);

CREATE TABLE IF NOT EXISTS material_requests (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
  requester_name VARCHAR(255) NOT NULL,
  course_code VARCHAR(50) NOT NULL,
  department VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL,
  type VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requests_status_created ON material_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS resource_reports (
  id VARCHAR(50) PRIMARY KEY,
  resource_id VARCHAR(50) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  resource_title VARCHAR(255) NOT NULL,
  course_code VARCHAR(50) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  details TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON resource_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_resource ON resource_reports(resource_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saved_resources_submission'
  ) THEN
    ALTER TABLE saved_resources
      ADD CONSTRAINT fk_saved_resources_submission
      FOREIGN KEY (resource_id) REFERENCES submissions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reading_progress_submission'
  ) THEN
    ALTER TABLE reading_progress
      ADD CONSTRAINT fk_reading_progress_submission
      FOREIGN KEY (resource_id) REFERENCES submissions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resource_reports_submission'
  ) THEN
    ALTER TABLE resource_reports
      ADD CONSTRAINT fk_resource_reports_submission
      FOREIGN KEY (resource_id) REFERENCES submissions(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore constraint creation errors if existing dirty data is being cleaned
    NULL;
END $$;

