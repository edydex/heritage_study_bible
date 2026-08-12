function context(label, dateLabel, startYear, endYear = startYear, certainty = 'anchored') {
  return { label, dateLabel, startYear, endYear, certainty }
}

function groupedContext(group, label, dateLabel, startYear, endYear = startYear, certainty = 'anchored') {
  return { ...context(label, dateLabel, startYear, endYear, certainty), group }
}

function parallelContext(event, label, dateLabel, startYear, endYear = startYear, certainty = 'anchored') {
  return groupedContext(`Parallel accounts — ${event}`, label, dateLabel, startYear, endYear, certainty)
}

function timelineAnchor(dateLabel, summary) {
  return { dateLabel, summary }
}

function situationPhase(id, label, anchor) {
  return {
    id,
    label,
    ...(anchor ? { anchor } : {}),
  }
}

function situationPassage(label, source, start, end = start) {
  return { label, source, start, end }
}

function situationalTimeline(heading, phases, passages) {
  return {
    presentation: 'situational',
    perspective: 'historical-situation',
    heading,
    phases,
    passages,
  }
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

  'jeremiah-last-kings-survey': situationalTimeline(
    'Judah’s last kings',
    [
      situationPhase('jehoiakim', 'Jehoiakim'),
      situationPhase('jehoiachin', 'Jehoiachin'),
      situationPhase('first-exile', 'First exile'),
      situationPhase('zedekiah', 'Zedekiah'),
      situationPhase('final-siege', 'Final siege'),
    ],
    [
      situationPassage('Jer 21', 'jeremiah', 'final-siege'),
      situationPassage('Jer 22–23', 'jeremiah', 'jehoiakim', 'zedekiah'),
      situationPassage('Jer 24', 'jeremiah', 'first-exile'),
      situationPassage('2 Kin 23:31–24:20', 'kings', 'jehoiakim', 'zedekiah'),
      situationPassage('2 Chr 36:1–13', 'chronicles', 'jehoiakim', 'zedekiah'),
    ]
  ),

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

  'jeremiah-zedekiah-siege-anchors': situationalTimeline(
    'Babylon’s final siege of Jerusalem',
    [
      situationPhase('surrounded', 'Siege begins'),
      situationPhase('withdrawal', 'Withdrawal'),
      situationPhase('return', 'Siege resumes'),
      situationPhase('fall', 'Fall'),
    ],
    [
      situationPassage('Jer 37–38', 'jeremiah', 'surrounded', 'return'),
      situationPassage('2 Kin 25:1–7', 'kings', 'surrounded', 'fall'),
      situationPassage('2 Chr 36:17–20', 'chronicles', 'return', 'fall'),
    ]
  ),

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

  'jeremiah-fall-and-aftermath': situationalTimeline(
    'Babylon’s siege and its aftermath',
    [
      situationPhase('siege', 'Siege'),
      situationPhase('fall', 'Fall'),
      situationPhase('gedaliah', 'Gedaliah'),
      situationPhase('flight', 'Flight'),
      situationPhase('egypt', 'Egypt'),
    ],
    [
      situationPassage('Jer 39–41', 'jeremiah', 'fall', 'gedaliah'),
      situationPassage('Jer 42–44', 'jeremiah', 'flight', 'egypt'),
      situationPassage('2 Kin 25:1–26', 'kings', 'siege', 'flight'),
      situationPassage('2 Chr 36:17–21', 'chronicles', 'fall'),
    ]
  ),

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

// The reader-facing presentation is event-first. The date-axis definitions above
// remain as legacy reference data, while every generated aid uses these compact
// situation tracks and passage-only bars.
const situationalTimelineOverrides = {
  'job-patriarchal-placement': situationalTimeline(
    'Job’s story setting',
    [
      situationPhase('household', 'Household'),
      situationPhase('testing', 'Testing'),
      situationPhase('debate', 'Debate'),
      situationPhase('answer', 'God answers'),
      situationPhase('restoration', 'Restoration'),
    ],
    [
      situationPassage('Job 1–2', 'wisdom', 'household', 'testing'),
      situationPassage('Job 3–31', 'wisdom', 'debate'),
      situationPassage('Job 32–37', 'wisdom', 'debate'),
      situationPassage('Job 38–42', 'wisdom', 'answer', 'restoration'),
    ]
  ),

  'obadiah-traditional-placement': situationalTimeline(
    'Obadiah’s proposed settings',
    [
      situationPhase('kingdom', 'Divided kingdom'),
      situationPhase('fall', 'Jerusalem falls'),
      situationPhase('exile', 'Exile'),
      situationPhase('return', 'Return'),
    ],
    [
      situationPassage('Obad 1', 'prophet', 'kingdom', 'exile'),
    ]
  ),

  'joel-traditional-placement': situationalTimeline(
    'Joel’s proposed settings',
    [
      situationPhase('monarchy', 'Monarchy'),
      situationPhase('fall', 'Jerusalem falls'),
      situationPhase('exile', 'Exile'),
      situationPhase('post-exile', 'Post-exile'),
    ],
    [
      situationPassage('Joel 1–3', 'prophet', 'monarchy', 'post-exile'),
    ]
  ),

  'jonah-jeroboam-ii': situationalTimeline(
    'Jonah during Jeroboam II’s reign',
    [
      situationPhase('jeroboam', 'Jeroboam II'),
      situationPhase('sent', 'Jonah sent'),
      situationPhase('nineveh', 'Nineveh'),
      situationPhase('repentance', 'Repentance'),
    ],
    [
      situationPassage('2 Kin 14:23–25', 'kings', 'jeroboam'),
      situationPassage('Jon 1–4', 'prophet', 'sent', 'repentance'),
    ]
  ),

  'amos-hosea-eighth-century': situationalTimeline(
    'Israel’s final northern-kingdom crisis',
    [
      situationPhase('jeroboam', 'Jeroboam II'),
      situationPhase('decline', 'Northern decline'),
      situationPhase('samaria', 'Samaria falls'),
      situationPhase('aftermath', 'Aftermath'),
    ],
    [
      situationPassage('Amos 1–9', 'prophet', 'jeroboam', 'decline'),
      situationPassage('Hos 1–14', 'prophet', 'jeroboam', 'aftermath'),
      situationPassage('2 Kin 14–17', 'kings', 'jeroboam', 'aftermath'),
    ]
  ),

  'isaiah-uzziah-transition': situationalTimeline(
    'Isaiah across Judah’s kings',
    [
      situationPhase('uzziah', 'Uzziah'),
      situationPhase('death', 'Uzziah dies'),
      situationPhase('jotham', 'Jotham'),
      situationPhase('ahaz', 'Ahaz'),
      situationPhase('hezekiah', 'Hezekiah'),
    ],
    [
      situationPassage('Isa 1–5', 'prophet', 'uzziah', 'hezekiah'),
      situationPassage('Isa 6', 'prophet', 'death'),
    ]
  ),

  'isaiah-ahaz-crisis': situationalTimeline(
    'Ahaz and the Syria–Israel crisis',
    [
      situationPhase('threat', 'Syria–Israel threat'),
      situationPhase('appeal', 'Ahaz seeks Assyria'),
      situationPhase('damascus', 'Damascus falls'),
      situationPhase('pressure', 'Assyrian pressure'),
    ],
    [
      situationPassage('Isa 7', 'prophet', 'threat', 'damascus'),
      situationPassage('Isa 8–12', 'prophet', 'threat', 'pressure'),
      situationPassage('2 Kin 16', 'kings', 'threat', 'damascus'),
      situationPassage('2 Chr 28', 'chronicles', 'threat', 'pressure'),
    ]
  ),

  'micah-isaiah-overlap': situationalTimeline(
    'Micah and Isaiah’s shared generation',
    [
      situationPhase('jotham', 'Jotham'),
      situationPhase('ahaz', 'Ahaz'),
      situationPhase('hezekiah', 'Hezekiah'),
      situationPhase('invasion', 'Assyrian invasion'),
    ],
    [
      situationPassage('Mic 1–7', 'prophet', 'jotham', 'invasion'),
      situationPassage('Isa 1–39', 'prophet', 'jotham', 'invasion'),
    ]
  ),

  'isaiah-burdens-ahaz-sargon': situationalTimeline(
    'Isaiah’s nation oracles amid Assyrian pressure',
    [
      situationPhase('ahaz', 'Ahaz'),
      situationPhase('ahaz-dies', 'Ahaz dies'),
      situationPhase('ashdod', 'Ashdod campaign'),
      situationPhase('crisis', 'Assyrian crisis'),
    ],
    [
      situationPassage('Isa 13–19, 21–23', 'prophet', 'ahaz', 'crisis'),
      situationPassage('Isa 14:28–32', 'prophet', 'ahaz-dies'),
      situationPassage('Isa 20', 'prophet', 'ashdod'),
    ]
  ),

  'isaiah-hezekiah-assyrian-crisis': situationalTimeline(
    'Hezekiah and Sennacherib',
    [
      situationPhase('threat', 'Assyrian threat'),
      situationPhase('jerusalem', 'Jerusalem threatened'),
      situationPhase('deliverance', 'Rescue'),
      situationPhase('illness', 'Hezekiah’s illness'),
      situationPhase('envoys', 'Babylonian envoys'),
    ],
    [
      situationPassage('Isa 24–35', 'prophet', 'threat', 'deliverance'),
      situationPassage('Isa 36–39', 'prophet', 'threat', 'envoys'),
      situationPassage('2 Kin 18:13–20:19', 'kings', 'threat', 'envoys'),
      situationPassage('2 Chr 32', 'chronicles', 'threat', 'envoys'),
    ]
  ),

  'isaiah-comfort-prophecy': situationalTimeline(
    'Isaiah’s ministry and prophetic horizon',
    [
      situationPhase('ministry', 'Isaiah’s ministry'),
      situationPhase('exile', 'Exile foreseen'),
      situationPhase('comfort', 'Comfort promised'),
      situationPhase('return', 'Return foreseen'),
    ],
    [
      situationPassage('Isa 1–39', 'prophet', 'ministry'),
      situationPassage('Isa 40–66', 'prophet', 'ministry', 'return'),
    ]
  ),

  'josiah-prophetic-cluster': situationalTimeline(
    'The prophetic crisis around Josiah',
    [
      situationPhase('reform', 'Josiah’s reform'),
      situationPhase('assyria', 'Assyria collapses'),
      situationPhase('babylon', 'Babylon rises'),
      situationPhase('exile', 'Exile approaches'),
    ],
    [
      situationPassage('Nah 1–3', 'prophet', 'assyria'),
      situationPassage('Zeph 1–3', 'prophet', 'reform', 'exile'),
      situationPassage('Jer 1:1–3', 'jeremiah', 'reform', 'exile'),
      situationPassage('Hab 1–3', 'prophet', 'babylon', 'exile'),
    ]
  ),

  'josiah-context-before-jeremiah': situationalTimeline(
    'Josiah’s reform and Jeremiah’s call',
    [
      situationPhase('law', 'Law found'),
      situationPhase('covenant', 'Covenant renewed'),
      situationPhase('passover', 'Passover'),
      situationPhase('death', 'Josiah dies'),
      situationPhase('continues', 'Jeremiah continues'),
    ],
    [
      situationPassage('2 Kin 22–23', 'kings', 'law', 'death'),
      situationPassage('2 Chr 34–35', 'chronicles', 'law', 'death'),
      situationPassage('Jer 1:1–3', 'jeremiah', 'law', 'continues'),
    ]
  ),

  'nahum-zephaniah-late-judah-setting': situationalTimeline(
    'Nahum and Zephaniah before Judah’s fall',
    [
      situationPhase('josiah', 'Josiah'),
      situationPhase('nineveh-warned', 'Nineveh warned'),
      situationPhase('nineveh-falls', 'Nineveh falls'),
      situationPhase('judah-warned', 'Judah warned'),
    ],
    [
      situationPassage('Nah 1–3', 'prophet', 'nineveh-warned', 'nineveh-falls'),
      situationPassage('Zeph 1–3', 'prophet', 'josiah', 'judah-warned'),
    ]
  ),

  'jeremiah-fall-of-jerusalem': situationalTimeline(
    'Jeremiah’s ministry begins and continues',
    [
      situationPhase('josiah', 'Josiah'),
      situationPhase('jehoiakim', 'Jehoiakim'),
      situationPhase('first-exile', 'First exile'),
      situationPhase('zedekiah', 'Zedekiah'),
      situationPhase('fall', 'Jerusalem falls'),
    ],
    [
      situationPassage('Jer 1:1–3', 'jeremiah', 'josiah', 'fall'),
      situationPassage('Jer 1–20', 'jeremiah', 'josiah', 'zedekiah'),
    ]
  ),

  'jeremiah-era-band-compromise': situationalTimeline(
    'The historical frame interrupting Jeremiah',
    [
      situationPhase('josiah', 'Josiah'),
      situationPhase('jehoiakim', 'Jehoiakim'),
      situationPhase('first-exile', 'First exile'),
      situationPhase('zedekiah', 'Zedekiah'),
      situationPhase('siege', 'Final siege'),
    ],
    [
      situationPassage('Jer 1–20', 'jeremiah', 'josiah', 'zedekiah'),
      situationPassage('2 Kin 23:31–24:20', 'kings', 'jehoiakim', 'zedekiah'),
      situationPassage('2 Chr 36:1–13', 'chronicles', 'jehoiakim', 'zedekiah'),
      situationPassage('Jer 21 onward', 'jeremiah', 'jehoiakim', 'siege'),
    ]
  ),

  'habakkuk-babylonian-rise-setting': situationalTimeline(
    'Habakkuk as Babylon rises',
    [
      situationPhase('assyria', 'Assyria fades'),
      situationPhase('babylon', 'Babylon rises'),
      situationPhase('threat', 'Judah threatened'),
    ],
    [
      situationPassage('Hab 1–3', 'prophet', 'assyria', 'threat'),
    ]
  ),

  'jeremiah-last-kings-survey': situationalTimeline(
    'Judah’s last kings',
    [
      situationPhase('jehoiakim', 'Jehoiakim'),
      situationPhase('jehoiachin', 'Jehoiachin'),
      situationPhase('first-exile', 'First exile'),
      situationPhase('zedekiah', 'Zedekiah'),
      situationPhase('final-siege', 'Final siege'),
    ],
    [
      situationPassage('Jer 21', 'jeremiah', 'final-siege'),
      situationPassage('Jer 22–23', 'jeremiah', 'jehoiakim', 'zedekiah'),
      situationPassage('Jer 24', 'jeremiah', 'first-exile'),
      situationPassage('2 Kin 23:31–24:20', 'kings', 'jehoiakim', 'zedekiah'),
      situationPassage('2 Chr 36:1–13', 'chronicles', 'jehoiakim', 'zedekiah'),
    ]
  ),

  'jeremiah-jehoiakim-fourth-year': situationalTimeline(
    'Jeremiah during Jehoiakim’s reign',
    [
      situationPhase('accession', 'Jehoiakim begins'),
      situationPhase('fourth-year', 'Fourth year'),
      situationPhase('babylon', 'Babylon advances'),
      situationPhase('end', 'Reign ends'),
    ],
    [
      situationPassage('Jer 26', 'jeremiah', 'accession'),
      situationPassage('Jer 25', 'jeremiah', 'fourth-year'),
      situationPassage('2 Kin 23:34–24:7', 'kings', 'accession', 'end'),
      situationPassage('2 Chr 36:4–8', 'chronicles', 'accession', 'end'),
    ]
  ),

  'jeremiah-zedekiah-first-exiles': situationalTimeline(
    'The first exile and Zedekiah’s reign',
    [
      situationPhase('first-exile', 'First exile'),
      situationPhase('installed', 'Zedekiah installed'),
      situationPhase('fourth-year', 'Fourth year'),
      situationPhase('siege', 'Final siege'),
    ],
    [
      situationPassage('Jer 27–29', 'jeremiah', 'installed', 'siege'),
      situationPassage('Jer 28', 'jeremiah', 'fourth-year'),
      situationPassage('2 Kin 24:10–20', 'kings', 'first-exile', 'installed'),
      situationPassage('2 Chr 36:9–14', 'chronicles', 'first-exile', 'installed'),
    ]
  ),

  'jeremiah-consolation-siege-flashback': situationalTimeline(
    'Jeremiah moves between Jehoiakim and the siege',
    [
      situationPhase('jehoiakim', 'Jehoiakim'),
      situationPhase('fourth-year', 'Fourth year'),
      situationPhase('first-exile', 'First exile'),
      situationPhase('zedekiah', 'Zedekiah'),
      situationPhase('siege', 'Final siege'),
    ],
    [
      situationPassage('Jer 30–31', 'jeremiah', 'jehoiakim', 'siege'),
      situationPassage('Jer 32–34', 'jeremiah', 'siege'),
      situationPassage('Jer 35', 'jeremiah', 'jehoiakim'),
      situationPassage('Jer 36', 'jeremiah', 'fourth-year'),
      situationPassage('2 Kin 24–25:7', 'kings', 'jehoiakim', 'siege'),
      situationPassage('2 Chr 36:4–20', 'chronicles', 'jehoiakim', 'siege'),
    ]
  ),

  'daniel-early-babylonian-exile': situationalTimeline(
    'Daniel enters Babylonian service',
    [
      situationPhase('jehoiakim', 'Jehoiakim', timelineAnchor(
        '609–598 BC (est.)',
        'Daniel 1 opens during Jehoiakim’s reign, before the later exile of his son Jehoiachin (Dan 1:1; 2 Kin 23:36).'
      )),
      situationPhase('babylon', 'Babylon triumphs', timelineAnchor(
        '605 BC (est.)',
        'In Jehoiakim’s fourth year, Babylon defeated Egypt at Carchemish, the first year of Nebuchadnezzar (Jer 25:1; 46:2).'
      )),
      situationPhase('taken', 'Daniel taken', timelineAnchor(
        '606/605 BC (est.)',
        'Daniel 1 places Jerusalem’s siege and Daniel’s removal in Jehoiakim’s third year (Dan 1:1–6).'
      )),
      situationPhase('training', 'Court training', timelineAnchor(
        'c. 605–602 BC (est.)',
        'Daniel’s training and earliest court service belong to the opening years of Nebuchadnezzar’s reign (Dan 1:5, 18–20; 2:1).'
      )),
      situationPhase('jehoiachin-exile', 'Jehoiachin exiled', timelineAnchor(
        '597 BC (est.)',
        'Nebuchadnezzar later carried Jehoiachin and Jerusalem’s leaders to Babylon (2 Kin 24:10–17; Jer 24:1).'
      )),
    ],
    [
      situationPassage('Dan 1', 'prophet', 'jehoiakim', 'training'),
      situationPassage('Dan 2', 'prophet', 'training'),
      situationPassage('Jer 25:1; 46:2', 'jeremiah', 'babylon'),
      situationPassage('2 Kin 24:1–17', 'kings', 'babylon', 'jehoiachin-exile'),
      situationPassage('2 Chr 36:5–10', 'chronicles', 'babylon', 'jehoiachin-exile'),
      situationPassage('Jer 24:1', 'jeremiah', 'jehoiachin-exile'),
    ]
  ),

  'jeremiah-zedekiah-siege-anchors': situationalTimeline(
    'Babylon’s final siege of Jerusalem',
    [
      situationPhase('surrounded', 'Siege begins'),
      situationPhase('withdrawal', 'Withdrawal'),
      situationPhase('return', 'Siege resumes'),
      situationPhase('fall', 'Fall'),
    ],
    [
      situationPassage('Jer 37–38', 'jeremiah', 'surrounded', 'return'),
      situationPassage('2 Kin 25:1–7', 'kings', 'surrounded', 'fall'),
      situationPassage('2 Chr 36:17–20', 'chronicles', 'return', 'fall'),
    ]
  ),

  'jeremiah-appendix-oracles': situationalTimeline(
    'Jeremiah’s nations appendix spans two reigns',
    [
      situationPhase('fourth-year', 'Jehoiakim’s fourth year'),
      situationPhase('nations', 'Nations oracles'),
      situationPhase('zedekiah', 'Zedekiah’s fourth year'),
      situationPhase('siege', 'Final siege'),
    ],
    [
      situationPassage('Jer 45–46', 'jeremiah', 'fourth-year'),
      situationPassage('Jer 47–50', 'jeremiah', 'nations', 'siege'),
      situationPassage('Jer 51:1–58', 'jeremiah', 'nations', 'siege'),
      situationPassage('Jer 51:59–64', 'jeremiah', 'zedekiah'),
    ]
  ),

  'late-judah-fall-history-first': situationalTimeline(
    'Judah falls and exile begins',
    [
      situationPhase('siege', 'Final siege', timelineAnchor(
        '588 BC (est.)',
        'Babylon began its final siege of Jerusalem in Zedekiah’s ninth year (2 Kin 25:1).'
      )),
      situationPhase('fall', 'Fall', timelineAnchor(
        '586 BC (est.)',
        'Jerusalem was breached and the temple was burned in Zedekiah’s eleventh year (2 Kin 25:2–10).'
      )),
      situationPhase('gedaliah', 'Gedaliah / flight', timelineAnchor(
        'After 586 BC (est.)',
        'After Gedaliah was killed, the remnant fled to Egypt because they feared Babylon (2 Kin 25:22–26).'
      )),
      situationPhase('release', 'Jehoiachin freed', timelineAnchor(
        '561 BC (est.)',
        'Evil-merodach released Jehoiachin in the thirty-seventh year of his exile (2 Kin 25:27).'
      )),
      situationPhase('return', 'Return decree', timelineAnchor(
        '538 BC (est.)',
        'Cyrus authorized the exiles to return and rebuild the temple (2 Chr 36:22–23).'
      )),
    ],
    [
      situationPassage('2 Kin 25:1–26', 'kings', 'siege', 'gedaliah'),
      situationPassage('2 Kin 25:27–30', 'kings', 'release'),
      situationPassage('2 Chr 36:11–21', 'chronicles', 'siege', 'fall'),
      situationPassage('2 Chr 36:22–23', 'chronicles', 'return'),
      situationPassage('Jer 39–43', 'jeremiah', 'fall', 'gedaliah'),
      situationPassage('Jer 52:31–34', 'jeremiah', 'release'),
    ]
  ),

  'jeremiah-fall-and-aftermath': situationalTimeline(
    'Babylon’s siege and its aftermath',
    [
      situationPhase('siege', 'Siege', timelineAnchor(
        '588 BC (est.)',
        'Babylon began its final siege of Jerusalem in Zedekiah’s ninth year (Jer 39:1).'
      )),
      situationPhase('fall', 'Fall', timelineAnchor(
        '586 BC (est.)',
        'Jerusalem was breached in Zedekiah’s eleventh year, beginning the city’s final collapse (Jer 39:2).'
      )),
      situationPhase('gedaliah', 'Gedaliah', timelineAnchor(
        'After 586 BC (est.)',
        'Babylon appointed Gedaliah over the people left in Judah after Jerusalem fell (Jer 40:5–12).'
      )),
      situationPhase('flight', 'Flight', timelineAnchor(
        'After 586 BC (est.)',
        'After Gedaliah’s murder, the remnant went to Egypt despite Jeremiah’s warning (Jer 41:16–43:7).'
      )),
      situationPhase('egypt', 'Egypt', timelineAnchor(
        'After 586 BC (est.)',
        'Jeremiah addressed the Judean communities living in Egypt after the flight (Jer 44:1).'
      )),
    ],
    [
      situationPassage('Jer 39–41', 'jeremiah', 'fall', 'gedaliah'),
      situationPassage('Jer 42–44', 'jeremiah', 'flight', 'egypt'),
      situationPassage('2 Kin 25:1–26', 'kings', 'siege', 'flight'),
      situationPassage('2 Chr 36:17–21', 'chronicles', 'fall'),
    ]
  ),

  'jeremiah-historical-appendix': situationalTimeline(
    'Jeremiah 52 retells Judah’s final collapse',
    [
      situationPhase('zedekiah', 'Zedekiah', timelineAnchor(
        '597–586 BC (est.)',
        'Jeremiah 52 opens by looking back across Zedekiah’s eleven-year reign (Jer 52:1).'
      )),
      situationPhase('siege', 'Final siege', timelineAnchor(
        '588–586 BC (est.)',
        'The appendix retells Babylon’s siege from Zedekiah’s ninth through eleventh years (Jer 52:4–7).'
      )),
      situationPhase('fall', 'Fall / deportation', timelineAnchor(
        '586 BC (est.)',
        'Jeremiah 52 recounts Jerusalem’s destruction and the deportations that followed (Jer 52:12–30).'
      )),
      situationPhase('escape', 'Escape to Egypt', timelineAnchor(
        'After 586 BC (est.)',
        'After Gedaliah was killed, the remnant fled to Egypt; Jeremiah 52 skips this interval (Jer 41:16–43:7).'
      )),
      situationPhase('release', 'Jehoiachin freed', timelineAnchor(
        '561 BC (est.)',
        'The final verses jump forward to Jehoiachin’s release in the thirty-seventh year of his exile (Jer 52:31–34).'
      )),
    ],
    [
      situationPassage('Jer 52:1–30', 'jeremiah', 'zedekiah', 'fall'),
      situationPassage('2 Kin 24:18–25:21', 'kings', 'zedekiah', 'fall'),
      situationPassage('2 Chr 36:11–21', 'chronicles', 'zedekiah', 'fall'),
      situationPassage('Jer 52:31–34', 'jeremiah', 'release'),
      situationPassage('2 Kin 25:27–30', 'kings', 'release'),
    ]
  ),

  'lamentations-after-jerusalem-falls': situationalTimeline(
    'Jerusalem falls, and Judah mourns',
    [
      situationPhase('fall', 'Jerusalem falls', timelineAnchor(
        '586 BC (est.)',
        'Babylon breached Jerusalem and burned the temple after the final siege (2 Kin 25:2–10).'
      )),
      situationPhase('ruins', 'City in ruins', timelineAnchor(
        'After 586 BC (est.)',
        'The poems speak from Jerusalem’s devastated aftermath, with the city emptied and grieving (Lam 1:1; 2:8–9).'
      )),
      situationPhase('mourning', 'Communal mourning', timelineAnchor(
        '586–539 BC (broad est.)',
        'The poems give voice to personified Jerusalem, an individual sufferer, and the surviving community.'
      )),
      situationPhase('hope', 'Restoration sought', timelineAnchor(
        'After 586 BC (est.)',
        'The collection ends by asking the Lord to restore his people, without narrating their return (Lam 5:19–22).'
      )),
      situationPhase('flight', 'Flight to Egypt', timelineAnchor(
        'After 586 BC (est.)',
        'After Gedaliah’s murder, the surviving remnant took Jeremiah to Egypt (Jer 41:16–43:7).'
      )),
    ],
    [
      situationPassage('Lam 1–2', 'other', 'ruins', 'mourning'),
      situationPassage('Lam 3', 'other', 'mourning', 'hope'),
      situationPassage('Lam 4', 'other', 'fall', 'mourning'),
      situationPassage('Lam 5', 'other', 'mourning', 'hope'),
      situationPassage('2 Kin 25:1–21', 'kings', 'fall'),
      situationPassage('Jer 39; 52:1–30', 'jeremiah', 'fall'),
      situationPassage('Jer 40–44', 'jeremiah', 'ruins', 'flight'),
    ]
  ),

  'exilic-psalm-laments': situationalTimeline(
    'Songs of destruction, exile, and return',
    [
      situationPhase('destruction', 'Jerusalem destroyed', timelineAnchor(
        '586 BC (est.)',
        'Babylon burned Jerusalem and the temple after breaching the city (2 Kin 25:8–10).'
      )),
      situationPhase('displaced', 'Survivors displaced', timelineAnchor(
        'After 586 BC (est.)',
        'Survivors were deported to Babylon, scattered through Judah, or driven toward Egypt (2 Kin 25:11–26; Jer 43:4–7).'
      )),
      situationPhase('lament', 'Lament in exile', timelineAnchor(
        '586–539 BC (broad est.)',
        'The exile supplied the broad setting for grief over the ruined city and sanctuary (Ps 74; 79; 137).'
      )),
      situationPhase('hope', 'Hope for return', timelineAnchor(
        '586–539 BC (broad est.)',
        'Exilic prayers ask God to remember his covenant, restore his people, and rebuild Zion (Ps 89; 102).'
      )),
      situationPhase('return', 'Return begins', timelineAnchor(
        '539/538 BC (est.)',
        'Cyrus authorized the exiles to return and rebuild the house of the Lord (2 Chr 36:22–23; Ezra 1:1–4).'
      )),
    ],
    [
      situationPassage('Ps 74, 79', 'psalm', 'destruction', 'lament'),
      situationPassage('Ps 89, 102', 'psalm', 'displaced', 'hope'),
      situationPassage('Ps 137', 'psalm', 'lament'),
      situationPassage('Ps 85', 'psalm', 'hope', 'return'),
      situationPassage('2 Kin 25', 'kings', 'destruction', 'hope'),
      situationPassage('2 Chr 36:17–23', 'chronicles', 'destruction', 'return'),
      situationPassage('Jer 39–44; 52', 'jeremiah', 'destruction', 'hope'),
    ]
  ),

  'ezekiel-dated-exile-visions': situationalTimeline(
    'Jeremiah in Judah, Ezekiel among the exiles',
    [
      situationPhase('first-exile', 'Jehoiachin exiled', timelineAnchor(
        '597 BC (est.)',
        'Nebuchadnezzar took Jehoiachin, Ezekiel, and other leaders from Jerusalem to Babylon (2 Kin 24:10–17).'
      )),
      situationPhase('call', 'Ezekiel called', timelineAnchor(
        '593 BC (est.)',
        'Ezekiel received his call among the exiles while Zedekiah still ruled Jerusalem (Ezek 1:1–3).'
      )),
      situationPhase('warnings', 'Parallel warnings', timelineAnchor(
        '593–588 BC (est.)',
        'Jeremiah warned Judah from Jerusalem while Ezekiel warned the earlier exiles in Babylon (Jer 27–36; Ezek 4–23).'
      )),
      situationPhase('siege', 'Final siege', timelineAnchor(
        '588–586 BC (est.)',
        'Ezekiel 24 and 2 Kings 25 date Babylon’s siege to the same year, month, and day (Ezek 24:1–2; 2 Kin 25:1).'
      )),
      situationPhase('fall-news', 'Fall / news', timelineAnchor(
        '586/585 BC (est.)',
        'Jerusalem fell in 586 BC, and a survivor later brought the news to Ezekiel in Babylon (Ezek 33:21).'
      )),
      situationPhase('restoration', 'Restoration visions', timelineAnchor(
        '585–573 BC (broad est.)',
        'After the fall, Ezekiel’s message turns toward a restored people, land, and temple (Ezek 34–48).'
      )),
    ],
    [
      situationPassage('Jer 27–36', 'jeremiah', 'first-exile', 'warnings'),
      situationPassage('Ezek 1–7', 'prophet', 'call', 'warnings'),
      situationPassage('Ezek 8–23', 'prophet', 'warnings'),
      situationPassage('Jer 37–39', 'jeremiah', 'siege', 'fall-news'),
      situationPassage('Ezek 24; 29–31', 'prophet', 'siege'),
      situationPassage('2 Kin 24:10–25:21', 'kings', 'first-exile', 'fall-news'),
      situationPassage('2 Chr 36:9–21', 'chronicles', 'first-exile', 'fall-news'),
      situationPassage('Jer 40–44; 52', 'jeremiah', 'fall-news'),
      situationPassage('Ezek 25–39', 'prophet', 'fall-news', 'restoration'),
      situationPassage('Ezek 40–48', 'prophet', 'restoration'),
    ]
  ),

  'daniel-later-reign-markers': situationalTimeline(
    'Daniel across Babylon and Persia',
    [
      situationPhase('babylon', 'Babylonian court'),
      situationPhase('belshazzar', 'Belshazzar'),
      situationPhase('fall', 'Babylon falls'),
      situationPhase('darius', 'Darius'),
      situationPhase('cyrus', 'Cyrus'),
    ],
    [
      situationPassage('Dan 3–4', 'prophet', 'babylon'),
      situationPassage('Dan 7–8', 'prophet', 'belshazzar'),
      situationPassage('Dan 5', 'prophet', 'fall'),
      situationPassage('Dan 6, 9', 'prophet', 'darius'),
      situationPassage('Dan 10–12', 'prophet', 'cyrus'),
    ]
  ),

  'haggai-zechariah-temple-rebuild': situationalTimeline(
    'The prophets inside Ezra’s temple rebuild',
    [
      situationPhase('return', 'First return'),
      situationPhase('stalls', 'Work stalls'),
      situationPhase('prophets', 'Prophets call'),
      situationPhase('resumes', 'Work resumes'),
      situationPhase('completed', 'Temple completed'),
    ],
    [
      situationPassage('Ezra 1–4', 'history', 'return', 'stalls'),
      situationPassage('Hag 1–2', 'prophet', 'prophets', 'resumes'),
      situationPassage('Zech 1–8', 'prophet', 'prophets', 'resumes'),
      situationPassage('Ezra 5–6', 'history', 'resumes', 'completed'),
    ]
  ),

  'return-and-pilgrimage-psalms': situationalTimeline(
    'Return, rebuilding, and pilgrimage worship',
    [
      situationPhase('return', 'Return'),
      situationPhase('temple', 'Temple rebuilt'),
      situationPhase('jerusalem', 'Jerusalem rebuilt'),
      situationPhase('pilgrimage', 'Pilgrimage worship'),
    ],
    [
      situationPassage('Ezra 1–Neh 13', 'history', 'return', 'jerusalem'),
      situationPassage('Ps 126', 'psalm', 'return', 'jerusalem'),
      situationPassage('Ps 120–134', 'psalm', 'temple', 'pilgrimage'),
    ]
  ),

  'malachi-post-exilic-close': situationalTimeline(
    'Malachi in the restored community',
    [
      situationPhase('temple', 'Temple restored'),
      situationPhase('ezra', 'Ezra’s reforms'),
      situationPhase('nehemiah', 'Nehemiah’s reforms'),
      situationPhase('warning', 'Post-exilic warning'),
    ],
    [
      situationPassage('Ezra 7–10', 'history', 'ezra'),
      situationPassage('Neh 13', 'history', 'nehemiah'),
      situationPassage('Mal 1–4', 'prophet', 'ezra', 'warning'),
    ]
  ),

  'james-early-church': situationalTimeline(
    'James amid the early Jerusalem church',
    [
      situationPhase('jerusalem', 'Jerusalem church'),
      situationPhase('persecution', 'Suffering'),
      situationPhase('scattered', 'Believers scattered'),
      situationPhase('gentiles', 'Gentile mission'),
    ],
    [
      situationPassage('Acts 1–8', 'acts', 'jerusalem', 'scattered'),
      situationPassage('Jas 1–5', 'letter', 'scattered', 'gentiles'),
    ]
  ),

  'galatians-acts-mission': situationalTimeline(
    'Galatians near Paul’s early missions',
    [
      situationPhase('mission', 'First mission'),
      situationPhase('galatia', 'South Galatia'),
      situationPhase('council', 'Jerusalem council'),
      situationPhase('later', 'Later-date view'),
    ],
    [
      situationPassage('Acts 13–14', 'acts', 'mission', 'galatia'),
      situationPassage('Acts 15', 'acts', 'council'),
      situationPassage('Gal 1–6', 'letter', 'mission', 'council'),
    ]
  ),

  'thessalonians-corinth': situationalTimeline(
    'The Thessalonian letters during Paul’s second mission',
    [
      situationPhase('macedonia', 'Macedonia'),
      situationPhase('thessalonica', 'Thessalonica'),
      situationPhase('athens', 'Athens'),
      situationPhase('corinth', 'Corinth'),
    ],
    [
      situationPassage('Acts 16–18', 'acts', 'macedonia', 'corinth'),
      situationPassage('1 Thess 1–5', 'letter', 'thessalonica', 'corinth'),
      situationPassage('2 Thess 1–3', 'letter', 'corinth'),
    ]
  ),

  'corinthians-romans-acts-19-20': situationalTimeline(
    'Corinthians and Romans across Paul’s travels',
    [
      situationPhase('ephesus', 'Ephesus'),
      situationPhase('macedonia', 'Macedonia'),
      situationPhase('greece', 'Greece'),
      situationPhase('jerusalem', 'Jerusalem journey'),
    ],
    [
      situationPassage('Acts 19', 'acts', 'ephesus'),
      situationPassage('1 Cor 1–16', 'letter', 'ephesus'),
      situationPassage('Acts 20', 'acts', 'macedonia', 'jerusalem'),
      situationPassage('2 Cor 1–13', 'letter', 'macedonia'),
      situationPassage('Rom 1–16', 'letter', 'greece', 'jerusalem'),
    ]
  ),

  'prison-epistles-after-acts': situationalTimeline(
    'Paul’s journey into Roman custody',
    [
      situationPhase('jerusalem', 'Jerusalem custody'),
      situationPhase('voyage', 'Voyage to Rome'),
      situationPhase('rome', 'Roman imprisonment'),
    ],
    [
      situationPassage('Acts 21–28', 'acts', 'jerusalem', 'rome'),
      situationPassage('Eph 1–6; Phil 1–4', 'letter', 'rome'),
      situationPassage('Col 1–4; Phlm 1', 'letter', 'rome'),
    ]
  ),

  'late-epistles-and-revelation': situationalTimeline(
    'The New Testament’s closing decades',
    [
      situationPhase('after-acts', 'After Acts'),
      situationPhase('pastoral', 'Pastoral ministry'),
      situationPhase('persecution', 'Suffering'),
      situationPhase('late', 'Late apostolic era'),
      situationPhase('revelation', 'Revelation'),
    ],
    [
      situationPassage('1 Tim 1–6; Titus 1–3', 'letter', 'pastoral'),
      situationPassage('2 Tim 1–4', 'letter', 'persecution'),
      situationPassage('1 Pet 1–5; Heb 1–13', 'letter', 'persecution'),
      situationPassage('2 Pet 1–3; Jude 1', 'letter', 'persecution', 'late'),
      situationPassage('1–3 John', 'letter', 'late'),
      situationPassage('Rev 1–22', 'letter', 'revelation'),
    ]
  ),
}

Object.assign(chronologicalTimelineAids, situationalTimelineOverrides)
