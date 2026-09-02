import type { JSONContent } from '@tiptap/core'

export type TypstSubsetParseResult = {
  preamble: string
  doc: JSONContent
  unsupportedCount: number
  warnings: string[]
}

export type TextModeCompatibility = {
  ok: boolean
  recommendCodeMode: boolean
  unsupportedCount: number
  message: string
}

const HEADING_RE = /^(={1,6})\s+(.*)$/
const BULLET_RE = /^-\s+(.*)$/
const NUMBERED_RE = /^(?:\+\s+|\d+\.\s+)(.*)$/
const PREAMBLE_RE = /^\s*#/
const HR_RE = /^-{3,}$/
const BLOCK_MATH_RE = /^\$\s*(.*?)\s*\$$/
const LINK_RE = /#link\("([^"]+)"\)\[([^\]]*)\]/g

/** Escape Typst special characters in plain text runs. */
export function escapeTypstText(text: string): string {
  return text.replace(/([\\#*_`$<>\[\]@])/g, '\\$1')
}

function textNode(text: string, marks?: JSONContent['marks']): JSONContent {
  return marks?.length ? { type: 'text', text, marks } : { type: 'text', text }
}

/** Parse inline Typst subset into TipTap text nodes. */
export function parseInlineTypst(input: string): JSONContent[] {
  const nodes: JSONContent[] = []
  let i = 0

  const pushText = (value: string, marks?: JSONContent['marks']) => {
    if (!value) return
    nodes.push(textNode(value, marks))
  }

  while (i < input.length) {
    // #link("url")[label]
    if (input.startsWith('#link("', i)) {
      const rest = input.slice(i)
      const match = rest.match(/^#link\("([^"]+)"\)\[([^\]]*)\]/)
      if (match) {
        pushText(match[2] || match[1], [
          { type: 'link', attrs: { href: match[1] } },
        ])
        i += match[0].length
        continue
      }
    }

    const ch = input[i]

    if (ch === '\\' && i + 1 < input.length) {
      pushText(input[i + 1])
      i += 2
      continue
    }

    if (ch === '*' || ch === '_') {
      const closer = input.indexOf(ch, i + 1)
      if (closer > i + 1) {
        const inner = input.slice(i + 1, closer)
        // Nested parse for simple cases without nested same delimiter
        if (!inner.includes(ch)) {
          pushText(inner, [{ type: ch === '*' ? 'bold' : 'italic' }])
          i = closer + 1
          continue
        }
      }
    }

    if (ch === '`') {
      const closer = input.indexOf('`', i + 1)
      if (closer > i) {
        const inner = input.slice(i + 1, closer)
        pushText(inner, [{ type: 'code' }])
        i = closer + 1
        continue
      }
    }

    if (ch === '$') {
      const closer = input.indexOf('$', i + 1)
      if (closer > i) {
        const inner = input.slice(i + 1, closer).trim()
        pushText(inner ? `$${inner}$` : '$$', [{ type: 'code' }])
        i = closer + 1
        continue
      }
    }

    let j = i + 1
    while (j < input.length && !'*_`$\\'.includes(input[j]) && !input.startsWith('#link("', j)) {
      j += 1
    }
    pushText(input.slice(i, j))
    i = j
  }

  return nodes.length ? nodes : [textNode('')]
}

function serializeInline(nodes: JSONContent[] | undefined): string {
  if (!nodes?.length) return ''

  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '\\\n'
      if (node.type !== 'text') return ''

      let text = node.text ?? ''
      const marks = node.marks ?? []
      const markTypes = marks.map((m) => m.type)
      const link = marks.find((m) => m.type === 'link')

      if (markTypes.includes('code')) {
        if (text.startsWith('$') && text.endsWith('$')) return text
        return `\`${text.replace(/`/g, '')}\``
      }

      if (link?.attrs?.href) {
        const href = String(link.attrs.href)
        const label = escapeTypstText(text)
        return `#link("${href}")[${label}]`
      }

      text = escapeTypstText(text)
      if (markTypes.includes('bold')) text = `*${text}*`
      if (markTypes.includes('italic')) text = `_${text}_`
      return text
    })
    .join('')
}

function rawCodeBlock(content: string): JSONContent {
  return {
    type: 'codeBlock',
    attrs: { language: 'typst' },
    content: content ? [textNode(content)] : [],
  }
}

function splitPreamble(source: string): { preamble: string; body: string } {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '' || PREAMBLE_RE.test(line)) {
      i += 1
      continue
    }
    break
  }
  const preambleLines = lines.slice(0, i)
  while (preambleLines.length && preambleLines[preambleLines.length - 1].trim() === '') {
    preambleLines.pop()
  }
  const body = lines.slice(i).join('\n').replace(/^\n+/, '')
  return {
    preamble: preambleLines.join('\n'),
    body,
  }
}

/**
 * Convert Typst source into a TipTap document for the supported subset.
 * Unsupported blocks become typst code blocks so they are not lost.
 */
export function typstToTiptap(source: string): TypstSubsetParseResult {
  const warnings: string[] = []
  const { preamble, body } = splitPreamble(source)
  const content: JSONContent[] = []
  let unsupportedCount = 0

  if (!body.trim()) {
    return {
      preamble,
      doc: {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
      unsupportedCount: 0,
      warnings,
    }
  }

  const lines = body.split('\n')
  let i = 0

  const flushParagraph = (buffer: string[]) => {
    const text = buffer.join(' ').trim()
    if (!text) return
    content.push({
      type: 'paragraph',
      content: parseInlineTypst(text),
    })
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (HR_RE.test(trimmed)) {
      content.push({ type: 'horizontalRule' })
      i += 1
      continue
    }

    const blockMath = trimmed.match(BLOCK_MATH_RE)
    if (blockMath && trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.length > 2) {
      content.push({
        type: 'paragraph',
        content: [textNode(`$${blockMath[1].trim()}$`, [{ type: 'code' }])],
      })
      i += 1
      continue
    }

    const heading = trimmed.match(HEADING_RE)
    if (heading) {
      const level = Math.min(heading[1].length, 3)
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineTypst(heading[2]),
      })
      i += 1
      continue
    }

    if (BULLET_RE.test(trimmed)) {
      const items: JSONContent[] = []
      while (i < lines.length && BULLET_RE.test(lines[i].trim())) {
        const match = lines[i].trim().match(BULLET_RE)!
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: parseInlineTypst(match[1]),
            },
          ],
        })
        i += 1
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }

    if (NUMBERED_RE.test(trimmed)) {
      const items: JSONContent[] = []
      while (i < lines.length && NUMBERED_RE.test(lines[i].trim())) {
        const match = lines[i].trim().match(NUMBERED_RE)!
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: parseInlineTypst(match[1]),
            },
          ],
        })
        i += 1
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }

    if (PREAMBLE_RE.test(trimmed) || trimmed.startsWith('```')) {
      // Prefer mapping simple #link-only lines into paragraphs
      LINK_RE.lastIndex = 0
      if (/^#link\("[^"]+"\)\[[^\]]*\]$/.test(trimmed)) {
        content.push({
          type: 'paragraph',
          content: parseInlineTypst(trimmed),
        })
        i += 1
        continue
      }

      const rawLines: string[] = []
      while (i < lines.length) {
        const current = lines[i]
        if (!rawLines.length) {
          rawLines.push(current)
          i += 1
          continue
        }
        if (current.trim() === '') break
        if (PREAMBLE_RE.test(current) || /^\s/.test(current)) {
          rawLines.push(current)
          i += 1
          continue
        }
        break
      }
      unsupportedCount += 1
      content.push(rawCodeBlock(rawLines.join('\n')))
      continue
    }

    const buffer: string[] = []
    while (i < lines.length) {
      const current = lines[i]
      const t = current.trim()
      if (!t) break
      if (
        HEADING_RE.test(t) ||
        BULLET_RE.test(t) ||
        NUMBERED_RE.test(t) ||
        PREAMBLE_RE.test(t) ||
        HR_RE.test(t)
      ) {
        break
      }
      buffer.push(t)
      i += 1
    }
    flushParagraph(buffer)
  }

  if (unsupportedCount > 0) {
    warnings.push(
      `${unsupportedCount} advanced Typst block${unsupportedCount === 1 ? '' : 's'} kept as raw code`
    )
  }

  return {
    preamble,
    doc: {
      type: 'doc',
      content: content.length ? content : [{ type: 'paragraph' }],
    },
    unsupportedCount,
    warnings,
  }
}

function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6)
      return `${'='.repeat(level)} ${serializeInline(node.content)}`
    }
    case 'paragraph':
      return serializeInline(node.content)
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => {
          const para = item.content?.[0]
          return `- ${serializeInline(para?.content)}`
        })
        .join('\n')
    case 'orderedList':
      return (node.content ?? [])
        .map((item) => {
          const para = item.content?.[0]
          return `+ ${serializeInline(para?.content)}`
        })
        .join('\n')
    case 'codeBlock': {
      const text = (node.content ?? []).map((n) => n.text ?? '').join('')
      return text
    }
    case 'horizontalRule':
      return '#line(length: 100%)'
    case 'blockquote': {
      const inner = (node.content ?? [])
        .map(serializeBlock)
        .filter(Boolean)
        .join('\n')
      return inner
        .split('\n')
        .map((line) => `#quote[${line}]`)
        .join('\n')
    }
    default:
      return serializeInline(node.content)
  }
}

/** Serialize TipTap document (+ preamble) back to Typst source. */
export function tiptapToTypst(preamble: string, doc: JSONContent): string {
  const blocks = (doc.content ?? [])
    .map(serializeBlock)
    .map((block) => block.trimEnd())
    .filter((block, index, arr) => block.length > 0 || (index > 0 && arr[index - 1].length > 0))

  const body = blocks.join('\n\n').trim()
  const head = preamble.trim()

  if (head && body) return `${head}\n\n${body}\n`
  if (head) return `${head}\n`
  return body ? `${body}\n` : '\n'
}

/** True when source is mostly within the Word-like subset (few raw blocks). */
export function isMostlySubsetCompatible(source: string): boolean {
  return assessTextModeCompatibility(source).ok
}

/** Decide whether Text mode is a good fit for this source. */
export function assessTextModeCompatibility(source: string): TextModeCompatibility {
  const result = typstToTiptap(source)
  const bodyLines = source.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim())
  const threshold = Math.max(2, Math.floor(bodyLines.length / 5))
  const recommendCodeMode = result.unsupportedCount >= threshold && result.unsupportedCount >= 2
  const ok = result.unsupportedCount <= threshold

  let message = 'Document fits Text mode.'
  if (result.unsupportedCount === 0) {
    message = 'Document fits the Word-like subset.'
  } else if (recommendCodeMode) {
    message = `This document has ${result.unsupportedCount} advanced Typst blocks. Typst mode is recommended.`
  } else {
    message = `${result.unsupportedCount} advanced block${result.unsupportedCount === 1 ? '' : 's'} will appear as raw Typst code.`
  }

  return {
    ok,
    recommendCodeMode,
    unsupportedCount: result.unsupportedCount,
    message,
  }
}
