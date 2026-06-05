import fs from 'node:fs'
import path from 'node:path'
import { bibleBooks } from '../src/data/bible-books.js'

const totalDays = 365
const generatorVersion = 2

const sourceNotes = [
  {
    id: 'biblical_superscriptions',
    title: 'Internal biblical headings, date notices, and contextual anchors',
    use: 'Explicit book openings, psalm titles, dated prophetic headings, and internal contextual signals such as Isaiah 1:1, Zephaniah 1:1, Psalm 90, and Habakkuk 1:6.',
    url: 'https://www.biblegateway.com/versions/World-English-Bible-WEB/',
    rightsNote: 'Primary biblical reference data; translation text remains separately licensed.',
  },
  {
    id: 'townsend_ot_nt',
    title: 'George Townsend chronological Old and New Testament arrangements',
    years: '1826-1837',
    use: 'Whole-Bible chronological backbone and the principle of inserting Psalms, Prophets, and Epistles near their historical setting.',
    url: 'https://books.google.com/books/about/The_Holy_Bible.html?id=luuSd4gNlegC',
    rightsNote: 'Public-domain-era source; used as a historical guide, not copied as a day-by-day reading schedule.',
  },
  {
    id: 'merrill_kings_prophets',
    title: 'Stephen Merrill, A Harmony of the Kings and Prophets',
    year: 1832,
    use: 'Kings, Chronicles, and Prophets alignment during the monarchy.',
    url: 'https://search.worldcat.org/title/A-Harmony-of-the-Kings-and-Prophets/oclc/1000381978',
    rightsNote: 'Public-domain-era source; used as a historical guide.',
  },
  {
    id: 'josiah_reform_context',
    title: 'Josiah-era reform passages',
    use: '2 Kings 22-23 and 2 Chronicles 34-35 for Josiah, the book of the law, Huldah, and Judah\'s covenant reform.',
    url: 'https://www.biblegateway.com/passage/?search=2%20Kings%2022-23%3B%202%20Chronicles%2034-35&version=WEB',
    rightsNote: 'Primary biblical reference data; translation text remains separately licensed.',
  },
  {
    id: 'nahum_nineveh_context',
    title: 'Nahum and Nineveh historical context',
    use: 'Historical context for placing Nahum before Nineveh\'s fall and near the late Assyrian/Josiah-era crisis.',
    url: 'https://www.encyclopedia.com/philosophy-and-religion/bible/old-testament/nahum',
    rightsNote: 'Used for high-level historical context only.',
  },
  {
    id: 'robinson_gospel_harmony',
    title: 'Edward Robinson, A Harmony of the Four Gospels in English',
    year: 1847,
    use: 'Gospel chronology and parallel-account ordering.',
    url: 'https://openlibrary.org/books/OL14010087M/A_harmony_of_the_four_Gospels_in_English',
    rightsNote: 'Public-domain-era source; used as a historical guide.',
  },
  {
    id: 'conybeare_howson_paul',
    title: 'Conybeare and Howson, The Life and Epistles of St. Paul',
    year: 1852,
    use: 'Acts and Pauline epistle placement.',
    url: 'https://openlibrary.org/books/OL20423759M/The_life_and_epistles_of_St._Paul',
    rightsNote: 'Public-domain-era source; used as a historical guide.',
  },
  {
    id: 'web_word_counts',
    title: 'World English Bible text bundled with this app',
    use: 'Approximate word and character counts for generating balanced daily readings.',
    url: 'https://worldenglish.bible/',
    rightsNote: 'The app already stores WEB as a public-domain translation module; the plan stores references plus derived counts only.',
  },
]

const sourceTitleById = new Map(sourceNotes.map(source => [source.id, source.title]))
const sourceLinkById = new Map(sourceNotes.map(source => [source.id, {
  id: source.id,
  title: source.title,
  url: source.url || '',
}]))

function note(id, title, text, sources = []) {
  return {
    type: 'note',
    id,
    title,
    text,
    sources,
  }
}

const readingRhythmPsalmSprinkles = [
  {
    id: 'undated-psalms-covenant-sprinkle',
    target: 'covenant_law',
    note: note(
      'undated-psalms-covenant-sprinkle',
      'Why this Psalm is added to a hard reading day',
      'Psalm chronology is ambiguous for these worship and praise Psalms. Instead of pretending we know their exact dates, the plan sprinkles them one at a time onto dense covenant-law and wilderness days as breathing spaces. In other words: this placement is for reading rhythm, not because these Psalms were written during Leviticus or Numbers.',
      ['biblical_superscriptions', 'townsend_ot_nt']
    ),
    psalms: [111, 112, 113, 115, 116, 117, 118, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 71, 104],
  },
  {
    id: 'undated-psalms-genealogy-sprinkle',
    target: 'chronicles_genealogies',
    note: note(
      'undated-psalms-genealogy-sprinkle',
      'Why this Psalm is added to a genealogy day',
      'The early chapters of Chronicles preserve important genealogy and tribal memory, but they are naturally slower to read. These Psalms have no clear event setting, so the plan uses them as one-at-a-time worshipful pauses at the end of genealogy days while marking the placement as intentionally non-chronological.',
      ['biblical_superscriptions', 'townsend_ot_nt']
    ),
    psalms: [1, 33, 66, 67],
  },
]

const readingRhythmPsalmKeys = new Set(readingRhythmPsalmSprinkles.flatMap(group =>
  group.psalms.map(psalm => `Psalms ${psalm}`)
))

const chronologicalSections = [
  {
    title: 'Primeval History and Patriarchal Wisdom',
    period: 'creation_to_patriarchs',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      'Genesis 1-11',
      note(
        'job-patriarchal-placement',
        'Why Job is here',
        'Job is not dated inside the book, so this is a traditional early placement rather than a hard chronological claim. Public-domain chronological arrangements such as Townsend commonly place Job with the patriarchal age because its setting reads earlier than Israel under Moses or the monarchy.',
        ['townsend_ot_nt']
      ),
      'Job 1-42',
      'Genesis 12-50',
    ],
  },
  {
    title: 'Exodus, Wilderness, and Covenant',
    period: 'exodus_wilderness',
    confidence: 'high',
    sources: ['townsend_ot_nt'],
    passages: [
      'Exodus 1-40',
      'Leviticus 1-27',
      'Numbers 1-36',
      'Psalms 90',
      'Deuteronomy 1-34',
      note(
        'psalm-119-torah-meditation',
        'Why Psalm 119 follows Deuteronomy',
        'Psalm 119 is not dated to Moses, but it is an extended meditation on Yahweh\'s law, word, commandments, and ways. The plan places it after Deuteronomy as a substantial Torah-reflection reading rather than treating it like one of the shorter reading-rhythm Psalms.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 119',
      note(
        'exodus-wilderness-psalms',
        'Why these Psalms follow Moses',
        'Psalm 90 is explicitly titled as a prayer of Moses. Psalms 78, 105, 106, 114, 135, and 136 are not all Mosaic compositions; they are later worshipful retellings of the Exodus and wilderness story, so they are grouped after the Mosaic narrative as theological reflection on that period.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 78',
      'Psalms 105-106',
      'Psalms 114',
      'Psalms 135-136',
    ],
  },
  {
    title: 'Conquest, Judges, and Ruth',
    period: 'conquest_judges',
    confidence: 'high',
    sources: ['townsend_ot_nt'],
    passages: [
      'Joshua 1-24',
      'Judges 1-21',
      'Ruth 1-4',
      '1 Chronicles 1-9',
    ],
  },
  {
    title: 'Samuel, Saul, and David in Exile',
    period: 'united_monarchy_sauls_reign',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      '1 Samuel 1-18',
      note(
        'david-flight-psalms',
        'Why these Psalms are inside David\'s flight from Saul',
        'Several Psalm headings tie individual prayers to episodes while David is fleeing Saul: Saul watching David\'s house, David at Gath, Doeg reporting Ahimelech, the Ziphites, and David hiding in the cave. The plan places those Psalms next to the nearest matching Samuel narrative instead of holding them all until the end of David\'s life.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 7',
      '1 Samuel 19',
      'Psalms 59',
      '1 Samuel 20-21',
      'Psalms 34',
      'Psalms 56',
      '1 Samuel 22',
      'Psalms 52',
      '1 Samuel 23',
      'Psalms 54',
      'Psalms 63',
      '1 Samuel 24',
      'Psalms 57',
      'Psalms 142',
      '1 Samuel 25-31',
      '1 Chronicles 10',
    ],
  },
  {
    title: 'David the King',
    period: 'united_monarchy_david',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      note(
        'samuel-chronicles-parallel-history',
        'Why Samuel and Chronicles are intertwined',
        'Chronicles often retells the same monarchy history from a later priestly and temple-focused angle. Rather than reading all of Samuel and then a large repeated Chronicles block, this plan interleaves the clearest parallels so David\'s reign is followed as a single event-flow with complementary accounts.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      '2 Samuel 1-4',
      '2 Samuel 5',
      '1 Chronicles 11-12',
      '2 Samuel 6',
      '1 Chronicles 13-16',
      '2 Samuel 7',
      '1 Chronicles 17',
      '2 Samuel 8-10',
      '1 Chronicles 18-19',
      'Psalms 60',
      '2 Samuel 11-12',
      'Psalms 51',
      '1 Chronicles 20',
      '2 Samuel 13-14',
      '2 Samuel 15-18',
      'Psalms 3',
      '2 Samuel 19-20',
      '2 Samuel 21',
      note(
        'psalm-18-samuel-parallel',
        'Why Psalm 18 follows David\'s song in Samuel',
        'Psalm 18 is explicitly tied to the day Yahweh delivered David from his enemies and from Saul, and 2 Samuel 22 preserves the same song inside David\'s story. The plan reads Psalm 18 immediately after that Samuel parallel rather than burying it in a general Davidic collection.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      '2 Samuel 22',
      'Psalms 18',
      '2 Samuel 23-24',
      '1 Chronicles 21',
      note(
        'david-temple-preparation-psalms',
        'Why Psalm 30 is near David\'s temple preparations',
        'Psalm 30 is titled as a song for the dedication of the temple and by David. Since the temple itself is built under Solomon, this is not an exact event timestamp; the plan places it near David\'s altar, temple-site, and preparation material while marking the connection as title-based rather than certain.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 30',
      '1 Chronicles 22-29',
      note(
        'levitical-psalm-collections',
        'Why the Asaph and Korah Psalms are near David\'s worship organization',
        'The headings for many of these Psalms name Asaph, the sons of Korah, Heman, or Ethan, while Chronicles describes David organizing temple singers and gatekeepers. Their final dates are not always obvious, and some titles may represent later guild collections, so this is a worship-organization placement rather than a precise claim about when each Psalm was written.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 42-50',
      'Psalms 73',
      'Psalms 75-77',
      'Psalms 80-84',
      'Psalms 87-88',
      note(
        'general-davidic-psalms',
        'Why these Davidic Psalms stay as a collection',
        'These Psalms are titled as Davidic or are traditionally royal/Davidic, but most do not name a specific life event the way Psalms 3, 18, 34, 51, 52, 54, 56, 57, 59, 60, and 142 do. The plan keeps them in David\'s reign, but does not pretend we know a tighter date for each one.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 2',
      'Psalms 4-6',
      'Psalms 8-17',
      'Psalms 19',
      'Psalms 20-29',
      'Psalms 31-32',
      'Psalms 35-41',
      'Psalms 53',
      'Psalms 55',
      'Psalms 58',
      'Psalms 61-62',
      'Psalms 64-65',
      'Psalms 68-70',
      'Psalms 86',
      'Psalms 101',
      'Psalms 103',
      'Psalms 108-110',
      'Psalms 122',
      'Psalms 124',
      'Psalms 131',
      'Psalms 133',
      'Psalms 138-141',
      'Psalms 143-145',
    ],
  },
  {
    title: 'Solomon and Wisdom',
    period: 'united_monarchy_solomon',
    confidence: 'medium',
    sources: ['townsend_ot_nt'],
    passages: [
      '1 Kings 1-2',
      '1 Kings 3-4',
      '2 Chronicles 1',
      '1 Kings 5-8',
      '2 Chronicles 2-7',
      '1 Kings 9-11',
      '2 Chronicles 8-9',
      'Song of Solomon 1-8',
      'Proverbs 1-31',
      'Ecclesiastes 1-12',
      'Psalms 72',
      'Psalms 127',
    ],
  },
  {
    title: 'Divided Kingdom and Early Prophets',
    period: 'divided_kingdom_early',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      note(
        'kings-chronicles-parallel-history',
        'Why Kings and Chronicles are intertwined',
        'Kings and Chronicles overlap heavily from the divided kingdom onward, but they do not emphasize the same things. Kings keeps Israel and Judah together in one political narrative; Chronicles focuses on Judah, the temple, and Davidic continuity. The plan alternates the parallel blocks so the shared reigns stay close together instead of making Chronicles feel like a long rewind.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      '1 Kings 12-14',
      '2 Chronicles 10-12',
      '1 Kings 15-16',
      '2 Chronicles 13-16',
      '1 Kings 17-19',
      '1 Kings 20-22',
      '2 Chronicles 17-20',
      '2 Kings 1-8',
      '2 Chronicles 21-22',
      note(
        'obadiah-traditional-placement',
        'Why Obadiah is here',
        'Obadiah does not give a dated royal heading, so this is a tentative traditional placement rather than a hard chronological claim. The plan is not aligning Obadiah by a later fulfillment event; it is following older chronological arrangements that place the book among the early divided-kingdom prophets while marking the date as uncertain.',
        ['townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Obadiah 1',
      note(
        'joel-traditional-placement',
        'Why Joel is here',
        'Joel also lacks a dated royal heading, and interpreters have placed it in more than one period. This plan keeps Joel in the early-prophet block because that is how the public-domain chronological guides used here arrange it, but the note is intentionally explicit: this is traditional and tentative, not a claim that Joel must have been written at this exact point.',
        ['townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Joel 1-3',
      '2 Kings 9-11',
      '2 Chronicles 23',
      '2 Kings 12-13',
      '2 Chronicles 24',
      note(
        'jonah-jeroboam-ii',
        'Why Jonah appears during Israel\'s monarchy',
        'Jonah is not placed here only because of its canonical location among the Twelve. 2 Kings 14:25 names Jonah son of Amittai during the reign of Jeroboam II, so the plan places Jonah near that northern-kingdom setting and follows the same broad alignment used in older chronological arrangements.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Jonah 1-4',
      note(
        'amos-hosea-eighth-century',
        'Why Amos and Hosea follow Jonah',
        'Amos 1:1 names Uzziah of Judah and Jeroboam II of Israel, and Hosea 1:1 stretches from Uzziah through Hezekiah while also naming Jeroboam. That puts both prophets in the same eighth-century northern-kingdom crisis that Kings and Chronicles are narrating here.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Amos 1-9',
      'Hosea 1-14',
    ],
  },
  {
    title: 'Assyrian Crisis and Judah in Decline',
    period: 'divided_kingdom_late',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      '2 Kings 14',
      '2 Chronicles 25',
      '2 Kings 15',
      '2 Chronicles 26-27',
      note(
        'isaiah-uzziah-transition',
        'Why Isaiah begins here',
        'Isaiah 1:1 places Isaiah\'s ministry during the reigns of Uzziah, Jotham, Ahaz, and Hezekiah, and Isaiah 6:1 specifically locates Isaiah\'s temple vision in the year Uzziah died. The first Isaiah block is therefore read near the Uzziah/Jotham-era material rather than as one undifferentiated prophetic book.',
        ['biblical_superscriptions', 'merrill_kings_prophets']
      ),
      'Isaiah 1-6',
      '2 Kings 16',
      '2 Chronicles 28',
      note(
        'isaiah-ahaz-crisis',
        'Why Isaiah 7-12 follows Ahaz',
        'Isaiah 7:1 explicitly places the Syria-Ephraim crisis in the days of Ahaz. Chapters 7-12 are kept together as the surrounding Immanuel/Assyria material connected to that same crisis-era setting.',
        ['biblical_superscriptions', 'merrill_kings_prophets']
      ),
      'Isaiah 7-12',
      note(
        'micah-isaiah-overlap',
        'Why Micah follows Isaiah',
        'Micah 1:1 names Jotham, Ahaz, and Hezekiah, overlapping Isaiah\'s superscription. This places Micah in the same broad prophetic generation as Isaiah, so the plan keeps their early monarchy-era material together.',
        ['biblical_superscriptions', 'merrill_kings_prophets']
      ),
      'Micah 1-7',
      note(
        'isaiah-burdens-ahaz-sargon',
        'Why Isaiah 13-23 is here',
        'Isaiah 13-23 contains a collection of burdens against the nations. Some are undated, but Isaiah 14:28 anchors one oracle in the year Ahaz died, and Isaiah 20:1 anchors another in Sargon\'s Ashdod campaign, so this block is placed in the Ahaz-to-Assyria crisis period while acknowledging that not every chapter has its own date stamp.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Isaiah 13-23',
      '2 Kings 17',
      '2 Kings 18',
      '2 Chronicles 29-31',
      '2 Kings 19-20',
      '2 Chronicles 32',
      note(
        'isaiah-hezekiah-assyrian-crisis',
        'Why Isaiah 24-39 follows Hezekiah',
        'Isaiah 36:1 ties the Sennacherib narrative to Hezekiah\'s fourteenth year, and Isaiah 38-39 stay in Hezekiah\'s reign. Isaiah 24-35 are less directly dated but fit the surrounding Assyrian-crisis material, so they are grouped immediately before the explicitly Hezekiah-era narrative.',
        ['biblical_superscriptions', 'merrill_kings_prophets']
      ),
      'Isaiah 24-39',
      note(
        'isaiah-comfort-prophecy',
        'Why Isaiah 40-66 stays with Isaiah',
        'Isaiah 40-66 looks ahead to exile, comfort, restoration, and return, but this plan aligns prophetic books primarily by the prophet\'s ministry or writing setting rather than by the later events being prophesied. So these chapters stay with Isaiah\'s Uzziah-through-Hezekiah-era ministry, with this note marking the later horizon they point toward.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Isaiah 40-66',
    ],
  },
  {
    title: 'Late Judah Prophets, Fall of Jerusalem, and Exilic Psalms',
    period: 'judah_fall_exile',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      '2 Kings 21',
      '2 Chronicles 33',
      note(
        'josiah-prophetic-cluster',
        'Why so many prophets cluster around Josiah',
        'Josiah\'s reign sits at a strange pressure point: Judah has one last serious covenant reform after the book of the law is found, Assyria is collapsing, Babylon is rising, and Jerusalem is still heading toward judgment. Zephaniah explicitly names Josiah, Jeremiah begins in Josiah\'s thirteenth year, Nahum fits the still-living Nineveh crisis, and Habakkuk looks toward the Chaldeans. So this cluster is not just a random pile-up of prophets; it is a real historical hinge where reform, warning, empire-collapse, and coming exile all meet.',
        ['biblical_superscriptions', 'josiah_reform_context', 'nahum_nineveh_context', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      note(
        'nahum-zephaniah-late-judah-setting',
        'Why Nahum and Zephaniah are here',
        'Zephaniah 1:1 explicitly places his ministry in Josiah\'s reign. Nahum is not dated by a king, but Nineveh is still the living object of the oracle, so the plan places Nahum in the late Assyrian period before Nineveh\'s fall. This is a writing-setting placement, not a jump forward to the fulfillment of the prophecy.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Nahum 1-3',
      'Zephaniah 1-3',
      note(
        'jeremiah-fall-of-jerusalem',
        'Why Jeremiah begins before Jerusalem falls',
        'Jeremiah 1:1-3 dates his ministry from Josiah\'s thirteenth year through the fall of Jerusalem. Jeremiah is not arranged like a simple diary, so the plan begins him in Josiah\'s reign and then keeps most of the book in larger era bands instead of trying to reshuffle every dated chapter into a perfect timeline.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Jeremiah 1-20',
      '2 Kings 22',
      '2 Chronicles 34',
      '2 Kings 23',
      '2 Chronicles 35',
      note(
        'jeremiah-era-band-compromise',
        'Why Jeremiah is not sorted chapter by chapter',
        'Some Jeremiah chapters have very specific dates, but the book also collects sermons, narratives, restoration promises, and oracles in a non-linear shape. A strictly sorted Jeremiah would bounce back and forth so much that it becomes harder to read. This plan makes a tradeoff: it respects the clearest Josiah, Jehoiakim, Zedekiah, and fall-of-Jerusalem anchors, but keeps the middle of Jeremiah in broad late-monarchy bands.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Jeremiah 21-24',
      'Jeremiah 25-26',
      'Jeremiah 27-29',
      'Jeremiah 30-36',
      note(
        'habakkuk-babylonian-rise-setting',
        'Why Habakkuk is here',
        'Habakkuk is not dated by a royal heading, but Habakkuk 1:6 speaks of the Chaldeans being raised up, which fits late Judah as Babylon is rising. The plan places Habakkuk by that likely writing setting before Jerusalem\'s fall, not by the later completion of the judgment it announces.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Habakkuk 1-3',
      '2 Kings 24',
      note(
        'daniel-early-babylonian-exile',
        'Why Daniel begins here',
        'Daniel 1 opens in the third year of Jehoiakim and Daniel 2 is set in Nebuchadnezzar\'s second year. Those early Babylonian-court chapters belong with Judah\'s first Babylonian crisis rather than with the later Persian-era Daniel visions.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Daniel 1-2',
      note(
        'jeremiah-zedekiah-siege-anchors',
        'Why these Jeremiah chapters follow the first exile',
        'Jeremiah 37-38 sit in the last Zedekiah-era siege narrative, after Judah has already entered the Babylonian crisis but before Jerusalem finally falls. They are kept here as the clearest final-siege block before the fall is narrated in Kings, Chronicles, and Jeremiah itself.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Jeremiah 37-38',
      note(
        'jeremiah-appendix-oracles',
        'Why Jeremiah 45-51 stays together here',
        'Jeremiah 45-51 is a Baruch-and-nations appendix near the end of the book. Some pieces point backward to Jehoiakim, and Jeremiah 51:59 links the Babylon scroll to Zedekiah\'s fourth year. Rather than scatter those chapters in several directions, the plan keeps the appendix together before Jerusalem falls and notes that its internal dates reach back across the late monarchy.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Jeremiah 45-51',
      '2 Kings 25',
      '2 Chronicles 36',
      'Jeremiah 39-44',
      'Jeremiah 52',
      'Lamentations 1-5',
      note(
        'exilic-psalm-laments',
        'Why these Psalms follow Jerusalem\'s fall',
        'These Psalms are not all dated by a royal heading, but their contents fit the shock of exile, ruined sanctuary, threatened covenant, or Babylon more directly than a generic Davidic placement would. Psalm 137 is the clearest Babylon Psalm; Psalms 74, 79, 89, and 102 are kept nearby as destruction-and-restoration laments.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 74',
      'Psalms 79',
      'Psalms 85',
      'Psalms 89',
      'Psalms 102',
      'Psalms 137',
    ],
  },
  {
    title: 'Exile and Return',
    period: 'exile_return',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'merrill_kings_prophets'],
    passages: [
      note(
        'ezekiel-dated-exile-visions',
        'Why Ezekiel is split into dated exile blocks',
        'Ezekiel gives repeated year, month, and day markers from Jehoiachin\'s captivity. The plan keeps Ezekiel mostly in canonical order but splits the major blocks where the book itself gives clear chronological markers, including the siege date in Ezekiel 24 and the restoration vision in Ezekiel 40.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Ezekiel 1-7',
      'Ezekiel 8-19',
      'Ezekiel 20-24',
      'Ezekiel 29-30',
      'Ezekiel 25-28',
      'Ezekiel 31-32',
      'Ezekiel 33-39',
      'Ezekiel 40-48',
      note(
        'daniel-later-reign-markers',
        'Why Daniel is not read straight through',
        'Daniel 7-8 are dated to Belshazzar before the fall of Babylon in Daniel 5, while Daniel 9 is dated to Darius and Daniel 10-12 to Cyrus. The plan therefore reads Daniel\'s later chapters by their internal reign markers instead of simple chapter order.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Daniel 3-4',
      'Daniel 7-8',
      'Daniel 5-6',
      'Daniel 9',
      'Daniel 10-12',
      'Ezra 1-6',
      note(
        'haggai-zechariah-temple-rebuild',
        'Why Haggai and Zechariah interrupt Ezra',
        'Ezra 5:1 names Haggai and Zechariah as prophets who encouraged the returned exiles during the temple rebuilding, and both prophetic books are dated to the reign of Darius. So the plan pauses Ezra after the first return and reads those prophets at the temple-rebuilding moment.',
        ['biblical_superscriptions', 'townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Haggai 1-2',
      'Zechariah 1-14',
      'Esther 1-10',
      'Ezra 7-10',
      'Nehemiah 1-13',
      note(
        'return-and-pilgrimage-psalms',
        'Why these Psalms follow the return',
        'Several Psalms in this group look like restored-community, pilgrimage, or temple-worship songs rather than dated monarchy episodes. Psalm 126 explicitly celebrates restored fortunes, and many Songs of Ascents fit pilgrimage worship. The plan places them after Ezra and Nehemiah as return-era worship, while still treating the exact composition dates as uncertain.',
        ['biblical_superscriptions', 'townsend_ot_nt']
      ),
      'Psalms 107',
      'Psalms 120-121',
      'Psalms 123',
      'Psalms 125-126',
      'Psalms 128-130',
      'Psalms 132',
      'Psalms 134',
      'Psalms 146-150',
      note(
        'malachi-post-exilic-close',
        'Why Malachi closes the Old Testament',
        'Malachi is not dated by a named king, but its temple, priesthood, and covenant concerns fit the restored post-exilic community. Older chronological plans commonly place it after Ezra and Nehemiah as one of the final prophetic words before the New Testament gap, so this plan lets Malachi close the Old Testament readings.',
        ['townsend_ot_nt', 'merrill_kings_prophets']
      ),
      'Malachi 1-4',
    ],
  },
  {
    title: 'Life and Ministry of Jesus',
    period: 'gospels',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'robinson_gospel_harmony'],
    passages: [
      'Luke 1-2',
      'Matthew 1-2',
      'Mark 1',
      'Matthew 3-4',
      'Luke 3-4',
      'John 1-4',
      'Matthew 5-7',
      'Luke 5-6',
      'Mark 2-3',
      'Matthew 8-10',
      'Luke 7-9',
      'Mark 4-6',
      'Matthew 11-13',
      'John 5-6',
      'Mark 7-9',
      'Matthew 14-18',
      'Luke 10-13',
      'John 7-10',
      'Luke 14-18',
      'Mark 10',
      'Matthew 19-20',
      'John 11-12',
      'Mark 11-13',
      'Matthew 21-25',
      'Luke 19-21',
      'Matthew 26-28',
      'Mark 14-16',
      'Luke 22-24',
      'John 13-21',
    ],
  },
  {
    title: 'Acts, Epistles, and Revelation',
    period: 'apostolic_church',
    confidence: 'medium',
    sources: ['townsend_ot_nt', 'conybeare_howson_paul'],
    passages: [
      'Acts 1-8',
      note(
        'james-early-church',
        'Why James is placed early in Acts',
        'James does not give a travel itinerary like some Pauline letters, so this is a traditional early-church placement rather than a precise timestamp. It is read after the first Jerusalem-centered chapters of Acts because older chronological arrangements often treat it as an early letter to dispersed Jewish Christians.',
        ['townsend_ot_nt']
      ),
      'James 1-5',
      'Acts 9-12',
      note(
        'galatians-acts-mission',
        'Why Galatians is near Paul\'s early missions',
        'Galatians is one of the less-settled Pauline placements, but this plan follows the early/South-Galatian style of arrangement represented in older Acts-and-epistles chronologies. That is why it appears near Acts 13-15 rather than much later in Paul\'s ministry.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      'Galatians 1-6',
      'Acts 13-15',
      'Acts 16-18',
      note(
        'thessalonians-corinth',
        'Why the Thessalonian letters follow Acts 16-18',
        'Acts 16-18 narrates Paul\'s Macedonian mission, Thessalonica, Athens, and Corinth. Conybeare and Howson place 1 and 2 Thessalonians in this missionary period, so the plan reads them after that part of Acts.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      '1 Thessalonians 1-5',
      '2 Thessalonians 1-3',
      'Acts 19',
      note(
        'corinthians-romans-acts-19-20',
        'Why Corinthians and Romans are here',
        'Acts 19-20 gives the Ephesus, Macedonia, and Greece setting for this part of Paul\'s work. Older Pauline chronologies place 1 Corinthians near the Ephesian ministry, then 2 Corinthians and Romans as Paul moves through Macedonia and Greece before the Jerusalem journey.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      '1 Corinthians 1-16',
      'Acts 20',
      '2 Corinthians 1-13',
      'Romans 1-16',
      'Acts 21-28',
      note(
        'prison-epistles-after-acts',
        'Why the prison letters follow Acts 28',
        'Acts ends with Paul under Roman custody. Ephesians, Philippians, Colossians, and Philemon are traditionally grouped as captivity or prison letters, so this plan reads them after Acts reaches Paul\'s imprisonment.',
        ['conybeare_howson_paul', 'townsend_ot_nt']
      ),
      'Ephesians 1-6',
      'Philippians 1-4',
      'Colossians 1-4',
      'Philemon 1',
      note(
        'late-epistles-and-revelation',
        'Why these letters close the New Testament',
        'After Acts, the chronology becomes less directly narrated. This closing block follows public-domain chronological arrangements for the later pastoral and general epistles, then ends with Revelation as the final apocalyptic book of the canon.',
        ['townsend_ot_nt', 'conybeare_howson_paul']
      ),
      '1 Timothy 1-6',
      'Titus 1-3',
      '1 Peter 1-5',
      'Hebrews 1-13',
      '2 Timothy 1-4',
      '2 Peter 1-3',
      'Jude 1',
      '1 John 1-5',
      '2 John 1',
      '3 John 1',
      'Revelation 1-22',
    ],
  },
]

const chapterByBook = new Map(bibleBooks.map(book => [book.name, book.chapters]))
const bookOrder = new Map(bibleBooks.map((book, index) => [book.name, index + 1]))

function bookToSlug(bookName) {
  return String(bookName || '').toLowerCase().replace(/\s+/g, '-')
}

function loadWebChapterMetrics() {
  const metrics = new Map()
  const root = path.join(process.cwd(), 'public/data/translations/WEB')

  for (const book of bibleBooks) {
    const filePath = path.join(root, `${bookToSlug(book.name)}.json`)
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    for (const chapter of data.chapters || []) {
      const text = (chapter.verses || []).map(verse => verse.text || '').join(' ')
      const words = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g) || []
      metrics.set(`${book.name} ${chapter.number}`, {
        wordCount: words.length,
        characterCount: text.replace(/\s+/g, ' ').trim().length,
      })
    }
  }

  return metrics
}

function parseChapterReference(reference) {
  const match = String(reference || '').trim().match(/^(.+?)\s+(\d+)(?:-(\d+))?$/)
  if (!match) throw new Error(`Unsupported chapter reference: ${reference}`)

  const book = match[1]
  const start = Number(match[2])
  const end = Number(match[3] || match[2])
  const maxChapter = chapterByBook.get(book)

  if (!maxChapter) throw new Error(`Unknown book in reference: ${reference}`)
  if (start < 1 || end > maxChapter || start > end) {
    throw new Error(`Chapter range outside ${book}: ${reference}`)
  }

  return { book, start, end }
}

function expandChronology(chapterMetrics) {
  const items = []
  const seen = new Map()

  chronologicalSections.forEach((section, sectionIndex) => {
    section.passages.forEach(entry => {
      if (entry?.type === 'note') {
        items.push({
          ...entry,
          section: section.title,
          period: section.period,
          confidence: section.confidence,
          wordCount: 0,
          characterCount: 0,
          sequence: items.length + 1,
          sectionIndex,
        })
        return
      }

      const reference = entry
      const parsed = parseChapterReference(reference)
      for (let chapter = parsed.start; chapter <= parsed.end; chapter += 1) {
        const key = `${parsed.book} ${chapter}`
        const previous = seen.get(key)
        if (previous) {
          throw new Error(`Duplicate chapter ${key}: ${previous} and ${section.title}`)
        }

        seen.set(key, section.title)
        items.push({
          type: 'chapter',
          book: parsed.book,
          chapter,
          reference: key,
          canonicalOrder: bookOrder.get(parsed.book),
          section: section.title,
          period: section.period,
          confidence: section.confidence,
          sources: section.sources,
          wordCount: chapterMetrics.get(key)?.wordCount || 0,
          characterCount: chapterMetrics.get(key)?.characterCount || 0,
          sequence: items.length + 1,
          sectionIndex,
        })
      }
    })
  })

  const missing = []
  for (const book of bibleBooks) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      const key = `${book.name} ${chapter}`
      if (!seen.has(key) && !readingRhythmPsalmKeys.has(key)) missing.push(key)
    }
  }

  if (missing.length) {
    throw new Error(`Missing chapters: ${missing.join(', ')}`)
  }

  const chapterCount = items.filter(item => item.type === 'chapter').length
  const expectedChapterCount = 1189 - readingRhythmPsalmKeys.size
  if (chapterCount !== expectedChapterCount) {
    throw new Error(`Expected ${expectedChapterCount} base chapters, found ${chapterCount}`)
  }

  return items
}

function monthLabel(day) {
  const months = [
    ['January', 31],
    ['February', 28],
    ['March', 31],
    ['April', 30],
    ['May', 31],
    ['June', 30],
    ['July', 31],
    ['August', 31],
    ['September', 30],
    ['October', 31],
    ['November', 30],
    ['December', 31],
  ]

  let cursor = day
  for (const [label, length] of months) {
    if (cursor <= length) return label
    cursor -= length
  }
  return 'December'
}

function toPassages(dayChapters) {
  const segments = []
  for (const item of dayChapters.filter(row => row.type === 'chapter')) {
    const last = segments[segments.length - 1]
    if (!last || last.book !== item.book || item.chapter !== last.end + 1) {
      segments.push({ book: item.book, start: item.chapter, end: item.chapter })
    } else {
      last.end = item.chapter
    }
  }

  return segments.map(segment => {
    if (segment.start === segment.end) return `${segment.book} ${segment.start}`
    return `${segment.book} ${segment.start}-${segment.end}`
  })
}

function toReadingItems(dayItems) {
  const items = []
  let pendingChapters = []

  const flushChapters = () => {
    if (!pendingChapters.length) return
    toPassages(pendingChapters).forEach(passage => {
      items.push({ type: 'passage', passage })
    })
    pendingChapters = []
  }

  for (const item of dayItems) {
    if (item.type === 'note') {
      flushChapters()
      items.push({
        type: 'note',
        id: item.id,
        title: item.title,
        text: item.text,
        sources: item.sources || [],
        sourceLabels: (item.sources || []).map(source => sourceTitleById.get(source) || source),
        sourceLinks: (item.sources || []).map(source => sourceLinkById.get(source)).filter(Boolean),
      })
      continue
    }
    pendingChapters.push(item)
  }

  flushChapters()
  return items
}

function toNoteReadingItem(noteItem) {
  return {
    type: 'note',
    id: noteItem.id,
    title: noteItem.title,
    text: noteItem.text,
    sources: noteItem.sources || [],
    sourceLabels: (noteItem.sources || []).map(source => sourceTitleById.get(source) || source),
    sourceLinks: (noteItem.sources || []).map(source => sourceLinkById.get(source)).filter(Boolean),
  }
}

function readingHasPsalm(reading) {
  return reading.passages.some(passage => passage.startsWith('Psalms '))
}

function readingMatchesSprinkleTarget(reading, target) {
  const chapterRefs = reading.passages.flatMap(passage => {
    if (passage.startsWith('Psalms ')) return []
    const parsed = parseChapterReference(passage)
    const chapters = []
    for (let chapter = parsed.start; chapter <= parsed.end; chapter += 1) {
      chapters.push({ book: parsed.book, chapter })
    }
    return chapters
  })

  if (target === 'covenant_law') {
    return chapterRefs.some(ref => ref.book === 'Leviticus' || ref.book === 'Numbers')
  }

  if (target === 'deuteronomy') {
    return chapterRefs.some(ref => ref.book === 'Deuteronomy')
  }

  if (target === 'chronicles_genealogies') {
    return chapterRefs.some(ref => ref.book === '1 Chronicles' && ref.chapter <= 9)
  }

  return false
}

function appendReadingRhythmPsalms(readings, chapterMetrics) {
  const usedDays = new Set()

  for (const group of readingRhythmPsalmSprinkles) {
    const candidates = readings
      .filter(reading => readingMatchesSprinkleTarget(reading, group.target))
      .filter(reading => !readingHasPsalm(reading))

    if (candidates.length < group.psalms.length) {
      throw new Error(`Not enough candidate days for ${group.id}: ${candidates.length} for ${group.psalms.length} Psalms`)
    }

    const availableCandidates = candidates
      .filter(reading => !usedDays.has(reading.day))
      .sort((a, b) => a.wordCount - b.wordCount || a.day - b.day)

    if (availableCandidates.length < group.psalms.length) {
      throw new Error(`Not enough unused candidate days for ${group.id}: ${availableCandidates.length} for ${group.psalms.length} Psalms`)
    }

    const selectedCandidates = availableCandidates
      .slice(0, group.psalms.length)

    const assignments = group.psalms
      .map(psalm => {
        const reference = `Psalms ${psalm}`
        const metrics = chapterMetrics.get(reference)
        if (!metrics) throw new Error(`Missing metrics for ${reference}`)
        return { psalm, reference, metrics }
      })
      .sort((a, b) => b.metrics.wordCount - a.metrics.wordCount)
      .map((psalmInfo, index) => {
        const reading = selectedCandidates[index]
        usedDays.add(reading.day)
        return { ...psalmInfo, reading }
      })
      .sort((a, b) => a.reading.day - b.reading.day)

    assignments.forEach((assignment, index) => {
      const { reading, reference, metrics } = assignment

      if (index === 0) {
        reading.items.push(toNoteReadingItem(group.note))
        reading.sources = [...new Set([...reading.sources, ...(group.note.sources || [])])]
      }

      reading.items.push({ type: 'passage', passage: reference })
      reading.passages.push(reference)
      reading.sections = [...new Set([...reading.sections, 'Reading Rhythm Psalms'])]
      reading.periods = [...new Set([...reading.periods, 'reading_rhythm_psalms'])]
      reading.sources = [...new Set([...reading.sources, 'biblical_superscriptions', 'townsend_ot_nt'])]
      reading.wordCount += metrics.wordCount
      reading.characterCount += metrics.characterCount
    })
  }
}

function findCharacterPartition(chapters, average, tolerance) {
  const lower = average * (1 - tolerance)
  const upper = average * (1 + tolerance)
  const nextByDay = Array.from({ length: totalDays + 2 }, () => new Map())
  const chapterCountsFrom = Array.from({ length: chapters.length + 1 }, () => 0)
  for (let index = chapters.length - 1; index >= 0; index -= 1) {
    chapterCountsFrom[index] = chapterCountsFrom[index + 1] + (chapters[index].type === 'chapter' ? 1 : 0)
  }
  nextByDay[totalDays + 1].set(chapters.length, chapters.length)

  for (let day = totalDays; day >= 1; day -= 1) {
    const daysLeftAfterToday = totalDays - day

    for (let start = chapters.length - 1; start >= 0; start -= 1) {
      if (chapterCountsFrom[start] < totalDays - day + 1) continue

      let characterCount = 0
      for (let end = start; end < chapters.length; end += 1) {
        characterCount += chapters[end].characterCount

        const nextStart = end + 1
        if (chapterCountsFrom[nextStart] < daysLeftAfterToday) break
        if (characterCount > upper) break
        if (characterCount < lower) continue
        if (!nextByDay[day + 1].has(nextStart)) continue

        nextByDay[day].set(start, nextStart)
        break
      }
    }
  }

  if (!nextByDay[1].has(0)) return null

  const partition = []
  let cursor = 0
  for (let day = 1; day <= totalDays; day += 1) {
    const next = nextByDay[day].get(cursor)
    partition.push(chapters.slice(cursor, next))
    cursor = next
  }

  return {
    partition,
    lower,
    upper,
  }
}

function partitionChaptersByCharacters(chapters, totalCharacters) {
  const average = totalCharacters / totalDays
  const targetTolerance = 0.2

  for (let percentage = 20; percentage <= 50; percentage += 1) {
    const tolerance = percentage / 100
    const result = findCharacterPartition(chapters, average, tolerance)
    if (!result) continue

    return {
      partition: result.partition,
      characterBounds: {
        average: Math.round(average),
        lower: Math.ceil(result.lower),
        upper: Math.floor(result.upper),
        targetTolerance,
        actualTolerance: tolerance,
        targetMet: tolerance === targetTolerance,
      },
    }
  }

  throw new Error('Could not partition readings by character count within a 50% whole-chapter tolerance')
}

function generateReadings(chapters, totalCharacters) {
  const { partition, characterBounds } = partitionChaptersByCharacters(chapters, totalCharacters)
  const readings = []

  partition.forEach((dayChapters, index) => {
    const day = index + 1
    const chapterItems = dayChapters.filter(item => item.type === 'chapter')
    const dayWords = chapterItems.reduce((sum, item) => sum + item.wordCount, 0)
    const dayCharacters = chapterItems.reduce((sum, item) => sum + item.characterCount, 0)
    const sections = [...new Set(chapterItems.map(item => item.section))]
    const periods = [...new Set(chapterItems.map(item => item.period))]
    const sources = [...new Set(dayChapters.flatMap(item => item.sources || []))]
    const confidence = chapterItems.some(item => item.confidence === 'low')
      ? 'low'
      : chapterItems.some(item => item.confidence === 'medium')
        ? 'medium'
        : 'high'
    const orderedItems = toReadingItems(dayChapters)

    readings.push({
      day,
      month: monthLabel(day),
      passages: orderedItems.filter(item => item.type === 'passage').map(item => item.passage),
      items: orderedItems,
      sections,
      periods,
      sources,
      confidence,
      wordCount: dayWords,
      characterCount: dayCharacters,
    })
  })

  return { readings, characterBounds }
}

function summarizeReadings(readings, field) {
  const counts = readings.map(reading => reading[field])
  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
    average: Math.round(counts.reduce((sum, value) => sum + value, 0) / readings.length),
  }
}

function summarizeCharacterBounds(readings, totalCharacters) {
  const average = totalCharacters / totalDays
  const counts = readings.map(reading => reading.characterCount)
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  const actualTolerance = Math.ceil(Math.max(
    Math.abs(average - min) / average,
    Math.abs(max - average) / average
  ) * 100) / 100
  const targetTolerance = 0.2

  return {
    average: Math.round(average),
    lower: Math.ceil(average * (1 - actualTolerance)),
    upper: Math.floor(average * (1 + actualTolerance)),
    targetTolerance,
    actualTolerance,
    targetMet: actualTolerance <= targetTolerance,
  }
}

function validateReadingChapterCoverage(readings) {
  const seen = new Map()

  readings.forEach(reading => {
    reading.passages.forEach(passage => {
      const parsed = parseChapterReference(passage)
      for (let chapter = parsed.start; chapter <= parsed.end; chapter += 1) {
        const key = `${parsed.book} ${chapter}`
        const previous = seen.get(key)
        if (previous) {
          throw new Error(`Duplicate chapter ${key}: day ${previous} and day ${reading.day}`)
        }
        seen.set(key, reading.day)
      }
    })
  })

  const missing = []
  for (const book of bibleBooks) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      const key = `${book.name} ${chapter}`
      if (!seen.has(key)) missing.push(key)
    }
  }

  if (missing.length) {
    throw new Error(`Missing chapters after reading generation: ${missing.join(', ')}`)
  }

  if (seen.size !== 1189) {
    throw new Error(`Expected 1189 final chapters, found ${seen.size}`)
  }

  return seen.size
}

const chapterMetrics = loadWebChapterMetrics()
const chronologyItems = expandChronology(chapterMetrics)
const chapterItems = chronologyItems.filter(item => item.type === 'chapter')
const baseCharacters = chapterItems.reduce((sum, chapter) => sum + chapter.characterCount, 0)
const { readings } = generateReadings(chronologyItems, baseCharacters)
appendReadingRhythmPsalms(readings, chapterMetrics)
const totalChapters = validateReadingChapterCoverage(readings)
const totalWords = readings.reduce((sum, reading) => sum + reading.wordCount, 0)
const totalCharacters = readings.reduce((sum, reading) => sum + reading.characterCount, 0)
const characterBounds = summarizeCharacterBounds(readings, totalCharacters)

const output = {
  id: 'chronological-bible',
  title: 'Chronological Bible in 365 Days',
  description: 'A full-Bible plan arranged by broad biblical chronology, with Psalms, Prophets, Gospels, Acts, and Epistles placed near their historical settings where possible. Undated Psalms are sprinkled into dense reading sections as reading-rhythm pauses, but the plan is not claiming they were written at those moments.',
  attribution: 'Original generated plan for Heritage Study Bible. Built from public-domain-era chronology sources and bundled WEB character counts; not copied from a modern 365-day schedule.',
  licenseNote: 'The plan data is an original reference compilation generated by this project. Bible translation text remains separately licensed by translation module.',
  generatorVersion,
  methodology: [
    'Build an ordered chapter sequence from independent chronology sections.',
    'Align historical narrative and retrospective books with the time period they describe, while noting when the placement is traditional rather than explicit.',
    'Align prophetic and other prospective books primarily by the prophet\'s ministry or likely writing setting, not by the later events being prophesied.',
    'When prophetic books give internal chapter-level date markers, split them at whole-chapter boundaries and keep undated adjacent material near the nearest anchored block.',
    'For long prophetic books whose internal order is mixed, prefer readable era bands over a brittle chapter-by-chapter reshuffle, and explain the compromise in a plan note.',
    'When a prophetic book lacks an explicit date, label the placement as inferred, tentative, or traditional instead of treating it like a fixed timestamp.',
    'Use plan notes to mark when a prophecy points forward to a later period or when a book-to-book connection is less obvious.',
    'Validate that every Protestant-canon Bible chapter appears exactly once.',
    'Keep event-titled Psalms near their named historical settings, place author- or guild-titled Psalms near the broad setting their headings suggest, and use clearly labeled undated Psalms as reading-rhythm pauses in dense sections without forcing false precision.',
    'Use bundled World English Bible character counts to balance daily readings; the generated metadata records whether the 20 percent target is feasible at whole-chapter granularity.',
    'Keep the app-facing plan at whole-chapter granularity because the current reader tracks plan progress by chapter.',
  ],
  sourceNotes,
  totalDays,
  totalChapters,
  totalWords,
  totalCharacters,
  characterBounds,
  characterCountSummary: summarizeReadings(readings, 'characterCount'),
  wordCountSummary: summarizeReadings(readings, 'wordCount'),
  readings,
}

const outPath = path.join(process.cwd(), 'public/data/reading-plans/chronological-bible.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)

console.log(`Wrote ${outPath}`)
console.log(`Days: ${output.totalDays}, chapters: ${output.totalChapters}, characters: ${output.totalCharacters}`)
console.log(`Daily characters: ${output.characterCountSummary.min}-${output.characterCountSummary.max}, active bounds ${output.characterBounds.lower}-${output.characterBounds.upper}`)
console.log(`Character tolerance target met: ${output.characterBounds.targetMet}`)
console.log(`Sample day 1: ${output.readings[0].passages.join(', ')}`)
console.log(`Sample day 365: ${output.readings[364].passages.join(', ')}`)
