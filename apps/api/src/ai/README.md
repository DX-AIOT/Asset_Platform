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

## Runtime/Algorithm Notes

- OpenAI call complexity per request: `O(1)` local processing + one model inference request.
- JSON parse/transform complexity: `O(k)` where `k` is fixed number of fields (constant-time in practice).
- Fallback decision complexity: `O(1)`.
