CREATE TABLE opportunities (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL CHECK (length(trim(source)) > 0),
    source_id TEXT NOT NULL CHECK (length(trim(source_id)) > 0),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    company TEXT,
    description TEXT,
    url TEXT NOT NULL CHECK (length(trim(url)) > 0),
    application_deadline TEXT,
    discovered_at TEXT NOT NULL CHECK (length(trim(discovered_at)) > 0),
    published_at TEXT,

    UNIQUE (source, source_id)
);