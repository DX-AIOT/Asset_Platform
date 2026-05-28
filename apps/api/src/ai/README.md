# Vision Recognition API Contract

## Endpoint

`POST /ai/recognize`

Request body:

```json
{
  "imageBase64": "<base64-image>"
}
```

Response body (`AssetRecognitionResult` from `@dx-aiot/shared`):

- `name.value`, `brand.value`, `model.value`, `category.value`
- `name.confidence`, `brand.confidence`, `model.confidence`, `category.confidence` in `[0, 1]`
- `fallbackSuggested`: `true` when low-confidence or missing `name/model`
- `latencyMs`: model roundtrip latency in milliseconds

## Endpoint

`POST /ai/auto-category-duplicate`

Request body:

```json
{
  "candidate": {
    "name": "Apple iPhone 14 Pro 128GB",
    "brand": "Apple",
    "model": "A2890",
    "categoryHint": "phone"
  },
  "inventory": [
    {
      "id": "item-1",
      "name": "iPhone 14 Pro 128GB",
      "brand": "Apple",
      "model": "A2890",
      "categoryHint": "smartphone"
    }
  ]
}
```

Response highlights:

- `autoCategory.category`: canonical category (`smartphone`, `laptop`, `tablet`, `tv`, `refrigerator`, `washing_machine`, `air_conditioner`, `motorbike`, `camera`, `other`)
- `autoCategory.confidence`: confidence in `[0, 1]`
- `duplicateDetection.isDuplicateLikely`: `true` when at least one match is above hard threshold
- `duplicateDetection.matches[]`: candidate duplicates with `itemId`, `score`, and `reason`

## Runtime/Algorithm Notes

- Vision recognition: `O(1)` local processing plus one model inference request.
- Auto-category scoring: `O(C*K + T)` where `C`=category count, `K`=keywords/category, `T`=token count in candidate fields.
- Duplicate detection: `O(N*L)` where `N`=inventory size, `L`=token length per compared item.
- Matching memory: `O(N + T)` to hold token sets and sorted match candidates.
