import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { catalogInsertNeedsHash, expandTypstSnippet, getVariableInsertPlan } from '@/lib/typst-catalog'

export type EditorToolbarCommand =
  | 'heading1'
  | 'heading2'
  | 'bold'
  | 'italic'
  | 'link'
  | 'bulletList'
  | 'orderedList'
  | 'horizontalRule'
  | 'codeBlock'
  | 'figure'
  | 'table'
  | 'math'
  | 'variable'

export const TYPST_TOOLBAR_HINTS: Record<EditorToolbarCommand, string> = {
  heading1: '= Heading',
  heading2: '== Heading',
  bold: '*strong*',
  italic: '_emphasis_',
  link: '#link("url")[label]',
  bulletList: '- item',
  orderedList: '+ item',
  horizontalRule: '#line(length: 100%)',
  codeBlock: '`raw`',
  figure: '#figure(image("…"), caption: […])',
  table: '#table(columns: n, …)',
  math: 'inline $x$, block $ x $',
  variable: '#let name = value',
}

const BLOCK_PREFIX: Record<
  Extract<EditorToolbarCommand, 'heading1' | 'heading2' | 'bulletList' | 'orderedList'>,
  string
> = {
  heading1: '= ',
  heading2: '== ',
  bulletList: '- ',
  orderedList: '+ ',
}

const BLOCK_PREFIX_RE = /^(={1,6}\s+|-\s+|\+\s+|\d+\.\s+)/

export function typstImagePath(path: string) {
  return path.replace(/\\/g, '/').replace(/"/g, '\\"')
}

export function typstFigureSnippet(imagePath: string) {
  const posix = typstImagePath(imagePath)
  const stem = (posix.split('/').pop() ?? 'image').replace(/\.[^.]+$/, '')
  const label =
    stem.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^A-Za-z_]+/, '') || 'fig'
  const caption = stem.replace(/[-_]+/g, ' ').trim().replace(/[\\`]/g, '') || 'Caption'
  return `figure(
  image("${posix}", width: \${1:80%}),
  caption: [\${2:${caption}}],
) <\${3:${label}}>`
}

export function typstFigureSource(imagePath: string) {
  const posix = typstImagePath(imagePath)
  const stem = (posix.split('/').pop() ?? 'image').replace(/\.[^.]+$/, '')
  const label =
    stem.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^A-Za-z_]+/, '') || 'fig'
  const caption = stem.replace(/[-_]+/g, ' ').trim() || 'Caption'
  return `#figure(\n  image("${posix}", width: 80%),\n  caption: [${caption}],\n) <${label}>`
}

export function insertTypstFigure(editor: Editor, imagePath: string) {
  insertSnippet(editor, typstFigureSnippet(imagePath))
}

const TABLE_SNIPPET = `table(
  columns: \${1:3},
  table.header([\${2:A}], [\${3:B}], [\${4:C}]),
  [\${5:1}], [\${6:2}], [\${7:3}],
)`

function currentLineRange(editor: Editor) {
  const { $from } = editor.state.selection
  return { start: $from.start(), end: $from.end() }
}

export function sourceOffsetToPmPos(doc: PMNode, offset: number) {
  let remaining = Math.max(0, offset)
  let pos = 0
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i)
    const textLen = child.textContent.length
    pos += 1
    if (remaining <= textLen) {
      return Math.min(pos + remaining, pos + child.content.size)
    }
    remaining -= textLen
    pos += child.content.size
    pos += 1
    if (i < doc.childCount - 1) {
      remaining -= 1
      if (remaining < 0) return pos
    }
  }
  return Math.max(1, doc.content.size)
}

function paragraphsFromText(schema: Editor['schema'], text: string) {
  return text.split('\n').map((line) =>
    schema.nodes.paragraph.create(null, line.length ? schema.text(line) : undefined)
  )
}

export function insertTypstSource(
  editor: Editor,
  from: number,
  to: number,
  text: string,
  select?: { from: number; to: number }
) {
  editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      if (!text.includes('\n')) {
        tr.insertText(text, from, to)
        if (select) {
          tr.setSelection(TextSelection.create(tr.doc, select.from, select.to))
        }
        return true
      }

      const $from = state.doc.resolve(from)
      const $to = state.doc.resolve(to)
      const start = $from.start()
      const end = $to.end()
      const before = state.doc.textBetween(start, from, '\n')
      const after = state.doc.textBetween(to, end, '\n')
      const nodes = paragraphsFromText(state.schema, `${before}${text}${after}`)
      tr.replaceWith($from.before(), $to.after(), Fragment.from(nodes))

      if (select) {
        const sourceBefore = state.doc.textBetween(0, start, '\n')
        const prefixLen = sourceBefore.length + (sourceBefore.length > 0 ? 1 : 0) + before.length
        const selFrom = sourceOffsetToPmPos(tr.doc, prefixLen + (select.from - from))
        const selTo = sourceOffsetToPmPos(tr.doc, prefixLen + (select.to - from))
        tr.setSelection(TextSelection.create(tr.doc, selFrom, selTo))
      }
      return true
    })
    .run()
}

function replaceRange(
  editor: Editor,
  from: number,
  to: number,
  text: string,
  selectInner?: { from: number; to: number }
) {
  insertTypstSource(editor, from, to, text, selectInner)
}

function wrapInline(editor: Editor, open: string, close: string, placeholder: string) {
  const { from, to, empty } = editor.state.selection
  const selected = empty ? placeholder : editor.state.doc.textBetween(from, to, '\n')
  if (
    !empty &&
    selected.startsWith(open) &&
    selected.endsWith(close) &&
    selected.length >= open.length + close.length
  ) {
    const inner = selected.slice(open.length, selected.length - close.length)
    replaceRange(editor, from, to, inner)
    return
  }
  replaceRange(editor, from, to, `${open}${selected}${close}`, {
    from: from + open.length,
    to: from + open.length + selected.length,
  })
}

function toggleBlockPrefix(
  editor: Editor,
  kind: 'heading1' | 'heading2' | 'bulletList' | 'orderedList'
) {
  const { start, end } = currentLineRange(editor)
  const line = editor.state.doc.textBetween(start, end, '\n')
  const prefix = BLOCK_PREFIX[kind]
  const already =
    kind === 'heading1'
      ? /^=(?!=)\s+/.test(line)
      : kind === 'heading2'
        ? /^==\s+/.test(line)
        : kind === 'bulletList'
          ? /^-\s+/.test(line)
          : /^\+\s+/.test(line)
  const stripped = line.replace(BLOCK_PREFIX_RE, '')
  replaceRange(editor, start, end, already ? stripped : prefix + stripped)
}

function insertSnippet(editor: Editor, template: string, prefix = '#') {
  const { from, to, $from } = editor.state.selection
  const lineStart = $from.start()
  const before = editor.state.doc.textBetween(lineStart, from, '\n')
  const hash = before.endsWith('#') || prefix === '' ? '' : prefix
  const { text, stops } = expandTypstSnippet(template)
  const inserted = hash + text
  const first = stops[0]
  const select = first
    ? {
        from: from + hash.length + first.from,
        to: from + hash.length + first.to,
      }
    : undefined
  insertTypstSource(editor, from, to, inserted, select)
}

export function insertTypstCatalogSnippet(
  editor: Editor,
  template: string,
  replaceFrom: number,
  replaceTo: number,
  options?: { hash?: boolean }
) {
  const raw = template.replace(/^#/, '')
  const { text, stops } = expandTypstSnippet(raw)
  const prefix = (options?.hash ?? catalogInsertNeedsHash(template)) ? '#' : ''
  const inserted = `${prefix}${text}`
  const first = stops[0]
  const select = first
    ? {
        from: replaceFrom + prefix.length + first.from,
        to: replaceFrom + prefix.length + first.to,
      }
    : {
        from: replaceFrom + inserted.length,
        to: replaceFrom + inserted.length,
      }
  insertTypstSource(editor, replaceFrom, replaceTo, inserted, select)
}

export function insertTypstVariable(editor: Editor, name: string) {
  const caret = editor.state.selection.from
  const textBefore = editor.state.doc.textBetween(0, caret, '\n')
  const plan = getVariableInsertPlan(textBefore, textBefore.length)
  const from = sourceOffsetToPmPos(editor.state.doc, plan.from)
  insertTypstCatalogSnippet(editor, name, from, caret, { hash: plan.needsHash })
}

function quoteTypstLiteral(raw: string) {
  const t = raw.trim()
  if (!t) return '${2:value}'
  if (/^".*"$/.test(t) || /^\[.*\]$/.test(t)) return t
  if (/^-?\d+(\.\d+)?(%|pt|mm|cm|in|em|fr|deg|rad)?$/.test(t)) return t
  if (/^(true|false|none|auto)$/.test(t)) return t
  if (t.includes('\n') || /[*_#\\]/.test(t)) return `[${t.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')}]`
  return `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function isTypstFormatActive(editor: Editor, command: EditorToolbarCommand) {
  const { from, to, $from } = editor.state.selection
  const line = editor.state.doc.textBetween($from.start(), $from.end(), '\n')
  const selected = editor.state.doc.textBetween(from, to, '\n')

  switch (command) {
    case 'heading1':
      return /^=(?!=)\s+/.test(line)
    case 'heading2':
      return /^==\s+/.test(line)
    case 'bold':
      return selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2
    case 'italic':
      return selected.startsWith('_') && selected.endsWith('_') && selected.length >= 2
    case 'link':
      return /#link\(/.test(selected) || /#link\(/.test(line)
    case 'bulletList':
      return /^-\s+/.test(line)
    case 'orderedList':
      return /^\+\s+/.test(line)
    case 'horizontalRule':
      return /#line\(/.test(line)
    case 'codeBlock':
      return (
        (selected.startsWith('`') && selected.endsWith('`') && selected.length >= 2) ||
        line.trimStart().startsWith('```')
      )
    case 'figure':
      return /#figure\(/.test(line) || /#figure\(/.test(selected)
    case 'table':
      return /#table\(/.test(line) || /#table\(/.test(selected)
    case 'math':
      return selected.includes('$') || /\$/.test(line)
    case 'variable':
      return /#let\s+[A-Za-z_]/.test(line) || /#let\s+[A-Za-z_]/.test(selected)
    default:
      return false
  }
}

export function applyTypstFormat(editor: Editor, command: EditorToolbarCommand) {
  switch (command) {
    case 'heading1':
    case 'heading2':
    case 'bulletList':
    case 'orderedList':
      toggleBlockPrefix(editor, command)
      return
    case 'bold':
      wrapInline(editor, '*', '*', 'strong')
      return
    case 'italic':
      wrapInline(editor, '_', '_', 'emphasis')
      return
    case 'codeBlock': {
      const { from, to, empty } = editor.state.selection
      const selected = empty ? 'code' : editor.state.doc.textBetween(from, to, '\n')
      if (selected.includes('\n')) {
        wrapInline(editor, '```\n', '\n```', 'code')
      } else {
        wrapInline(editor, '`', '`', 'code')
      }
      return
    }
    case 'horizontalRule':
      insertSnippet(editor, 'line(length: ${1:100%})')
      return
    case 'figure':
      return
    case 'table':
      insertSnippet(editor, TABLE_SNIPPET)
      return
    case 'math': {
      const { from, to, empty } = editor.state.selection
      const selected = empty ? 'x' : editor.state.doc.textBetween(from, to, '\n')
      wrapInline(editor, '$ ', ' $', selected === 'x' ? 'x' : selected)
      return
    }
    case 'variable': {
      const { from, to, empty } = editor.state.selection
      const selected = empty ? '' : editor.state.doc.textBetween(from, to, '\n')
      if (selected) {
        insertSnippet(editor, `let \${1:name} = ${quoteTypstLiteral(selected)}`)
      } else {
        insertSnippet(editor, 'let ${1:name} = ${2:value}')
      }
      return
    }
    case 'link': {
      const previous = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to,
        '\n'
      )
      const url = window.prompt('Link URL', /https?:\/\//.test(previous) ? previous : 'https://')
      if (url === null || url === '') return
      const { from, to, empty } = editor.state.selection
      const label = empty || /https?:\/\//.test(previous) ? 'label' : previous
      replaceRange(editor, from, to, `#link("${url}")[${label}]`, {
        from: from + `#link("${url}")[`.length,
        to: from + `#link("${url}")[`.length + label.length,
      })
    }
  }
}

export function isRichTextFormatActive(editor: Editor, command: EditorToolbarCommand) {
  switch (command) {
    case 'heading1':
      return editor.isActive('heading', { level: 1 })
    case 'heading2':
      return editor.isActive('heading', { level: 2 })
    case 'bold':
      return editor.isActive('bold')
    case 'italic':
      return editor.isActive('italic')
    case 'link':
      return editor.isActive('link')
    case 'bulletList':
      return editor.isActive('bulletList')
    case 'orderedList':
      return editor.isActive('orderedList')
    case 'horizontalRule':
      return editor.isActive('horizontalRule')
    case 'codeBlock':
      return editor.isActive('codeBlock')
    default:
      return false
  }
}

export function applyRichTextFormat(editor: Editor, command: EditorToolbarCommand) {
  switch (command) {
    case 'heading1':
      editor.chain().focus().toggleHeading({ level: 1 }).run()
      return
    case 'heading2':
      editor.chain().focus().toggleHeading({ level: 2 }).run()
      return
    case 'bold':
      editor.chain().focus().toggleBold().run()
      return
    case 'italic':
      editor.chain().focus().toggleItalic().run()
      return
    case 'bulletList':
      editor.chain().focus().toggleBulletList().run()
      return
    case 'orderedList':
      editor.chain().focus().toggleOrderedList().run()
      return
    case 'horizontalRule':
      editor.chain().focus().setHorizontalRule().run()
      return
    case 'codeBlock':
      editor.chain().focus().toggleCodeBlock().run()
      return
    case 'figure':
      return
    case 'table':
    case 'math':
    case 'variable': {
      const snippets = {
        table: `#table(\n  columns: 3,\n  table.header([A], [B], [C]),\n  [1], [2], [3],\n)`,
        math: `$ x $`,
        variable: `#let name = value`,
      }
      editor.chain().focus().setCodeBlock().insertContent(snippets[command]).run()
      return
    }
    case 'link': {
      const previous = editor.getAttributes('link').href as string | undefined
      const url = window.prompt('Link URL', previous || 'https://')
      if (url === null) return
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        return
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }
}
