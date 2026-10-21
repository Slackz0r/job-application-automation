"use server";

import { openDatabase } from "../lib/db.ts";
import { searchJobs } from "../lib/job-search.ts";
import { saveOpportunity, type Opportunity } from "../lib/opportunities.ts";

export type SearchState =
  | { status: "success"; total: number; skippedCount: number; opportunities: Opportunity[] }
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

  let result;
  try {
    result = await searchJobs({ query, municipalities: municipalities.map((value) => value.trim()).filter(Boolean) });
  } catch {
    return { status: "error", message: "Could not search Platsbanken. Please try again." };
  }
  if (result.opportunities.length === 0) {
    return { status: "success", ...result, opportunities: [] };
  }

  try {
    const db = openDatabase();
    try {
      // Save this search together: a database failure leaves no partial batch.
      const saveResults = db.transaction(() => result.opportunities.map((opportunity) => saveOpportunity(db, opportunity)));
      const opportunities = saveResults.immediate();
      return { status: "success", ...result, opportunities };
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
