import "server-only";

import type Database from "better-sqlite3";
import { z } from "zod";
import {
  evaluationResultSchema,
  savedEvaluationSchema,
  type EvaluationMap,
  type SavedEvaluation,
} from "../schemas/opportunity-evaluation.ts";

const opportunityIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const columns = "opportunity_id AS opportunityId, mode, model, result_json AS resultJson, evaluated_at AS evaluatedAt";
type EvaluationRow = { opportunityId: number; mode: string; model: string | null; resultJson: string; evaluatedAt: string };

function readEvaluation(row: EvaluationRow): SavedEvaluation {
  return savedEvaluationSchema.parse({
    opportunityId: row.opportunityId,
    mode: row.mode,
    model: row.model,
    result: JSON.parse(row.resultJson),
    evaluatedAt: row.evaluatedAt,
  });
}

export function getEvaluation(db: Database.Database, opportunityId: number): SavedEvaluation | null {
  opportunityIdSchema.parse(opportunityId);
  const row = db.prepare<[number], EvaluationRow>(`
    SELECT ${columns} FROM opportunity_evaluations WHERE opportunity_id = ?
  `).get(opportunityId);
  return row ? readEvaluation(row) : null;
}

export function getEvaluations(db: Database.Database, opportunityIds: number[]): EvaluationMap {
  z.array(opportunityIdSchema).max(100).parse(opportunityIds);
  if (opportunityIds.length === 0) return {};
  const placeholders = opportunityIds.map(() => "?").join(", ");
  const rows = db.prepare<number[], EvaluationRow>(`
    SELECT ${columns} FROM opportunity_evaluations WHERE opportunity_id IN (${placeholders})
  `).all(...opportunityIds);
  return Object.fromEntries(rows.map((row) => [row.opportunityId, readEvaluation(row)]));
}

export function saveEvaluation(
  db: Database.Database,
  opportunityId: number,
  input: unknown,
  source: { mode: "simulated" } | { mode: "live"; model: string } = { mode: "simulated" },
): SavedEvaluation {
  opportunityIdSchema.parse(opportunityId);
  const result = evaluationResultSchema.parse(input);
  const evaluation = savedEvaluationSchema.parse({
    opportunityId,
    ...source,
    model: source.mode === "live" ? source.model : null,
    result,
    evaluatedAt: new Date().toISOString(),
  });
  db.prepare(`
    INSERT INTO opportunity_evaluations (opportunity_id, mode, model, result_json, evaluated_at)
    VALUES (@opportunityId, @mode, @model, @resultJson, @evaluatedAt)
    ON CONFLICT (opportunity_id) DO UPDATE SET
      mode = excluded.mode, model = excluded.model, result_json = excluded.result_json, evaluated_at = excluded.evaluated_at
  `).run({
    opportunityId,
    mode: evaluation.mode,
    model: evaluation.model,
    resultJson: JSON.stringify(result),
    evaluatedAt: evaluation.evaluatedAt,
  });
  return evaluation;
}
