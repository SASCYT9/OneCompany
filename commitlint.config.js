/**
 * Conventional Commits, validated in CI by .github/workflows/commitlint.yml.
 * Reference: https://www.conventionalcommits.org/
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "docs",
        "test",
        "build",
        "ci",
        "chore",
        "style",
      ],
    ],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "footer-leading-blank": [1, "always"],
    // Body and footer often contain unwrappable URLs, stack traces, or
    // shell snippets — wrapping them at 100 cols hurts readability and
    // breaks copy-paste. Disable the line-length checks; keep the
    // header limit, which is the part that shows in `git log --oneline`.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
