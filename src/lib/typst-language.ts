import type * as Monaco from 'monaco-editor'
import {
  TYPST_BUILTIN_FUNCTIONS,
  TYPST_CONSTANTS,
  TYPST_KEYWORDS,
  TYPST_UNITS,
} from '@/lib/typst-syntax'

let registered = false

const KEYWORDS = [...TYPST_KEYWORDS]
const CONSTANTS = [...TYPST_CONSTANTS]
const BUILTIN_FUNCTIONS = [...TYPST_BUILTIN_FUNCTIONS]
const UNITS = [...TYPST_UNITS]

const COMPLETIONS: Array<{
  label: string
  kind: 'Keyword' | 'Function' | 'Constant' | 'Snippet'
  detail?: string
  insertText?: string
  documentation?: string
}> = [
  ...KEYWORDS.map((label) => ({
    label,
    kind: 'Keyword' as const,
    detail: 'keyword',
  })),
  ...CONSTANTS.map((label) => ({
    label,
    kind: 'Constant' as const,
    detail: 'constant',
  })),
  ...BUILTIN_FUNCTIONS.map((label) => ({
    label,
    kind: 'Function' as const,
    detail: 'function',
    insertText: `${label}($0)`,
    documentation: `Built-in Typst function \`${label}\``,
  })),
  {
    label: 'set page',
    kind: 'Snippet',
    detail: 'snippet',
    insertText: 'set page(margin: ${1:2cm})',
    documentation: 'Configure page size and margins',
  },
  {
    label: 'set text',
    kind: 'Snippet',
    detail: 'snippet',
    insertText: 'set text(font: "${1:Libertinus Serif}", size: ${2:11pt})',
    documentation: 'Configure document text',
  },
  {
    label: 'set par',
    kind: 'Snippet',
    detail: 'snippet',
    insertText: 'set par(justify: ${1:true}, leading: ${2:0.65em})',
    documentation: 'Configure paragraph layout',
  },
  {
    label: 'heading',
    kind: 'Snippet',
    detail: 'snippet',
    insertText: '= ${1:Heading}',
    documentation: 'Level-1 heading',
  },
  {
    label: 'figure',
    kind: 'Snippet',
    detail: 'snippet',
    insertText: '#figure(\n  ${1:image("path.png")},\n  caption: [${2:Caption}],\n) <${3:label}>',
    documentation: 'Insert a figure with caption',
  },
  {
    label: 'table',
    kind: 'Snippet',
    detail: 'snippet',
    insertText:
      '#table(\n  columns: ${1:3},\n  table.header([${2:A}], [${3:B}], [${4:C}]),\n  [${5:1}], [${6:2}], [${7:3}],\n)',
    documentation: 'Insert a table. Use table.header for the header row.',
  },
  {
    label: 'equation',
    kind: 'Snippet',
    detail: 'snippet',
    insertText: '$ ${1:x = y} $',
    documentation: 'Block math (spaces inside $ … $). Inline is $x$ with no spaces.',
  },
]

const HOVER_DOCS: Record<string, string> = {
  set: 'Apply a style or configuration rule to the rest of the document.\n\nExample: `#set text(size: 12pt)`',
  let: 'Bind a value to a variable.\n\nExample: `#let name = "Latte"`',
  show: 'Transform elements that match a selector.\n\nExample: `#show heading: set text(blue)`',
  import: 'Import definitions from a module or package.\n\nExample: `#import "@preview/example:0.1.0"`',
  include: 'Include another Typst file in place.\n\nExample: `#include "chapter.typ"`',
  page: 'Configure page size, margins, headers, and numbering.',
  text: 'Style or create text content.',
  par: 'Configure paragraph justification, spacing, and leading.',
  figure: 'Create a floating figure with an optional caption.',
  table: 'Lay out content in rows and columns.',
  image: 'Embed an image from a path or bytes.',
  math: 'Access mathematical functions and constants.',
}

export function registerTypstLanguage(monaco: typeof Monaco) {
  if (registered) return
  registered = true

  monaco.languages.register({
    id: 'typst',
    extensions: ['.typ'],
    aliases: ['Typst', 'typst'],
    mimetypes: ['text/x-typst'],
  })

  monaco.languages.setLanguageConfiguration('typst', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
      ['$', '$'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '$', close: '$' },
      { open: '`', close: '`' },
      { open: '*', close: '*' },
      { open: '_', close: '_' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '$', close: '$' },
      { open: '`', close: '`' },
      { open: '*', close: '*' },
      { open: '_', close: '_' },
    ],
    colorizedBracketPairs: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    folding: {
      markers: {
        start: /^\s*\/\/\s*#?region\b/,
        end: /^\s*\/\/\s*#?endregion\b/,
      },
    },
    indentationRules: {
      increaseIndentPattern: /[{\[(]\s*$/,
      decreaseIndentPattern: /^\s*[}\])]/,
    },
    wordPattern:
      /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    onEnterRules: [
      {
        beforeText: /^\s*=+\s+.*$/,
        action: { indentAction: monaco.languages.IndentAction.None },
      },
    ],
  })

  monaco.languages.setMonarchTokensProvider('typst', {
    defaultToken: '',
    tokenPostfix: '.typst',
    keywords: KEYWORDS,
    constants: CONSTANTS,
    builtins: BUILTIN_FUNCTIONS,
    units: UNITS,
    tokenizer: {
      root: [{ include: 'markup' }],

      markup: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/^=+[^\n]*$/, 'heading'],
        [/^\s*([-+\/]|[0-9]+\.)\s+/, 'list'],
        [/\*[^*\n]+\*/, 'strong'],
        [/_[^_\n]+_/, 'emphasis'],
        [/`{3,}[^`]*`{3,}/, 'string.raw'],
        [/`[^`\n]+`/, 'string.raw'],
        [/https?:\/\/[^\s\]]+/, 'string.link'],
        [/<(?!\/)[^>\s]+>/, 'tag'],
        [/@[A-Za-z_][\w-]*/, 'variable'],
        [/\$/, 'delimiter.math', '@mathInline'],
        [/#/, 'delimiter.hash', '@code'],
        [/\\[A-Za-z]+/, 'string.escape'],
        [/\\[\S]/, 'string.escape'],
        [/[{}\[\]()]/, 'delimiter.bracket'],
      ],

      code: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/\s+/, 'white'],
        [
          /[a-zA-Z_][\w-]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@constants': 'constant',
              '@builtins': 'function',
              '@default': 'identifier',
            },
          },
        ],
        [/\d+(\.\d+)?(%|pt|mm|cm|in|em|fr|deg|rad)?/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/'/, 'string', '@stringSingle'],
        [/=>|==|!=|<=|>=|\+=|-=|\*=|\/=|\.\./, 'operator'],
        [/[=+\-*/<>!&|.?:]/, 'operator'],
        [/[{]/, 'delimiter.bracket', '@codeBlock'],
        [/\[/, 'delimiter.bracket', '@contentBlock'],
        [/\(/, 'delimiter.bracket', '@parenBlock'],
        [/[}\]\)]/, { token: 'delimiter.bracket', next: '@pop' }],
        [/;|,/, 'delimiter'],
        // End of hash expression when markup resumes
        [/(?=\n)/, { token: '', next: '@pop' }],
        [/[^#\s{}\[\]()"'0-9A-Za-z_+\-*/=<>!&|.?:;,]+/, 'identifier'],
      ],

      codeBlock: [
        { include: 'codeInner' },
        [/\{/, 'delimiter.bracket', '@codeBlock'],
        [/\}/, { token: 'delimiter.bracket', next: '@pop' }],
      ],

      contentBlock: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/\[/, 'delimiter.bracket', '@contentBlock'],
        [/\]/, { token: 'delimiter.bracket', next: '@pop' }],
        { include: 'markup' },
      ],

      parenBlock: [
        { include: 'codeInner' },
        [/\(/, 'delimiter.bracket', '@parenBlock'],
        [/\)/, { token: 'delimiter.bracket', next: '@pop' }],
      ],

      codeInner: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/\s+/, 'white'],
        [
          /[a-zA-Z_][\w-]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@constants': 'constant',
              '@builtins': 'function',
              '@default': 'identifier',
            },
          },
        ],
        [/\d+(\.\d+)?(%|pt|mm|cm|in|em|fr|deg|rad)?/, 'number'],
        [/"/, 'string', '@string'],
        [/'/, 'string', '@stringSingle'],
        [/=>|==|!=|<=|>=|\+=|-=|\*=|\/=|\.\./, 'operator'],
        [/[=+\-*/<>!&|.?:]/, 'operator'],
        [/\[/, 'delimiter.bracket', '@contentBlock'],
        [/;|,/, 'delimiter'],
      ],

      mathInline: [
        [/\$/, { token: 'delimiter.math', next: '@pop' }],
        { include: 'mathBody' },
      ],

      mathBody: [
        [/\/\/.*$/, 'comment'],
        [/\\[A-Za-z]+/, 'keyword.math'],
        [/[_^]/, 'operator.math'],
        [/[{}\[\]()]/, 'delimiter.bracket'],
        [/[+\-*/=<>!|&]+/, 'operator.math'],
        [/\d+(\.\d+)?/, 'number'],
        [/[A-Za-z][\w]*/, 'identifier.math'],
        [/[^$\\]+/, 'string.math'],
      ],

      comment: [
        [/[^*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/\*/, 'comment'],
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],

      stringSingle: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
  })

  monaco.languages.registerCompletionItemProvider('typst', {
    triggerCharacters: ['#', '.', '@', ' '],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const line = model.getLineContent(position.lineNumber)
      const before = line.slice(0, position.column - 1)
      const inHashContext = /#\s*[\w.-]*$/.test(before) || /#\s*\w+\([\w\s,=."'-]*$/.test(before)

      const suggestions = COMPLETIONS.map((item) => {
        const kindMap = {
          Keyword: monaco.languages.CompletionItemKind.Keyword,
          Function: monaco.languages.CompletionItemKind.Function,
          Constant: monaco.languages.CompletionItemKind.Constant,
          Snippet: monaco.languages.CompletionItemKind.Snippet,
        }

        const insertText = item.insertText ?? item.label
        const needsHash =
          inHashContext === false &&
          (item.kind === 'Function' || item.kind === 'Snippet') &&
          !insertText.startsWith('#') &&
          !insertText.startsWith('=') &&
          !insertText.startsWith('$')

        return {
          label: item.label,
          kind: kindMap[item.kind],
          detail: item.detail,
          documentation: item.documentation,
          insertText: needsHash ? `#${insertText}` : insertText,
          insertTextRules: item.insertText
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          range,
        }
      })

      return { suggestions }
    },
  })

  monaco.languages.registerHoverProvider('typst', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)
      if (!word) return null
      const docs = HOVER_DOCS[word.word]
      if (!docs) return null
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents: [
          { value: `**${word.word}**` },
          { value: docs },
        ],
      }
    },
  })

  monaco.languages.registerDocumentFormattingEditProvider('typst', {
    provideDocumentFormattingEdits(model) {
      // Soft format: trim trailing whitespace and ensure final newline
      const value = model.getValue()
      const formatted =
        value
          .split('\n')
          .map((line) => line.replace(/[ \t]+$/g, ''))
          .join('\n')
          .replace(/\s*$/, '\n')

      if (formatted === value) return []
      return [
        {
          range: model.getFullModelRange(),
          text: formatted,
        },
      ]
    },
  })
}

export function defineTypstThemes(monaco: typeof Monaco) {
  monaco.editor.defineTheme('latte-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment.typst', foreground: '6B7280', fontStyle: 'italic' },
      { token: 'string.typst', foreground: 'B45309' },
      { token: 'string.raw.typst', foreground: '0F766E' },
      { token: 'string.link.typst', foreground: '2563EB', fontStyle: 'underline' },
      { token: 'string.escape.typst', foreground: 'C2410C' },
      { token: 'string.math.typst', foreground: '7C3AED' },
      { token: 'keyword.typst', foreground: '4F46E5', fontStyle: 'bold' },
      { token: 'keyword.math.typst', foreground: '7C3AED' },
      { token: 'constant.typst', foreground: '0F766E' },
      { token: 'number.typst', foreground: '047857' },
      { token: 'function.typst', foreground: '1D4ED8' },
      { token: 'identifier.typst', foreground: '1F2937' },
      { token: 'identifier.math.typst', foreground: '6D28D9' },
      { token: 'operator.typst', foreground: '374151' },
      { token: 'operator.math.typst', foreground: '7C3AED' },
      { token: 'heading.typst', foreground: '1E3A8A', fontStyle: 'bold' },
      { token: 'strong.typst', fontStyle: 'bold' },
      { token: 'emphasis.typst', fontStyle: 'italic' },
      { token: 'list.typst', foreground: '4F46E5' },
      { token: 'tag.typst', foreground: 'B45309' },
      { token: 'variable.typst', foreground: 'A16207' },
      { token: 'delimiter.hash.typst', foreground: '4F46E5', fontStyle: 'bold' },
      { token: 'delimiter.math.typst', foreground: '7C3AED', fontStyle: 'bold' },
      { token: 'delimiter.bracket.typst', foreground: '64748B' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#1F2937',
      'editor.lineHighlightBackground': '#F8FAFC',
      'editorLineNumber.foreground': '#94A3B8',
      'editorLineNumber.activeForeground': '#475569',
      'editor.selectionBackground': '#E0E7FF',
      'editor.inactiveSelectionBackground': '#EEF2FF',
      'editorCursor.foreground': '#4F46E5',
      'editorWidget.background': '#FFFFFF',
      'editorGutter.background': '#FFFFFF',
      'editorIndentGuide.background1': '#E2E8F0',
      'editorIndentGuide.activeBackground1': '#CBD5E1',
      'editorBracketMatch.background': '#E0E7FF88',
      'editorBracketMatch.border': '#6366F1',
      'editor.findMatchBackground': '#FDE68A88',
      'editor.findMatchHighlightBackground': '#FEF3C788',
    },
  })

  monaco.editor.defineTheme('latte-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment.typst', foreground: '8B949E', fontStyle: 'italic' },
      { token: 'string.typst', foreground: 'F0B429' },
      { token: 'string.raw.typst', foreground: '5EEAD4' },
      { token: 'string.link.typst', foreground: '93C5FD', fontStyle: 'underline' },
      { token: 'string.escape.typst', foreground: 'FBBF24' },
      { token: 'string.math.typst', foreground: 'C4B5FD' },
      { token: 'keyword.typst', foreground: 'A5B4FC', fontStyle: 'bold' },
      { token: 'keyword.math.typst', foreground: 'C4B5FD' },
      { token: 'constant.typst', foreground: '5EEAD4' },
      { token: 'number.typst', foreground: '86EFAC' },
      { token: 'function.typst', foreground: '93C5FD' },
      { token: 'identifier.typst', foreground: 'E5E7EB' },
      { token: 'identifier.math.typst', foreground: 'DDD6FE' },
      { token: 'operator.typst', foreground: 'CBD5E1' },
      { token: 'operator.math.typst', foreground: 'C4B5FD' },
      { token: 'heading.typst', foreground: 'C7D2FE', fontStyle: 'bold' },
      { token: 'strong.typst', fontStyle: 'bold' },
      { token: 'emphasis.typst', fontStyle: 'italic' },
      { token: 'list.typst', foreground: 'A5B4FC' },
      { token: 'tag.typst', foreground: 'FBBF24' },
      { token: 'variable.typst', foreground: 'FCD34D' },
      { token: 'delimiter.hash.typst', foreground: 'A5B4FC', fontStyle: 'bold' },
      { token: 'delimiter.math.typst', foreground: 'C4B5FD', fontStyle: 'bold' },
      { token: 'delimiter.bracket.typst', foreground: '94A3B8' },
    ],
    colors: {
      'editor.background': '#1C1F26',
      'editor.foreground': '#E5E7EB',
      'editor.lineHighlightBackground': '#252A33',
      'editorLineNumber.foreground': '#6B7280',
      'editorLineNumber.activeForeground': '#D1D5DB',
      'editor.selectionBackground': '#3730A3AA',
      'editor.inactiveSelectionBackground': '#312E8188',
      'editorCursor.foreground': '#A5B4FC',
      'editorWidget.background': '#1C1F26',
      'editorGutter.background': '#1C1F26',
      'editorIndentGuide.background1': '#2D3340',
      'editorIndentGuide.activeBackground1': '#3F4A5A',
      'editorBracketMatch.background': '#4338CA55',
      'editorBracketMatch.border': '#A5B4FC',
      'editor.findMatchBackground': '#854D0E88',
      'editor.findMatchHighlightBackground': '#713F1288',
    },
  })
}
