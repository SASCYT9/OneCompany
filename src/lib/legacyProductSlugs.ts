/**
 * Old product slugs that were later renamed.
 *
 * iPE exhausts were first published as `ipe-<car>-titanium-exhaust(-system)`
 * and now live at `ipe-<car>-exhaust`. The old URLs were already indexed and
 * collecting impressions, and they answer 404 today with nothing pointing to
 * the new address, so that ranking is simply lost.
 *
 * This only proposes candidates. The caller must confirm the candidate exists
 * before redirecting: several live iPE slugs legitimately end in
 * `-titanium-exhaust`, so a blanket rewrite would break them.
 */
export function legacyProductSlugCandidates(slug: string): string[] {
  if (!slug.startsWith("ipe-")) return [];

  const candidates: string[] = [];
  const add = (candidate: string) => {
    if (candidate !== slug && candidate.length > "ipe-".length && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  };

  const titaniumSystem = /^(ipe-.+)-titanium-exhaust-system$/.exec(slug);
  if (titaniumSystem) {
    add(`${titaniumSystem[1]}-exhaust`);
    add(`${titaniumSystem[1]}-exhaust-system`);
  }
  const titaniumExhaust = /^(ipe-.+)-titanium-exhaust$/.exec(slug);
  if (titaniumExhaust) add(`${titaniumExhaust[1]}-exhaust`);
  const titanium = /^(ipe-.+)-titanium$/.exec(slug);
  if (titanium) add(`${titanium[1]}-exhaust`);
  const exhaustSystem = /^(ipe-.+)-exhaust-system$/.exec(slug);
  if (exhaustSystem) add(`${exhaustSystem[1]}-exhaust`);

  return candidates;
}
