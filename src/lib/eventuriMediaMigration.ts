export type EventuriMediaMigrationInput = {
  primaryImage?: string | null;
  mediaSources: readonly string[];
  variantImages: readonly (string | null | undefined)[];
};

export type EventuriMediaMigrationDecision =
  | {
      canPersist: true;
      expectedSources: string[];
    }
  | {
      canPersist: false;
      expectedSources: string[];
      missingSources: string[];
      primaryImageMissing: boolean;
      reason: string;
    };

export function getExpectedEventuriMediaSources(input: EventuriMediaMigrationInput): string[] {
  return Array.from(
    new Set(
      [input.primaryImage, ...input.mediaSources, ...input.variantImages].filter(
        (source): source is string => typeof source === "string" && source.length > 0
      )
    )
  );
}

/**
 * An Eventuri snapshot is only safe to persist when every referenced source
 * asset has a migrated URL. This prevents a partial upload from clearing the
 * primary image or replacing a complete gallery with the successful subset.
 */
export function decideEventuriMediaMigration(
  input: EventuriMediaMigrationInput,
  resolvedSources: ReadonlyMap<string, string>
): EventuriMediaMigrationDecision {
  const expectedSources = getExpectedEventuriMediaSources(input);
  const missingSources = expectedSources.filter((source) => !resolvedSources.has(source));

  if (missingSources.length === 0) {
    return { canPersist: true, expectedSources };
  }

  const primaryImageMissing = Boolean(
    input.primaryImage && missingSources.includes(input.primaryImage)
  );
  const missingLabel = `${missingSources.length} of ${expectedSources.length} expected media assets failed`;

  return {
    canPersist: false,
    expectedSources,
    missingSources,
    primaryImageMissing,
    reason: primaryImageMissing
      ? `media migration incomplete: primary image missing; ${missingLabel}`
      : `media migration incomplete: ${missingLabel}`,
  };
}
