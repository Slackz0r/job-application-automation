CREATE TABLE opportunity_evaluations (
    opportunity_id INTEGER PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode = 'simulated'),
    result_json TEXT NOT NULL CHECK (json_valid(result_json)),
    evaluated_at TEXT NOT NULL CHECK (length(trim(evaluated_at)) > 0)
);
