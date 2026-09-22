# LSB and NASB passage sources

Checked 22 September 2026 for selected Scripture slides in Heritage Community / SyncShow.

The user's existing foolishandweak.org post pages configure `bibleVersion: 'NASB95'` in Logos RefTagger and load `https://api.reftagger.com/v2/RefTagger.js`. This is a public website lookup widget. It is not an existing API.Bible account or a licensed translation file.

## Verified permissions and delivery options

| Source | Confirmed use | What remains before enabling stored API imports |
| --- | --- | --- |
| [LSB quotation policy](https://lsbible.org/permission-to-quote-the-lsb/) | Limited quotations include noncommercial presentation slides. The general policy has a 1,000-verse limit, excludes whole books, limits the quoted proportion of the work, and limits electronic retrieval storage. | A supported machine-readable passage endpoint and its service terms; decide how accumulated saved services stay within the storage allowance. |
| [Official LSB Tagger](https://lsbible.org/lsb-tagger/) | Free hover lookup for personal and church websites, including nonsequential references. The current widget embeds `https://read.lsbible.org/ref-tagger?ref=...`. | The widget's existence does not establish a stable JSON API contract for an offline presentation library. |
| [NASB quotation policy](https://www.lockman.org/permission-to-quote-copyright-trademark-information/) | Limited quotations include presentation slides, with edition-specific attribution and similar general quotation/storage limits. | A retrieval provider whose terms cover the required storage and editing workflow. |
| [Logos Biblia API terms](https://bibliaapi.com/docs/Terms_of_Use) | API access for approved applications; API key required. | Terms prohibit extracting database content for an alternate database. Do not assume the existing RefTagger installation authorizes a permanent service-text archive. |
| [API.Bible Express Licensing](https://care.api.bible/article/405-express-licensing-faqs) | Copyrighted translations are available for eligible accounts. | The church has no key yet. Cached text requires refresh every 30 days; content edits need a separate agreement. API.Bible content also has restrictions on AI processing. These affect offline packages, slide omissions/context, and translation preparation. |

The quotation policies are distinct from distributing an entire translation. A whole-Bible software agreement is not automatically required for every limited quotation. Conversely, quotation permission alone does not settle the delivery service's API terms.

## Current implementation boundary

BSB and Russian Synodal reader lookup and private, licensed translation uploads remain available. No LSB/NASB full text has been bundled or bulk-downloaded, and no undocumented endpoint has been enabled as a production passage importer. Selected verses already entered in an authorized service presentation remain part of that presentation.

Next step: obtain the publisher's earlier reply or a provider account/agreement that explicitly covers selected verse retrieval, retained offline service packages, and presentation excerpts. Then add the provider through `HeritageServiceBibleLookup` / the installed-passage resolver, preserving edition, attribution, source URL and exact source checksums. Fetch only the requested verses, handle outages without changing existing slides, and cover nonsequential references, authorization, quota/retention and offline reload in tests.
