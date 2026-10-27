CREATE TABLE application_drafts (
    opportunity_id INTEGER PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
    question TEXT NOT NULL CHECK (length(trim(question)) > 0),
    text TEXT NOT NULL CHECK (length(trim(text)) > 0),
    model TEXT,
    revision INTEGER NOT NULL CHECK (revision > 0),
    saved_at TEXT NOT NULL
);
