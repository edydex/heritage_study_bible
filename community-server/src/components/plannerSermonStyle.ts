type Span = { start: number; end: number; foreground?: string; weight?: string }

// Only style text, never alter or look up the quoted Scripture.
export function sermonTextSpans(text: string): Span[] {
  const spans: Span[] = []
  let offset = 0
  for (const line of text.split('\n')) {
    const reference = line.match(/^\s*(?:[1-4]\s*)?[\p{L}][\p{L}\p{M}.'’ʼ -]{0,48}?\.?\s*\d{1,3}:\d{1,3}(?:\s*[-–—,;]\s*\d{1,3})*/u)
    if (reference) spans.push({ start: offset, end: offset + reference[0].length, foreground: '#ffc000', weight: '700' })
    else if (/^\s*[IVX]+\.\s/u.test(line)) spans.push({ start: offset, end: offset + line.length, weight: '700' })
    offset += line.length + 1
  }
  return spans
}
