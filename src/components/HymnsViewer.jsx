import { useNavigate } from 'react-router-dom'

export const HYMNS = [
  {
    id: 'before-the-throne',
    title: 'Before the Throne of God Above',
    author: 'Charitie Lees Bancroft',
    year: 1863,
    stanzas: [
      `Before the throne of God above
I have a strong and perfect plea:
A great High Priest whose name is Love,
Who ever lives and pleads for me.
My name is graven on His hands,
My name is written on His heart;
I know that while in Heaven He stands,
No tongue can bid me thence depart.`,
      `When Satan tempts me to despair,
And tells me of the guilt within,
Upward I look and see Him there
Who made an end of all my sin.
Because the sinless Savior died,
My sinful soul is counted free;
For God the Just is satisfied
To look on Him and pardon me.`,
      `Behold Him there, the risen Lamb,
My perfect spotless Righteousness,
The great unchangeable I AM,
The King of glory and of grace!
One with Himself I cannot die;
My soul is purchased by His blood;
My life is hid with Christ on high,
With Christ my Savior and my God.`,
    ],
  },
  {
    id: 'it-is-well',
    title: 'It Is Well with My Soul',
    author: 'Horatio G. Spafford',
    year: 1873,
    stanzas: [
      `When peace like a river attendeth my way,
When sorrows like sea billows roll;
Whatever my lot, Thou hast taught me to say,
It is well, it is well with my soul.`,
      `Though Satan should buffet, though trials should come,
Let this blest assurance control,
That Christ hath regarded my helpless estate,
And hath shed His own blood for my soul.`,
      `My sin, O the bliss of this glorious thought!
My sin, not in part but the whole,
Is nailed to the cross, and I bear it no more,
Praise the Lord, praise the Lord, O my soul!`,
      `And Lord, haste the day when my faith shall be sight,
The clouds be rolled back as a scroll;
The trump shall resound, and the Lord shall descend,
Even so, it is well with my soul.`,
    ],
  },
  {
    id: 'come-thou-fount',
    title: 'Come Thou Fount of Every Blessing',
    author: 'Robert Robinson',
    year: 1758,
    stanzas: [
      `Come, Thou Fount of every blessing,
Tune my heart to sing Thy grace;
Streams of mercy, never ceasing,
Call for songs of loudest praise.
Teach me some melodious sonnet,
Sung by flaming tongues above.
Praise the mount! I’m fixed upon it,
Mount of Thy redeeming love.`,
      `Here I raise mine Ebenezer;
Hither by Thy help I’m come;
And I hope, by Thy good pleasure,
Safely to arrive at home.
Jesus sought me when a stranger,
Wandering from the fold of God;
He, to rescue me from danger,
Interposed His precious blood.`,
      `O to grace how great a debtor
Daily I’m constrained to be!
Let Thy goodness, like a fetter,
Bind my wandering heart to Thee.
Prone to wander, Lord, I feel it,
Prone to leave the God I love;
Here’s my heart, O take and seal it,
Seal it for Thy courts above.`,
    ],
  },
]

function HymnsViewer({ toolMeta }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/resources/tools')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <span className="text-lg">{'\u2190'}</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold heading-text truncate">
            {toolMeta?.title || 'Hymns'}
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-6 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Public-domain hymn texts for reading.
        </p>

        {HYMNS.map((hymn) => (
          <section
            key={hymn.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4 sm:p-5"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 heading-text">
              {hymn.title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {hymn.author} · {hymn.year}
            </p>

            <div className="mt-4 space-y-4">
              {hymn.stanzas.map((stanza, index) => (
                <div key={`${hymn.id}-stanza-${index}`}>
                  <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Verse {index + 1}</p>
                  <p className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
                    {stanza}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

export default HymnsViewer
