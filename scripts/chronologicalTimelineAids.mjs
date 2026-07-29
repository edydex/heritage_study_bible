function context(label, dateLabel, startYear, endYear = startYear, certainty = 'anchored') {
  return { label, dateLabel, startYear, endYear, certainty }
}

function groupedContext(group, label, dateLabel, startYear, endYear = startYear, certainty = 'anchored') {
  return { ...context(label, dateLabel, startYear, endYear, certainty), group }
}

function parallelContext(event, label, dateLabel, startYear, endYear = startYear, certainty = 'anchored') {
  return groupedContext(`Parallel accounts — ${event}`, label, dateLabel, startYear, endYear, certainty)
}

function eraTimeline({
  heading,
  rangeLabel,
  startYear,
  endYear,
  startLabel,
  endLabel,
  ticks = [],
  contexts,
  caption,
}) {
  return {
    heading,
    rangeLabel,
    perspective: 'attributed-setting',
    startYear,
    endYear,
    startLabel,
    endLabel,
    ticks,
    contexts,
    caption,
  }
}

function lateJudah(contexts, {
  heading = 'Late Judah and Jeremiah',
  rangeLabel = 'Late Assyria through Jerusalem’s fall • c. 650-586 BC',
  caption,
} = {}) {
  return {
    heading,
    rangeLabel,
    perspective: 'attributed-setting',
    startYear: 650,
    endYear: 586,
    startLabel: 'c. 650 BC',
    endLabel: '586 BC',
    ticks: [
      { year: 627, label: 'Jeremiah’s call', shortLabel: '627 • call' },
      { year: 597, label: 'Jehoiachin exiled', shortLabel: '597 • exile' },
    ],
    contexts,
    caption: caption || 'Bars show the passage’s attributed ministry or narrative setting, not when a prophecy was fulfilled. BC equivalents are approximate; the biblical reign and year notices remain the controlling anchors.',
  }
}

function fallAndExile(contexts, {
  heading = 'Fall, exile, and first return',
  rangeLabel = 'First Babylonian exile through Cyrus • 597-539 BC',
  startYear = 597,
  endYear = 539,
  startLabel = '597 BC',
  endLabel = '539 BC',
  ticks = [
    { year: 586, label: 'Jerusalem falls', shortLabel: '586 • fall' },
    { year: 561, label: 'Jehoiachin released', shortLabel: '561 • release' },
  ],
  caption,
} = {}) {
  return {
    heading,
    rangeLabel,
    perspective: 'attributed-setting',
    startYear,
    endYear,
    startLabel,
    endLabel,
    ticks,
    contexts,
    caption: caption || 'Bars show the period narrated or implied by the passage, not the date of a later fulfillment. Single-year bars are intentionally drawn as short visible marks.',
  }
}

export const chronologicalTimelineAids = {
  'job-patriarchal-placement': eraTimeline({
    heading: 'Job’s traditional story setting',
    rangeLabel: 'Broad patriarchal age • roughly c. 2100-1700 BC',
    startYear: 2100,
    endYear: 1700,
    startLabel: 'c. 2100 BC',
    endLabel: 'c. 1700 BC',
    ticks: [],
    contexts: [
      context('Job 1-42', 'Traditional patriarchal story setting, broadly c. 2000-1800 BC', 2000, 1800, 'traditional'),
    ],
    caption: 'This bar shows the traditional setting of Job’s story used by the plan. Job supplies no date, so it is not a claim about when the book reached its final written form.',
  }),

  'obadiah-traditional-placement': eraTimeline({
    heading: 'Obadiah’s date is disputed',
    rangeLabel: 'Proposed settings range from the divided kingdom to after 586 BC',
    startYear: 850,
    endYear: 450,
    startLabel: 'c. 850 BC',
    endLabel: 'c. 450 BC',
    ticks: [
      { year: 586, label: 'Jerusalem falls', shortLabel: '586 • fall' },
    ],
    contexts: [
      context('Obadiah (plan placement)', 'Traditional early divided-kingdom setting, broadly c. 850-800 BC', 850, 800, 'traditional'),
      context('Obadiah (date proposals)', 'The book has also been placed much later, including after 586 BC', 850, 500, 'broad'),
    ],
    caption: 'The short dotted bar is the plan’s traditional placement; the broad bar shows why it remains tentative. Neither bar uses the prophecy’s fulfillment as its date.',
  }),

  'joel-traditional-placement': eraTimeline({
    heading: 'Joel’s date is disputed',
    rangeLabel: 'Proposed settings span the monarchy through the post-exilic period',
    startYear: 850,
    endYear: 400,
    startLabel: 'c. 850 BC',
    endLabel: 'c. 400 BC',
    ticks: [
      { year: 586, label: 'Jerusalem falls', shortLabel: '586 • fall' },
    ],
    contexts: [
      context('Joel (plan placement)', 'Traditional early-prophet setting, broadly c. 850-800 BC', 850, 800, 'traditional'),
      context('Joel (date proposals)', 'Interpreters place the book across a much wider range', 850, 400, 'broad'),
    ],
    caption: 'The short dotted bar is the plan’s traditional reading position. The full bar records the uncertainty instead of presenting Joel as securely dated by a later event.',
  }),

  'jonah-jeroboam-ii': eraTimeline({
    heading: 'Jonah beside Jeroboam II',
    rangeLabel: 'Northern kingdom under Jeroboam II • early-to-mid eighth century BC',
    startYear: 800,
    endYear: 740,
    startLabel: '800 BC',
    endLabel: '740 BC',
    ticks: [
      { year: 753, label: 'Jeroboam II’s reign ends', shortLabel: 'c. 753' },
    ],
    contexts: [
      parallelContext('Jonah in Jeroboam II’s reign', '2 Kings 14:23-25', 'Jeroboam II and Jonah son of Amittai, c. 793-753 BC', 793, 753, 'broad'),
      parallelContext('Jonah in Jeroboam II’s reign', 'Jonah 1-4', 'Placed in the same Jeroboam II setting, c. 793-753 BC', 793, 753, 'broad'),
    ],
    caption: 'The grouped, matching bars put Jonah beside the Kings passage that supplies his historical setting. They do not claim a precise composition year for the narrative.',
  }),

  'amos-hosea-eighth-century': eraTimeline({
    heading: 'Amos and Hosea overlap',
    rangeLabel: 'Eighth-century northern-kingdom crisis • c. 790-710 BC',
    startYear: 790,
    endYear: 710,
    startLabel: 'c. 790 BC',
    endLabel: 'c. 710 BC',
    ticks: [
      { year: 753, label: 'Jeroboam II’s reign ends', shortLabel: 'c. 753' },
      { year: 722, label: 'Samaria falls', shortLabel: '722 • Samaria' },
    ],
    contexts: [
      context('Amos 1-9', 'Uzziah and Jeroboam II; often placed around c. 760 BC', 765, 755, 'approximate'),
      context('Hosea 1-14', 'Uzziah through Hezekiah, broadly c. 755-715 BC', 755, 715, 'broad'),
    ],
    caption: 'Bars follow the kings named in each book’s heading and the likely ministry window, not the later completion of the judgments they announce.',
  }),

  'isaiah-uzziah-transition': eraTimeline({
    heading: 'Isaiah begins at the Uzziah transition',
    rangeLabel: 'Uzziah through Hezekiah • c. 760-686 BC',
    startYear: 760,
    endYear: 686,
    startLabel: 'c. 760 BC',
    endLabel: '686 BC',
    ticks: [
      { year: 740, label: 'Uzziah dies', shortLabel: 'c. 740' },
      { year: 701, label: 'Sennacherib invades Judah', shortLabel: '701 • Assyria' },
    ],
    contexts: [
      context('Isaiah 1-5', 'Opening material within Isaiah’s Uzziah-to-Hezekiah ministry', 760, 701, 'broad'),
      context('Isaiah 6', 'The year Uzziah died, c. 740 BC', 740),
    ],
    caption: 'Bars show the reign setting named by Isaiah’s heading and the explicit Uzziah death notice. They are not fulfillment dates.',
  }),

  'isaiah-ahaz-crisis': eraTimeline({
    heading: 'Isaiah 7-12 during Ahaz’s crisis',
    rangeLabel: 'Syria-Ephraim crisis and Ahaz • c. 735-715 BC',
    startYear: 735,
    endYear: 715,
    startLabel: 'c. 735 BC',
    endLabel: 'c. 715 BC',
    ticks: [
      { year: 732, label: 'Damascus falls to Assyria', shortLabel: '732 • Damascus' },
    ],
    contexts: [
      context('Isaiah 7', 'In the days of Ahaz during the Syria-Ephraim crisis, c. 735-732 BC', 735, 732),
      context('Isaiah 8-12', 'Surrounding Ahaz/Assyria material, broadly c. 735-715 BC', 735, 715, 'broad'),
    ],
    caption: 'These bars show the crisis-era setting of the units, not when their prospective promises were later fulfilled.',
  }),

  'micah-isaiah-overlap': eraTimeline({
    heading: 'Micah overlaps Isaiah’s generation',
    rangeLabel: 'Jotham, Ahaz, and Hezekiah • broadly c. 750-700 BC',
    startYear: 750,
    endYear: 700,
    startLabel: 'c. 750 BC',
    endLabel: 'c. 700 BC',
    ticks: [
      { year: 722, label: 'Samaria falls', shortLabel: '722 • Samaria' },
      { year: 701, label: 'Sennacherib invades Judah', shortLabel: '701 • Assyria' },
    ],
    contexts: [
      context('Micah 1-7', 'Jotham through Hezekiah, broadly c. 750-700 BC', 750, 700, 'broad'),
      context('Isaiah’s ministry', 'Uzziah through Hezekiah, broadly c. 760-700 BC', 750, 700, 'broad'),
    ],
    caption: 'The overlapping bars reflect the kings named in Micah 1:1 and Isaiah 1:1. They do not date the fulfillment of either prophet’s message.',
  }),

  'isaiah-burdens-ahaz-sargon': eraTimeline({
    heading: 'Isaiah 13-23 spans several settings',
    rangeLabel: 'Ahaz through the Assyrian crisis • c. 735-701 BC',
    startYear: 735,
    endYear: 701,
    startLabel: 'c. 735 BC',
    endLabel: '701 BC',
    ticks: [
      { year: 715, label: 'Ahaz dies', shortLabel: 'c. 715' },
      { year: 711, label: 'Sargon’s Ashdod campaign', shortLabel: '711 • Ashdod' },
    ],
    contexts: [
      context('Isaiah 13-19, 21-23', 'Nation oracles without one shared firm year', 735, 701, 'broad'),
      context('Isaiah 14:28-32', 'The year Ahaz died, c. 715 BC', 715),
      context('Isaiah 20', 'Sargon’s Ashdod campaign, 711 BC', 711),
    ],
    caption: 'The anchored marks come from the chapter headings; the broad bar acknowledges that the surrounding oracles are not individually dated by later fulfillments.',
  }),

  'isaiah-hezekiah-assyrian-crisis': eraTimeline({
    heading: 'Isaiah 24-39 and Hezekiah',
    rangeLabel: 'Hezekiah and Assyrian pressure • c. 715-686 BC',
    startYear: 715,
    endYear: 686,
    startLabel: 'c. 715 BC',
    endLabel: '686 BC',
    ticks: [
      { year: 701, label: 'Sennacherib invades Judah', shortLabel: '701 • invasion' },
    ],
    contexts: [
      context('Isaiah 24-35', 'Grouped with the Assyrian-crisis material; not individually dated', 715, 701, 'broad'),
      parallelContext('Hezekiah and Sennacherib', 'Isaiah 36-39', 'Hezekiah narrative centered on the 701 BC crisis, c. 701-686 BC', 701, 686, 'broad'),
      parallelContext('Hezekiah and Sennacherib', '2 Kings 18:13-20:19', 'Parallel Hezekiah narrative, c. 701-686 BC', 701, 686, 'broad'),
      parallelContext('Hezekiah and Sennacherib', '2 Chronicles 32', 'Parallel Hezekiah summary, c. 701-686 BC', 701, 686, 'broad'),
    ],
    caption: 'The grouped, equal bars align Isaiah’s Hezekiah narrative with its Kings and Chronicles parallels. The broader bar shows the surrounding ministry setting, not a fulfillment date.',
  }),

  'isaiah-comfort-prophecy': eraTimeline({
    heading: 'Isaiah 40-66 stays in Isaiah’s ministry band',
    rangeLabel: 'Isaiah’s Uzziah-to-Hezekiah ministry • broadly c. 760-700 BC',
    startYear: 760,
    endYear: 700,
    startLabel: 'c. 760 BC',
    endLabel: 'c. 700 BC',
    ticks: [
      { year: 740, label: 'Uzziah dies', shortLabel: 'c. 740' },
      { year: 701, label: 'Sennacherib invades Judah', shortLabel: '701 • Assyria' },
    ],
    contexts: [
      context('Isaiah 1-39', 'The book’s named Uzziah-to-Hezekiah ministry frame', 760, 700, 'broad'),
      context('Isaiah 40-66', 'Kept with that ministry frame by this plan', 760, 700, 'traditional'),
    ],
    caption: 'The lower bar records this plan’s attributed ministry setting. It intentionally does not jump forward to the exile and return described in the prophecy.',
  }),

  'josiah-prophetic-cluster': lateJudah([
    context('Nahum', 'Late Assyrian setting before Nineveh fell, c. 650-612 BC', 650, 612, 'approximate'),
    context('Zephaniah', 'During Josiah’s reign, 640-609 BC', 640, 609),
    context('Jeremiah (heading)', 'Call in 627; ministry continues to the 586 fall', 627, 586),
    context('Habakkuk', 'Babylon rising in late Judah, broadly c. 612-597 BC', 612, 597, 'approximate'),
  ], {
    heading: 'The prophets around Josiah',
  }),

  'josiah-context-before-jeremiah': lateJudah([
    parallelContext('Josiah’s reform and final years', '2 Kings 22-23', 'Josiah’s reform, Passover, and death, 640-609 BC', 640, 609, 'broad'),
    parallelContext('Josiah’s reform and final years', '2 Chronicles 34-35', 'Parallel Josiah account, 640-609 BC', 640, 609, 'broad'),
    context('Jeremiah’s call', 'Josiah’s thirteenth year, c. 627 BC', 627),
    context('Jeremiah’s ministry', 'Josiah through Jerusalem’s fall, c. 627-586 BC', 627, 586),
  ], {
    heading: 'Josiah overlaps Jeremiah',
    caption: 'The equal grouped bars align Kings and Chronicles as parallel accounts. Jeremiah’s shorter mark and longer ministry bar then show where his call and ministry fit inside that historical setting.',
  }),

  'nahum-zephaniah-late-judah-setting': lateJudah([
    context('Nahum 1-3', 'Late Assyrian setting before Nineveh fell, c. 650-612 BC', 650, 612, 'approximate'),
    context('Zephaniah 1-3', 'Josiah’s reign, 640-609 BC', 640, 609),
  ], {
    heading: 'Nahum and Zephaniah',
  }),

  'jeremiah-fall-of-jerusalem': lateJudah([
    context('Jeremiah 1:2-3', 'The book’s ministry span: c. 627-586 BC', 627, 586),
    context('Jeremiah 1-20', 'Opening band within that ministry; most units lack a date', 627, 586, 'broad'),
  ], {
    heading: 'Jeremiah’s opening band',
  }),

  'jeremiah-era-band-compromise': lateJudah([
    context('Jeremiah 1-20', 'Opening band; most units are not individually dated', 627, 586, 'broad'),
    parallelContext('Judah’s last kings before the fall', '2 Kings 23:31-24:20', 'Jehoahaz through Zedekiah’s accession, 609-597 BC', 609, 597, 'broad'),
    parallelContext('Judah’s last kings before the fall', '2 Chronicles 36:1-13', 'Parallel last-kings account, 609-597 BC', 609, 597, 'broad'),
    context('Jeremiah 21 onward', 'Late-kings material that repeatedly moves backward and forward', 609, 586, 'broad'),
  ], {
    heading: 'Why the history interrupts Jeremiah',
    caption: 'Kings and Chronicles receive equal grouped bars because they cover the same last-kings setting. Jeremiah’s broader bars show why the book cannot be treated as a straight diary.',
  }),

  'habakkuk-babylonian-rise-setting': lateJudah([
    context('Habakkuk 1-3', 'Likely as Babylon rises, broadly c. 612-597 BC', 612, 597, 'approximate'),
  ], {
    heading: 'Habakkuk’s likely setting',
    caption: 'The dashed bar marks Habakkuk’s likely speaking or writing setting. It intentionally does not plot the later events announced in the oracle.',
  }),

  'jeremiah-last-kings-survey': lateJudah([
    parallelContext('Zedekiah’s final siege', 'Jeremiah 21', 'Zedekiah’s final siege, c. 588-586 BC', 588, 586),
    parallelContext('Zedekiah’s final siege', '2 Kings 25:1-7', 'The same final siege and capture window, c. 588-586 BC', 588, 586),
    parallelContext('Zedekiah’s final siege', '2 Chronicles 36:17-20', 'Parallel fall summary in the same siege window, c. 588-586 BC', 588, 586),
    groupedContext('Historical frame — Judah’s last kings', 'Jeremiah 22-23', 'Looks across Judah’s last kings, 609-586 BC', 609, 586, 'broad'),
    groupedContext('Historical frame — Judah’s last kings', '2 Kings 23:31-24:20', 'Jehoahaz through Zedekiah’s accession, 609-597 BC', 609, 597, 'broad'),
    groupedContext('Historical frame — Judah’s last kings', '2 Chronicles 36:1-13', 'Parallel last-kings summary, 609-597 BC', 609, 597, 'broad'),
    parallelContext('Jehoiachin’s first exile', 'Jeremiah 24', 'After Jehoiachin’s exile, c. 597 BC', 597),
    parallelContext('Jehoiachin’s first exile', '2 Kings 24:10-17', 'Jehoiachin and Jerusalem’s first exiles, c. 597 BC', 597),
    parallelContext('Jehoiachin’s first exile', '2 Chronicles 36:9-10', 'Parallel first-exile account, c. 597 BC', 597),
  ], {
    heading: 'Jeremiah 21-24 is not sequential',
    caption: 'Grouped rows place Jeremiah beside the matching Kings and Chronicles setting. The middle group remains broader because Jeremiah 22-23 surveys more than one reign.',
  }),

  'jeremiah-jehoiakim-fourth-year': lateJudah([
    groupedContext('Historical frame — Jehoiakim’s reign', 'Jeremiah 26', 'Beginning of Jehoiakim’s reign, c. 609 BC', 609),
    groupedContext('Historical frame — Jehoiakim’s reign', '2 Kings 23:34-24:7', 'Jehoiakim’s reign and Babylonian crisis, 609-598 BC', 609, 598, 'broad'),
    groupedContext('Historical frame — Jehoiakim’s reign', '2 Chronicles 36:4-8', 'Parallel Jehoiakim summary, 609-598 BC', 609, 598, 'broad'),
    context('Jeremiah 25', 'Jehoiakim’s fourth year, c. 605 BC', 605),
  ], {
    heading: 'Jeremiah 25-26 moves backward',
    caption: 'The historical setting rows show Jehoiakim’s whole reign; the short Jeremiah marks identify the specific beginning-of-reign and fourth-year settings inside it.',
  }),

  'jeremiah-zedekiah-first-exiles': lateJudah([
    parallelContext('Jehoiachin’s first exile', '2 Kings 24:10-17', 'Jehoiachin and others taken to Babylon, 597 BC', 597),
    parallelContext('Jehoiachin’s first exile', '2 Chronicles 36:9-10', 'Parallel first-exile account, 597 BC', 597),
    groupedContext('Same historical window — Zedekiah after the first exile', 'Jeremiah 27-29', 'Zedekiah’s reign after that exile, 597-586 BC', 597, 586, 'broad'),
    groupedContext('Same historical window — Zedekiah after the first exile', '2 Kings 24:18-20', 'Zedekiah’s reign, 597-586 BC', 597, 586, 'broad'),
    groupedContext('Same historical window — Zedekiah after the first exile', '2 Chronicles 36:11-14', 'Parallel Zedekiah setting, 597-586 BC', 597, 586, 'broad'),
    context('Jeremiah 28', 'Zedekiah’s fourth year, c. 594 BC', 594),
  ], {
    heading: 'Zedekiah and the first exiles',
    caption: 'The paired exile marks and equal Zedekiah-era bars make the Kings and Chronicles setting visible instead of leaving it only in the note text.',
  }),

  'jeremiah-consolation-siege-flashback': lateJudah([
    context('Jeremiah 30-31', 'Promise section; not assigned a firm year', 627, 586, 'broad'),
    parallelContext('Zedekiah’s final siege', 'Jeremiah 32-34', 'Zedekiah’s final siege, c. 588-586 BC', 588, 586),
    parallelContext('Zedekiah’s final siege', '2 Kings 25:1-7', 'The same final siege and capture window, c. 588-586 BC', 588, 586),
    parallelContext('Zedekiah’s final siege', '2 Chronicles 36:17-20', 'Parallel fall summary in the same siege window, c. 588-586 BC', 588, 586),
    groupedContext('Same historical window — Jehoiakim’s reign', 'Jeremiah 35', 'A flashback to Jehoiakim, 609-598 BC', 609, 598),
    groupedContext('Same historical window — Jehoiakim’s reign', '2 Kings 23:34-24:7', 'Jehoiakim’s reign and Babylonian crisis, 609-598 BC', 609, 598, 'broad'),
    groupedContext('Same historical window — Jehoiakim’s reign', '2 Chronicles 36:4-8', 'Parallel Jehoiakim summary, 609-598 BC', 609, 598, 'broad'),
    context('Jeremiah 36', 'Jehoiakim’s fourth year, c. 605 BC', 605),
  ], {
    heading: 'Promise, siege, then flashback',
    caption: 'Equal grouped bars expose the historical setting: the siege passages align with one another, and the Jehoiakim flashback sits beside its Kings and Chronicles reign frame.',
  }),

  'daniel-early-babylonian-exile': {
    heading: 'Daniel begins in the Babylonian crisis',
    rangeLabel: 'Jehoiakim’s reign through the first exile • 609-597 BC',
    perspective: 'attributed-setting',
    startYear: 609,
    endYear: 597,
    startLabel: '609 BC',
    endLabel: '597 BC',
    ticks: [
      { year: 605, label: 'Babylon defeats Egypt', shortLabel: '605 • Babylon' },
    ],
    contexts: [
      context('Daniel 1', 'Jehoiakim’s third year in the book’s reckoning, c. 606/605 BC', 606, 605, 'approximate'),
      context('Daniel 2', 'Nebuchadnezzar’s second year in the narrative, c. 603/602 BC', 603, 602, 'approximate'),
      context('Jehoiachin’s exile', 'The later 597 BC deportation', 597),
    ],
    caption: 'Bars show the reign setting named by Daniel’s narrative. Approximate BC equivalents can vary with accession-year reckoning; they are not claims about the book’s final composition date.',
  },

  'jeremiah-zedekiah-siege-anchors': lateJudah([
    context('Zedekiah’s reign', '597-586 BC', 597, 586),
    parallelContext('Zedekiah’s final siege', 'Jeremiah 37-38', 'The final siege and temporary Babylonian withdrawal, c. 588-586 BC', 588, 586),
    parallelContext('Zedekiah’s final siege', '2 Kings 25:1-7', 'The same final siege and capture window, c. 588-586 BC', 588, 586),
    parallelContext('Zedekiah’s final siege', '2 Chronicles 36:17-20', 'Parallel fall summary in the same siege window, c. 588-586 BC', 588, 586),
  ], {
    heading: 'Jeremiah 37-38 stays near the end',
    caption: 'The equal grouped bars align Jeremiah’s siege setting with the Kings sequence and the Chronicles summary. The longer bar above them is Zedekiah’s full reign.',
  }),

  'jeremiah-appendix-oracles': lateJudah([
    context('Jeremiah 45-46', 'Jehoiakim’s fourth year, c. 605 BC', 605),
    context('Jeremiah 47', 'Before Pharaoh struck Gaza; no secure year', 609, 586, 'broad'),
    context('Jeremiah 48-50', 'No firm royal heading within Jeremiah’s ministry', 627, 586, 'broad'),
    context('Jeremiah 51:59-64', 'Zedekiah’s fourth year, c. 594 BC', 594),
  ], {
    heading: 'The nations appendix spans the reigns',
  }),

  'late-judah-fall-history-first': fallAndExile([
    context('2 Kings 25:1-3', 'The final siege begins, c. 588-586 BC', 588, 586),
    context('2 Chronicles 36:11-16', 'Zedekiah’s reign before the fall, 597-586 BC', 597, 586, 'broad'),
    parallelContext('Jerusalem falls', '2 Kings 25:4-21', 'Jerusalem’s capture and destruction, c. 586 BC', 586, 585),
    parallelContext('Jerusalem falls', '2 Chronicles 36:17-21', 'Parallel fall and destruction summary, c. 586 BC', 586, 585),
    parallelContext('Jerusalem falls', 'Jeremiah 39', 'The same fall and immediate-aftermath window, c. 586 BC', 586, 585),
    parallelContext('Gedaliah and the flight', '2 Kings 25:22-26', 'Gedaliah, his death, and the flight, c. 586 BC', 586, 585),
    parallelContext('Gedaliah and the flight', 'Jeremiah 40-43', 'The same immediate-aftermath window, c. 586 BC', 586, 585),
    parallelContext('Jehoiachin released', '2 Kings 25:27-30', 'Jehoiachin released, c. 561 BC', 561),
    parallelContext('Jehoiachin released', 'Jeremiah 52:31-34', 'The same release retold, c. 561 BC', 561),
    context('2 Chronicles 36:22-23', 'Cyrus permits return, c. 539/538 BC', 539),
  ], {
    heading: 'The history reaches beyond the fall',
    caption: 'Grouped rows align Kings and Chronicles with the Jeremiah passages that retell the same events. Equal bars mean the accounts share a historical setting; the ungrouped rows show the longer siege, reign, and return frame.',
  }),

  'jeremiah-fall-and-aftermath': fallAndExile([
    parallelContext('the fall and immediate aftermath', 'Jeremiah 39', 'Jerusalem falls and Zedekiah is captured, c. 586 BC', 586, 585),
    parallelContext('the fall and immediate aftermath', 'Jeremiah 40-41', 'Gedaliah’s brief governorship and death, c. 586 BC', 586, 585),
    parallelContext('the fall and immediate aftermath', '2 Kings 25:4-25', 'The matching fall and Gedaliah sequence, c. 586 BC', 586, 585),
    parallelContext('the fall and immediate aftermath', '2 Chronicles 36:17-21', 'The matching fall summary, c. 586 BC', 586, 585),
    parallelContext('the remnant flees to Egypt', 'Jeremiah 42-43', 'The remnant chooses Egypt, c. 586 BC', 586, 585),
    parallelContext('the remnant flees to Egypt', '2 Kings 25:26', 'The same flight to Egypt, c. 586 BC', 586, 585),
    context('Jeremiah 44', 'The remnant established in Egypt after the flight, broadly c. 585-580 BC', 585, 580, 'broad'),
  ], {
    heading: 'Jeremiah beside Kings and Chronicles',
    rangeLabel: 'Jerusalem’s fall through the remnant in Egypt • c. 586-580 BC',
    startYear: 586,
    endYear: 580,
    startLabel: '586 BC',
    endLabel: 'c. 580 BC',
    ticks: [
      { year: 586, label: 'Jerusalem falls', shortLabel: '586 • fall' },
    ],
    caption: 'Rows in each group use identical one-year bars because they describe the same c. 586 BC historical setting. Jeremiah 39 and 40-41 now share the fall-and-immediate-aftermath range, with Kings and Chronicles directly beside them; Jeremiah 44 then continues later in Egypt.',
  }),

  'jeremiah-historical-appendix': fallAndExile([
    parallelContext('Zedekiah through Jerusalem’s fall', 'Jeremiah 52:1-30', 'Zedekiah, siege, destruction, and deportations, 597-586 BC', 597, 586),
    parallelContext('Zedekiah through Jerusalem’s fall', '2 Kings 24:18-25:21', 'The matching Zedekiah-to-destruction account, 597-586 BC', 597, 586),
    parallelContext('Zedekiah through Jerusalem’s fall', '2 Chronicles 36:11-21', 'The parallel Zedekiah and fall summary, 597-586 BC', 597, 586),
    parallelContext('Jehoiachin released', 'Jeremiah 52:31-34', 'Jehoiachin released, c. 561 BC', 561),
    parallelContext('Jehoiachin released', '2 Kings 25:27-30', 'The same release account, c. 561 BC', 561),
  ], {
    heading: 'Jeremiah 52 spans two endpoints',
    rangeLabel: 'Zedekiah’s accession through Jehoiachin’s release • 597-561 BC',
    endYear: 561,
    endLabel: '561 BC',
    ticks: [
      { year: 586, label: 'Jerusalem falls', shortLabel: '586 • fall' },
    ],
    caption: 'The grouped bars expose both parallel endpoints: Jeremiah 52 aligns with Kings and Chronicles through the fall, then with Kings again when Jehoiachin is released.',
  }),

  'exilic-psalm-laments': fallAndExile([
    context('Psalms 74, 79, 89, 102', 'Destruction/exile setting suggested by content, broadly 586-539 BC', 586, 539, 'approximate'),
    context('Psalm 137', 'Babylonian exile remembered, broadly 586-539 BC', 586, 539, 'broad'),
    context('Psalm 85 and related songs', 'Exile-to-return worship setting; exact dates uncertain', 586, 515, 'traditional'),
  ], {
    heading: 'Exilic Psalms are broad placements',
    rangeLabel: 'Jerusalem’s fall through the rebuilt temple • 586-515 BC',
    startYear: 586,
    endYear: 515,
    startLabel: '586 BC',
    endLabel: '515 BC',
    ticks: [
      { year: 539, label: 'Cyrus and first return', shortLabel: '539 • return' },
    ],
    caption: 'These bars describe the historical setting suggested by each Psalm’s language or later use. They do not claim secure composition dates.',
  }),

  'ezekiel-dated-exile-visions': fallAndExile([
    context('Ezekiel 1-7', 'Fifth year of Jehoiachin’s exile, c. 593 BC', 593),
    context('Ezekiel 8-24', 'Dated blocks from c. 592 to the 588 siege', 592, 588),
    context('Ezekiel 25-32', 'Oracles dated across c. 588-571 BC', 588, 571, 'broad'),
    context('Ezekiel 33-39', 'After news of Jerusalem’s fall, c. 585 BC', 585),
    context('Ezekiel 40-48', 'Twenty-fifth year of exile, c. 573 BC', 573),
  ], {
    heading: 'Ezekiel’s dated vision blocks',
    rangeLabel: 'Jehoiachin’s exile through Ezekiel’s latest dated oracle • 597-571 BC',
    startYear: 597,
    endYear: 571,
    startLabel: '597 BC',
    endLabel: '571 BC',
    ticks: [
      { year: 586, label: 'Jerusalem falls', shortLabel: '586 • fall' },
    ],
    caption: 'Bars follow the year notices within Ezekiel. Some grouped chapters contain more than one date, so those bars show the full dated reach of the block.',
  }),

  'daniel-later-reign-markers': fallAndExile([
    context('Daniel 3-4', 'Nebuchadnezzar’s reign, broadly 605-562 BC', 605, 562, 'broad'),
    context('Daniel 7-8', 'Belshazzar’s first and third years, broadly c. 553-551 BC', 553, 551, 'approximate'),
    context('Daniel 5-6 and 9', 'Fall of Babylon and Darius setting, c. 539/538 BC', 539, 538, 'approximate'),
    context('Daniel 10-12', 'Cyrus’s third year, c. 536 BC', 536),
  ], {
    heading: 'Daniel’s internal reign sequence',
    rangeLabel: 'Nebuchadnezzar through Cyrus • c. 605-536 BC',
    startYear: 605,
    endYear: 536,
    startLabel: '605 BC',
    endLabel: '536 BC',
    ticks: [
      { year: 539, label: 'Babylon falls', shortLabel: '539 • Babylon falls' },
    ],
    caption: 'Bars show the narrative or vision setting named in Daniel, not a claim about the final composition date of the book.',
  }),

  'haggai-zechariah-temple-rebuild': fallAndExile([
    context('Ezra 1-4', 'First return and stalled rebuilding, c. 538-520 BC', 538, 520, 'broad'),
    context('Haggai 1-2', 'Darius’s second year, 520 BC', 520),
    context('Zechariah 1-8', 'Darius’s second through fourth years, c. 520-518 BC', 520, 518),
    context('Ezra 5-6', 'Rebuilding resumes; temple completed in 515 BC', 520, 515),
  ], {
    heading: 'The prophets inside Ezra’s rebuild',
    rangeLabel: 'First return through the completed temple • 538-515 BC',
    startYear: 538,
    endYear: 515,
    startLabel: '538 BC',
    endLabel: '515 BC',
    ticks: [
      { year: 520, label: 'Haggai and Zechariah', shortLabel: '520 • prophets' },
    ],
  }),

  'return-and-pilgrimage-psalms': fallAndExile([
    context('Ezra-Nehemiah community', 'Returned and rebuilt community, broadly 538-430 BC', 538, 430, 'broad'),
    context('Psalm 126', 'Restoration language; exact composition date uncertain', 538, 430, 'approximate'),
    context('Songs of Ascents', 'Second-temple pilgrimage use; composition dates uncertain', 515, 400, 'traditional'),
  ], {
    heading: 'Return-era worship, not exact dates',
    rangeLabel: 'First return through the later Persian period • c. 538-400 BC',
    startYear: 538,
    endYear: 400,
    startLabel: '538 BC',
    endLabel: 'c. 400 BC',
    ticks: [
      { year: 515, label: 'Second temple completed', shortLabel: '515 • temple' },
    ],
    caption: 'These are broad worship-setting placements. The bars intentionally do not claim that each Psalm was composed at a known moment.',
  }),

  'malachi-post-exilic-close': fallAndExile([
    context('Second temple', 'Temple restored from 515 BC onward', 515, 400, 'broad'),
    context('Ezra-Nehemiah reforms', 'Later Persian-period community, broadly c. 458-430 BC', 458, 430, 'approximate'),
    context('Malachi 1-4', 'Post-exilic temple community, often placed c. 450-400 BC', 450, 400, 'traditional'),
  ], {
    heading: 'Malachi in the restored community',
    rangeLabel: 'Second temple through the later Persian period • 515-c. 400 BC',
    startYear: 515,
    endYear: 400,
    startLabel: '515 BC',
    endLabel: 'c. 400 BC',
    ticks: [
      { year: 458, label: 'Ezra’s mission', shortLabel: 'c. 458 • Ezra' },
      { year: 445, label: 'Nehemiah’s mission', shortLabel: 'c. 445 • Nehemiah' },
    ],
    caption: 'Malachi has no named king or numbered regnal year. Its bar is a traditional post-exilic placement based on the temple and community setting.',
  }),

  'james-early-church': eraTimeline({
    heading: 'James in the early church',
    rangeLabel: 'Jerusalem-centered church before and around the council • c. AD 35-50',
    startYear: 35,
    endYear: 50,
    startLabel: 'c. AD 35',
    endLabel: 'AD 50',
    ticks: [
      { year: 49, label: 'Jerusalem council', shortLabel: 'c. 49 • council' },
    ],
    contexts: [
      context('Acts 1-8', 'Early Jerusalem-centered church, broadly AD 30s', 35, 40, 'broad'),
      context('James 1-5', 'Traditional early-letter placement, broadly c. AD 40-49', 40, 49, 'traditional'),
    ],
    caption: 'James gives no travel itinerary or numbered year. Its dotted bar is the plan’s traditional early-church placement, not a precise composition claim.',
  }),

  'galatians-acts-mission': eraTimeline({
    heading: 'Galatians near Paul’s early missions',
    rangeLabel: 'Early missions and the Jerusalem council • c. AD 46-55',
    startYear: 46,
    endYear: 55,
    startLabel: 'c. AD 46',
    endLabel: 'AD 55',
    ticks: [
      { year: 49, label: 'Jerusalem council', shortLabel: 'c. 49 • council' },
    ],
    contexts: [
      context('Acts 13-15', 'First mission and Jerusalem council, broadly c. AD 46-49', 46, 49, 'broad'),
      context('Galatians 1-6', 'Early/South-Galatian plan placement, broadly c. AD 48-49', 48, 49, 'traditional'),
      context('Galatians (other proposals)', 'A later setting in Paul’s ministry is also widely proposed', 49, 55, 'approximate'),
    ],
    caption: 'The dotted bar is the arrangement used by this plan; the dashed bar preserves the dating uncertainty rather than presenting one proposal as certain.',
  }),

  'thessalonians-corinth': eraTimeline({
    heading: 'The Thessalonian letters during Acts 16-18',
    rangeLabel: 'Macedonia, Athens, and Corinth • c. AD 49-52',
    startYear: 49,
    endYear: 52,
    startLabel: 'c. AD 49',
    endLabel: 'AD 52',
    ticks: [
      { year: 51, label: 'Paul at Corinth', shortLabel: 'c. 51 • Corinth' },
    ],
    contexts: [
      context('Acts 16-18', 'Second mission through the Corinth stay, c. AD 49-52', 49, 52, 'broad'),
      context('1 Thessalonians', 'Written during the Corinth phase, c. AD 50-51', 50, 51, 'approximate'),
      context('2 Thessalonians', 'Placed soon after 1 Thessalonians, c. AD 51-52', 51, 52, 'approximate'),
    ],
    caption: 'Bars show the mission setting used by the plan. The year equivalents are approximate and do not represent fulfillment dates.',
  }),

  'corinthians-romans-acts-19-20': eraTimeline({
    heading: 'Corinthians and Romans across Acts 19-20',
    rangeLabel: 'Ephesus, Macedonia, and Greece • c. AD 52-58',
    startYear: 52,
    endYear: 58,
    startLabel: 'c. AD 52',
    endLabel: 'AD 58',
    ticks: [
      { year: 55, label: 'End of the Ephesus phase', shortLabel: 'c. 55' },
    ],
    contexts: [
      context('Acts 19 / 1 Corinthians', 'Ephesian ministry, broadly c. AD 52-55', 52, 55, 'broad'),
      context('Acts 20 / 2 Corinthians', 'Macedonia, broadly c. AD 55-57', 55, 57, 'approximate'),
      context('Romans', 'Greece before the Jerusalem journey, c. AD 57-58', 57, 58, 'approximate'),
    ],
    caption: 'The bars align each letter with Paul’s travel setting in Acts. The calendar equivalents are approximate rather than exact timestamps.',
  }),

  'prison-epistles-after-acts': eraTimeline({
    heading: 'The prison letters after Acts 28',
    rangeLabel: 'Paul’s Roman custody • broadly c. AD 60-62',
    startYear: 59,
    endYear: 63,
    startLabel: 'c. AD 59',
    endLabel: 'AD 63',
    ticks: [
      { year: 60, label: 'Roman custody begins', shortLabel: 'c. 60 • Rome' },
    ],
    contexts: [
      context('Acts 28', 'Paul under Roman custody, broadly c. AD 60-62', 60, 62, 'broad'),
      context('Ephesians, Philippians', 'Traditional Roman-prison grouping, c. AD 60-62', 60, 62, 'traditional'),
      context('Colossians, Philemon', 'Traditional Roman-prison grouping, c. AD 60-62', 60, 62, 'traditional'),
    ],
    caption: 'The dotted bars show the traditional captivity-letter grouping used by this plan. They do not rule out other proposed imprisonment settings.',
  }),

  'late-epistles-and-revelation': eraTimeline({
    heading: 'The New Testament’s less-certain closing decades',
    rangeLabel: 'After Acts through the late first century • broadly c. AD 62-100',
    startYear: 62,
    endYear: 100,
    startLabel: 'c. AD 62',
    endLabel: 'AD 100',
    ticks: [
      { year: 70, label: 'Jerusalem and the temple destroyed', shortLabel: 'AD 70' },
      { year: 95, label: 'Traditional late Revelation setting', shortLabel: 'c. 95' },
    ],
    contexts: [
      context('Pastoral letters', 'Traditional post-Acts Pauline setting, broadly c. AD 62-67', 62, 67, 'traditional'),
      context('1 Peter and Hebrews', 'Commonly placed before or around AD 70; dates debated', 62, 70, 'approximate'),
      context('2 Peter and Jude', 'Later first-century placement; dates debated', 65, 85, 'approximate'),
      context('Johannine letters', 'Traditional later first-century setting, broadly c. AD 85-100', 85, 100, 'traditional'),
      context('Revelation', 'Traditional later first-century setting, often c. AD 90-96', 90, 96, 'traditional'),
    ],
    caption: 'These bars record the broad traditional arrangement used by the plan and explicitly preserve dating uncertainty. They are not fulfillment dates.',
  }),
}
