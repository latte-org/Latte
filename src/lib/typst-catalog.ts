export type TypstAssistKind = 'keyword' | 'function' | 'markup' | 'custom' | 'variable'

export type TypstCatalogEntry = {
  name: string
  kind: TypstAssistKind
  signature: string
  description: string
  usage: string
  insert: string
  aliases?: string[]
  /** When false, insert markup as-is (no leading `#`). */
  hash?: boolean
}

export type TypstSnippetStop = {
  from: number
  to: number
  index: number
}

const ENTRIES: TypstCatalogEntry[] = [
  {
    name: 'set',
    kind: 'keyword',
    signature: '#set element(arguments)',
    description:
      'Apply a set rule so later elements of that kind use the given defaults. Set rules only work with element functions (text, page, par, heading, …).',
    usage: '#set text(font: "Libertinus Serif", size: 11pt)\n#set page(margin: 2cm)\n#set heading(numbering: "1.")',
    insert: 'set text(font: "${1:Libertinus Serif}", size: ${2:11pt})',
  },
  {
    name: 'let',
    kind: 'keyword',
    signature: '#let name = value\n#let name(params) = body',
    description:
      'Bind a value or define a function. Function parameters can be positional, named with defaults, or a sink (`..args`).',
    usage: '#let name = "Latte"\n#let alert(body, fill: red) = {\n  set text(white)\n  rect(fill: fill, inset: 8pt, [*#body*])\n}\n#alert[Watch out]',
    insert: 'let ${1:name} = ${2:value}',
  },
  {
    name: 'show',
    kind: 'keyword',
    signature: '#show selector: set …\n#show selector: it => …',
    description:
      'Rewrite how matching elements are shown. Use a show-set rule for styling, or a function that receives the element.',
    usage: '#show heading: set text(blue)\n#show heading.where(level: 2): set text(size: 12pt)\n#show "Typst": smallcaps',
    insert: 'show ${1:heading}: set text(${2:blue})',
  },
  {
    name: 'import',
    kind: 'keyword',
    signature: '#import "file.typ"\n#import "file.typ": name\n#import "@preview/pkg:1.0.0": *',
    description: 'Import a module or selected names from a file or package.',
    usage: '#import "utils.typ": alert\n#import "@preview/cetz:0.3.0": canvas',
    insert: 'import "${1:file.typ}": ${2:name}',
  },
  {
    name: 'include',
    kind: 'keyword',
    signature: '#include "file.typ"',
    description: 'Include another Typst file in place, inserting its rendered content here.',
    usage: '#include "chapter-1.typ"',
    insert: 'include "${1:file.typ}"',
  },
  {
    name: 'context',
    kind: 'keyword',
    signature: '#context expression',
    description: 'Evaluate an expression with access to the current location, styles, and other contextual data.',
    usage: '#context text.lang\n#context counter(heading).get()',
    insert: 'context ${1:text.lang}',
  },
  {
    name: 'figure',
    kind: 'function',
    signature: '#figure(body, caption: none, placement: none) <label>',
    description:
      'A captioned figure. The kind (image, table, or code) is inferred from the body so numbering tracks stay separate. Reference it with `@label`.',
    usage:
      '#figure(\n  image("glacier.jpg", width: 80%),\n  caption: [A curious figure.],\n) <glacier>\n\n@glacier shows a glacier.',
    insert:
      'figure(\n  image("${1:image.png}", width: ${2:80%}),\n  caption: [${3:Caption}],\n) <${4:fig}>',
  },
  {
    name: 'image',
    kind: 'function',
    signature: '#image(path, width: auto, height: auto, alt: none)',
    description: 'Embed an image from a path. Wrap it in `figure` to add a caption and a reference label.',
    usage: '#image("plot.png", width: 70%)',
    insert: 'image("${1:image.png}", width: ${2:80%})',
  },
  {
    name: 'table',
    kind: 'function',
    signature: '#table(columns: n, ..cells)',
    description:
      'Arrange cells in row-major order. Use `table.header` for the header row. Wrap in `figure` for a caption.',
    usage:
      '#table(\n  columns: 3,\n  table.header([A], [B], [C]),\n  [1], [2], [3],\n  [4], [5], [6],\n)',
    insert:
      'table(\n  columns: ${1:3},\n  table.header([${2:A}], [${3:B}], [${4:C}]),\n  [${5:1}], [${6:2}], [${7:3}],\n)',
  },
  {
    name: 'grid',
    kind: 'function',
    signature: '#grid(columns: n, ..cells)',
    description: 'Lay out content on a grid without table styling. Similar arguments to `table`.',
    usage: '#grid(columns: 2, gutter: 1em, [Left], [Right])',
    insert: 'grid(columns: ${1:2}, gutter: ${2:1em}, [${3:A}], [${4:B}])',
  },
  {
    name: 'text',
    kind: 'function',
    signature: '#text(font: auto, size: auto, fill: auto)[content]',
    description: 'Style text or create a text element. Also used in set rules for the whole document.',
    usage: '#set text(font: "Libertinus Serif", size: 11pt)\n#text(blue)[accent]',
    insert: 'text(${1:size: 11pt})[${2:content}]',
  },
  {
    name: 'page',
    kind: 'function',
    signature: '#set page(paper: "a4", margin: auto, numbering: none)',
    description: 'Configure page size, margins, headers, footers, and numbering. HTML export ignores page set rules.',
    usage: '#set page(paper: "a4", margin: 2cm, numbering: "1")',
    insert: 'set page(margin: ${1:2cm}, numbering: ${2:"1"})',
  },
  {
    name: 'pagebreak',
    kind: 'function',
    signature: '#pagebreak(weak: false)',
    description: 'Insert a page break. A weak break is skipped if it would land at the start of a page.',
    usage: '#pagebreak()\n#pagebreak(weak: true)',
    insert: 'pagebreak()',
  },
  {
    name: 'par',
    kind: 'function',
    signature: '#set par(justify: false, leading: 0.65em)',
    description: 'Configure paragraph justification, first-line indent, and leading (line spacing).',
    usage: '#set par(justify: true, leading: 0.8em)',
    insert: 'set par(justify: ${1:true}, leading: ${2:0.65em})',
  },
  {
    name: 'heading',
    kind: 'function',
    signature: '#heading(level: 1)[Title]\n= Title',
    description: 'Create a heading. Markup `=`, `==`, `===` is the usual form.',
    usage: '= Introduction\n== Background\n#heading(level: 3, numbering: none)[Notes]',
    insert: 'heading(level: ${1:1})[${2:Title}]',
  },
  {
    name: 'link',
    kind: 'function',
    signature: '#link(url)[label]\nhttps://example.com',
    description: 'A hyperlink. Bare URLs also become links automatically.',
    usage: '#link("https://typst.app/")[Typst]\nhttps://typst.app/',
    insert: 'link("${1:https://}")[${2:label}]',
  },
  {
    name: 'line',
    kind: 'function',
    signature: '#line(length: 100%, stroke: auto)',
    description: 'Draw a line. Typst has no Markdown `---` rule; `---` is an em dash.',
    usage: '#line(length: 100%)\n#line(length: 60%, stroke: 0.5pt + gray)',
    insert: 'line(length: ${1:100%})',
  },
  {
    name: 'align',
    kind: 'function',
    signature: '#align(alignment)[content]',
    description: 'Align content. Alignments include `left`, `center`, `right`, `top`, `horizon`, `bottom`.',
    usage: '#align(center)[= Title]\n#align(right)[Page #context counter(page).display()]',
    insert: 'align(${1:center})[${2:content}]',
  },
  {
    name: 'box',
    kind: 'function',
    signature: '#box(width: auto, height: auto)[content]',
    description: 'An inline container. Use `block` for a block-level box.',
    usage: '#box(fill: luma(230), inset: 6pt)[Note]',
    insert: 'box(inset: ${1:6pt})[${2:content}]',
  },
  {
    name: 'block',
    kind: 'function',
    signature: '#block(width: auto, breakable: true)[content]',
    description: 'A block-level container that can break across pages.',
    usage: '#block(fill: luma(240), inset: 8pt, radius: 4pt)[Callout]',
    insert: 'block(inset: ${1:8pt})[${2:content}]',
  },
  {
    name: 'rect',
    kind: 'function',
    signature: '#rect(width: auto, height: auto, fill: none, stroke: auto)',
    description: 'A rectangle, optionally filled or stroked. Useful as a placeholder or frame.',
    usage: '#rect(width: 100%, height: 4cm, fill: luma(230))',
    insert: 'rect(width: ${1:100%}, height: ${2:3cm}, fill: ${3:luma(230)})',
  },
  {
    name: 'lorem',
    kind: 'function',
    signature: '#lorem(words)',
    description: 'Insert placeholder Latin text of the given word count.',
    usage: '#lorem(40)',
    insert: 'lorem(${1:20})',
  },
  {
    name: 'cite',
    kind: 'function',
    signature: '#cite(<key>)\n@key',
    description: 'Cite a bibliography entry. `@key` is the markup form.',
    usage: '@netwok2020\n#cite(<netwok2020>, form: "prose")',
    insert: 'cite(<${1:key}>)',
  },
  {
    name: 'bibliography',
    kind: 'function',
    signature: '#bibliography("refs.bib")',
    description: 'Print the bibliography from a BibLaTeX/Hayagriva file.',
    usage: '#bibliography("refs.bib")',
    insert: 'bibliography("${1:refs.bib}")',
  },
  {
    name: 'footnote',
    kind: 'function',
    signature: '#footnote[content]',
    description: 'Insert a footnote. Numbering is automatic.',
    usage: 'Glaciers are melting.#footnote[See IPCC AR6.]',
    insert: 'footnote[${1:Note}]',
  },
  {
    name: 'ref',
    kind: 'function',
    signature: '#ref(<label>)\n@label',
    description: 'Reference a labelled heading, figure, or equation. `@label` is the markup form.',
    usage: 'See @glacier and @eqt.',
    insert: 'ref(<${1:label}>)',
  },
  {
    name: 'label',
    kind: 'function',
    signature: '<label>\n#label("name")',
    description: 'Attach a label after an element so it can be referenced with `@name`.',
    usage: '= Methods <methods>\nSee @methods.',
    insert: 'label("${1:name}")',
  },
  {
    name: 'outline',
    kind: 'function',
    signature: '#outline(title: auto, target: heading)',
    description: 'Table of contents, or an outline of figures when `target` is set.',
    usage: '#outline()\n#outline(title: [Figures], target: figure)',
    insert: 'outline()',
  },
  {
    name: 'enum',
    kind: 'function',
    signature: '+ item\n#enum[..]',
    description: 'Numbered list. Markup form is `+ item` on each line (not `1.`).',
    usage: '+ First\n+ Second\n#enum(start: 3)[A][B]',
    insert: 'enum[${1:First}][${2:Second}]',
  },
  {
    name: 'list',
    kind: 'function',
    signature: '- item\n#list[..]',
    description: 'Bullet list. Markup form is `- item` on each line.',
    usage: '- Ice\n- Snow',
    insert: 'list[${1:A}][${2:B}]',
  },
  {
    name: 'raw',
    kind: 'function',
    signature: '`code`\n#raw(block: true, lang: none)[code]',
    description: 'Raw/monospaced text. Backticks are the markup form; use a language tag for highlighting.',
    usage: '`let x = 1`\n```py\nprint("hi")\n```',
    insert: 'raw(block: true, lang: "${1:typ}")[${2:code}]',
  },
  {
    name: 'emph',
    kind: 'function',
    signature: '_emphasis_\n#emph[text]',
    description: 'Emphasis, usually italic. Markup uses underscores.',
    usage: 'This is _important_.',
    insert: 'emph[${1:text}]',
  },
  {
    name: 'strong',
    kind: 'function',
    signature: '*strong*\n#strong[text]',
    description: 'Strong emphasis, usually bold. Markup uses asterisks.',
    usage: 'This is *important*.',
    insert: 'strong[${1:text}]',
  },
  {
    name: 'eval',
    kind: 'function',
    signature: '#eval(source, mode: "code")',
    description: 'Evaluate a Typst source string. Prefer normal markup unless you truly need dynamic code.',
    usage: '#eval("1 + 2")',
    insert: 'eval("${1:1 + 2}")',
  },
  {
    name: 'math',
    kind: 'markup',
    hash: false,
    aliases: ['equation', '$'],
    signature: '$x^2$     inline\n$ x^2 $   block',
    description:
      'Math mode. Inline if the dollars touch the formula; block if there is space or a newline inside the dollars. Subscripts use `_`, superscripts `^`.',
    usage:
      'The flow is $Q = rho a v + C$.\n\n$ v := vec(x_1, x_2, x_3) $\n\n$ sum_(k=0)^n k = (n(n+1))/2 $',
    insert: '$ ${1:x} $',
  },
]

export const TYPST_CATALOG: TypstCatalogEntry[] = ENTRIES

const BY_NAME = new Map(ENTRIES.map((entry) => [entry.name, entry]))

export function getTypstCatalogEntry(name: string) {
  return BY_NAME.get(name) ?? null
}

export function expandTypstSnippet(template: string): { text: string; stops: TypstSnippetStop[] } {
  const stops: TypstSnippetStop[] = []
  let text = ''
  const pattern = /\$\{(\d+):([^}]*)\}|\$(\d+)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(template))) {
    text += template.slice(last, match.index)
    const index = Number(match[1] ?? match[3])
    const value = match[2] ?? ''
    const from = text.length
    text += value
    stops.push({ index, from, to: text.length })
    last = match.index + match[0].length
  }
  text += template.slice(last)
  stops.sort((a, b) => a.index - b.index)
  return { text, stops }
}

export type UserTypstCommand = {
  name: string
  kind: 'custom' | 'variable'
  signature: string
  description: string
  usage: string
  insert: string
  params: string
  value?: string
}

export type TypstVariableRef = {
  name: string
  value: string
}

function skipSpace(source: string, index: number) {
  let i = index
  while (i < source.length && /[ \t]/.test(source[i] ?? '')) i += 1
  return i
}

function matchingDelim(source: string, openIndex: number) {
  const open = source[openIndex]
  const close = open === '(' ? ')' : open === '[' ? ']' : open === '{' ? '}' : ''
  if (!close) return -1
  let depth = 0
  let inStr: '"' | "'" | null = null
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i]
    if (inStr) {
      if (char === '\\') {
        i += 1
        continue
      }
      if (char === inStr) inStr = null
      continue
    }
    if (char === '"' || char === "'") {
      inStr = char
      continue
    }
    if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function parseTypstValue(source: string, start: number) {
  let i = skipSpace(source, start)
  const from = i
  let depth = 0
  let inStr: '"' | "'" | null = null
  while (i < source.length) {
    const char = source[i]
    if (inStr) {
      if (char === '\\') {
        i += 2
        continue
      }
      if (char === inStr) inStr = null
      i += 1
      continue
    }
    if (char === '"' || char === "'") {
      inStr = char
      i += 1
      continue
    }
    if (char === '(' || char === '[' || char === '{') {
      depth += 1
      i += 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      if (depth === 0) break
      depth -= 1
      i += 1
      continue
    }
    if (depth === 0 && (char === '\n' || char === ';')) break
    if (depth === 0 && char === '/' && source[i + 1] === '/') break
    i += 1
  }
  return { value: source.slice(from, i).trim(), end: i }
}

function truncateValue(value: string, max = 48) {
  const one = value.replace(/\s+/g, ' ')
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

function identNames(inner: string) {
  const names: string[] = []
  let depth = 0
  let current = ''
  for (const char of inner) {
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) {
      names.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) names.push(current.trim())
  return names
    .map((part) => part.match(/^\.{0,2}([A-Za-z_][\w-]*)/)?.[1] ?? '')
    .filter(Boolean)
}

export function parseUserTypstCommands(source: string): UserTypstCommand[] {
  const found: UserTypstCommand[] = []
  const seen = new Set<string>()

  const pushFn = (name: string, params: string) => {
    if (!name || seen.has(name) || BY_NAME.has(name)) return
    seen.add(name)
    found.push({
      name,
      kind: 'custom',
      signature: `#let ${name}${params} = …`,
      description: `Custom function defined in this document as \`#let ${name}${params} = …\`. Call it with \`#${name}(…)\` or a trailing content block \`#${name}[…]\`.`,
      usage: `#${name}${params}\n#${name}[content]`,
      insert: snippetFromLetParams(name, params),
      params,
    })
  }

  const pushVar = (name: string, value: string) => {
    if (!name || seen.has(name) || BY_NAME.has(name)) return
    seen.add(name)
    const preview = truncateValue(value)
    found.push({
      name,
      kind: 'variable',
      signature: `#let ${name} = ${preview || '…'}`,
      description: `Variable declared in this document. In markup write \`#${name}\`. Inside code (function arguments or \`{ }\` blocks) write \`${name}\`. In math write \`$#${name}$\`.`,
      usage: `Markup: #${name}\nCode: ${name}\nMath: $#${name}$`,
      insert: name,
      params: '',
      value: preview,
    })
  }

  const letStart = /#let\b/g
  let match: RegExpExecArray | null
  while ((match = letStart.exec(source))) {
    let i = skipSpace(source, match.index + 4)
    if (source[i] === '(') {
      const close = matchingDelim(source, i)
      if (close < 0) continue
      const inner = source.slice(i + 1, close)
      i = skipSpace(source, close + 1)
      if (source[i] !== '=') continue
      const { value } = parseTypstValue(source, i + 1)
      for (const name of identNames(inner)) pushVar(name, value)
      continue
    }

    const nameMatch = source.slice(i).match(/^[A-Za-z_][\w-]*/)
    if (!nameMatch) continue
    const name = nameMatch[0]
    i = skipSpace(source, i + name.length)
    if (source[i] === '(') {
      const close = matchingDelim(source, i)
      if (close < 0) continue
      pushFn(name, source.slice(i, close + 1))
      continue
    }
    if (source[i] === '=') {
      const { value } = parseTypstValue(source, i + 1)
      pushVar(name, value)
    }
  }

  return found
}

export function parseUserTypstVariables(source: string): TypstVariableRef[] {
  return parseUserTypstCommands(source)
    .filter((item) => item.kind === 'variable')
    .map((item) => ({ name: item.name, value: item.value ?? '' }))
}

export type AssistItem = TypstCatalogEntry | UserTypstCommand

export function filterTypstAssistItems(
  query: string,
  source: string,
  options?: { variablesOnly?: boolean }
): AssistItem[] {
  const q = query.toLowerCase()
  const custom = parseUserTypstCommands(source)
  const pool: AssistItem[] = options?.variablesOnly ? custom.filter((item) => item.kind === 'variable') : [...custom, ...ENTRIES]
  if (!q) return pool.slice(0, 12)
  return pool
    .filter((item) => {
      if (item.name.toLowerCase().startsWith(q)) return true
      if ('aliases' in item && item.aliases?.some((alias) => alias.toLowerCase().startsWith(q))) {
        return true
      }
      return item.name.toLowerCase().includes(q)
    })
    .slice(0, 16)
}

export function lookupTypstAssistItem(name: string, source: string): AssistItem | null {
  const custom = parseUserTypstCommands(source).find((item) => item.name === name)
  if (custom) return custom
  return getTypstCatalogEntry(name)
}

export type HashAssistContext = {
  hashFrom: number
  queryFrom: number
  caret: number
  query: string
  inCall: boolean
  commandName: string
  needsHash: boolean
}

function snippetFromLetParams(name: string, params: string): string {
  const inner = params.slice(1, -1).trim()
  if (!inner) return `${name}($0)`
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of inner) {
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  if (parts.length === 0) return `${name}($0)`

  const pieces = parts.map((part, i) => {
    const named = part.match(/^(\.\.)?([A-Za-z_][\w-]*)(?:\s*:\s*(.+))?$/)
    if (!named) return `\${${i + 1}:${part}}`
    const [, sink, ident, def] = named
    if (sink) return `..${ident}`
    if (def) return `${ident}: \${${i + 1}:${def.trim()}}`
    return `\${${i + 1}:${ident}}`
  })
  return `${name}(${pieces.join(', ')})`
}

function assistHashFrom(textBeforeCaret: string, caret: number, commandName: string) {
  const hashIndex = textBeforeCaret.lastIndexOf(`#${commandName}`)
  if (hashIndex < 0) return caret
  return caret - (textBeforeCaret.length - hashIndex)
}

function inUnclosedString(text: string) {
  let inStr: '"' | "'" | null = null
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inStr) {
      if (char === '\\') {
        i += 1
        continue
      }
      if (char === inStr) inStr = null
      continue
    }
    if (char === '"' || char === "'") inStr = char
  }
  return inStr !== null
}

export function isInsideTypstMath(textBefore: string) {
  return (textBefore.split('$').length - 1) % 2 === 1
}

export function isInsideTypstCode(textBefore: string) {
  if (isInsideTypstMath(textBefore)) return false
  const lastHash = textBefore.lastIndexOf('#')
  if (lastHash < 0) return false
  const after = textBefore.slice(lastHash)
  if (inUnclosedString(after)) return true
  let depth = 0
  let inStr: '"' | "'" | null = null
  for (let i = 0; i < after.length; i += 1) {
    const char = after[i]
    if (inStr) {
      if (char === '\\') {
        i += 1
        continue
      }
      if (char === inStr) inStr = null
      continue
    }
    if (char === '"' || char === "'") {
      inStr = char
      continue
    }
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1)
  }
  return depth > 0
}

export function getVariableInsertPlan(textBeforeCaret: string, caret: number) {
  const complete = textBeforeCaret.match(/#([A-Za-z_][\w-]*)?$/)
  if (complete) {
    return { from: caret - complete[0].length, needsHash: true }
  }
  if (isInsideTypstCode(textBeforeCaret)) {
    const ident = textBeforeCaret.match(/[A-Za-z_][\w-]*$/)
    return {
      from: ident ? caret - ident[0].length : caret,
      needsHash: false,
    }
  }
  return { from: caret, needsHash: true }
}

function argIdentQuery(args: string): { query: string; fromDelta: number } | null {
  if (inUnclosedString(args)) return null
  const ident = args.match(/([A-Za-z_][\w-]*)?$/)
  if (!ident) return null
  const before = args.slice(0, args.length - ident[0].length)
  if (!/(?:^|[,\(\[:]\s*)$/.test(before)) return null
  return { query: ident[1] ?? '', fromDelta: ident[0].length }
}

export function getHashAssistContext(textBeforeCaret: string, caret: number): HashAssistContext | null {
  const complete = textBeforeCaret.match(/#([A-Za-z_][\w-]*)?$/)
  if (complete) {
    const query = complete[1] ?? ''
    const hashFrom = caret - complete[0].length
    return {
      hashFrom,
      queryFrom: hashFrom + 1,
      caret,
      query,
      inCall: false,
      commandName: query,
      needsHash: true,
    }
  }

  const letDef = textBeforeCaret.match(/#let(?:\s+[A-Za-z_][\w-]*)?\s*(?:\([^#]*)?$/)
  if (letDef) {
    const hashFrom = assistHashFrom(textBeforeCaret, caret, 'let')
    return {
      hashFrom,
      queryFrom: hashFrom + 1,
      caret,
      query: 'let',
      inCall: true,
      commandName: 'let',
      needsHash: true,
    }
  }

  const call = textBeforeCaret.match(/#([A-Za-z_][\w-]*)\s*[\(\[]([^#]*)$/)
  if (call) {
    const commandName = call[1]
    const args = call[2] ?? ''
    const arg = argIdentQuery(args)
    const commandFrom = assistHashFrom(textBeforeCaret, caret, commandName)
    if (arg && arg.fromDelta > 0) {
      return {
        hashFrom: caret - arg.fromDelta,
        queryFrom: caret - arg.fromDelta,
        caret,
        query: arg.query,
        inCall: true,
        commandName,
        needsHash: false,
      }
    }
    return {
      hashFrom: commandFrom,
      queryFrom: commandFrom + 1,
      caret,
      query: commandName,
      inCall: true,
      commandName,
      needsHash: true,
    }
  }

  if (isInsideTypstCode(textBeforeCaret)) {
    const ident = textBeforeCaret.match(/[A-Za-z_][\w-]*$/)
    if (!ident) return null
    const query = ident[0]
    return {
      hashFrom: caret - ident[0].length,
      queryFrom: caret - ident[0].length,
      caret,
      query,
      inCall: false,
      commandName: query,
      needsHash: false,
    }
  }

  return null
}

export function catalogInsertNeedsHash(template: string) {
  const raw = template.replace(/^#/, '').trimStart()
  if (!raw) return true
  return !/^[\$=\-+`/]/.test(raw)
}
