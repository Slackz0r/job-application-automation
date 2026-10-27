import "server-only";

import type Database from "better-sqlite3";
import { z } from "zod";
import { getOpportunity } from "./opportunities.ts";
import {
  statusHistorySchema, trackingFilterSchema, trackingIdSchema, trackingInputSchema, trackingOffsetSchema,
  trackingPageSize, trackingRevisionSchema, trackingSchema,
  type Tracking, type TrackingDetails, type TrackingFilter, type TrackingMap,
} from "../schemas/opportunity-tracking.ts";

export class TrackingConflictError extends Error {
  constructor() { super("Tracking was changed elsewhere. Reopen the saved tracking before replacing it."); }
}

export function getTracking(db: Database.Database, opportunityId: number): Tracking {
  trackingIdSchema.parse(opportunityId);
  const row = db.prepare(`SELECT opportunity_id AS opportunityId, status, applied_on AS appliedOn, notes,
    revision, updated_at AS updatedAt FROM opportunity_tracking WHERE opportunity_id = ?`).get(opportunityId);
  return trackingSchema.parse(row ?? { opportunityId, status: "to_review", appliedOn: null, notes: "", revision: 0, updatedAt: null });
}

export function getTrackingDetails(db: Database.Database, opportunityId: number): TrackingDetails {
  const tracking = getTracking(db, opportunityId);
  const history = db.prepare(`SELECT id, from_status AS fromStatus, to_status AS toStatus,
    changed_at AS changedAt, tracking_revision AS revision FROM opportunity_status_history
    WHERE opportunity_id = ? ORDER BY id DESC LIMIT 25`).all(opportunityId).map((row) => statusHistorySchema.parse(row));
  const count = db.prepare<[number], { count: number }>("SELECT COUNT(*) AS count FROM opportunity_status_history WHERE opportunity_id = ?").get(opportunityId)!;
  return { tracking, history, historyCount: count.count };
}

export function getTrackingMap(db: Database.Database, opportunityIds: number[]): TrackingMap {
  z.array(trackingIdSchema).max(100).parse(opportunityIds);
  if (opportunityIds.length === 0) return {};
  const rows = db.prepare(`SELECT opportunity_id AS opportunityId, status, applied_on AS appliedOn, notes,
    revision, updated_at AS updatedAt FROM opportunity_tracking WHERE opportunity_id IN (${opportunityIds.map(() => "?").join(",")})`)
    .all(...opportunityIds).map((row) => trackingSchema.parse(row));
  return Object.fromEntries(rows.map((row) => [row.opportunityId, row]));
}

export function saveTracking(db: Database.Database, opportunityId: number, input: unknown, expectedRevision: number): TrackingDetails {
  trackingIdSchema.parse(opportunityId);
  const value = trackingInputSchema.parse(input);
  trackingRevisionSchema.parse(expectedRevision);
  return db.transaction(() => {
    if (!getOpportunity(db, opportunityId)) throw new Error("The opportunity does not exist.");
    const current = getTracking(db, opportunityId);
    if (current.revision !== expectedRevision) throw new TrackingConflictError();
    if (current.status === value.status && current.appliedOn === value.appliedOn && current.notes === value.notes) {
      return getTrackingDetails(db, opportunityId);
    }
    const updated = trackingSchema.parse({ ...value, opportunityId, revision: current.revision + 1, updatedAt: new Date().toISOString() });
    db.prepare(`INSERT INTO opportunity_tracking (opportunity_id, status, applied_on, notes, revision, updated_at)
      VALUES (@opportunityId, @status, @appliedOn, @notes, @revision, @updatedAt)
      ON CONFLICT (opportunity_id) DO UPDATE SET status = excluded.status, applied_on = excluded.applied_on,
        notes = excluded.notes, revision = excluded.revision, updated_at = excluded.updated_at`).run(updated);
    if (current.status !== value.status) {
      db.prepare(`INSERT INTO opportunity_status_history (opportunity_id, from_status, to_status, changed_at, tracking_revision)
        VALUES (?, ?, ?, ?, ?)`).run(opportunityId, current.status, updated.status, updated.updatedAt, updated.revision);
    }
    return getTrackingDetails(db, opportunityId);
  }).immediate();
}

export function listTrackedOpportunities(db: Database.Database, filter: TrackingFilter = "tracked", offset = 0) {
  trackingFilterSchema.parse(filter);
  trackingOffsetSchema.parse(offset);
  // Untracked saved ads are implicitly To review; the default shows explicit tracking records.
  const where = filter === "tracked" ? "t.opportunity_id IS NOT NULL" : "COALESCE(t.status, 'to_review') = @filter";
  const total = db.prepare<{ filter: string }, { count: number }>(`SELECT COUNT(*) AS count FROM opportunities o
    LEFT JOIN opportunity_tracking t ON t.opportunity_id = o.id WHERE ${where}`).get({ filter })!.count;
  const ids = db.prepare<{ filter: string; offset: number; limit: number }, { id: number }>(`SELECT o.id FROM opportunities o
    LEFT JOIN opportunity_tracking t ON t.opportunity_id = o.id WHERE ${where}
    ORDER BY COALESCE(t.updated_at, o.discovered_at) DESC, o.id DESC LIMIT @limit OFFSET @offset`)
    .all({ filter, offset, limit: trackingPageSize });
  const items = ids.map(({ id }) => ({ opportunity: getOpportunity(db, id)!, tracking: getTracking(db, id) }));
  return { items, filter, offset, total, nextOffset: offset + ids.length < total ? offset + ids.length : null };
}
