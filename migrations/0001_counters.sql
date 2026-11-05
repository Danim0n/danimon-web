CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL CHECK(day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  page TEXT NOT NULL,
  language TEXT NOT NULL CHECK(language IN ('en','es')),
  counter TEXT NOT NULL,
  project TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 1 CHECK(total >= 1),
  PRIMARY KEY(day, page, language, counter, project)
) WITHOUT ROWID;
