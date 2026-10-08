-- lizlenjo.com: initial schema
-- Times are stored as ISO-8601 UTC strings (e.g. 2026-10-08T09:00:00Z).

CREATE TABLE series (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL DEFAULT '',
  excerpt       TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'Copyright',
  tags          TEXT NOT NULL DEFAULT '[]',        -- JSON array of strings
  body_json     TEXT NOT NULL DEFAULT '{"type":"doc","content":[]}', -- TipTap JSON
  body_text     TEXT NOT NULL DEFAULT '',          -- plain text, for search and read time
  word_count    INTEGER NOT NULL DEFAULT 0,
  cover_key     TEXT,                              -- R2 object key
  cover_alt     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  publish_at    TEXT,                              -- when a scheduled post goes live
  published_at  TEXT,                              -- when it actually went live
  series_id     INTEGER REFERENCES series(id) ON DELETE SET NULL,
  series_order  INTEGER,
  is_sample     INTEGER NOT NULL DEFAULT 0,        -- 1 = seeded prototype content
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX posts_status_idx ON posts (status, published_at);
CREATE INDEX posts_publish_at_idx ON posts (status, publish_at);
CREATE INDEX posts_series_idx ON posts (series_id, series_order);

CREATE TABLE post_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  excerpt    TEXT NOT NULL DEFAULT '',
  body_json  TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  kind       TEXT NOT NULL DEFAULT 'autosave' CHECK (kind IN ('autosave', 'published')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX post_versions_post_idx ON post_versions (post_id, created_at DESC);

CREATE TABLE comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  spam_score  REAL NOT NULL DEFAULT 0,
  spam_reason TEXT NOT NULL DEFAULT '',
  ip_hash     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX comments_post_idx ON comments (post_id, status, created_at);
CREATE INDEX comments_queue_idx ON comments (status, spam_score DESC);

CREATE TABLE subscribers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  confirmed      INTEGER NOT NULL DEFAULT 0,
  token          TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'site',     -- 'home', 'notes', 'post'
  source_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  confirmed_at   TEXT
);

CREATE TABLE enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ref        TEXT NOT NULL UNIQUE,                 -- LL-2026-0123
  type       TEXT NOT NULL,                        -- Keynote | Panel | Moderation | Advisory
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  event      TEXT NOT NULL DEFAULT '',
  emailed    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE post_stats_daily (
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                       -- YYYY-MM-DD (Africa/Nairobi)
  reads       INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  signups     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, date)
);

CREATE TABLE photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key     TEXT NOT NULL UNIQUE,                 -- R2 key, or "static/<file>" for photos built into the site
  caption    TEXT NOT NULL DEFAULT '',
  alt        TEXT NOT NULL DEFAULT '',
  collection TEXT NOT NULL DEFAULT 'Editorial' CHECK (collection IN ('Advocate', 'Lecturer', 'Fashion', 'Editorial')),
  sort       INTEGER NOT NULL DEFAULT 0,
  width      INTEGER NOT NULL DEFAULT 0,
  height     INTEGER NOT NULL DEFAULT 0,
  object_position TEXT NOT NULL DEFAULT '50% 30%',
  published  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX photos_sort_idx ON photos (published, sort);

-- Stage 3 (School): schema reserved only. Not used by this build.
CREATE TABLE courses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',
  price_kes   INTEGER,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE TABLE modules (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE lessons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id  INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  youtube_id TEXT,
  body_json  TEXT,
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE enrolments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (course_id, email)
);
CREATE TABLE progress (
  enrolment_id INTEGER NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (enrolment_id, lesson_id)
);
