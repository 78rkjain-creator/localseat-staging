"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@/types";
import {
  canViewAllPeople,
  canViewDonors,
  canViewVolunteers,
  canViewSigns,
  canViewTeam,
  canManageVoterList,
  canAccessImportHub,
  canViewReports,
  canManageSuppliers,
  canReviewDataImports,
  canCanvass,
} from "@/lib/permissions";
import { ClipboardList, ShieldCheck, Settings } from "lucide-react";
import { CampaignSwitcher } from "@/components/layout/campaign-switcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { HelpButton } from "@/components/help-button";
import { BugReportButton } from "@/components/bug-report-button";

// ── Sidebar-embedded Help button ─────────────────────────────────────────────
// Renders the HelpButton as a compact sidebar row instead of a floating FAB.

function SidebarHelpButton() {
  return <HelpButton variant="sidebar" />;
}

// ── Sidebar-embedded Bug Report button ───────────────────────────────────────

function SidebarBugReportButton() {
  return <BugReportButton variant="sidebar" />;
}


interface SidebarProps {
  firstName: string;
  lastName: string;
  role: Role | null;
  campaignName: string | null;
  campaignLogoUrl?: string | null;
  campaignCount?: number;
  pendingDataCorrectionsCount?: number;
  donorTrackingEnabled?: boolean;
  followUpQueueEnabled?: boolean;
  analyticsEnabled?: boolean;
  eventsEnabled?: boolean;
  surveysEnabled?: boolean;
  digitalSignaturesEnabled?: boolean;
  customFieldsEnabled?: boolean;
  signTrackingEnabled?: boolean;
  contactMapEnabled?: boolean;
  reportsEnabled?: boolean;
  canvassScriptEnabled?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

function NavLink({
  href,
  label,
  icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
        active
          ? "rounded-r-xl bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500"
          : "rounded-xl font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      <span className="h-5 w-5 flex-shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

export function Sidebar({ firstName, lastName, role, campaignName, campaignLogoUrl, campaignCount = 1, pendingDataCorrectionsCount = 0, donorTrackingEnabled = true, followUpQueueEnabled = true, analyticsEnabled = true, eventsEnabled = true, surveysEnabled = true, digitalSignaturesEnabled = true, customFieldsEnabled = true, signTrackingEnabled = true, contactMapEnabled = true, reportsEnabled = true, canvassScriptEnabled = true }: SidebarProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const peopleRef = useRef<HTMLDivElement>(null);
  const opsRef = useRef<HTMLDivElement>(null);
  const reportsRef = useRef<HTMLDivElement>(null);
  const adminRef2 = useRef<HTMLDivElement>(null);

  const isPeoplePath = pathname.startsWith("/people");
  useEffect(() => {
    if (isPeoplePath) setPeopleOpen(true);
  }, [isPeoplePath]);

  const isAdminPath =
    pathname.startsWith("/campaign-settings") ||
    pathname.startsWith("/data-corrections") ||
    pathname.startsWith("/team");
  useEffect(() => {
    if (isAdminPath) setAdminOpen(true);
  }, [isAdminPath]);

  const isReportsPath = pathname.startsWith("/reports");
  useEffect(() => {
    if (isReportsPath) setReportsOpen(true);
  }, [isReportsPath]);

  const isOpsPath =
    pathname.startsWith("/follow-ups") ||
    pathname.startsWith("/outreach") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/field-messages") ||
    pathname.startsWith("/donors") ||
    pathname.startsWith("/signs");
  useEffect(() => {
    if (isOpsPath) setOpsOpen(true);
  }, [isOpsPath]);

  // Scroll collapsible section into view when opened
  function toggleWithScroll(
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    ref: React.RefObject<HTMLDivElement | null>
  ) {
    setter((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }
      return next;
    });
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    if (accountOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountOpen]);

  // Admin sub-items — only shown to candidate, campaign_manager, data_manager, and co_chair.
  const adminItems: NavItem[] = [
    ...(role === "candidate" || role === "campaign_manager" || role === "data_manager"
      ? [
          {
            href: "/campaign-settings/general",
            label: "General",
            icon: <Settings size={16} />,
          },
        ]
      : []),
    ...(role && canViewTeam(role)
      ? [
          {
            href: "/team",
            label: "Team Setup",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ),
          },
        ]
      : []),
    {
      href: "/data-corrections",
      label: "Data Corrections",
      badge: pendingDataCorrectionsCount > 0 ? pendingDataCorrectionsCount : undefined,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      href: "/campaign-settings/ward",
      label: "Ward Boundary",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      href: "/campaign-settings/competitors",
      label: "Competitors",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        </svg>
      ),
    },
    ...(canvassScriptEnabled && (role === "candidate" || role === "campaign_manager" || role === "data_manager" || role === "co_chair")
      ? [
          {
            href: "/campaign-settings/script",
            label: "Canvassing Script",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(reportsEnabled && (role === "candidate" || role === "campaign_manager" || role === "data_manager" || role === "co_chair")
      ? [
          {
            href: "/campaign-settings/reports",
            label: "Email Reports",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(role === "candidate" || role === "campaign_manager" || role === "data_manager"
      ? [
          ...(customFieldsEnabled
            ? [{
                href: "/campaign-settings/custom-fields",
                label: "Custom Fields",
                icon: (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h6" />
                  </svg>
                ),
              }]
            : []),
          {
            href: "/campaign-settings/tags",
            label: "Custom Tags",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            ),
          },
          ...(surveysEnabled
            ? [{
                href: "/campaign-settings/surveys",
                label: "Surveys",
                icon: <ClipboardList size={16} />,
              }]
            : []),
          ...(digitalSignaturesEnabled
            ? [{
                href: "/campaign-settings/signature-consents",
                label: "Consent Types",
                icon: (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                ),
              }]
            : []),
          {
            href: "/campaign-settings/privacy",
            label: "Privacy & Data",
            icon: <ShieldCheck size={16} />,
          },
        ]
      : []),
    ...(role && canManageSuppliers(role)
      ? [
          {
            href: "/campaign-settings/suppliers",
            label: "Data Suppliers",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(role && canReviewDataImports(role)
      ? [
          {
            href: "/campaign-settings/imports",
            label: "Data Imports",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  const isSignInstaller = role === "sign_installer";

  const showAdmin =
    role === "candidate" ||
    role === "campaign_manager" ||
    role === "data_manager" ||
    role === "co_chair";

  // Sign installers get a stripped-down nav — Signs only.
  if (isSignInstaller) {
    const signsOnlyGroups: NavItem[][] = [
      [
        {
          href: "/signs",
          label: "Signs",
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ],
    ];
    return (
      <aside className="hidden md:flex flex-col w-60 h-full bg-white border-r border-slate-100 px-3 py-5 overflow-hidden flex-shrink-0">
        <div className="flex flex-col gap-1 px-3 mb-6">
          {campaignLogoUrl ? (
            <img src={campaignLogoUrl} alt="Campaign logo" className="h-7 w-auto object-contain object-left" />
          ) : (
            <Wordmark size={28} tone="ink" />
          )}
          {campaignName && (
            <CampaignSwitcher campaignName={campaignName} campaignCount={campaignCount} />
          )}
        </div>
        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
          {signsOnlyGroups.flatMap((group) =>
            group.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))
          )}
        </nav>
        <div className="border-t border-slate-100 pt-3 mt-3 relative" ref={accountRef}>
          {accountOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <Link href="/account/profile" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </Link>
              <button onClick={() => { setAccountOpen(false); signOut({ callbackUrl: "/login" }); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          )}
          <button onClick={() => setAccountOpen((v) => !v)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-slate-600">
                {firstName?.[0] ?? "?"}{lastName?.[0] ?? ""}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-slate-900 truncate">{firstName} {lastName}</p>
            </div>
            <svg className={["h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform", accountOpen ? "rotate-180" : ""].join(" ")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  // Nav items — top-level flat links only. Collapsible sections rendered separately.
  const topLinks: NavItem[] = [
    {
      href: "/dashboard",
      label: "Today",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    ...((role === "candidate" || role === "campaign_manager" || role === "data_manager" || role === "co_chair") && analyticsEnabled
      ? [
          {
            href: "/analytics",
            label: "Analytics",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(role && canAccessImportHub(role)
      ? [
          {
            href: "/import",
            label: "Import & Data",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" />
              </svg>
            ),
          },
        ]
      : []),
    ...(role && (canViewAllPeople(role) || role === "canvasser" || role === "volunteer_coordinator")
      ? [
          {
            href: "/canvassing",
            label: "Canvassing",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            ),
          },
        ]
      : []),
    ...(role && canCanvass(role)
      ? [
          {
            href: "/leaderboard",
            label: "Leaderboard",
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  // Operations sub-items
  const opsItems: NavItem[] = [
    ...(role && canViewAllPeople(role) && eventsEnabled
      ? [{
          href: "/events",
          label: "Events",
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        }]
      : []),
    ...(role && canViewAllPeople(role) && followUpQueueEnabled
      ? [{
          href: "/follow-ups",
          label: "Follow-ups",
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        }]
      : []),
    ...(role && canViewAllPeople(role)
      ? [{
          href: "/outreach",
          label: "Outreach",
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        }]
      : []),
    ...(role === "candidate" || role === "campaign_manager" || role === "data_manager" || role === "field_organizer"
      ? [{
          href: "/field-messages",
          label: "Field Messages",
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          ),
        }]
      : []),
    ...(role && canViewDonors(role) && role !== "field_organizer" && donorTrackingEnabled
      ? [{
          href: "/donors",
          label: "Donors",
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        }]
      : []),
    ...(role && canViewSigns(role) && signTrackingEnabled
      ? [{
          href: "/signs",
          label: "Signs",
          icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        }]
      : []),
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 h-full bg-white border-r border-slate-100 px-3 py-5 overflow-hidden flex-shrink-0">
      {/* Brand */}
      <div className="flex flex-col gap-1 px-3 mb-6">
        {campaignLogoUrl ? (
          <img src={campaignLogoUrl} alt="Campaign logo" className="h-7 w-auto object-contain object-left" />
        ) : (
          <Wordmark size={28} tone="ink" />
        )}
        {campaignName && (
          <CampaignSwitcher campaignName={campaignName} campaignCount={campaignCount} />
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
        {/* Top-level links */}
        {topLinks.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}

        {/* People section — expandable */}
        {role && canViewAllPeople(role) && (
          <div ref={peopleRef}>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              onClick={() => toggleWithScroll(setPeopleOpen, peopleRef)}
              className="flex items-center justify-between px-3 py-2.5 w-full text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="h-5 w-5 flex-shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                People
              </span>
              <svg className={["h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200", (peopleOpen || isPeoplePath) ? "rotate-180" : ""].join(" ")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {peopleOpen && (
              <div className="ml-3 border-l border-slate-200 pl-2 flex flex-col gap-0.5 mt-0.5">
                {([
                  { href: "/people", label: "All People" },
                  { href: "/people/residents", label: "Residents" },
                  { href: "/people/voters", label: "Voter List" },
                  ...(role && canManageVoterList(role) ? [{ href: "/people/out-of-district", label: "Out-of-District" }] : []),
                  { href: "/people/team", label: "Team" },
                  ...(role && canViewVolunteers(role) ? [{ href: "/people/volunteers", label: "Volunteers" }] : []),
                  ...(contactMapEnabled && (role === "candidate" || role === "campaign_manager" || role === "data_manager" || role === "co_chair" || role === "field_organizer") ? [{ href: "/people/map", label: "Contact Map" }] : []),
                ] as { href: string; label: string; badge?: number }[]).map((item) => {
                  const isActive = item.href === "/people" ? pathname === "/people" : pathname.startsWith("/people/out-of-district") ? item.href.startsWith("/people/out-of-district") : pathname.startsWith(item.href);
                  return (
                    <Link key={item.label} href={item.href} className={["flex items-center justify-between px-3 py-2 text-sm rounded-r-xl transition-colors", isActive ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"].join(" ")}>
                      <span>{item.label}</span>
                      {item.badge !== undefined && (<span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold bg-amber-500 text-white">{item.badge}</span>)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Operations — collapsible */}
        {opsItems.length > 0 && (
          <div ref={opsRef}>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              onClick={() => toggleWithScroll(setOpsOpen, opsRef)}
              className="flex items-center justify-between px-3 py-2.5 w-full text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="h-5 w-5 flex-shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </span>
                Operations
              </span>
              <svg className={["h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200", (opsOpen || isOpsPath) ? "rotate-180" : ""].join(" ")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {opsOpen && (
              <div className="ml-3 border-l border-slate-200 pl-2 flex flex-col gap-0.5 mt-0.5">
                {opsItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href} className={["flex items-center gap-3 px-3 py-2 text-sm rounded-r-xl transition-colors", isActive ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"].join(" ")}>
                      <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reports collapsible section */}
        {role && canViewReports(role) && (
          <div ref={reportsRef}>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              onClick={() => toggleWithScroll(setReportsOpen, reportsRef)}
              className="flex items-center justify-between px-3 py-2.5 w-full text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="h-5 w-5 flex-shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                Reports
              </span>
              <svg
                className={["h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200", (reportsOpen || isReportsPath) ? "rotate-180" : ""].join(" ")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {reportsOpen && (
              <div className="ml-3 border-l border-slate-200 pl-2 flex flex-col gap-0.5 mt-0.5">
                {[
                  {
                    href: "/reports/canvassing",
                    label: "Canvassing Activity",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    ),
                  },
                  {
                    href: "/reports/support-levels",
                    label: "Support Levels",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    ),
                  },
                  {
                    href: "/reports/touches",
                    label: "Touches",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    ),
                  },
                  {
                    href: "/reports/follow-ups",
                    label: "Follow-up Status",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    ),
                  },
                  ...(surveysEnabled ? [{
                    href: "/reports/surveys",
                    label: "Survey Results",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    ),
                  }] : []),
                  {
                    href: "/reports/volunteers",
                    label: "Volunteer Summary",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                  },
                  ...(donorTrackingEnabled ? [{
                    href: "/reports/donors",
                    label: "Donor Summary",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                  }] : []),
                  ...(signTrackingEnabled ? [{
                    href: "/reports/signs",
                    label: "Sign Summary",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    ),
                  }] : []),
                  {
                    href: "/reports/coverage",
                    label: "Coverage",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    ),
                  },
                  {
                    href: "/reports/export",
                    label: "Export Data",
                    icon: (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    ),
                  },
                ].map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-r-xl transition-colors",
                        isActive
                          ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Audit log — candidate / campaign_manager / data_manager */}
        {(role === "candidate" || role === "campaign_manager" || role === "data_manager") && (
          <>
            <div className="h-px bg-slate-100 my-1" />
            <NavLink
              href="/audit-log"
              label="Audit Log"
              active={pathname === "/audit-log" || pathname.startsWith("/audit-log/")}
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
          </>
        )}

        {/* Admin collapsible section */}
        {showAdmin && (
          <div ref={adminRef2}>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              onClick={() => toggleWithScroll(setAdminOpen, adminRef2)}
              className="flex items-center justify-between px-3 py-2.5 w-full text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="h-5 w-5 flex-shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                Admin
              </span>
              <svg
                className={["h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200", (adminOpen || isAdminPath) ? "rotate-180" : ""].join(" ")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {adminOpen && (
              <div className="ml-3 border-l border-slate-200 pl-2 flex flex-col gap-0.5 mt-0.5">
                {adminItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-r-xl transition-colors",
                        isActive
                          ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold bg-brand-500 text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User Guide + Help & Bug Report */}
      <div className="flex flex-col gap-1 px-3 py-1">
        <a
          href="/LocalSeat-User-Guide.docx"
          download
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-colors"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download User Guide
        </a>
        <div className="flex items-center gap-1.5">
          <SidebarHelpButton />
          <SidebarBugReportButton />
        </div>
      </div>

      {/* User */}
      <div className="border-t border-slate-100 pt-3 mt-3 relative" ref={accountRef}>
        {/* Account menu — opens above the user row */}
        {accountOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Link
              href="/account/profile"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
            <Link
              href="/account/campaigns"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V7a2 2 0 012-2h4l2-2h4l2 2h4a2 2 0 012 2v14M3 21h18M9 21V11h6v10" />
              </svg>
              My Campaigns
            </Link>
            <button
              onClick={() => { setAccountOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}

        {/* User row — toggles the menu */}
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-slate-600">
              {firstName?.[0] ?? "?"}{lastName?.[0] ?? ""}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-medium text-slate-900 truncate">
              {firstName} {lastName}
            </p>
          </div>
          <svg
            className={["h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform", accountOpen ? "rotate-180" : ""].join(" ")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
