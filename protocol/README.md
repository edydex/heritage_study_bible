# Heritage content protocol v2

A Content Server is a public static website. It publishes one small manifest at
`/heritage-content.json`, one metadata catalog per supported content type, and
the content assets referenced by those catalogs. No account, executable code,
or server-side API is required.

The app automatically refreshes manifest and catalog metadata. Large plan,
book, audio, and document assets are fetched only when a reader opens them.
Every URL may be relative to the JSON file that contains it.

Supported catalog types are `readingPlans`, `songs`, `sermons`, `books`, and
`commentaries`. A catalog uses this envelope:

```json
{
  "schemaVersion": 2,
  "contentType": "readingPlans",
  "updatedAt": "2026-07-10T00:00:00Z",
  "items": [
    {
      "id": "church-reading-plan",
      "title": "Church Reading Plan",
      "description": "A shared twelve-week plan.",
      "content": {
        "url": "../plans/church-reading-plan.json",
        "mediaType": "application/vnd.heritage.reading-plan+json"
      }
    }
  ]
}
```

The manifest contract is defined by
[`heritage-content-v2.schema.json`](./heritage-content-v2.schema.json). Static
hosts must allow cross-origin `GET` requests so the web and Android clients can
read the JSON and assets.
