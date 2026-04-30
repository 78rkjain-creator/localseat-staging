import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllFieldMessages } from "@/lib/field-messages";
import { createFieldMessage, deleteFieldMessage } from "./actions";
import type { FieldMessageItem } from "@/lib/field-messages";

export const metadata: Metadata = { title: "Field Messages" };

async function handleCreate(formData: FormData) {
  "use server";
  await createFieldMessage(formData);
}

export default async function FieldMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (
    activeRole !== "candidate" &&
    activeRole !== "campaign_manager" &&
    activeRole !== "data_manager" &&
    activeRole !== "field_organizer"
  ) {
    redirect("/dashboard");
  }

  const messages = await getAllFieldMessages(activeCampaignId);
  const now = new Date();

  const active = messages.filter((m) => !m.expiresAt || m.expiresAt > now);
  const expired = messages.filter((m) => m.expiresAt && m.expiresAt <= now);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Field Messages</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Push notes and talking points to your team&apos;s canvassing screens.
        </p>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-2xl border border-slate-100 px-5 py-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">New message</h2>
        <form action={handleCreate}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                name="title"
                type="text"
                required
                maxLength={120}
                placeholder="e.g. Focus on Elm Street today"
                className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Message</label>
              <textarea
                name="content"
                required
                rows={3}
                maxLength={500}
                placeholder="Key talking point, reminder, or update for your canvassers…"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                <label className="text-sm font-medium text-slate-700">Priority</label>
                <select
                  name="priority"
                  className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                <label className="text-sm font-medium text-slate-700">
                  Expires <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  name="expiresAt"
                  type="date"
                  className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-11 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl transition-colors mt-1"
            >
              Send message
            </button>
          </div>
        </form>
      </div>

      {/* Active messages */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Active ({active.length})
        </h2>

        {active.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No active messages. Create one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </section>

      {/* Expired messages */}
      {expired.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Expired ({expired.length})
          </h2>
          <div className="flex flex-col gap-3 opacity-60">
            {expired.map((msg) => (
              <MessageRow key={msg.id} msg={msg} showExpired />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MessageRow({ msg, showExpired = false }: { msg: FieldMessageItem; showExpired?: boolean }) {
  const isUrgent = msg.priority === "urgent";

  async function handleDelete() {
    "use server";
    await deleteFieldMessage(msg.id);
  }

  return (
    <div
      className={[
        "bg-white rounded-2xl border px-5 py-4",
        isUrgent ? "border-amber-300 bg-amber-50/30" : "border-slate-100",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-slate-900">{msg.title}</p>
            {isUrgent && (
              <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                Urgent
              </span>
            )}
            {showExpired && (
              <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                Expired
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{msg.content}</p>
          <p className="text-xs text-slate-400 mt-2">
            By {msg.createdBy.firstName} {msg.createdBy.lastName} &middot;{" "}
            {msg.createdAt.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
            {msg.expiresAt && (
              <> &middot; Expires {msg.expiresAt.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</>
            )}
          </p>
        </div>
        <form action={handleDelete}>
          <button
            type="submit"
            className="flex-shrink-0 text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
