import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

// Simple markdown parser for basic formatting
function parseMarkdown(text) {
  if (!text) return ''
  
  // Split into lines
  const lines = text.split('\n')
  const elements = []
  let currentParagraph = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Headers: # **Title (timestamp)**
    const headerMatch = line.match(/^#\s+\*\*(.+?)\s*\((\d{2}:\d{2}:\d{2})\)\*\*/)
    if (headerMatch) {
      // Flush current paragraph
      if (currentParagraph.length > 0) {
        elements.push({ type: 'paragraph', content: currentParagraph.join(' ') })
        currentParagraph = []
      }
      elements.push({ 
        type: 'header', 
        title: headerMatch[1], 
        timestamp: headerMatch[2],
        id: headerMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-')
      })
      continue
    }
    
    // Empty line = end of paragraph
    if (line.trim() === '') {
      if (currentParagraph.length > 0) {
        elements.push({ type: 'paragraph', content: currentParagraph.join(' ') })
        currentParagraph = []
      }
      continue
    }
    
    // Regular text
    currentParagraph.push(line.trim())
  }
  
  // Flush remaining paragraph
  if (currentParagraph.length > 0) {
    elements.push({ type: 'paragraph', content: currentParagraph.join(' ') })
  }
  
  return elements
}

// Format timestamp to seconds for YouTube link
function timestampToSeconds(timestamp) {
  const parts = timestamp.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return parts[0] * 60 + parts[1]
}

const transcriptMetadata = {
  'ortlund-revelation': {
    title: 'Explaining Every Chapter of Revelation',
    author: 'Gavin Ortlund',
    videoUrl: 'https://www.youtube.com/watch?v=_mXO5Ymb9NE',
    file: '/transcripts/ortlund-revelation.md'
  }
}

export default function TranscriptViewer() {
  const { transcriptId } = useParams()
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  
  const metadata = transcriptMetadata[transcriptId]
  
  useEffect(() => {
    if (!metadata) {
      setError('Transcript not found')
      setLoading(false)
      return
    }
    
    fetch(metadata.file)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load transcript')
        return res.text()
      })
      .then(text => {
        setContent(parseMarkdown(text))
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [transcriptId, metadata])
  
  // Track scroll position for active section highlighting
  useEffect(() => {
    if (!content) return
    
    const handleScroll = () => {
      const headers = document.querySelectorAll('[data-section-id]')
      let current = null
      
      headers.forEach(header => {
        const rect = header.getBoundingClientRect()
        if (rect.top <= 100) {
          current = header.dataset.sectionId
        }
      })
      
      setActiveSection(current)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [content])
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading transcript...</p>
        </div>
      </div>
    )
  }
  
  if (error || !metadata) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">📄</p>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Transcript Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'This transcript does not exist.'}</p>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Heritage Study Bible
          </Link>
        </div>
      </div>
    )
  }
  
  // Extract table of contents from headers
  const toc = content.filter(el => el.type === 'header')
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-primary text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="text-white/80 hover:text-white transition-colors flex items-center gap-2"
            >
              ← Back
            </Link>
            <div className="h-6 w-px bg-white/30"></div>
            <div>
              <h1 className="font-serif text-lg">{metadata.title}</h1>
              <p className="text-sm text-white/80">by {metadata.author}</p>
            </div>
          </div>
          <a
            href={metadata.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
          >
            <span>🎬</span> Watch Video
          </a>
        </div>
      </header>
      
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        {/* Table of Contents - Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-4 text-sm uppercase tracking-wide">Contents</h2>
            <nav className="space-y-1">
              {toc.map((section, idx) => (
                <a
                  key={idx}
                  href={`#${section.id}`}
                  className={`block text-sm py-1.5 px-2 rounded transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary/10 text-primary dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <article className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8">
            {content.map((element, idx) => {
              if (element.type === 'header') {
                const videoLink = `${metadata.videoUrl}&t=${timestampToSeconds(element.timestamp)}s`
                return (
                  <h2 
                    key={idx}
                    id={element.id}
                    data-section-id={element.id}
                    className="text-2xl font-serif font-bold text-primary dark:text-blue-400 mt-10 mb-4 first:mt-0 scroll-mt-24 flex items-center gap-3 flex-wrap"
                  >
                    {element.title}
                    <a
                      href={videoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-normal text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
                      title="Jump to this section in the video"
                    >
                      <span>⏱️</span>
                      <span>{element.timestamp}</span>
                    </a>
                  </h2>
                )
              }
              
              if (element.type === 'paragraph') {
                return (
                  <p key={idx} className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                    {element.content}
                  </p>
                )
              }
              
              return null
            })}
          </article>
          
          {/* Footer */}
          <footer className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            <p>
              This transcript is from "{metadata.title}" by {metadata.author}.
            </p>
            <p className="mt-2">
              <a 
                href={metadata.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Watch the original video →
              </a>
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
