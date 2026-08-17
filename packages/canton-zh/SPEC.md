# SPEC — Canton Zurich source-tax tariff determination

| | |
|---|---|
| Spec version | **1.0.0** (engineVersion `zh-1.0.0`) |
| Source | `https://www.services.zh.ch/app/quest/tarifbestimmung/prod/` |
| Evidence | `extraction_reference/main.formatted.js` (+ `EXTRACTION-NOTES.md`), line references below |
| Status | Normative — implementation and fixtures are tested against this document |

This document is the contract. The flow definition (`src/flow.ts`), the compute
function (`src/compute.ts`), and the fixtures implement it; the behavioral snapshot
and the differential harness verify it against the vendor's own code.

## 1. Answer document

All questions are booleans or small enums. Field names follow the vendor bundle for
traceability (Ivy preserved the original property names).

```
ZhAnswers
├─ mainIncome                                boolean   true = employment income, false = replacement income
├─ civilStatusMarriedOrRegisteredRelationship boolean  true = married / registered partnership
├─ recognizedReligiousAffiliation            boolean   recognized religious community → church tax Y
├─ partnerEmployed                           boolean
├─ withChildren                              boolean
├─ children                                  ZhChildAnswers[]        (1..15 when reachable)
│  ├─ group                                  'UNDERAGE' | 'IN_FIRST_APPRENTICESHIP' | 'OTHER'
│  ├─ childInSameHousehold                   boolean
│  ├─ parentalCare                           boolean
│  ├─ sharedCustody                          boolean
│  ├─ sameHousehold                          boolean
│  ├─ alternatingCustody                     boolean
│  ├─ mainFinancialContributor               boolean   true = the taxable person, false = the other parent
│  └─ financiallySupported                   boolean   >50% of child maintenance
└─ centerOfLife                              ZhCenterOfLifeAnswers
   ├─ residenceInSwitzerland                 boolean
   ├─ countryOfResidence                     'GERMANY' | 'LIECHTENSTEIN' | 'OTHER'
   ├─ dailyReturnToGermany                   boolean
   ├─ gre1_gre2                              boolean   residence certificate, forms Gre-1/Gre-2
   ├─ dailyReturnToCountryOfResidenceReasonable boolean
   ├─ gre3                                   boolean   >60 non-return days proven, form Gre-3
   ├─ dailyReturnToLiechtenstein             boolean
   └─ moreThanFortyFiveNonReturnDays         boolean
```

## 2. Visibility rules

A question is answerable iff its condition holds. Anything answered while
unreachable invalidates the document (see §6). `married` abbreviates
`civilStatusMarriedOrRegisteredRelationship = true`.

### 2.1 Top level — vendor `isVisible` [main.formatted.js:16461]

| question | reachable when |
|---|---|
| `mainIncome` | always |
| `civilStatus…` | `mainIncome = true` |
| `recognizedReligiousAffiliation` | `civilStatus…` answered |
| `partnerEmployed` | married ∧ religion answered |
| `withChildren` | (married ∧ `partnerEmployed` answered) ∨ (¬married ∧ religion answered) |
| `children` (repeating) | `withChildren = true` — min 1 item |
| `centerOfLife` (group) | (`mainIncome = true` ∧ `withChildren` answered ∧ all children complete) ∨ `mainIncome = false` |

“All children complete” is vacuously true when the children list is unreachable —
vendor `allChildQuestionnairesCompleted` [16490] over an empty list.

### 2.2 Per child — vendor `isVisible` [15475]

The vendor form renders three UI slots (`parentalCareYesNo`, `parentalCareCustody`,
`sharedCustody`) that write to **two** response fields: `parentalCareYesNo` →
`parentalCare` [15252], while `parentalCareCustody` (options “Geteiltes/Alleiniges
Sorgerecht”) [15277] and `sharedCustody` [15296] both → `sharedCustody`. This spec
models the two fields; the merged visibility below is therefore vendor-exact.
`inHH` abbreviates `childInSameHousehold`.

| question | reachable when |
|---|---|
| `group` | always |
| `childInSameHousehold` | group ∈ {UNDERAGE, IN_FIRST_APPRENTICESHIP} |
| `parentalCare` | UNDERAGE ∧ ¬married ∧ `inHH = false` |
| `sharedCustody` | UNDERAGE ∧ (`inHH = true` ∨ (married ∧ `inHH = false`)) |
| `sameHousehold` | (UNDERAGE ∧ `inHH = true` ∧ `sharedCustody = true`) ∨ (APPRENTICESHIP ∧ `inHH = true`) |
| `alternatingCustody` | UNDERAGE ∧ ((`inHH = false` ∧ `parentalCare = true`) ∨ (`inHH = true` ∧ `sameHousehold = false`) ∨ (married ∧ `inHH = false` ∧ `sharedCustody = true`)) |
| `mainFinancialContributor` | (UNDERAGE ∧ ((`inHH = false` ∧ `alternatingCustody = true`) ∨ (`inHH = true` ∧ `sameHousehold = true` ∧ ¬married) ∨ (`inHH = true` ∧ `alternatingCustody = true`))) ∨ (APPRENTICESHIP ∧ ¬married ∧ `sameHousehold = true`) |
| `financiallySupported` | APPRENTICESHIP ∧ ((`inHH = true` ∧ `sameHousehold = false`) ∨ `inHH = false`) |

`married` inside a child item resolves lexically to the top-level answer (vendor
passes `partnerEmployeed` down and derives married-ness from its presence [15580]).

### 2.3 Centre of life — vendor `isVisible` [16087]

| question | reachable when |
|---|---|
| `residenceInSwitzerland` | always |
| `countryOfResidence` | `residenceInSwitzerland = false` |
| `dailyReturnToGermany` | country = GERMANY |
| `gre1_gre2` | GERMANY ∧ `dailyReturnToGermany = true` |
| `dailyReturnToCountryOfResidenceReasonable` | GERMANY ∧ `dailyReturnToGermany = false` |
| `gre3` | GERMANY ∧ `…Reasonable = true` |
| `dailyReturnToLiechtenstein` | country = LIECHTENSTEIN |
| `moreThanFortyFiveNonReturnDays` | `dailyReturnToLiechtenstein = false` (vendor-exact: no explicit country guard) |

## 3. Per-child result — vendor `El` [14867 married / 14972 unmarried]

Each complete child yields `{ justified, counts }`: `counts` feeds the tariff digit;
`justified` decides H vs A for unmarried persons. The married and unmarried decision
trees genuinely differ. Rows below are exhaustive over reachable paths.

### 3.1 Married or registered partnership [14867]

| row | group | path | justified | counts |
|---|---|---|---|---|
| M1 | UNDERAGE | inHH ∧ shared ∧ same | T | T |
| M2 | UNDERAGE | inHH ∧ shared ∧ ¬same ∧ alt ∧ mfc | T | T |
| M3 | UNDERAGE | inHH ∧ shared ∧ ¬same ∧ alt ∧ ¬mfc | T | F |
| M4 | UNDERAGE | inHH ∧ shared ∧ ¬same ∧ ¬alt | T | F |
| M5 | UNDERAGE | inHH ∧ ¬shared | T | T |
| M6 | UNDERAGE | ¬inHH ∧ shared ∧ alt ∧ mfc | T | T |
| M7 | UNDERAGE | ¬inHH ∧ shared ∧ alt ∧ ¬mfc | T | F |
| M8 | UNDERAGE | ¬inHH ∧ shared ∧ ¬alt | T | F |
| M9 | UNDERAGE | ¬inHH ∧ ¬shared | T | F |
| M10 | APPRENTICESHIP | inHH ∧ same | T | T |
| M11 | APPRENTICESHIP | inHH ∧ ¬same ∧ fin | T | T |
| M12 | APPRENTICESHIP | inHH ∧ ¬same ∧ ¬fin | T | F |
| M13 | APPRENTICESHIP | ¬inHH ∧ fin | T | T |
| M14 | APPRENTICESHIP | ¬inHH ∧ ¬fin | T | F |
| M15 | OTHER | — | T | F |

(For married persons `justified` is always true; it is also never consulted.)

### 3.2 Unmarried (single, divorced, separated, widowed) [14972]

| row | group | path | justified | counts |
|---|---|---|---|---|
| U1 | UNDERAGE | inHH ∧ shared ∧ same ∧ mfc | T | T |
| U2 | UNDERAGE | inHH ∧ shared ∧ same ∧ ¬mfc | F | F |
| U3 | UNDERAGE | inHH ∧ shared ∧ ¬same ∧ alt ∧ mfc | T | T |
| U4 | UNDERAGE | inHH ∧ shared ∧ ¬same ∧ alt ∧ ¬mfc | F | F |
| U5 | UNDERAGE | inHH ∧ shared ∧ ¬same ∧ ¬alt | T | T |
| U6 | UNDERAGE | inHH ∧ ¬shared | T | T |
| U7 | UNDERAGE | ¬inHH ∧ pc ∧ alt ∧ mfc | T | T |
| U8 | UNDERAGE | ¬inHH ∧ pc ∧ alt ∧ ¬mfc | F | F |
| U9 | UNDERAGE | ¬inHH ∧ pc ∧ ¬alt | F | F |
| U10 | UNDERAGE | ¬inHH ∧ ¬pc | F | F |
| U11 | APPRENTICESHIP | inHH ∧ same ∧ mfc | T | T |
| U12 | APPRENTICESHIP | inHH ∧ same ∧ ¬mfc | F | F |
| U13 | APPRENTICESHIP | inHH ∧ ¬same ∧ fin | T | T |
| U14 | APPRENTICESHIP | inHH ∧ ¬same ∧ ¬fin | F | F |
| U15 | APPRENTICESHIP | ¬inHH ∧ fin | **F** | **T** |
| U16 | APPRENTICESHIP | ¬inHH ∧ ¬fin | F | F |
| U17 | OTHER | — | F | F |

⚠ U15 [15078–15087] is the easy-to-miss asymmetry: the child **counts** for the
digit but does **not** justify the single-parent (H) tariff.

## 4. Cross-border determination — vendor `Zl.getResult` [15713]

Yields `{ boarderCrosser, override?, remark? }`:

| path | boarderCrosser | override / remark |
|---|---|---|
| residence in CH | false | — |
| DE ∧ dailyReturn ∧ gre1_gre2=x | **x** | — |
| DE ∧ ¬dailyReturn ∧ reasonable ∧ gre3=x | **¬x** | — |
| DE ∧ ¬dailyReturn ∧ ¬reasonable | false | — |
| LI ∧ dailyReturn | false | override = `Grundsätzlich keine Quellensteuerpflicht`; remark = DTA |
| LI ∧ ¬dailyReturn ∧ >45 days | false | remark = DTA |
| LI ∧ ¬dailyReturn ∧ ¬(>45 days) | false | override = `Grundsätzlich keine Quellensteuerpflicht`; remark = DTA |
| OTHER country | false | — |

DTA remark = `Unter Vorbehalt des Doppelbesteuerungsabkommens`. Both strings are
canonical vendor values and are stored verbatim (translation is a UI concern).

## 5. Tariff assembly — vendor `getRate` [14576], `getMainIncomeRate` [14597], `getReplacementIncomeRate` [14657], `getRateGroup` [14679]

**Replacement income** (`mainIncome = false`): code is a bare letter —
`Q` if boarderCrosser else `G`. No digit, no church-tax suffix, no civil
status/religion/children involved.

**Main income**:

```
letter:  married ∧ partnerEmployed        → C
         married ∧ ¬partnerEmployed       → B
         ¬married ∧ any child justified   → H
         ¬married otherwise               → A
cross-border remap [14567]: A→L  B→M  C→N  H→P   (applied iff boarderCrosser)
digit:   withChildren = false → 0, else min(#children with counts=true, 9)
suffix:  recognizedReligiousAffiliation ? Y : N
code:    letter + digit + suffix          (e.g. B2Y, P3N)
```

**Override**: if the centre-of-life result carries an `override` string (LI rows),
it **replaces** the code entirely → outcome kind `noLiability`. A centre-of-life
`remark` is attached to the outcome in all cases where present.

## 6. Validity guard

The vendor threads `consumed`-field lists through every branch
(`hasInvalidPropertyValues` [14308]) so that answers to no-longer-reachable
questions poison the result. This module inherits the generalized law from
engine-core instead: **a document is valid iff every answered question is
reachable** (§2) — stale ⇒ no result. Equivalent in effect, defined once.

## 7. Known deviations from the vendor (deliberate)

1. **Stricter staleness on main income**: the vendor ignores a stale
   `partnerEmployed` after a civil-status flip (UI-managed); we invalidate. No
   reachable-complete document is affected (the differential corpus proves parity).
2. **Children capped at 15** in schema/UI (digit clamps at 9 regardless; vendor is
   unbounded).
3. **Single label per question**: vendor varies some titles by context (custody
   options, gre3 wording by income type); labels are UI data here, logic unaffected.
4. Replacement-income codes are single letters `G`/`Q` exactly as the vendor emits
   them — they deliberately do not match the `letter+digit+Y/N` shape.

## 8. Verification anchors

- `fixtures/vendor-examples.json` — the two worked examples the vendor ships in the
  bundle [14436–14565], expected `H3N` and `P3N`.
- `fixtures/curated.json` — hand-derived cases per §3–§5 rows, incl. U15, LI
  overrides, replacement income, and every remap letter.
- `fixtures/behavior-snapshot.jsonl` — exhaustive enumeration (≤2 children) of
  reachable complete documents → outcomes; regenerated via `pnpm snapshot`.
- Differential harness (`tests/vendor-harness.ts`) — executes `_l`/`El`/`Zl` from
  the captured bundle, offline, over the full enumeration and asserts agreement.
