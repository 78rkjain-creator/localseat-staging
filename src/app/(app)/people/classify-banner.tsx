"use client";

import { useState, useEffect } from "react";
import { ClassifyModal, type UnclassifiedPerson } from "./classify-modal";

interface Props {
  count: number;
  campaignId: string;
  people: UnclassifiedPerson[];
}

export function DistrictClassifyBanner({ count, campaignId, people }: Props) {
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    const key = `dismissed_classify_count_${campaignId}`;
    const dismissed = parseInt(localStorage.getItem(key) ?? "0", 10);
    setVisible(count > dismissed);
  }, [count, campaignId]);

  function dismiss() {
    localStorage.setItem(`dismissed_classify_count_${campaignId}`, String(count));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-4">
        {/* Warning icon */}
        <div className="mt-0.5 flex-shrink-0">
          <svg
            className="h-5 w-5 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {count} {count === 1 ? "person needs" : "people need"} district classification
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            Review and mark each as in-district or out-of-district.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-sm font-semibold text-amber-900 hover:text-amber-700 underline underline-offset-2 decoration-amber-400"
          >
            Review
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="h-6 w-6 flex items-center justify-center rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {showModal && (
        <ClassifyModal people={people} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
