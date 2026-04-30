import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSurveyList } from "@/lib/surveys";
import { createSurvey, deleteSurvey } from "./actions";

export const metadata: Metadata = { title: "Surveys" };

async function handleCreate(formData: FormData) {
  "use server";
  await createSurvey(formData);
}

export default async function SurveysPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") redirect("/dashboard");

  const surveys = await getSurveyList(activeCampaignId);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Canvass Surveys</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Active surveys appear on the canvassing screen for data collection at the door.
        </p>
      </div>

      {/* Create form */}
      <form action={handleCreate} className="bg-white rounded-2xl border border-slate-100 px-5 py-4 mb-8 flex gap-3">
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder="Survey name, e.g. Issue Priorities 2026"
          className="flex-1 h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
        />
        <button
          type="submit"
          className="h-11 px-5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl transition-colors flex-shrink-0"
        >
          Create
        </button>
      </form>

      {/* Survey list */}
      {surveys.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">No surveys yet</p>
          <p className="text-xs text-slate-400">Create your first survey above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {surveys.map((s) => (
            <div
              key={s.id}
              className={[
                "bg-white rounded-2xl border px-5 py-4 flex items-center gap-4",
                s.isActive ? "border-slate-100" : "border-slate-100 opacity-60",
              ].join(" ")}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-semibold text-slate-900">{s.name}</p>
                  {s.isActive ? (
                    <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {s._count.questions} question{s._count.questions !== 1 ? "s" : ""} &middot;{" "}
                  {s._count.responses} response{s._count.responses !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/campaign-settings/surveys/${s.id}`}
                  className="h-8 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center"
                >
                  Edit
                </Link>
                <form action={async () => { "use server"; await deleteSurvey(s.id); }}>
                  <button type="submit" className="h-8 px-3 rounded-xl border border-red-100 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
