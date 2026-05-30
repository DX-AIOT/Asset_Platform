# AI Pipeline — Model Docs & Usage Guide

This module (`apps/api/src/ai`) hosts all AI/ML and data-intelligence features of
the AIoT Asset Platform built across Sprint 1 & 2. Every feature is exposed under
the `/ai` route prefix and is wired through `AiModule`.

| Capability | Endpoint | Service | External model |
|------------|----------|---------|----------------|
| Vision recognition | `POST /ai/recognize` | `VisionRecognitionService` | OpenAI `gpt-4o-mini` |
| Condition assessment | `POST /ai/condition-assessment` | `ConditionAssessmentService` | OpenAI `gpt-4o-mini` (configurable) |
| OCR receipt/invoice | `POST /ai/ocr-receipt` | `OcrReceiptService` | OpenAI `gpt-4.1-mini` (configurable) |
| Market price valuation | `POST /ai/valuation` | `MarketValuationService` | none (local corpus) |
| Barcode/QR lookup | `POST /ai/barcode-lookup` | `BarcodeLookupService` | none (local corpus) |
| Auto-category + duplicate | `POST /ai/auto-category-duplicate` | `AutoCategoryDuplicateService` | none (local heuristics) |

> **Design principle — local-first.** Only vision recognition and OCR call an
> external model, and both fall back to a deterministic local mock when no API
> key is configured (or when `OPENAI_LOCAL_MODE=true`). Valuation, barcode, and
> auto-category run entirely offline. This keeps Docker, CI, and offline dev
> fully functional without cloud credentials.

---

## 1. Vision Recognition Pipeline

**Service:** `vision-recognition.service.ts` · **Endpoint:** `POST /ai/recognize`

Categorizes a household/asset photo into structured fields with per-field
confidence.

### How it works

1. Controller receives `{ imageBase64 }` (`RecognizeAssetDto`, min length 32).
2. If running in local-mock mode (`useLocalMock`), returns a deterministic
   low-confidence stub immediately (no network call).
3. Otherwise calls OpenAI's `responses` API with model **`gpt-4o-mini`**, sending
   the image inline as a `data:image/jpeg;base64,…` URL.
4. The request pins a **strict JSON schema** (`asset_vision_result`) so the model
   must return `name`, `brand`, `model`, `category` (each nullable) plus a
   `confidence` object with a `0..1` score per field. `max_output_tokens: 300`.
5. The system prompt is in Vietnamese ("Bạn là chuyên gia phân loại tài sản gia
   dụng tại Việt Nam…") — the model is primed to recognize VN household assets.

### Response (`AssetRecognitionResult` from `@dx-aiot/shared`)

- `name/brand/model/category`: each `{ value, confidence }`.
- `fallbackSuggested`: `true` when `name` or `model` is missing, **or**
  `confidence.name < 0.7` **or** `confidence.model < 0.65`. The client should then
  prompt the user to confirm/edit or fall back to manual entry.
- `latencyMs`: end-to-end model roundtrip time.

### Fallback behavior

| Situation | Result |
|-----------|--------|
| No API key / `OPENAI_LOCAL_MODE=true` | `mockRecognitionResult` → all fields null, `category='other'@0.4`, `fallbackSuggested=true` |
| Low confidence / missing name or model | Real model values returned, `fallbackSuggested=true` |
| Model returns valid high-confidence JSON | Values returned, `fallbackSuggested=false` |

**Complexity:** `O(1)` local processing + one model inference request.

---

## 1b. Condition Assessment Pipeline

**Service:** `condition-assessment.service.ts` ·
**Endpoint:** `POST /ai/condition-assessment`

Grades the **physical condition** of an asset from a photo — distinct from
vision recognition (which identifies *what* the asset is).

### How it works

1. Accepts `ConditionAssessmentDto`: an optional `itemId` plus a photo as either
   `photoUrl` **or** `imageBase64` (+ `mimeType` ∈ `image/png|jpeg|webp`). One
   image source is required → else `400 BadRequest`.
2. In local-mock mode (no API key / `OPENAI_LOCAL_MODE=true`), returns a
   deterministic stub (`condition: 'good'`, `confidence: 0`,
   `fallbackSuggested: true`).
3. Otherwise calls OpenAI's `responses` API with model **`gpt-4o-mini`** (override
   via `OPENAI_VISION_MODEL`), pinning a **strict JSON schema**
   (`condition_assessment`) so the model must return
   `condition ∈ {excellent, good, fair, poor}`, a `0..1` `confidence`, and a
   short `notes` string. `max_output_tokens: 300`.
4. The system prompt anchors each grade to concrete visual evidence — visible
   wear, scratches, dents, cracks, damage, missing parts, and cleanliness.
5. `normalize()` validates the grade (case-insensitive), clamps confidence to
   `[0,1]`, and trims notes. An unknown/missing grade degrades to **`fair` with
   `confidence: 0` and `fallbackSuggested: true`** rather than throwing.

### Persistence & integration

- When `itemId` is supplied and the item exists, the assessed grade is written to
  `Item.condition` via `ConditionAssessmentService.toItemCondition(...)`:
  `excellent → like_new · good → good · fair → fair · poor → poor` (the storage
  enum has no `excellent`, so it maps to its nearest member `like_new`). A missing
  item is a no-op — the assessment is still returned.
- **Auto-assess on capture:** the item create/update flow can call this right
  after AI capture to populate `condition` automatically. The standalone endpoint
  is the integration seam FrontendDev consumes; once a write-side item
  create/update endpoint lands, wire `assess()` into it (see DXS-90 follow-up).

### Response (`ConditionAssessmentResult` from `@dx-aiot/shared`)

`condition` (`excellent|good|fair|poor`), `confidence` (`0..1`), `notes`
(reasoning), `fallbackSuggested` (`true` when a neutral default was used), and
`latencyMs`.

**Complexity:** `O(1)` local processing + one model inference request.

---

## 2. OCR Receipt / Invoice Pipeline

**Service:** `ocr-receipt.service.ts` · **Endpoint:** `POST /ai/ocr-receipt`

Extracts purchase metadata from a receipt/invoice photo to auto-populate asset
purchase date, price, and warranty.

### How it works

1. Accepts `OcrReceiptDto`: either `imageUrl` **or** `imageBase64` (+ `mimeType`
   ∈ `image/png|jpeg|webp`). One of the two image sources is required.
2. In local-mock mode, returns a null/zero-confidence stub.
3. Otherwise POSTs to `${OPENAI_BASE_URL}/responses` with model
   **`gpt-4.1-mini`** (override via `OPENAI_OCR_MODEL`). The prompt asks for JSON
   only with keys `purchaseDate, totalAmount, currency, warrantyExpiryDate,
   warrantyPeriodMonths, confidence`, and explicitly accepts **Vietnamese and
   English** receipts.
4. The raw model output is normalized (`normalize()`), which is the data-quality
   core of this pipeline.

### Normalization logic (deterministic, model-independent)

- **Amount** (`normalizeAmount`): strips currency symbols, then disambiguates
  thousand vs decimal separators heuristically — handles `1.234,56` (EU/VN),
  `1,234.56` (US), and bare grouped forms like `1,000` / `1.000`.
- **Currency** (`normalizeCurrency`): maps `đ/vnđ/vnd/dong → VND`,
  `$/usd/us dollar → USD`, else upper-cases the raw token.
- **Date** (`normalizeDate`): parses `DD/MM/YYYY`, `YYYY-MM-DD`, 2-digit years
  (`expandYear`: `<100 → 2000+yy`), validates real calendar dates, emits ISO
  `YYYY-MM-DD`. Invalid dates → `null`.
- **Warranty expiry**: uses an explicit `warrantyExpiryDate` if present;
  otherwise derives it from `purchaseDate + warrantyPeriodMonths` (`addMonths`).
- **Confidence**: clamped to `[0, 1]`; non-numeric → `0`.

### Error handling

- Missing both image sources → `400 BadRequest`.
- Non-2xx from OpenAI, missing `output_text`, or non-JSON body →
  `500 InternalServerError` with context.

**Complexity:** `O(n)` time / `O(1)` space over each small field string; latency
is dominated by the model call.

---

## 3. Market Price Intelligence (Valuation)

**Service:** `market-valuation.service.ts` + `market-data.ts` ·
**Endpoint:** `POST /ai/valuation`

Estimates current resale value from category, condition, age, and comparable
market data. Runs **fully offline** against a seeded reference corpus.

### Valuation formula

```
estimatedValue = baselinePrice × depreciation(age, category) × conditionFactor
depreciation(age) = max(floor, (1 − annualRate) ^ age)
```

### Data sources

- **`MARKET_COMPARABLES`** (in `market-data.ts`): ~30 seeded "new"/MSRP reference
  products across 9 categories (phones, laptops, tablets, electronics,
  appliances, furniture, vehicles, jewelry, watches), each with matching
  keywords and a USD `basePrice`.
- **`DEPRECIATION_PROFILES`**: per-category `annualRate` + `floor` (e.g. phones
  `0.22/0.08`, jewelry `0.04/0.5` — electronics depreciate fastest,
  jewelry/watches slowest).
- **`CONDITION_FACTORS`**: `new 1.0 · like_new 0.92 · good 0.8 · fair 0.6 · poor
  0.4` (default `good`).
- **`CATEGORY_MEDIAN_BASELINE`**: precomputed per-category median, used as a last
  resort.

> The seeded corpus deliberately mirrors the `BarcodeLookupService` pattern. A
> live price-API/scraper adapter can replace or augment it **without changing
> the algorithm or the response shape**.

### Baseline-selection / confidence ladder

| Condition | Baseline | `method` | `confidence` |
|-----------|----------|----------|--------------|
| Strong comparable (`matchScore ≥ 0.34`) | comparable price | `comparable` | `high` |
| Weak comparable (`0.12 ≤ score < 0.34`) | comparable price | `comparable` | `medium` |
| No comparable, purchase price given | purchase price | `purchase_price` | `medium` (supported cat) / `low` |
| No comparable, no price, supported cat | category median | `category_median` | `low` |
| Unsupported category | global median | `category_median` | `low` |

`matchScore` = asymmetric token overlap: `keywordCoverage × 0.6 + queryCoverage ×
0.4` — favours comparables whose distinctive keywords (`iphone`, `14`, `pro`)
appear in the request name. Category strings are normalized via aliases
(`phone/smartphone → mobile_phones`, `motorbike/car → vehicles`, …). Age is
capped at 40 years.

### Response (`ValuationResult`)

`estimatedValue`, `currency`, `category` (normalized or `other`), `confidence`,
up to 3 `comparables[]` with `matchScore`, and `basis = { baselinePrice,
ageYears, depreciationFactor, conditionFactor, method }`. `cached: true` when
served from cache.

### Caching (`valuation-cache.service.ts`)

- 24h TTL, keyed by normalized `name|category|condition|year|price|currency`.
- Uses **Redis** when `REDIS_URL` is set; otherwise a process-local TTL map
  (pruned lazily on access).
- **Redis failures never break a request** — `lazyConnect`, `maxRetriesPerRequest:
  1`, `enableOfflineQueue: false`, and every get/set is wrapped to degrade to a
  cache miss / in-memory fallback. Disable entirely with
  `VALUATION_CACHE_DISABLED=true`.

**Complexity:** `O(M·(Tq+Tc))` — linear in corpus size `M`, with `Tq/Tc` query /
comparable token counts; `O(Tq)` space. Cache get/set `O(1)` average.

---

## 4. Barcode / QR Lookup

**Service:** `barcode-lookup.service.ts` · **Endpoint:** `POST /ai/barcode-lookup`

Resolves a scanned barcode/QR payload to product metadata.

- Backed by a seeded `Map<barcode, product>` (EAN-13 samples for Samsung,
  Mitsubishi, Razer). `O(1)` average lookup, `O(n)` space.
- Request `{ barcode }`; empty/blank → `400 BadRequest` (validated in controller).
- Response `BarcodeLookupResponseDto`: `{ found, barcode, product|null,
  fallbackOnly }`. On a miss, `found=false` and `fallbackOnly=true` — the
  **integration point** signalling the client to fall through to vision
  recognition or manual entry.
- Like the valuation corpus, this map is a stand-in for a real product database
  / GS1 API; swapping in a live adapter does not change the response contract.

---

## 5. Auto-Category & Duplicate Detection

**Service:** `auto-category-duplicate.service.ts` ·
**Endpoint:** `POST /ai/auto-category-duplicate`

Two heuristics in one call — predict a canonical category and flag likely
duplicates against existing inventory. Runs offline (no model call).

### Auto-category

- Keyword rules over 9 canonical categories (`smartphone, laptop, tablet, tv,
  refrigerator, washing_machine, air_conditioner, motorbike, camera`, else
  `other`). Keywords include **Vietnamese** terms (`tủ lạnh`, `máy giặt`, `điều
  hòa`, `xe máy`).
- Scores the concatenation of `name+brand+model+categoryHint`; multi-word
  keywords weigh `1.2` vs `1.0`. Confidence = `min(0.98, 0.62 + bestScore×0.12)`;
  no match → `other @ 0.5`.

### Duplicate detection

- Per inventory item: `score = jaccard(nameTokens) × 0.68 + sameBrand(0.14) +
  sameModel(0.22) + sameCategoryHint(0.08)`, capped at `1`.
- Tokenization is Unicode-aware (`\p{L}\p{N}`), lower-cased, drops 1-char tokens.
- Matches with `score ≥ 0.70` are returned (sorted desc) with a human-readable
  `reason` (`name_sim=…, same_brand, same_model`). `isDuplicateLikely=true` when
  any match `≥ 0.82`.

**Complexity:** category scoring `O(C·K + T)`; duplicate scoring `O(N·L)`; space
`O(N+T)` — `C` categories, `K` keywords/category, `T` candidate tokens, `N`
inventory size, `L` token length/item.

---

## Configuration Guide

All AI config is read via `ConfigService` (env vars). Boolean vars accept
`true/1/yes/on`.

| Variable | Used by | Default | Purpose |
|----------|---------|---------|---------|
| `OPENAI_LOCAL_MODE` | Vision, OCR | `true` when no key, else `false` | Force deterministic local mock; **no cloud call**. Keep `true` for offline dev/CI/Docker. |
| `OPENAI_API_KEY` | Vision, OCR | — | Required only when `OPENAI_LOCAL_MODE=false`. |
| `OPENAI_BASE_URL` | Vision, OCR | `https://api.openai.com/v1` | Point at OpenAI or an OpenAI-compatible gateway. |
| `OPENAI_OCR_MODEL` | OCR | `gpt-4.1-mini` | Override the OCR model. (Recognition vision model `gpt-4o-mini` is currently hardcoded.) |
| `OPENAI_VISION_MODEL` | Condition assessment | `gpt-4o-mini` | Override the condition-assessment vision model. |
| `REDIS_URL` | Valuation cache | — | Enables Redis-backed 24h cache; absent → in-memory TTL map. |
| `VALUATION_CACHE_DISABLED` | Valuation cache | `false` | Disable Redis entirely (force in-memory). |

Reference templates: `.env.template` (repo root) and `docker-compose.yml`.
Valuation / barcode / auto-category need **no** configuration.

### Minimal setups

- **Offline / CI / Docker:** `OPENAI_LOCAL_MODE=true` (or simply omit
  `OPENAI_API_KEY`). Everything works; vision/OCR return mock results.
- **Full cloud:** `OPENAI_LOCAL_MODE=false` + `OPENAI_API_KEY=sk-…`
  (+ optional `OPENAI_OCR_MODEL`, `REDIS_URL`).

---

## Limitations & Accuracy Notes

### Confidence thresholds (quick reference)

| Pipeline | Threshold | Effect |
|----------|-----------|--------|
| Vision | `name<0.7` or `model<0.65` or missing name/model | `fallbackSuggested=true` |
| Valuation | comparable `matchScore ≥ 0.34` | `high` |
| Valuation | `0.12 ≤ matchScore < 0.34` | `medium` |
| Duplicate | item `score ≥ 0.70` | surfaced as a match |
| Duplicate | item `score ≥ 0.82` | `isDuplicateLikely=true` |
| Auto-category | confidence ceiling | `0.98` |

### Known edge cases & caveats

- **Local-mock results are not predictions.** With no API key, vision returns
  all-null and OCR returns null/`confidence: 0`. Downstream code must treat
  `fallbackSuggested=true` / `confidence: 0` as "ask the user", not "no asset".
- **Seeded corpora are small.** Valuation comparables (~30) and barcode entries
  (3) are demonstration datasets. Unknown phones, unlisted barcodes, etc. fall to
  median/`fallbackOnly` paths. Replace with live adapters before production
  accuracy claims.
- **Valuation is heuristic, not appraisal.** Exponential depreciation + a flat
  condition multiplier approximate secondhand curves; luxury/collectible
  appreciation (e.g. some watches) is **not** modeled — values only ever decay.
- **Vision model is region-primed.** The Vietnamese system prompt biases toward
  VN household assets; non-VN or non-household inputs may score lower.
- **OCR amount parsing is heuristic.** Mixed/ambiguous separator formats are
  resolved by best-effort rules; verify high-value extractions. Currency symbols
  beyond VND/USD pass through upper-cased and unmapped.
- **Duplicate detection is lexical**, not semantic — relies on token overlap +
  brand/model/category matches. Different wording for the same item (or matching
  model codes across different products) can mis-score.
- **`gpt-4o-mini` vision model is hardcoded** (unlike OCR). Changing it requires
  a code edit.

---

## Source Map

| File | Responsibility |
|------|----------------|
| `ai.module.ts` | DI wiring for all AI services/controllers |
| `ai.controller.ts` | `recognize`, `barcode-lookup`, `valuation`, `condition-assessment` routes |
| `condition-assessment.service.ts` | OpenAI condition grading + local mock + Item persistence |
| `ocr-receipt.controller.ts` | `ocr-receipt` route |
| `asset-intelligence.controller.ts` | `auto-category-duplicate` route |
| `vision-recognition.service.ts` | OpenAI vision categorization + local mock |
| `ocr-receipt.service.ts` | OpenAI OCR call + deterministic normalization |
| `market-valuation.service.ts` | Valuation algorithm + comparable matching |
| `market-data.ts` | Seeded comparables, depreciation/condition tables |
| `valuation-cache.service.ts` | 24h Redis / in-memory valuation cache |
| `barcode-lookup.service.ts` | Seeded barcode → product lookup |
| `auto-category-duplicate.service.ts` | Keyword categorization + duplicate scoring |
| `dto/` | Request validation (`class-validator`) |
