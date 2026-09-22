import { useEffect, useMemo, useRef, useState } from 'react'
import './community-book-readalong.css'
import { useHeritageAudio } from './audio/AudioProvider'

function wordAt(words, time) {
  let low = 0,
    high = words.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (words[mid].start <= time) low = mid + 1
    else high = mid
  }
  return low - 1
}
export default function CommunityBookReadAlong({
  document,
  contentUrl,
  requestOptions,
}) {
  const heritageAudio = useHeritageAudio()
  const book = document.readAlong,
    key = `heritage-community-book-progress:${contentUrl}`
  const initial = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')
    } catch {
      return {}
    }
  }, [key])
  const [chapterId, setChapterId] = useState(
    initial.chapterId || book.chapters[0].id,
  )
  const chapter =
    book.chapters.find((ch) => ch.id === chapterId) || book.chapters[0]
  const [loadedChapter, setLoadedChapter] = useState(''),
    [source, setSource] = useState(''),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [playing, setPlaying] = useState(false),
    [active, setActive] = useState(-1),
    [follow, setFollow] = useState(true),
    [controls, setControls] = useState(false)
  const dialog = useRef(null)
  useEffect(() => {
    if (!controls) return
    const previous = window.document.activeElement
    const root = dialog.current
    root?.querySelector('button')?.focus()
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setControls(false)
      }
      if (event.key === 'Tab') {
        const items = Array.from(
          root?.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select',
          ) || [],
        )
        const first = items[0],
          last = items.at(-1)
        if (event.shiftKey && window.document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && window.document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('keydown', keydown)
      previous?.focus?.()
    }
  }, [controls])
  const player = useRef(null),
    textRoot = useRef(null),
    resume = useRef(initial.position || 0),
    hold = useRef(null),
    held = useRef(false),
    autoPlay = useRef(false)
  const firstByParagraph = useMemo(
    () =>
      new Map(
        chapter.words
          .slice()
          .reverse()
          .map((w) => [w.paragraphId, w.start]),
      ),
    [chapter],
  )
  useEffect(() => {
    let cancelled = false,
      url = ''
    const abort = new AbortController()
    setLoadedChapter('')
    setSource('')
    setActive(-1)
    setPlaying(false)
    setError('')
    setLoading(true)
    const target = new URL(
      `/api/community/books/${document.id}/audio/${chapter.id}`,
      contentUrl,
    )
    const headers = {}
    if (
      requestOptions.authorization &&
      target.origin === requestOptions.authorizationOrigin
    )
      headers.Authorization = requestOptions.authorization
    fetch(target, {
      headers,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: abort.signal,
      referrerPolicy: 'no-referrer',
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'Audio is unavailable. Check your church sign-in and connection.',
          )
        const bytes = await response.arrayBuffer()
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          (b) => b.toString(16).padStart(2, '0'),
        ).join('')
        if (
          digest !== chapter.audioSha256 ||
          bytes.byteLength !== chapter.audioSize
        )
          throw new Error(
            'The audio does not match this book’s timestamps. Please retry.',
          )
        if (!cancelled) {
          url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
          setLoadedChapter(chapter.id)
          setSource(url)
        }
      })
      .catch((error) => {
        if (!cancelled) setError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      abort.abort()
      if (url) URL.revokeObjectURL(url)
      clearTimeout(hold.current)
    }
  }, [
    chapter,
    contentUrl,
    document.id,
    requestOptions.authorization,
    requestOptions.authorizationOrigin,
  ])
  useEffect(() => {
    const audio = player.current
    if (!audio || !source || loadedChapter !== chapter.id) return
    let frame,
      lastSave = 0
    const update = () => {
      setActive(wordAt(chapter.words, audio.currentTime))
      if (performance.now() - lastSave > 1000) {
        save()
        lastSave = performance.now()
      }
      frame = requestAnimationFrame(update)
    }
    const save = () => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            chapterId: chapter.id,
            position: audio.currentTime,
          }),
        )
      } catch {}
    }
    const pause = () => {
      setPlaying(false)
      save()
    }
    audio.addEventListener('pause', pause)
    audio.addEventListener('seeked', save)
    frame = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(frame)
      save()
      audio.removeEventListener('pause', pause)
      audio.removeEventListener('seeked', save)
      audio.pause()
    }
  }, [source, loadedChapter, chapter, key])
  const word = chapter.words[active]
  useEffect(() => {
    if (follow && playing && word) {
      const paragraph = Array.from(textRoot.current?.children || []).find(
        (node) => node.dataset.paragraph === word.paragraphId,
      )
      if (paragraph) {
        const r = paragraph.getBoundingClientRect()
        if (r.top < 80 || r.bottom > window.innerHeight - 130)
          paragraph.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }, [word?.paragraphId, follow, playing])
  async function toggle() {
    const audio = player.current
    if (!audio || !source) return
    if (audio.paused) {
      try {
        await heritageAudio?.player.pause()
        await audio.play()
      } catch {
        setError('Tap Play again to start audio.')
      }
    } else audio.pause()
  }
  function seek(delta) {
    if (player.current)
      player.current.currentTime = Math.max(
        0,
        Math.min(chapter.duration, player.current.currentTime + delta),
      )
  }
  function choose(id) {
    resume.current = 0
    autoPlay.current = Boolean(player.current && !player.current.paused)
    setChapterId(id)
  }
  return (
    <section className="community-book-reader">
      <label>
        Chapter
        <select
          aria-label="Chapter"
          value={chapter.id}
          onChange={(event) => choose(event.target.value)}
        >
          {book.chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.title}
            </option>
          ))}
        </select>
      </label>
      {book.synthetic && (
        <p className="text-sm">
          Synthetic narration · {book.voice} · {book.license}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <audio
        key={chapter.id}
        ref={player}
        src={loadedChapter === chapter.id ? source || undefined : undefined}
        preload="auto"
        onLoadedMetadata={() => {
          player.current.currentTime = Math.min(
            resume.current,
            chapter.duration,
          )
          resume.current = 0
          if (autoPlay.current) {
            autoPlay.current = false
            player.current.play().catch(() => {})
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          const index = book.chapters.indexOf(chapter)
          if (index < book.chapters.length - 1) {
            autoPlay.current = true
            resume.current = 0
            setChapterId(book.chapters[index + 1].id)
          }
        }}
      />
      <div
        ref={textRoot}
        className="community-book-reader__text"
        lang={book.language}
      >
        {chapter.paragraphs.map((p) => {
          const w = word?.paragraphId === p.id ? word : null,
            Tag = p.kind === 'heading' ? 'h2' : 'p'
          return (
            <Tag
              key={p.id}
              data-paragraph={p.id}
              onClick={() => {
                const start = firstByParagraph.get(p.id)
                if (player.current && start != null)
                  player.current.currentTime = start
              }}
            >
              {w ? (
                <>
                  {p.text.slice(0, w.sourceStart)}
                  <mark>{p.text.slice(w.sourceStart, w.sourceEnd)}</mark>
                  {p.text.slice(w.sourceEnd)}
                </>
              ) : (
                p.text
              )}
            </Tag>
          )
        })}
      </div>
      {playing && (
        <button
          className="community-book-reader__rewind"
          aria-label="Back 10 seconds"
          onClick={() => seek(-10)}
        >
          −10
        </button>
      )}
      <div className="community-book-reader__dock">
        <button
          disabled={!source || loadedChapter !== chapter.id}
          aria-label={playing ? 'Pause book audio' : 'Play book audio'}
          title="Hold for player controls"
          onPointerDown={() => {
            held.current = false
            hold.current = setTimeout(() => {
              held.current = true
              setControls(true)
            }, 500)
          }}
          onPointerUp={() => clearTimeout(hold.current)}
          onPointerCancel={() => clearTimeout(hold.current)}
          onPointerLeave={() => clearTimeout(hold.current)}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            if (!held.current) toggle()
            held.current = false
          }}
        >
          {loading ? 'Loading…' : playing ? '❚❚' : '▶'}
        </button>
        <span>{chapter.title}</span>
        <button
          aria-label="Open player controls"
          onClick={() => setControls(true)}
        >
          ⋯
        </button>
      </div>
      {controls && (
        <div
          className="community-book-reader__backdrop"
          onClick={() => setControls(false)}
        >
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Book audio player"
            className="community-book-reader__player"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setControls(false)}
              aria-label="Close player"
            >
              Close
            </button>
            <h2>{chapter.title}</h2>
            <button onClick={() => seek(-10)}>−10 seconds</button>
            <button onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>
            <button onClick={() => seek(10)}>+10 seconds</button>
            <label>
              Position
              <input
                type="range"
                min="0"
                max={chapter.duration}
                step="0.1"
                value={player.current?.currentTime || 0}
                onChange={(event) => {
                  player.current.currentTime = Number(event.target.value)
                  setActive(wordAt(chapter.words, player.current.currentTime))
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={follow}
                onChange={(event) => setFollow(event.target.checked)}
              />
              Follow text
            </label>
          </section>
        </div>
      )}
    </section>
  )
}
export { wordAt }
