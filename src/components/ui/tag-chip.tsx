import Link from "next/link";

interface TagChipProps {
  name: string;
  color?: string | null;
  // If provided, clicking the chip filters the people list by this tag
  tagId?: string;
  size?: "sm" | "md";
}

export function TagChip({ name, color, tagId, size = "sm" }: TagChipProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  const chip = (
    <span
      className={[
        "inline-flex items-center rounded-full font-medium border",
        sizeClass,
        color ? "" : "bg-slate-100 text-slate-600 border-slate-200",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        color
          ? {
              backgroundColor: color + "18", // 10% opacity fill
              color: color,
              borderColor: color + "40",
            }
          : undefined
      }
    >
      {name}
    </span>
  );

  if (tagId) {
    return (
      <Link href={`/people/residents?tag=${tagId}`} className="hover:opacity-80 transition-opacity">
        {chip}
      </Link>
    );
  }

  return chip;
}
