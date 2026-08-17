# Zurich `tarifbestimmung` — bundle analysis

Source app: `https://www.services.zh.ch/app/quest/tarifbestimmung/prod/`
(confirmed from webpack `publicPath` in [runtime.formatted.js:73](runtime.formatted.js#L73))

Angular 9/10 (Ivy), production build. Three scripts, three webpack chunks:

| file | chunk | contents | business logic? |
|---|---|---|---|
| `runtime.js` | — | webpack bootstrap, 77 lines | no |
| `polyfills.js` | `[2]` | zone.js + core-js, 112 modules | no |
| `main.js` | `[1]` | lodash + **the whole app** | **yes** |

Formatted copies: `runtime.formatted.js`, `polyfills.formatted.js`, `main.formatted.js`.

**There is no lazy loading.** `runtime.js` never defines `__webpack_require__.e`, and its
chunk table is initialised as `{0:0}` only. Every chunk is loaded eagerly by `<script>` tag,
so these three files are the complete client. Nothing else needs to be scraped.

## `main.js` module map

Only 4 modules. Everything interesting is in `zUnb`.

| line | module | what |
|---:|---|---|
| [4](main.formatted.js#L4) | `0` | entry, requires `zUnb` |
| [7](main.formatted.js#L7) | `LvDl` | lodash (~4,570 lines — ignore) |
| [4577](main.formatted.js#L4577) | `YuTi` | stub |
| [4601](main.formatted.js#L4601) | `zUnb` | Angular runtime + **the application** |
| [18857](main.formatted.js#L18857) | `zn8P` | stub |

Within `zUnb`, the app code starts at ~line 14285. Everything before that is the Angular
framework itself.

## Symbol map (minified name → role)

| symbol | line | role |
|---|---:|---|
| `cl` | [14305](main.formatted.js#L14305) | base class; provides `hasInvalidPropertyValues` |
| `_l` | [14428](main.formatted.js#L14428) | **main service** — `getRate`, `getMainIncomeRate`, `getReplacementIncomeRate`, `getRateGroup` |
| `El` | [14858](main.formatted.js#L14858) | **child questionnaire service** — `getResultForMarriedPeople` / `getResultForUnmarriedPeople` |
| `Zl` | [15707](main.formatted.js#L15707) | **centre-of-life service** — cross-border (`boarderCrosser`) determination |
| `Il` | [14771](main.formatted.js#L14771) | `app-boolean-question` yes/no component |
| `ec` | [15850](main.formatted.js#L15850) | country-of-residence select component |

Ivy preserves property and method names, so the domain vocabulary survives intact
(`civilStatusMarriedOrRegisteredRelationship`, `alternatingCustody`, `boarderCrosser`, …).
Only local variables were mangled. This is close to readable source.

## The tariff code algorithm

`getMainIncomeRate` ([main.formatted.js:14597](main.formatted.js#L14597)) builds the code
as **`letter + digit + Y/N`**:

```
letter := rate group  (see table below)
digit  := min(number of children that count, 9)
Y/N    := recognizedReligiousAffiliation ? "Y" : "N"
```

**Letter selection**, before the cross-border remap:

| civil status | condition | letter |
|---|---|---|
| married / registered partnership | partner employed | `C` |
| married / registered partnership | partner not employed | `B` |
| single, divorced, separated, widowed | any child has `parentsRateJustified` | `H` |
| single, divorced, separated, widowed | otherwise | `A` |

**Cross-border remap** — `getRateGroup` ([14679](main.formatted.js#L14679)). If the person is a
cross-border commuter (`boarderCrosser === true`), the letter is substituted via `rateMap`
([14567–14570](main.formatted.js#L14567)):

```
A → L    H → P    B → M    C → N
```

**Replacement income** (`mainIncome === false`) — `getReplacementIncomeRate`
([14657](main.formatted.js#L14657)) skips all of the above entirely:
cross-border → `"Q"`, otherwise → `"G"`. No children, no religion, no civil status.
This is an easy edge case to miss.

## Cross-border determination (`Zl.getResult`, [15713](main.formatted.js#L15713))

```
residenceInSwitzerland = true            → boarderCrosser: false
countryOfResidence:
  GERMANY
    dailyReturnToGermany = true          → boarderCrosser: gre1_gre2
    dailyReturnToGermany = false
      dailyReturnReasonable = true       → boarderCrosser: NOT gre3
      dailyReturnReasonable = false      → boarderCrosser: false
  LIECHTENSTEIN
    dailyReturn = true                   → false + rate "Grundsätzlich keine
                                            Quellensteuerpflicht"
    dailyReturn = false
      >45 non-return days = true         → false, rate undefined
      >45 non-return days = false        → false + rate "Grundsätzlich keine
                                            Quellensteuerpflicht"
    (all Liechtenstein branches carry remark
     "Unter Vorbehalt des Doppelbesteuerungsabkommens")
  OTHER                                  → boarderCrosser: false
```

Note the Liechtenstein branch can return a `rate` **string** rather than a code, and
`getRate` ([14576](main.formatted.js#L14576)) lets that string **override** the computed
tariff code. So the output of the calculator is not always a `B2Y`-shaped code.

## Per-child evaluation (`El`, [14864](main.formatted.js#L14864))

Each child is a sub-questionnaire returning `{ parentsRateJustified, childCounts }`.
`childCounts` feeds the digit; `parentsRateJustified` decides `A` vs `H` for unmarried people.
There are two entirely separate decision trees — married
([14867](main.formatted.js#L14867)) and unmarried ([14972](main.formatted.js#L14972)) —
keyed on `group`:

- `UNDERAGE` (Minderjährig)
- `IN_FIRST_APPRENTICESHIP` (Volljährig und in Erstausbildung)
- `OTHER` (weder noch) → always `childCounts: false`

Inputs per child: `childInSameHousehold`, `parentalCare`, `sharedCustody`, `sameHousehold`,
`alternatingCustody`, `mainFinancialContributor`, `financiallySupported`.

The two trees genuinely differ. Example: unmarried + `UNDERAGE` + in-household + shared
custody + same household + **not** main financial contributor yields
`{parentsRateJustified: false, childCounts: false}` ([15000](main.formatted.js#L15000)),
whereas the married tree in the comparable position yields
`{parentsRateJustified: true, childCounts: false}` ([14899](main.formatted.js#L14899)).

## The completeness guard

`hasInvalidPropertyValues(entries, consumed)` ([14308](main.formatted.js#L14308)) is the
mechanism worth copying. Every branch pushes the field names it actually *read* onto a
`consumed` list, then this helper removes those from the full response and asserts that
**nothing else is still defined**.

In other words: if the user answered a question, then went back and changed an earlier answer
so that question is no longer reachable, the stale answer makes the result `undefined` rather
than silently contributing. It is a stale-answer detector implemented as a purity check on the
response object.

## Conditional visibility rules

Top-level form — `isVisible` ([16461](main.formatted.js#L16461)):

| field | shown when |
|---|---|
| `civilStatus` | `mainIncome === true` |
| `religiousAffiliation` | `civilStatus` answered |
| `partnerEmployed` | married **and** religion answered |
| `withChildren` | (married and `partnerEmployed` answered) or (unmarried and religion answered) |
| `centerOfLife` | (`mainIncome` and `withChildren` answered and **all child questionnaires complete**) or `mainIncome === false` |

Centre-of-life sub-form — `isVisible` ([16087](main.formatted.js#L16087)):

| field | shown when |
|---|---|
| `countryOfResidence` | `residenceInSwitzerland === false` |
| `dailyReturnToGermany` | country = GERMANY |
| `gre1_gre2` | GERMANY and daily return = true |
| `dailyReturnReasonable` | GERMANY and daily return = false |
| `gre3` | GERMANY and reasonable = true |
| `dailyReturnToLiechtenstein` | country = LIECHTENSTEIN |
| `moreThanFortyFiveNonReturnDays` | daily return to LI = false |

## Question labels (German, as shipped)

- `"Für welche Einkünfte möchten Sie den Quellensteuertarif ermitteln?"` — Erwerbseinkommen / Ersatzeinkünfte
- `"Zivilstand"` — Verheiratet oder eingetragene Partnerschaft / Ledig, Geschieden, Getrennt, Verwitwet
- `"Konfession"` — röm.-kath., christ.-kath., evang.-ref. / Keine oder andere
- `"Leibliche oder adoptierte Kinder der Person (oder der Ehegatten bzw. Partner)?"` — the title text switches on civil status ([16296](main.formatted.js#L16296))
- `"Wohnsitzstaat"` — Deutschland / Liechtenstein / Anderes Land
- `"Elterliche Sorge"`, `"Geteiltes Sorgerecht"`, `"Alternierende Obhut?"`, `"Ansässigkeitsbescheinigung beigebracht?"`

## Built-in test fixtures

`_l` ships an `examples` array ([14436](main.formatted.js#L14436)) with fully-populated
response objects and their expected results — e.g. a `countryOfResidence: "GERMANY"` case
with `result: {boarderCrosser: true}` ([14561](main.formatted.js#L14561)) and a matching
non-cross-border case ([14486](main.formatted.js#L14486)). These are the vendor's own
worked examples and make ready-made golden test cases.

## Caveats

- `gre1_gre2` / `gre3` are opaque form codes (Grenzgänger forms Gre-1/Gre-2/Gre-3). The
  bundle carries no explanatory text for them beyond the field names.
- Only Germany and Liechtenstein get special cross-border handling. Every other country
  collapses to `OTHER` → not a cross-border commuter.
- No tariff **rate tables** (actual percentages) are in the bundle — only the code. If you
  need amounts, that is a separate data source.
- The remaining `main.formatted.js` lines 4601–14285 are the Angular framework and can be
  ignored for extraction purposes.
