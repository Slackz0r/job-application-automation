CREATE TABLE opportunity_evaluations_next (
    opportunity_id INTEGER PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('simulated', 'live')),
    model TEXT,
    result_json TEXT NOT NULL CHECK (json_valid(result_json)),
    evaluated_at TEXT NOT NULL CHECK (length(trim(evaluated_at)) > 0),
    CHECK ((mode = 'simulated' AND model IS NULL)
        OR (mode = 'live' AND model IS NOT NULL AND length(trim(model)) > 0))
);

INSERT INTO opportunity_evaluations_next (opportunity_id, mode, model, result_json, evaluated_at)
SELECT opportunity_id, mode, NULL, result_json, evaluated_at FROM opportunity_evaluations;

DROP TABLE opportunity_evaluations;
ALTER TABLE opportunity_evaluations_next RENAME TO opportunity_evaluations;
