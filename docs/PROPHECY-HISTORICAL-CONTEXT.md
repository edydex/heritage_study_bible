# Proposed prophecy fulfillment: first Egypt comparison

The chronological plan's Day 250 note, **Ezekiel’s Egypt oracles: dates and
proposed fulfillment**, now includes a collapsed section below its historical
timeline. It compares individual predictions with events and evidence instead
of assigning one fulfillment date to the whole passage.

The four comparisons cover Egypt as Judah's unreliable ally, Nebuchadnezzar's
Egyptian campaign, the forty-year desolation and return, and later Persian rule.
Each distinguishes the oracle's date, a proposed event date (including unknown),
its place relative to biblical chapters, evidence, and limitations. This is
AI-assisted editorial research, with specialist review still pending; the UI
states that status. Source checking is not historical or theological acceptance.

## Source basis, checked September 21, 2026

| Source | What it supports | Limits |
| --- | --- | --- |
| [British Museum, BM 33041 / 1878,1015.22](https://www.britishmuseum.org/collection/object/W_1878-1015-22) | The museum catalogue identifies an Egyptian campaign in Nebuchadnezzar's 37th year. | The accessible indexed catalogue was checked; this work does not claim to have translated the fragment or recovered a complete account of the outcome. |
| [Peerapat Ouysook, *A Study of the Composition of Nebuchadnezzar II’s Royal Inscriptions* (Cambridge PhD, 2021), p. 182, note 105](https://api.repository.cam.ac.uk/server/api/core/bitstreams/77b2c5db-900a-4f70-b297-cf8eafac8c1e/content#page=193) | The broken tablet yields little detail and the extent of Babylonian success is disputed. | Modern scholarly assessment, not an independent campaign record. PDF page 193 corresponds to printed page 182. |
| [Dan’el Kahn (2022), discussion of Nebuchadnezzar and Egypt](https://www.thetorah.com/article/nebuchadnezzar-fails-to-conquer-egypt-so-jeremiahs-prophecy-was-updated) | The sections on Egypt's civil war and Babylonian success propose a brief foothold followed by Egyptian resistance, connecting the evidence with 568/567 BC. | A reconstruction from fragmentary evidence. The article's separate theory of prophetic editing is not adopted as a finding here. Its historical argument is distinguished from the museum's limited catalogue statement. |
| [Herodotus, *Histories* 2.177.1](https://lexundria.com/hdt/2.177.1/mcly) and [3.10.1](https://lexundria.com/hdt/3.10.1/mcly) | A later ancient account of prosperity under Amasis and his long reign before Cambyses. | Literary evidence, not a contemporary census or a proof that every region was untouched. It cautions against assuming nationwide abandonment without further evidence. |
| [Herodotus, *Histories* 3.14](https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.01.0126%3Abook%3D3%3Achapter%3D14) | An ancient narrative of the Egyptian king's capture following the surrender of Memphis. | A later narrative, not a direct identification of Ezekiel's fulfillment. |
| [Metropolitan Museum, Egypt in the Late Period](https://www.metmuseum.org/essays/egypt-in-the-late-period-ca-712-332-b-c) | Conventional dates for the first Persian period, 525–404 BC, and renewed native rule. | Modern curatorial history. Cambyses cannot simply replace Nebuchadnezzar in a prophecy naming the latter. |

The passage links use the Bible already bundled with Heritage. Jeremiah 37 and
2 Kings 25 supply the siege comparison; Ezekiel 29:17 and 40:1 distinguish exile
years 27 and 25; Ezra 1 and 6 supply the wider return-to-temple-completion period.
The cross-book placement is our explicitly labelled editorial comparison.
Neither Ezra chapter narrates the Persian conquest of Egypt. Ezekiel 32:17
does not name a month, so the note does not invent one.

No forty-year fulfillment interval is drawn. `eventDate: null` deliberately
renders as **Fulfillment date not established**. This does not adjudicate
symbolic, partial, or future interpretations; those need their own arguments.
Campaign, plunder, political subjugation and complete desolation remain distinct.

## Implementation and validation

Edit `scripts/prophecyHistoricalContext.mjs`, then run
`node scripts/generateChronologicalPlan.mjs` to rebuild the distributed JSON.
The timeline remains `historical-situation`; fulfillment comparisons live in a
separate `prophecyContext` field. There is no change to the 365 daily passage
assignments or any existing reading/note ID. The Egypt note is a new item;
previous saved completion records are retained.

The viewer uses a three-column table on larger screens and stacked entries on
phones. Labels carry uncertainty without relying on color. The section starts
closed and opening it or following a citation does not mark the note done.
Scripture links pass an exact verse target to the existing reader. External
sources open separately; they require a connection, while the note is bundled
in the Android build.

Regression coverage checks citation integrity, actual verse targets, unknown
dates, separation from oracle-setting dates, generated plan completeness, and
metadata preservation through the reading-item service. Browser coverage checks
first-click verse navigation, unchanged completion state, collapse behavior,
and 320-pixel stacked layout. Historical accuracy still requires informed human
review; automated tests verify the implementation and structural claims only.
