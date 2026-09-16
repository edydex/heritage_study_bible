export type SongbookLanguage = 'en' | 'ru'
export type SongbookEntry = { id: string; slug: string; title: string; russianTitle: string; alternateTitles: string[]; authors: string[]; previewSections?: { language: string; label: string; lines: string[] }[] }

export function songbookLanguage(value: unknown): SongbookLanguage { return value === 'ru' ? 'ru' : 'en' }
export function songbookTitle(song: SongbookEntry, language: SongbookLanguage) {
  return language === 'ru' ? (song.russianTitle || (/^[^A-Za-z]*[А-Яа-яЁё]/u.test(song.title) ? song.title : ''))
    : (/[A-Za-z]/u.test(song.title) ? song.title : '')
}
function searchText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/ё/g, 'е').replace(/[’‘]/g, "'").trim()
}
export function groupSongbook(songs: SongbookEntry[], language: SongbookLanguage, query: string) {
  const terms = searchText(query).split(/\s+/).filter(Boolean)
  const collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true })
  const visible = songs.map(song => ({ ...song, displayTitle: songbookTitle(song, language) }))
    .filter(song => song.displayTitle && terms.every(term => searchText([song.title, song.russianTitle, ...song.alternateTitles, ...song.authors].join(' ')).includes(term)))
    .sort((a, b) => collator.compare(a.displayTitle, b.displayTitle) || a.id.localeCompare(b.id))
  const groups: { letter: string; songs: typeof visible }[] = []
  for (const song of visible) {
    const letter = song.displayTitle.match(/[A-Za-zА-Яа-яЁё]/u)?.[0].toLocaleUpperCase(language) || '#'
    const group = groups.find(item => item.letter === letter)
    if (group) group.songs.push(song)
    else groups.push({ letter, songs: [song] })
  }
  return groups
}
