"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import type { ChatGPTConnection } from "@/schemas/chatgpt-auth";
import styles from "./workspace-shell.module.css";

const navigationItems = [
  { view: "discovery", label: "Discover", heading: "search-heading", group: "Workspace" },
  { view: "tracking", label: "Tracking", heading: "tracking-heading", group: "Workspace" },
  { view: "connection", label: "AI connection", heading: "chatgpt-heading", group: "Setup" },
  { view: "profile", label: "Profile", heading: "profile-heading", group: "Setup" },
] as const;

type WorkspaceView = typeof navigationItems[number]["view"];

export type WorkspaceShellProps = {
  discovery: ReactNode;
  tracking: ReactNode;
  connection: ReactNode;
  profile: ReactNode;
  connectionStatus: ChatGPTConnection["status"];
  initialView: WorkspaceView;
};

const connectionLabels = {
  disconnected: "AI not connected",
  permission_granted: "AI connected",
  permission_missing: "AI permission needed",
  expired: "AI sign-in expired",
};

// Use native hash links so views support bookmarks and browser Back/Forward.
function subscribeToNavigation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);

  return () => window.removeEventListener("hashchange", onChange);
}

function viewFromHash(fallback: WorkspaceView) {
  if (window.location.hash === "#chatgpt") return "connection";

  return navigationItems.find((item) => window.location.hash === `#${item.heading}`)?.view ?? fallback;
}

function focusView(view: WorkspaceView) {
  const item = navigationItems.find((item) => item.view === view);
  if (!item) return;

  document.getElementById(item.heading)?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Keep the small navigation icon set local to the workspace shell.
function NavigationIcon({ view }: { view: WorkspaceView }) {
  const paths = {
    discovery: "m21 21-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z",
    tracking: "M9 5h11M9 12h11M9 19h11M3 5h1M3 12h1M3 19h1",
    connection: "m9 15 6-6M8 17l-1 1a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0m2 8a4.2 4.2 0 0 0 6 0l4-4a4.2 4.2 0 0 0-6-6l-1 1",
    profile: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  };

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[view]} />
    </svg>
  );
}

export function WorkspaceShell({
  discovery,
  tracking,
  connection,
  profile,
  connectionStatus,
  initialView,
}: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeView = useSyncExternalStore(
    subscribeToNavigation,
    () => viewFromHash(initialView),
    () => initialView,
  );
  const previousView = useRef(activeView);

  // Move keyboard focus to the selected view, including restored hash links.
  useEffect(() => {
    if (window.location.hash || previousView.current !== activeView) focusView(activeView);
    previousView.current = activeView;
  }, [activeView]);

  // Navigation actions leave the mounted editors and their unsaved content intact.
  function navigate(view: WorkspaceView) {
    setMobileOpen(false);
    if (view === activeView) focusView(view);
  }

  function focusContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById("workspace-content")?.focus();
  }

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      <a className={styles.skipLink} href="#workspace-content" onClick={focusContent}>
        Skip to content
      </a>

      <aside className={styles.sidebar} data-mobile-open={mobileOpen}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">J</span>
          <span className={styles.brandName}>Job search</span>
        </div>

        <button
          className={styles.mobileToggle}
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="workspace-navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? "Close menu" : "Menu"}
        </button>

        <div className={styles.sidebarContent}>
          <nav id="workspace-navigation" aria-label="Workspace navigation">
            {(["Workspace", "Setup"] as const).map((group) => (
              <div className={styles.navigationGroup} key={group}>
                <p className={styles.groupLabel}>{group}</p>

                {navigationItems.filter((item) => item.group === group).map((item) => (
                  <a
                    className={styles.navigationLink}
                    key={item.view}
                    href={`#${item.heading}`}
                    aria-label={item.label}
                    aria-current={activeView === item.view ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => navigate(item.view)}
                  >
                    <NavigationIcon view={item.view} />
                    <span className={styles.itemLabel}>{item.label}</span>
                  </a>
                ))}
              </div>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <p className={styles.localLabel}>Local workspace</p>

            <button
              className={styles.collapseToggle}
              type="button"
              aria-expanded={!collapsed}
              aria-controls="workspace-navigation"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((value) => !value)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 3h16v18H4zM9 3v18" />
                <path d={collapsed ? "m12 8 4 4-4 4" : "m16 8-4 4 4 4"} />
              </svg>
              <span className={styles.itemLabel}>Collapse</span>
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.body}>
        <header className={styles.topbar}>
          <h1 className={styles.title}>Job Opportunity Automation</h1>
          <a className={styles.connectionLink} href="#chatgpt-heading" onClick={() => navigate("connection")}>
            <span className={styles.connectionDot} aria-hidden="true" />
            {connectionLabels[connectionStatus]}
          </a>
        </header>

        <main className={styles.content} id="workspace-content" tabIndex={-1}>
          {/* Hidden views stay mounted to preserve searches, editors and pending requests. */}
          <div className={styles.panel} hidden={activeView !== "discovery"}>{discovery}</div>
          <div className={styles.panel} hidden={activeView !== "tracking"}>{tracking}</div>
          <div className={styles.panel} hidden={activeView !== "connection"}>{connection}</div>
          <div className={styles.panel} hidden={activeView !== "profile"}>{profile}</div>
        </main>
      </div>
    </div>
  );
}
