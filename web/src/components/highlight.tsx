import { Fragment } from "react";
import { highlightMatches } from "@/lib/highlight";

/** Tô đỏ phần chữ khớp ô tìm (Figma 05). */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightMatches(text, query).map((s, i) =>
        s.hit ? (
          <mark key={i} className="bg-transparent text-primary">
            {s.text}
          </mark>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}
