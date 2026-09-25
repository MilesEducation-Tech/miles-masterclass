/**
 * Commit message rules — see docs/engineering/git-workflow.md §3.
 *
 * Runs in two places: `.husky/commit-msg` locally, and a required CI job so
 * `--no-verify` only delays the failure instead of dodging it.
 *
 * The version bump is derived from these messages (docs/engineering/versioning.md §1),
 * so the `type` is the part that carries machine meaning — hence it is the part
 * enforced hardest.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The type list from CLAUDE.md, plus `revert` — git generates that one itself
    // (`git revert` writes `Revert "…"`), so banning it would block a legitimate
    // escape hatch nobody hand-writes.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'chore',
        'docs',
        'test',
        'style',
        'perf',
        'build',
        'ci',
        'revert',
      ],
    ],

    // why: NOT the conventional 72. Measured against this repo's own history —
    // five of the last forty subjects run 73–77 chars, all of them good, descriptive
    // messages (e.g. "refactor(services): convert every @Injectable to @Service, and
    // enforce it"). A limit that rejects the existing house style isn't enforcement,
    // it's the reason people reach for --no-verify. 100 is config-conventional's own
    // default and still refuses a rambling paragraph.
    'header-max-length': [2, 'always', 100],

    // why: warnings, not errors — and the footer rule matters as much as the body one.
    // This repo writes long, detailed commit bodies containing endpoint tables and file
    // paths; commitlint parses several of those lines as *footers*, where the length rule
    // is an error by default. Measured: `36bb915 feat(caira): …` is a well-formed commit
    // that config-conventional rejects for exactly this reason. A rule that fails a good
    // commit over an unwrappable path or URL is how --no-verify becomes a habit.
    'body-max-line-length': [1, 'always', 100],
    'footer-max-line-length': [1, 'always', 100],

    // why: scope stays FREE-FORM here, deliberately, and this is the one rule where
    // strictness would have backfired. Two measurements:
    //   1. History uses 23 distinct scopes; only 4 (`auth`, `cpe-tracker`, `core`,
    //      `deps`) appear in CLAUDE.md's list. The most common by far is `structure`
    //      (15 commits) — the active refactor's own mandated convention, which a
    //      locked enum would reject outright.
    //   2. CLAUDE.md's list is itself stale: it names `blog` (that feature was
    //      removed) and `cpe-tracker` (the folder is `tracker`).
    // So scope is a convention reviewers hold you to, not a gate — anywhere. If that
    // ever changes, the one place to enforce it is the PR title (that is what lands on
    // master), and .github/workflows/pr-title.yml holds the measured list ready to
    // uncomment. One list, one place. See the note in git-workflow.md §3.
    'scope-empty': [0],
  },
};
