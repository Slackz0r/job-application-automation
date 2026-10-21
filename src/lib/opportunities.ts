import "server-only";

import type Database from "better-sqlite3";
import { z } from "zod";
import { opportunityInputSchema, type Opportunity } from "../schemas/opportunity.ts";

const opportunityColumns = `
  id, source, source_id AS sourceId, title, company, location, description, url,
  application_deadline AS applicationDeadline,
  discovered_at AS discoveredAt, published_at AS publishedAt
`;

// The caller owns the connection and closes it after the work is finished.
export function saveOpportunity(db: Database.Database, input: unknown): Opportunity {
  const opportunity = opportunityInputSchema.parse(input);

  const save = db.transaction(() => {
    db.prepare(`
      INSERT INTO opportunities (
        source, source_id, title, company, location, description, url,
        application_deadline, discovered_at, published_at
      ) VALUES (
        @source, @sourceId, @title, @company, @location, @description, @url,
        @applicationDeadline, @discoveredAt, @publishedAt
      )
      ON CONFLICT (source, source_id) DO UPDATE SET location = excluded.location
      WHERE opportunities.location IS NULL AND excluded.location IS NOT NULL
    `).run({ ...opportunity, discoveredAt: new Date().toISOString() });

    const saved = db.prepare<[string, string], Opportunity>(`
      SELECT ${opportunityColumns} FROM opportunities
      WHERE source = ? AND source_id = ?
    `).get(opportunity.source, opportunity.sourceId);

    if (!saved) {
      throw new Error("The saved opportunity could not be read back.");
    }
    return saved;
  });

  return save.immediate();
}

export function getOpportunity(db: Database.Database, id: number): Opportunity | null {
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(id);

  return db.prepare<[number], Opportunity>(`
    SELECT ${opportunityColumns} FROM opportunities WHERE id = ?
  `).get(id) ?? null;
}

export function listOpportunities(db: Database.Database, limit = 20): Opportunity[] {
  z.number().int().min(1).max(100).parse(limit);
  return db.prepare<[number], Opportunity>(`
    SELECT ${opportunityColumns} FROM opportunities
    ORDER BY discovered_at DESC, id DESC LIMIT ?
  `).all(limit);
}
