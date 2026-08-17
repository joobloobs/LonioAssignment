# Lessons

Patterns from corrections, per the self-improvement loop in CLAUDE.md. Reviewed at
session start; updated after any user correction.

## Two documents that must agree will eventually disagree

**Correction (user, form bug):** the onboarding form kept `rawAnswers` (unrestricted,
so hidden answers could reappear) and derived `effectiveAnswers` for the engine. The
renderer evaluated visibility against the *raw* document, the engine against the
*restricted* one. Flipping `residenceInSwitzerland` back to `true` left
`dailyReturnToGermany` and `gre1_gre2` on screen: `isNodeVisible` only checks a node's
own condition, so those questions stayed visible because raw still held
`countryOfResidence = "GERMANY"` — an answer that was itself no longer reachable.

**Rule:** `isNodeVisible` is one level deep; only `restrictToReachable`'s fixpoint is
transitive. Any consumer that decides *what exists* must be fed the fixpoint document.
Never hold a "raw" and a "derived" copy of the same state kept in sync by two different
algorithms — collapse to one document and re-derive on write. The nicer UX (hidden
answers reappearing) was not in `SPEC.md`; it was an unexamined UI choice paying for
itself with a whole bug class.

**Also:** verify UI-layer invariants with a test against the *real* canton flow, not
just the synthetic `testFlow` fixture — `packages/canton-zh/tests/form-restriction.test.ts`.
