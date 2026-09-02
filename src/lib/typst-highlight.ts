import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { DiagnosticInfo } from '@/types'
import { tokenizeTypst } from '@/lib/typst-syntax'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    typstHighlight: {
      setTypstDiagnostics: (diagnostics: DiagnosticInfo[]) => ReturnType
    }
  }
}

const pluginKey = new PluginKey<DecorationSet>('typstHighlight')

function sourceOffsetToPos(doc: PMNode, offset: number) {
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

function lineColToPos(doc: PMNode, line: number, column: number) {
  if (doc.childCount === 0) return 1
  const target = Math.max(1, Math.min(line, doc.childCount))
  let pos = 0
  for (let i = 0; i < target - 1; i += 1) {
    pos += doc.child(i).nodeSize
  }
  const paragraph = doc.child(target - 1)
  const offset = Math.min(Math.max(column - 1, 0), paragraph.content.size)
  return pos + 1 + offset
}

function clampRange(doc: PMNode, from: number, to: number) {
  const max = doc.content.size
  const start = Math.max(1, Math.min(from, max))
  let end = Math.max(start, Math.min(to, max))
  if (end === start && end < max) end += 1
  return end > start ? { from: start, to: end } : null
}

function buildDecorations(doc: PMNode, diagnostics: DiagnosticInfo[]) {
  const decorations: Decoration[] = []
  const source = doc.textBetween(0, doc.content.size, '\n')

  for (const token of tokenizeTypst(source)) {
    const range = clampRange(
      doc,
      sourceOffsetToPos(doc, token.from),
      sourceOffsetToPos(doc, token.to)
    )
    if (!range) continue
    decorations.push(
      Decoration.inline(range.from, range.to, {
        class: `typst-token typst-token-${token.type}`,
      })
    )
  }

  for (const diagnostic of diagnostics) {
    const span = diagnostic.span
    let from: number
    let to: number
    if (span) {
      from = lineColToPos(doc, span.line, span.column)
      to = lineColToPos(doc, span.end_line || span.line, span.end_column || span.column)
    } else {
      from = 1
      to = Math.min(2, doc.content.size)
    }
    const range = clampRange(doc, from, to)
    if (!range) continue
    const severity = diagnostic.severity === 'warning' ? 'warning' : 'error'
    decorations.push(
      Decoration.inline(range.from, range.to, {
        class: `typst-diag typst-diag-${severity}`,
        title: diagnostic.message,
      })
    )
  }

  return DecorationSet.create(doc, decorations)
}

export const TypstHighlight = Extension.create<{ diagnostics: DiagnosticInfo[] }>({
  name: 'typstHighlight',

  addOptions() {
    return { diagnostics: [] }
  },

  addStorage() {
    return {
      diagnostics: this.options.diagnostics as DiagnosticInfo[],
    }
  },

  addCommands() {
    return {
      setTypstDiagnostics:
        (diagnostics: DiagnosticInfo[]) =>
        ({ tr, dispatch }) => {
          this.storage.diagnostics = diagnostics
          if (dispatch) {
            dispatch(
              tr.setMeta('typstDiagnostics', diagnostics).setMeta('addToHistory', false)
            )
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: (_, state) => buildDecorations(state.doc, extension.storage.diagnostics),
          apply(tr, decorations, _oldState, newState) {
            if (tr.docChanged || tr.getMeta('typstDiagnostics')) {
              return buildDecorations(newState.doc, extension.storage.diagnostics)
            }
            return decorations.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
