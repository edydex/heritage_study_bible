export const ONLINE_BIBLES = [
  {
    id: 'LSB', name: 'Legacy Standard Bible', language: 'en', edition: '2021', online: true,
    sourceUrl: 'https://read.lsbible.org', publisherUrl: 'https://LSBible.org',
    copyright: 'Scripture quotations taken from the (LSB®) Legacy Standard Bible®, Copyright © 2021 by The Lockman Foundation. Used by permission. All rights reserved. Managed in partnership with Three Sixteen Publishing Inc.',
  },
  {
    id: 'NASB95', name: 'New American Standard Bible 1995', language: 'en', edition: '1995', online: true,
    sourceUrl: 'https://biblia.com/bible/nasb95', publisherUrl: 'https://www.Lockman.org',
    copyright: 'Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission. All rights reserved.',
  },
] as const

export const onlineBibleSource = (id: string) => ONLINE_BIBLES.find(source => source.id === id)
