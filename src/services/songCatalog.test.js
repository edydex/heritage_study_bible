import { describe, expect, it } from 'vitest'
import {
  collapseLanguageVariants,
  mergeSongCatalog,
  normalizeSongTitle,
  sectionsFromText,
} from './songCatalog.js'

const builtInSong = {
  id: 'before-the-throne',
  title: 'Before the Throne of God Above',
  russianTitle: 'На небесах Ходатай мой',
  description: 'Heritage text',
  stanzas: ['Before the throne'],
}

function remoteSong(serverId, serverName, id = '7', title = builtInSong.title) {
  return {
    id,
    title,
    sourceServerId: serverId,
    sourceServerName: serverName,
    remote: true,
    content: { url: `https://${serverId}.example/content/${id}`, mediaType: 'application/json' },
  }
}

function community(id, contentServerId, { primary = false, addedAt = '2026-01-01T00:00:00Z' } = {}) {
  return {
    manifest: { id, name: id },
    contentPreview: { manifest: { id: contentServerId } },
    primary,
    addedAt,
  }
}

describe('song catalog merging', () => {
  it('normalizes harmless title differences and known aliases', () => {
    expect(normalizeSongTitle('10,000 Reasons (Bless the Lord)')).toBe('10 000 reasons')
    expect(normalizeSongTitle('Oh Come, Oh Come, Emmanuel')).toBe('o come o come emmanuel')
    expect(normalizeSongTitle('Arise, My Soul, Arise')).toBe('o my soul arise')
    expect(normalizeSongTitle('Приди, приди, Эммануил')).toBe('приди приди эммануил')
  })

  it('can merge records through a shared Russian or alternate title', () => {
    const catalog = mergeSongCatalog({
      builtInSongs: [{
        ...builtInSong,
        title: 'O Come, O Come, Emmanuel',
        russianTitle: 'Приди, приди, Эммануил',
      }],
      remoteItems: [{
        ...remoteSong('russian-content', 'Russian Community', '12', 'Эммануил, приди'),
        russianTitle: 'Приди, приди, Эммануил',
      }],
    })

    expect(catalog).toHaveLength(1)
    expect(catalog[0].references).toHaveLength(2)
  })

  it('merges duplicate listings and keeps Heritage as the catalog presentation source', () => {
    const catalog = mergeSongCatalog({
      builtInSongs: [builtInSong],
      remoteItems: [remoteSong('wotbc-content', 'WOTBC')],
      communities: [community('wotbc', 'wotbc-content', { primary: true })],
    })

    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toMatchObject({
      id: 'before-the-throne',
      title: builtInSong.title,
      sourceCount: 2,
      sourceNames: ['Heritage', 'wotbc'],
    })
    expect(catalog[0].references.map(reference => reference.source.type)).toEqual([
      'heritage',
      'primary-community',
    ])
  })

  it('orders the primary community before secondary communities and preserves join order', () => {
    const communities = [
      community('later', 'later-content', { addedAt: '2026-02-01T00:00:00Z' }),
      community('main', 'main-content', { primary: true }),
      community('earlier', 'earlier-content', { addedAt: '2026-01-01T00:00:00Z' }),
    ]
    const catalog = mergeSongCatalog({
      builtInSongs: [],
      remoteItems: [
        remoteSong('later-content', 'Later', '1'),
        remoteSong('earlier-content', 'Earlier', '2'),
        remoteSong('main-content', 'Main', '3'),
      ],
      communities,
    })

    expect(catalog[0].references.map(reference => reference.source.id)).toEqual([
      'main-content',
      'earlier-content',
      'later-content',
    ])
  })

  it('collapses exact lyrics while retaining every source that supplied them', () => {
    const heritage = { id: 'heritage', name: 'Heritage', priority: 0 }
    const community = { id: 'main', name: 'Main Community', priority: 100 }
    const variants = collapseLanguageVariants([
      {
        sections: [{ label: 'Verse 1', lines: ['Same words', 'Second line'] }],
        source: community,
        rights: { label: 'Community record' },
      },
      {
        sections: [{ label: 'Stanza 1', lines: ['Same words,', 'second line!'] }],
        source: heritage,
        rights: { label: 'Heritage record' },
      },
    ])

    expect(variants).toHaveLength(1)
    expect(variants[0].preferredSource).toEqual(heritage)
    expect(variants[0].sources).toEqual([heritage, community])
    expect(variants[0].rights.label).toBe('Heritage record')
  })

  it('keeps materially different lyrics as selectable source versions', () => {
    const variants = collapseLanguageVariants([
      {
        sections: [{ label: 'Verse 1', lines: ['First wording'] }],
        source: { id: 'main', name: 'Main', priority: 100 },
        rights: {},
      },
      {
        sections: [{ label: 'Verse 1', lines: ['Different wording'] }],
        source: { id: 'second', name: 'Second', priority: 200 },
        rights: {},
      },
    ])

    expect(variants).toHaveLength(2)
    expect(variants.map(variant => variant.preferredSource.id)).toEqual(['main', 'second'])
  })

  it('recognizes English and Russian song section headings from Community text', () => {
    expect(sectionsFromText('VERSE 1\nFirst line\nSecond line\n\nCHORUS\nRefrain')).toEqual([
      { label: 'VERSE 1', lines: ['First line', 'Second line'] },
      { label: 'CHORUS', lines: ['Refrain'] },
    ])
    expect(sectionsFromText('КУПЛЕТ 1\nПервая строка\n\nПРИПЕВ\nСтрока припева')).toEqual([
      { label: 'КУПЛЕТ 1', lines: ['Первая строка'] },
      { label: 'ПРИПЕВ', lines: ['Строка припева'] },
    ])
  })
})
