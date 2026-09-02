<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import HardBreak from '@tiptap/extension-hard-break'
import Placeholder from '@tiptap/extension-placeholder'
import { UndoRedo } from '@tiptap/extensions'
import { Extension } from '@tiptap/core'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import EditorToolbar from '@/components/EditorToolbar.vue'
import TypstAssistPopup from '@/components/TypstAssistPopup.vue'
import ImagePickerDialog from '@/components/ImagePickerDialog.vue'
import type { DiagnosticInfo } from '@/types'
import { TypstHighlight } from '@/lib/typst-highlight'
import {
  filterTypstAssistItems,
  getHashAssistContext,
  isInsideTypstCode,
  isInsideTypstMath,
  lookupTypstAssistItem,
  parseUserTypstVariables,
  type AssistItem,
} from '@/lib/typst-catalog'
import {
  applyTypstFormat,
  insertTypstCatalogSnippet,
  insertTypstFigure,
  insertTypstVariable,
  isTypstFormatActive,
  sourceOffsetToPmPos,
  type EditorToolbarCommand,
} from '@/lib/typst-source-format'
import { cn } from '@/lib/utils'

const props = defineProps<{
  content: string
  fontSize?: number
  colorMode?: 'light' | 'dark'
  diagnostics?: DiagnosticInfo[]
  workspacePath?: string | null
}>()

const emit = defineEmits<{
  'content-changed': [content: string]
  'update:editorMode': [mode: 'code' | 'text']
}>()

const applyingExternal = ref(false)
const localSource = ref(props.content)
const toolbarTick = ref(0)
const hostRef = ref<HTMLElement | null>(null)

type AssistUi = {
  items: AssistItem[]
  activeIndex: number
  help: AssistItem | null
  top: number
  left: number
  inCall: boolean
  hashFrom: number
  replaceTo: number
  needsHash: boolean
}

const assist = ref<AssistUi | null>(null)
const imagePickerOpen = ref(false)

const sourceToDoc = (source: string) => {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  return {
    type: 'doc' as const,
    content: lines.map((line) => ({
      type: 'paragraph' as const,
      content: line.length ? [{ type: 'text' as const, text: line }] : [],
    })),
  }
}

const positionAssist = (caret: number) => {
  const view = editor.value?.view
  const host = hostRef.value
  if (!view || !host) return { top: 8, left: 8 }
  const coords = view.coordsAtPos(caret)
  const box = host.getBoundingClientRect()
  const top = coords.bottom - box.top + host.scrollTop + 6
  const left = Math.max(8, Math.min(coords.left - box.left + host.scrollLeft, host.clientWidth - 320))
  return { top, left }
}

const refreshAssist = (force = false) => {
  const current = editor.value
  if (!current) {
    assist.value = null
    return
  }
  const caret = current.state.selection.from
  const textBefore = current.state.doc.textBetween(0, caret, '\n')
  const source = current.getText({ blockSeparator: '\n' })
  const ctx = getHashAssistContext(textBefore, textBefore.length)

  if (!ctx) {
    if (!force) {
      assist.value = null
      return
    }
    const inCode = isInsideTypstCode(textBefore)
    const inMath = isInsideTypstMath(textBefore)
    const items = filterTypstAssistItems('', source, { variablesOnly: inCode || inMath })
    if (items.length === 0) {
      assist.value = null
      return
    }
    const { top, left } = positionAssist(caret)
    assist.value = {
      items,
      activeIndex: 0,
      help: items[0] ?? null,
      top,
      left,
      inCall: false,
      hashFrom: caret,
      replaceTo: caret,
      needsHash: !inCode,
    }
    return
  }

  const items =
    ctx.inCall && ctx.needsHash
      ? []
      : filterTypstAssistItems(ctx.query, source, { variablesOnly: !ctx.needsHash })
  const help = lookupTypstAssistItem(ctx.commandName, source) ?? items[0] ?? null
  if (!ctx.inCall && items.length === 0 && !force) {
    assist.value = null
    return
  }
  if (ctx.inCall && !help && items.length === 0 && !force) {
    assist.value = null
    return
  }
  const { top, left } = positionAssist(caret)
  assist.value = {
    items,
    activeIndex: 0,
    help,
    top,
    left,
    inCall: ctx.inCall && items.length === 0,
    hashFrom: sourceOffsetToPmPos(current.state.doc, ctx.hashFrom),
    replaceTo: caret,
    needsHash: ctx.needsHash,
  }
}

const applyAssistItem = (item: AssistItem) => {
  const current = editor.value
  const state = assist.value
  if (!current || !state) return
  const hash =
    state.needsHash && !('hash' in item && item.hash === false)
  insertTypstCatalogSnippet(current, item.insert, state.hashFrom, state.replaceTo, { hash })
  assist.value = null
}

const TypstSourceKeys = Extension.create({
  name: 'typstSourceKeys',
  addKeyboardShortcuts() {
    return {
      'Mod-b': () => {
        applyTypstFormat(this.editor, 'bold')
        return true
      },
      'Mod-i': () => {
        applyTypstFormat(this.editor, 'italic')
        return true
      },
      'Mod-Space': () => {
        refreshAssist(true)
        return true
      },
    }
  },
})

const editor = useEditor({
  extensions: [
    Document,
    Paragraph,
    Text,
    HardBreak,
    UndoRedo,
    TypstSourceKeys,
    TypstHighlight.configure({ diagnostics: props.diagnostics ?? [] }),
    Placeholder.configure({
      placeholder: 'Write Typst markup…  Type # for commands',
    }),
  ],
  content: sourceToDoc(props.content),
  editorProps: {
    attributes: {
      class: 'typst-source-editor focus:outline-none',
      spellcheck: 'false',
    },
    handleKeyDown: (_view, event) => {
      const state = assist.value
      if (!state) return false
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const max = Math.max(0, state.items.length - 1)
        assist.value = { ...state, activeIndex: Math.min(max, state.activeIndex + 1) }
        return true
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        assist.value = { ...state, activeIndex: Math.max(0, state.activeIndex - 1) }
        return true
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        assist.value = null
        return true
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && state.items[state.activeIndex]) {
        event.preventDefault()
        applyAssistItem(state.items[state.activeIndex])
        return true
      }
      return false
    },
  },
  onTransaction: () => {
    toolbarTick.value += 1
    void nextTick(() => refreshAssist())
  },
  onUpdate: ({ editor: current }) => {
    if (applyingExternal.value) return
    const next = current.getText({ blockSeparator: '\n' })
    localSource.value = next
    emit('content-changed', next)
  },
  onBlur: () => {
    window.setTimeout(() => {
      assist.value = null
    }, 150)
  },
})


watch(
  () => props.content,
  (source) => {
    if (!editor.value || source === localSource.value) return
    applyingExternal.value = true
    editor.value.commands.setContent(sourceToDoc(source), { emitUpdate: false })
    applyingExternal.value = false
    localSource.value = source
  }
)

watch(
  () => props.fontSize,
  (size) => {
    if (!size) return
    const el = editor.value?.view.dom as HTMLElement | undefined
    if (el) el.style.fontSize = `${size}px`
  },
  { immediate: true }
)

watch(
  () => [editor.value, props.diagnostics] as const,
  ([current, diagnostics]) => {
    current?.commands.setTypstDiagnostics(diagnostics ?? [])
  },
  { deep: true }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

const goToLine = (line: number, column = 1) => {
  if (!editor.value) return
  const doc = editor.value.state.doc
  const target = Math.max(1, Math.min(line, doc.childCount))
  let pos = 0
  for (let i = 0; i < target - 1; i += 1) {
    pos += doc.child(i).nodeSize
  }
  const paragraph = doc.child(target - 1)
  const offset = Math.min(Math.max(column - 1, 0), paragraph.content.size)
  const selectionPos = pos + 1 + offset
  editor.value.chain().focus().setTextSelection(selectionPos).run()
}

const canUndo = () => {
  void toolbarTick.value
  return editor.value?.can().undo() ?? false
}
const canRedo = () => {
  void toolbarTick.value
  return editor.value?.can().redo() ?? false
}
const isActive = (command: EditorToolbarCommand) => {
  void toolbarTick.value
  return editor.value ? isTypstFormatActive(editor.value, command) : false
}

const onCommand = (command: EditorToolbarCommand) => {
  if (!editor.value) return
  if (command === 'figure') {
    imagePickerOpen.value = true
    return
  }
  applyTypstFormat(editor.value, command)
}

const onImagePicked = (relativePath: string) => {
  if (!editor.value) return
  insertTypstFigure(editor.value, relativePath)
}

const onInsertVariable = (name: string) => {
  if (!editor.value) return
  insertTypstVariable(editor.value, name)
}

const documentVariables = computed(() => {
  void toolbarTick.value
  const source = editor.value?.getText({ blockSeparator: '\n' }) ?? props.content
  return parseUserTypstVariables(source)
})

const jumpDiagnostic = () => {
  const span = props.diagnostics?.[0]?.span
  if (span?.line) goToLine(span.line, span.column)
}

defineExpose({ goToLine })
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div
      :class="
        cn(
          'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-card',
          colorMode === 'dark' && 'dark'
        )
      "
    >
      <EditorToolbar
        editor-mode="code"
        :can-undo="canUndo()"
        :can-redo="canRedo()"
        :is-active="isActive"
        :diagnostic-count="diagnostics?.length ?? 0"
        :variables="documentVariables"
        @update:editor-mode="emit('update:editorMode', $event)"
        @undo="editor?.chain().focus().undo().run()"
        @redo="editor?.chain().focus().redo().run()"
        @command="onCommand"
        @insert-variable="onInsertVariable"
        @jump-diagnostic="jumpDiagnostic"
      />

      <ImagePickerDialog
        v-model:open="imagePickerOpen"
        :workspace-path="workspacePath ?? null"
        @select="onImagePicked"
      />

      <div
        ref="hostRef"
        class="relative min-h-0 flex-1 overflow-auto"
      >
        <EditorContent :editor="editor" />
        <TypstAssistPopup
          v-if="assist"
          :items="assist.items"
          :active-index="assist.activeIndex"
          :help="assist.help"
          :top="assist.top"
          :left="assist.left"
          :in-call="assist.inCall"
          :needs-hash="assist.needsHash"
          @hover="assist && (assist.activeIndex = $event)"
          @select="assist && applyAssistItem(assist.items[$event])"
        />
      </div>
    </div>
  </TooltipProvider>
</template>

<style>
.typst-source-editor {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 14px;
  line-height: 1.6;
  min-height: 100%;
  padding: 1rem 1.25rem 2rem;
  white-space: pre-wrap;
  tab-size: 2;
  color: var(--foreground);
}

.typst-source-editor p {
  margin: 0;
  min-height: 1.6em;
}

.typst-source-editor .ProseMirror-focused {
  outline: none;
}

.typst-source-editor p.is-editor-empty:first-child::before {
  color: var(--muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.typst-token-comment {
  color: #6b7280;
  font-style: italic;
}
.typst-token-heading {
  color: #1e3a8a;
  font-weight: 700;
}
.typst-token-keyword,
.typst-token-hash {
  color: #4f46e5;
  font-weight: 650;
}
.typst-token-function {
  color: #1d4ed8;
}
.typst-token-constant,
.typst-token-number {
  color: #0f766e;
}
.typst-token-string,
.typst-token-label {
  color: #b45309;
}
.typst-token-link {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.typst-token-math,
.typst-token-escape {
  color: #7c3aed;
}
.typst-token-strong {
  font-weight: 700;
}
.typst-token-emphasis {
  font-style: italic;
}
.typst-token-operator,
.typst-token-punctuation {
  color: #475569;
}

.typst-diag-error {
  background: rgb(220 38 38 / 10%);
  border-radius: 2px;
  text-decoration: underline wavy #dc2626;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}

.typst-diag-warning {
  background: rgb(217 119 6 / 10%);
  border-radius: 2px;
  text-decoration: underline wavy #d97706;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}

.dark .typst-token-comment {
  color: #8b949e;
}
.dark .typst-token-heading {
  color: #c7d2fe;
}
.dark .typst-token-keyword,
.dark .typst-token-hash {
  color: #a5b4fc;
}
.dark .typst-token-function {
  color: #93c5fd;
}
.dark .typst-token-constant,
.dark .typst-token-number {
  color: #5eead4;
}
.dark .typst-token-string,
.dark .typst-token-label {
  color: #f0b429;
}
.dark .typst-token-link {
  color: #93c5fd;
}
.dark .typst-token-math,
.dark .typst-token-escape {
  color: #c4b5fd;
}
.dark .typst-token-operator,
.dark .typst-token-punctuation {
  color: #cbd5e1;
}
.dark .typst-diag-error {
  background: rgb(248 113 113 / 16%);
  text-decoration-color: #f87171;
}
.dark .typst-diag-warning {
  background: rgb(251 191 36 / 16%);
  text-decoration-color: #fbbf24;
}
</style>
