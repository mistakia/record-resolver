import { describe, expect, test } from 'bun:test'

import { format_entry, to_resolver_entry } from '../src/format.ts'
import type { ResolverEntry } from '../src/types.ts'
import { load_fixture } from './helpers.ts'

const SPEC_FIELDS = ['extractor', 'id', 'fulltitle', 'thumbnail', 'artist', 'alt_title', 'upload_date', 'webpage_url', 'duration']

function format_fixture (name: string) {
  return load_fixture(name).map(format_entry)
}

describe('format_entry against recorded yt-dlp output', () => {
  test('soundcloud track maps every field', () => {
    expect(format_fixture('soundcloud-track')).toEqual([{
      extractor: 'soundcloud',
      id: '21792171',
      url: 'https://media.invalid/soundcloud/21792171.mp3',
      fulltitle: 'WITH YOU, FRIENDS (LONG DRIVE)',
      thumbnail: 'https://i1.sndcdn.com/artworks-000008793437-pgni6l-original.jpg',
      artist: 'Skrillex',
      alt_title: 'WITH YOU, FRIENDS (LONG DRIVE)',
      upload_date: '20110824',
      webpage_url: 'https://soundcloud.com/skrillex/with-you-friends-long-drive',
      duration: 389.07,
      ext: 'mp3',
      http_headers: { 'User-Agent': 'record-resolver-fixture', Accept: '*/*' }
    }])
  })

  test('youtube video falls back to the uploader for artist and omits alt_title', () => {
    const [entry] = format_fixture('youtube-video')
    expect(entry).toMatchObject({
      extractor: 'youtube',
      id: 'iODdvJGpfIA',
      artist: 'jaleckmichdochfett',
      upload_date: '20081031',
      duration: 262,
      ext: 'm4a'
    })
    expect(entry).not.toHaveProperty('alt_title')
  })

  test('bandcamp lowercases the extractor and keeps unicode titles intact', () => {
    const [entry] = format_fixture('bandcamp-track')
    expect(entry?.extractor).toBe('bandcamp')
    expect(entry?.id).toBe('1812978515')
    expect(entry?.alt_title).toBe('youtube-dl "\'/\\ä↭ - youtube-dl test song "\'/\\ä↭')
  })

  test('mixcloud trims a trailing space from artist', () => {
    const [entry] = format_fixture('mixcloud-show')
    expect(entry?.extractor).toBe('mixcloud')
    expect(entry?.artist).toBe('Freeform Five feat. feat. R, Omid 16B, Miyagi, Gardens Of God, BLAMMA! BLAMMA! FEAT. KRISTINA TRAIN')
  })

  test('every recorded entry has a unique (extractor, id) and a url', () => {
    const entries = ['youtube-video', 'soundcloud-track', 'bandcamp-track', 'mixcloud-show', 'bandcamp-album'].flatMap(format_fixture)
    expect(entries).toHaveLength(26)
    for (const entry of entries) {
      expect(entry).toBeDefined()
      expect(entry?.url).toStartWith('https://')
    }
    const keys = new Set(entries.map((entry) => `${entry?.extractor}\0${entry?.id}`))
    expect(keys.size).toBe(entries.length)
  })
})

describe('format_entry field rules', () => {
  const base = { extractor: 'youtube', id: 'abc', url: 'https://media.invalid/a.m4a' }

  test('omits absent, null and empty optional fields rather than setting undefined', () => {
    const entry = format_entry({ ...base, title: null, thumbnail: '', artist: '   ', duration: null })
    expect(entry).toEqual(base)
    expect(Object.keys(entry ?? {}).sort()).toEqual(['extractor', 'id', 'url'])
  })

  test('falls back from extractor to extractor_key, lowercased', () => {
    expect(format_entry({ extractor_key: 'Bandcamp', id: '1', url: base.url })?.extractor).toBe('bandcamp')
    expect(format_entry({ extractor: 'SoundCloud', extractor_key: 'Other', id: '1', url: base.url })?.extractor).toBe('soundcloud')
  })

  test('coerces a numeric id to a string', () => {
    expect(format_entry({ ...base, id: 12345 })?.id).toBe('12345')
  })

  test('prefers fulltitle over title and alt_title over track', () => {
    expect(format_entry({ ...base, fulltitle: 'Full', title: 'Short', track: 'Track' })).toMatchObject({ fulltitle: 'Full', alt_title: 'Track' })
    expect(format_entry({ ...base, title: 'Short', alt_title: 'Alt', track: 'Track' })).toMatchObject({ fulltitle: 'Short', alt_title: 'Alt' })
  })

  test('derives artist from artist, then artists, then creator, then uploader', () => {
    expect(format_entry({ ...base, artists: ['A', 'B'], uploader: 'U' })?.artist).toBe('A, B')
    expect(format_entry({ ...base, creator: 'C', uploader: 'U' })?.artist).toBe('C')
    expect(format_entry({ ...base, uploader: 'U' })?.artist).toBe('U')
  })

  test('keeps only a finite non-negative numeric duration', () => {
    expect(format_entry({ ...base, duration: 0 })?.duration).toBe(0)
    expect(format_entry({ ...base, duration: '12' })).not.toHaveProperty('duration')
    expect(format_entry({ ...base, duration: -1 })).not.toHaveProperty('duration')
    expect(format_entry({ ...base, duration: Number.NaN })).not.toHaveProperty('duration')
  })

  test('keeps only string-valued http headers', () => {
    expect(format_entry({ ...base, http_headers: { A: 'x', B: 2 } })?.http_headers).toEqual({ A: 'x' })
  })

  test('rejects an entry missing extractor, id or url', () => {
    expect(format_entry({ id: 'abc', url: base.url })).toBeUndefined()
    expect(format_entry({ extractor: 'youtube', url: base.url })).toBeUndefined()
    expect(format_entry({ extractor: 'youtube', id: 'abc' })).toBeUndefined()
    expect(format_entry({ ...base, id: '' })).toBeUndefined()
  })

  test('rejects a non-object', () => {
    expect(format_entry(null)).toBeUndefined()
    expect(format_entry('x')).toBeUndefined()
    expect(format_entry([base])).toBeUndefined()
  })
})

describe('to_resolver_entry (spec §2.4.2 persistence)', () => {
  test('strips url, ext and http_headers and keeps every spec field', () => {
    const [resolved] = format_fixture('soundcloud-track')
    if (resolved === undefined) throw new Error('fixture did not format')
    const persisted = to_resolver_entry(resolved)
    expect(persisted).not.toHaveProperty('url')
    expect(persisted).not.toHaveProperty('ext')
    expect(persisted).not.toHaveProperty('http_headers')
    expect(persisted).toEqual({
      extractor: 'soundcloud',
      id: '21792171',
      fulltitle: 'WITH YOU, FRIENDS (LONG DRIVE)',
      thumbnail: 'https://i1.sndcdn.com/artworks-000008793437-pgni6l-original.jpg',
      artist: 'Skrillex',
      alt_title: 'WITH YOU, FRIENDS (LONG DRIVE)',
      upload_date: '20110824',
      webpage_url: 'https://soundcloud.com/skrillex/with-you-friends-long-drive',
      duration: 389.07
    })
  })

  test('drops keys outside the spec shape even when the input carries them', () => {
    const carrying_extra = { extractor: 'youtube', id: 'abc', url: 'https://x.invalid', formats: [], cookies: 'secret' } as unknown as ResolverEntry
    const persisted = to_resolver_entry(carrying_extra)
    expect(Object.keys(persisted).every((key) => SPEC_FIELDS.includes(key))).toBe(true)
    expect(persisted).toEqual({ extractor: 'youtube', id: 'abc' })
  })

  test('every recorded entry persists with spec keys only', () => {
    for (const resolved of format_fixture('bandcamp-album')) {
      if (resolved === undefined) throw new Error('fixture did not format')
      const keys = Object.keys(to_resolver_entry(resolved))
      expect(keys.every((key) => SPEC_FIELDS.includes(key))).toBe(true)
    }
  })
})
