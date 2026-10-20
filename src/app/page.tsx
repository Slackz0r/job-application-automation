import { loadProfessionalProfile } from "@/lib/professional-profile";

// Read the private profile at request time, keeping it out of prerendered pages.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const setupMessages = {
  missing: "Add professional-profile.json to the project root. You can use professional-profile.example.json as a starting point.",
  invalid: "Check that professional-profile.json contains valid JSON and follows the format in professional-profile.example.json.",
  unavailable: "The profile file could not be read. Check its file permissions and try again.",
};

export default async function Home() {
  const result = await loadProfessionalProfile();

  return (
    <main>
      <header>
        <p className="eyebrow">Local workspace</p>
        <h1>Job Opportunity Automation</h1>
        <p className="intro">Discover opportunities. Prepare thoughtful applications. Keep track of progress.</p>
      </header>

      <section aria-labelledby="profile-heading" className="card">
        <p className="eyebrow">Project foundation</p>
        <h2 id="profile-heading">Professional profile</h2>
        {result.status === "ready" ? (
          <>
            <p className="status">Profile loaded</p>
            <p>
              Your current experience contains {result.profile.contributions.length} documented contributions.
            </p>
            <p className="muted">The full profile is available to server-side application logic.</p>
          </>
        ) : (
          <>
            <p className="status">Profile needs attention</p>
            <p>{setupMessages[result.status]}</p>
          </>
        )}
      </section>

      <p className="next-step">Next: discover and browse job opportunities from Platsbanken.</p>
    </main>
  );
}
