CREATE TABLE opportunity_tracking (
    opportunity_id INTEGER PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('to_review', 'interested', 'applied', 'interview', 'offer', 'closed', 'skipped')),
    applied_on TEXT,
    notes TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL CHECK (revision > 0),
    updated_at TEXT NOT NULL
);

CREATE TABLE opportunity_status_history (
    id INTEGER PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL CHECK (from_status IN ('to_review', 'interested', 'applied', 'interview', 'offer', 'closed', 'skipped')),
    to_status TEXT NOT NULL CHECK (to_status IN ('to_review', 'interested', 'applied', 'interview', 'offer', 'closed', 'skipped')),
    changed_at TEXT NOT NULL,
    tracking_revision INTEGER NOT NULL,
    CHECK (from_status <> to_status),
    UNIQUE (opportunity_id, tracking_revision)
);

CREATE INDEX opportunity_status_history_opportunity ON opportunity_status_history(opportunity_id, id DESC);
CREATE INDEX opportunity_tracking_status ON opportunity_tracking(status, updated_at DESC);
