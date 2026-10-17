import { Fragment, type ReactNode } from "react";

import { stripOneAiRefs } from "@/lib/shopAiAgent/presentation";

/**
 * Minimal, safe renderer for One AI answers: paragraphs, "-"/"*" bullets and
 * **bold**. Everything else stays plain text — no HTML, no links.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`${keyPrefix}-${index}`} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${keyPrefix}-${index}`}>{part.replace(/\*\*/g, "")}</Fragment>
    )
  );
}

export function OneAiText({ text }: { text: string }) {
  const blocks = stripOneAiRefs(text)
    // Models occasionally emit <strong>/<b>; keep the emphasis, drop any other tag.
    .replace(/<\/?(?:strong|b)>/gi, "**")
    .replace(/<[^>]*>/g, "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim());
        const bullets = lines.filter((line) => /^[-*•]\s+/.test(line));
        if (bullets.length && bullets.length === lines.filter(Boolean).length) {
          return (
            <ul key={blockIndex} className="my-2 space-y-1.5 pl-0.5">
              {bullets.map((line, lineIndex) => (
                <li key={lineIndex} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-[0.55em] h-1 w-1 shrink-0 bg-foreground/45"
                  />
                  <span>
                    {renderInline(line.replace(/^[-*•]\s+/, ""), `${blockIndex}-${lineIndex}`)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="my-2 first:mt-0 last:mb-0">
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line.replace(/^[-*•]\s+/, "• "), `${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
