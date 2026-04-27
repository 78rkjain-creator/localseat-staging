"use client";

import { useState } from "react";
import type { ContactSubmission } from "@prisma/client";

interface Props {
  initialSubmissions: ContactSubmission[];
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ContactSubmissionsClient({ initialSubmissions }: Props) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>(initialSubmissions);
  const [selected, setSelected]       = useState<ContactSubmission | null>(null);

  async function openSubmission(sub: ContactSubmission) {
    setSelected(sub);

    // Mark as read if not already
    if (!sub.readAt) {
      try {
        await fetch(`/api/contact/${sub.id}/read`, { method: "PATCH" });
        const now = new Date();
        setSubmissions((prev) =>
          prev.map((s) => s.id === sub.id ? { ...s, readAt: now } : s)
        );
        setSelected((prev) => prev?.id === sub.id ? { ...prev, readAt: now } : prev);
      } catch {
        // Non-critical — silently ignore
      }
    }
  }

  function closePanel() {
    setSelected(null);
  }

  const unreadCount = submissions.filter((s) => !s.readAt).length;

  return (
    <div className="flex gap-5 items-start">
      {/* List */}
      <div className={["flex-1 min-w-0", selected ? "hidden lg:block" : ""].join(" ")}>
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-500">
            <strong className="text-slate-700">{submissions.length}</strong> submission{submissions.length !== 1 ? "s" : ""}
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          {submissions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">No contact submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-4"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Topic</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {submissions.map((sub) => {
                    const isUnread  = !sub.readAt;
                    const isActive  = selected?.id === sub.id;

                    return (
                      <tr
                        key={sub.id}
                        onClick={() => openSubmission(sub)}
                        className={[
                          "cursor-pointer transition-colors",
                          isActive
                            ? "bg-brand-50"
                            : "hover:bg-slate-50/50",
                        ].join(" ")}
                      >
                        {/* Unread dot */}
                        <td className="pl-4 pr-1 py-3">
                          {isUnread && (
                            <span className="block h-2 w-2 rounded-full bg-brand-500" />
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}>
                            {sub.firstName} {sub.lastName}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {sub.email}
                        </td>

                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={[
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            sub.topic
                              ? "bg-slate-100 text-slate-600"
                              : "bg-slate-50 text-slate-400",
                          ].join(" ")}>
                            {sub.topic ?? "General"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell whitespace-nowrap">
                          {formatDate(sub.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="flex-1 lg:max-w-md xl:max-w-lg flex-shrink-0">
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-semibold text-slate-900">
                  {selected.firstName} {selected.lastName}
                </p>
                <a
                  href={`mailto:${selected.email}`}
                  className="text-sm text-brand-600 hover:underline"
                >
                  {selected.email}
                </a>
              </div>
              <button
                onClick={closePanel}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Meta */}
            <div className="px-5 py-4 border-b border-slate-50 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Topic</p>
                <p className="text-sm text-slate-700">{selected.topic ?? "General"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Received</p>
                <p className="text-sm text-slate-700">{formatDate(selected.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Status</p>
                <p className="text-sm">
                  {selected.readAt ? (
                    <span className="text-emerald-600">Read {formatDate(selected.readAt)}</span>
                  ) : (
                    <span className="text-brand-600 font-medium">Unread</span>
                  )}
                </p>
              </div>
              {selected.ipAddress && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">IP</p>
                  <p className="text-sm text-slate-500 font-mono">{selected.ipAddress}</p>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="px-5 py-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">Message</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selected.message}
              </p>
            </div>

            {/* Reply CTA */}
            <div className="px-5 pb-5">
              <a
                href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.topic ?? "Your message to LocalSeat")}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Reply by email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
