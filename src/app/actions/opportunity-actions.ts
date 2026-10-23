"use server";

import { openDatabase } from "../../lib/db.ts";
import { searchJobs } from "../../lib/job-search.ts";
import { saveOpportunity } from "../../lib/opportunities.ts";
import { getEvaluations } from "../../lib/opportunity-evaluations.ts";
import type { Opportunity } from "../../schemas/opportunity.ts";
import type { EvaluationMap } from "../../schemas/opportunity-evaluation.ts";
import { searchInputSchema, type JobSearchResult } from "../../schemas/job-search.ts";

export type SearchState =
  | (Omit<JobSearchResult, "opportunities"> & {
    status: "success"; opportunities: Opportunity[]; evaluations?: EvaluationMap; evaluationError?: string;
    criteria: { query: string; municipalities: string[] }; offset: number;
  })
  | { status: "error"; message: string };

export async function searchOpportunities(
  _previousState: SearchState | null,
  formData: FormData,
): Promise<SearchState> {
  const query = formData.get("query");
  const municipalities = formData.getAll("municipality");
  if (typeof query !== "string" || !query.trim()) {
    return { status: "error", message: "Enter a search term, such as developer or support." };
  }
  if (!municipalities.every((value) => typeof value === "string")) {
    return { status: "error", message: "Choose locations or search all of Sweden." };
  }
  const rawOffset = formData.get("offset") ?? "0";
  const input = searchInputSchema.safeParse({
    query, municipalities: municipalities.map((value) => value.trim()).filter(Boolean),
    offset: typeof rawOffset === "string" && /^\d+$/.test(rawOffset) ? Number(rawOffset) : NaN,
  });
  if (!input.success) {
    return { status: "error", message: "The search page is invalid. Start a new search." };
  }
  const { offset, query: searchQuery, municipalities: searchMunicipalities } = input.data;
  const criteria = { query: searchQuery, municipalities: searchMunicipalities };

  let result;
  try {
    result = await searchJobs(input.data);
  } catch {
    return { status: "error", message: "Could not search Platsbanken. Please try again." };
  }
  if (result.opportunities.length === 0) {
    return { status: "success", ...result, criteria, offset, opportunities: [] };
  }

  try {
    const db = openDatabase();
    try {
      // Save this search together: a database failure leaves no partial batch.
      const saveResults = db.transaction(() => result.opportunities.map((opportunity) => saveOpportunity(db, opportunity)));
      const opportunities = saveResults.immediate();
      try {
        return { status: "success", ...result, criteria, offset, opportunities, evaluations: getEvaluations(db, opportunities.map((opportunity) => opportunity.id)) };
      } catch {
        // Evaluation setup must not prevent discovery or undo a saved search.
        return {
          status: "success", ...result, criteria, offset, opportunities,
          evaluationError: "Saved evaluations could not be loaded. Run npm run db:migrate if needed, then refresh.",
        };
      }
    } finally {
      db.close();
    }
  } catch {
    return {
      status: "error",
      message: "The search completed, but its results could not be saved. Check the database setup and try again.",
    };
  }
}
