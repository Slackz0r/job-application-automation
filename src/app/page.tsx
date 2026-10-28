import { loadProfessionalProfile } from "@/lib/professional-profile";
import { openDatabase } from "@/lib/db";
import { getMunicipalities } from "@/lib/job-search";
import { listOpportunities } from "@/lib/opportunities";
import { getEvaluations } from "@/lib/opportunity-evaluations";
import type { Opportunity } from "@/schemas/opportunity";
import type { EvaluationMap } from "@/schemas/opportunity-evaluation";
import { OpportunityWorkspace } from "@/components/opportunities/opportunity-workspace";
import { getTrackingMap } from "@/lib/opportunity-tracking";
import type { TrackingMap } from "@/schemas/opportunity-tracking";
import { cookies } from "next/headers";
import { getChatGPTAuth } from "@/lib/chatgpt-auth";
import { ChatGPTConnectionCard } from "@/components/chatgpt/connection";
import { chatGPTNotices, type ChatGPTNotice } from "@/schemas/chatgpt-auth";

// Read the private profile at request time, keeping it out of prerendered pages.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const setupMessages = {
  missing:
    "Add professional-profile.json to the project root. You can use professional-profile.example.json as a starting point.",
  invalid:
    "Check that professional-profile.json contains valid JSON and follows the format in professional-profile.example.json.",
  unavailable: "The profile file could not be read. Check its file permissions and try again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ chatgpt?: string | string[] }>;
}) {
  const noticeValue = (await searchParams).chatgpt;
  const notice = typeof noticeValue === "string" && Object.hasOwn(chatGPTNotices, noticeValue)
    ? noticeValue as ChatGPTNotice
    : undefined;
  const browserId = (await cookies()).get("chatgpt_session")?.value ?? "";
  const connection = getChatGPTAuth().status(browserId);

  const [result, municipalities] = await Promise.all([
    loadProfessionalProfile(),
    getMunicipalities().catch(() => []),
  ]);

  let savedOpportunities: Opportunity[] = [];
  let savedError: string | null = null;
  let savedEvaluations: EvaluationMap = {};
  let evaluationError: string | null = null;
  let savedTracking: TrackingMap = {};
  let trackingError: string | null = null;

  try {
    const db = openDatabase();

    try {
      savedOpportunities = listOpportunities(db);

      try {
        savedTracking = getTrackingMap(db, savedOpportunities.map((opportunity) => opportunity.id));
      } catch {
        trackingError = "Tracking could not be loaded. Run npm run db:migrate if needed, then refresh.";
      }

      try {
        savedEvaluations = getEvaluations(db, savedOpportunities.map((opportunity) => opportunity.id));
      } catch {
        evaluationError = "Saved evaluations could not be loaded. Run npm run db:migrate if needed, then refresh.";
      }
    } finally {
      db.close();
    }
  } catch {
    savedError = "Saved opportunities could not be loaded. Check the database setup and refresh.";
  }

  return (
    <OpportunityWorkspace
      municipalities={municipalities}
      savedOpportunities={savedOpportunities}
      savedError={savedError}
      savedEvaluations={savedEvaluations}
      evaluationError={evaluationError}
      savedTracking={savedTracking}
      trackingError={trackingError}
      connectionStatus={connection.status}
      initialView={notice ? "connection" : "discovery"}
      connection={<ChatGPTConnectionCard connection={connection} notice={notice} />}
      profile={(
        <section aria-labelledby="profile-heading" className="card">
          <p className="eyebrow">Project foundation</p>
          <h2 id="profile-heading" tabIndex={-1}>Professional profile</h2>

          {result.status === "ready" ? (
            <>
              <p className="status status-success">Profile loaded</p>
              <p>
                Professional experiences: {result.profile.experiences.professional.length}.
                {" "}Education entries: {result.profile.experiences.education.length}.
              </p>
              <p className="muted">The full profile is available to server-side application logic.</p>
            </>
          ) : (
            <>
              <p className="notice-message">Profile needs attention</p>
              <p>{setupMessages[result.status]}</p>
            </>
          )}
        </section>
      )}
    />
  );
}
