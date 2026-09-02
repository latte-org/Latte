export const TYPST_KEYWORDS = [
  'set',
  'let',
  'show',
  'if',
  'else',
  'for',
  'while',
  'return',
  'import',
  'include',
  'as',
  'in',
  'not',
  'and',
  'or',
  'break',
  'continue',
  'context',
] as const

export const TYPST_CONSTANTS = ['true', 'false', 'none', 'auto'] as const

export const TYPST_BUILTIN_FUNCTIONS = [
  'text',
  'box',
  'block',
  'page',
  'pagebreak',
  'par',
  'parbreak',
  'heading',
  'list',
  'enum',
  'table',
  'grid',
  'figure',
  'image',
  'link',
  'cite',
  'bibliography',
  'footnote',
  'ref',
  'label',
  'outline',
  'align',
  'place',
  'move',
  'scale',
  'rotate',
  'pad',
  'stack',
  'colbreak',
  'columns',
  'hline',
  'vline',
  'rect',
  'square',
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'raw',
  'eval',
  'repr',
  'type',
  'assert',
  'panic',
  'str',
  'int',
  'float',
  'len',
  'range',
  'luma',
  'rgb',
  'cmyk',
  'oklab',
  'oklch',
  'color',
  'gradient',
  'pattern',
  'stroke',
  'fill',
  'calc',
  'math',
  'sym',
  'emoji',
] as const

export const TYPST_UNITS = ['pt', 'mm', 'cm', 'in', 'em', 'fr', 'deg', 'rad', '%'] as const

export type TypstTokenType =
  | 'comment'
  | 'heading'
  | 'keyword'
  | 'function'
  | 'constant'
  | 'number'
  | 'string'
  | 'escape'
  | 'hash'
  | 'math'
  | 'strong'
  | 'emphasis'
  | 'link'
  | 'label'
  | 'operator'
  | 'punctuation'

export type TypstToken = {
  from: number
  to: number
  type: TypstTokenType
}

const KEYWORD_SET = new Set<string>(TYPST_KEYWORDS)
const CONSTANT_SET = new Set<string>(TYPST_CONSTANTS)
const BUILTIN_SET = new Set<string>(TYPST_BUILTIN_FUNCTIONS)
const UNIT_RE = /^(pt|mm|cm|in|em|fr|deg|rad|%)/

const push = (tokens: TypstToken[], from: number, to: number, type: TypstTokenType) => {
  if (to > from) tokens.push({ from, to, type })
}

const isWordStart = (ch: string) => /[A-Za-z_]/.test(ch)
const isWordChar = (ch: string) => /[\w-]/.test(ch)
const atLineStart = (source: string, i: number) => i === 0 || source[i - 1] === '\n'

export function tokenizeTypst(source: string): TypstToken[] {
  const tokens: TypstToken[] = []
  const n = source.length
  let i = 0

  while (i < n) {
    const ch = source[i]

    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') {
      i += 1
      continue
    }

    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i)
      push(tokens, i, end === -1 ? n : end, 'comment')
      i = end === -1 ? n : end
      continue
    }

    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2)
      const to = end === -1 ? n : end + 2
      push(tokens, i, to, 'comment')
      i = to
      continue
    }

    if (atLineStart(source, i) && ch === '=') {
      let j = i
      while (source[j] === '=') j += 1
      if (j > i && (source[j] === ' ' || source[j] === '\t' || source[j] === '\n' || j === n)) {
        const end = source.indexOf('\n', i)
        push(tokens, i, end === -1 ? n : end, 'heading')
        i = end === -1 ? n : end
        continue
      }
    }

    if (ch === '$') {
      const close = source.indexOf('$', i + 1)
      const to = close === -1 ? n : close + 1
      push(tokens, i, to, 'math')
      i = to
      continue
    }

    if (ch === '"') {
      let j = i + 1
      while (j < n && source[j] !== '"') {
        if (source[j] === '\\') j += 2
        else j += 1
      }
      push(tokens, i, Math.min(j + 1, n), 'string')
      i = Math.min(j + 1, n)
      continue
    }

    if (source.startsWith('https://', i) || source.startsWith('http://', i)) {
      let j = i
      while (j < n && !/[\s\]\)>"]/.test(source[j])) j += 1
      push(tokens, i, j, 'link')
      i = j
      continue
    }

    if (ch === '<' && isWordStart(source[i + 1] ?? '')) {
      const end = source.indexOf('>', i + 1)
      const newline = source.indexOf('\n', i)
      if (end !== -1 && (newline === -1 || end < newline)) {
        push(tokens, i, end + 1, 'label')
        i = end + 1
        continue
      }
    }

    if (ch === '`') {
      let ticks = 0
      while (source[i + ticks] === '`') ticks += 1
      const close = source.indexOf('`'.repeat(ticks), i + ticks)
      const to = close === -1 ? n : close + ticks
      push(tokens, i, to, 'string')
      i = to
      continue
    }

    if (ch === '#' ) {
      push(tokens, i, i + 1, 'hash')
      i += 1
      continue
    }

    if (ch === '*' && source[i + 1] && source[i + 1] !== ' ' && source[i + 1] !== '\n') {
      const end = source.indexOf('*', i + 1)
      const newline = source.indexOf('\n', i)
      if (end > i + 1 && (newline === -1 || end < newline)) {
        push(tokens, i, end + 1, 'strong')
        i = end + 1
        continue
      }
    }

    if (ch === '_' && source[i + 1] && source[i + 1] !== ' ' && source[i + 1] !== '\n') {
      const end = source.indexOf('_', i + 1)
      const newline = source.indexOf('\n', i)
      if (end > i + 1 && (newline === -1 || end < newline)) {
        push(tokens, i, end + 1, 'emphasis')
        i = end + 1
        continue
      }
    }

    if (isWordStart(ch)) {
      let j = i + 1
      while (j < n && isWordChar(source[j])) j += 1
      const word = source.slice(i, j)
      if (KEYWORD_SET.has(word)) push(tokens, i, j, 'keyword')
      else if (CONSTANT_SET.has(word)) push(tokens, i, j, 'constant')
      else if (BUILTIN_SET.has(word)) push(tokens, i, j, 'function')
      i = j
      continue
    }

    if (/\d/.test(ch)) {
      let j = i
      while (j < n && /[\d.]/.test(source[j])) j += 1
      const unit = source.slice(j).match(UNIT_RE)
      if (unit) j += unit[0].length
      push(tokens, i, j, 'number')
      i = j
      continue
    }

    if ('\\'.includes(ch) && i + 1 < n) {
      let j = i + 1
      if (isWordStart(source[j])) {
        j += 1
        while (j < n && isWordChar(source[j])) j += 1
      } else {
        j += 1
      }
      push(tokens, i, j, 'escape')
      i = j
      continue
    }

    if ('=+-*/<>!&|.?:'.includes(ch)) {
      let j = i + 1
      while (j < n && '=+-*/<>!&|.?:'.includes(source[j])) j += 1
      push(tokens, i, j, 'operator')
      i = j
      continue
    }

    if ('{}[](),;'.includes(ch)) {
      push(tokens, i, i + 1, 'punctuation')
      i += 1
      continue
    }

    i += 1
  }

  return tokens
}
