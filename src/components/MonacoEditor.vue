<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import loader from '@monaco-editor/loader'
import type { DiagnosticInfo } from '@/types'
import { defineTypstThemes, registerTypstLanguage } from '@/lib/typst-language'

const props = defineProps<{
  filePath: string
  content: string
  diagnostics?: DiagnosticInfo[]
  colorMode?: 'light' | 'dark'
  fontSize?: number
  showLineNumbers?: boolean
}>()

const emit = defineEmits<{
  'content-changed': [content: string]
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editor: any = null
let monaco: any = null
let applyingExternalContent = false

const monacoTheme = () =>
  props.colorMode === 'dark' ? 'latte-dark' : 'latte-light'

const updateMarkers = (diagnostics: DiagnosticInfo[] = []) => {
  if (!editor || !monaco) return
  const model = editor.getModel()
  if (!model) return

  const markers = diagnostics.map((diagnostic) => {
    const startLine = Math.max(1, diagnostic.span?.line ?? 1)
    const startColumn = Math.max(1, diagnostic.span?.column ?? 1)
    const endLine = Math.max(startLine, diagnostic.span?.end_line ?? startLine)
    let endColumn = diagnostic.span?.end_column ?? startColumn + 1
    if (endLine === startLine && endColumn <= startColumn) {
      endColumn = startColumn + 1
    }

    return {
      severity:
        diagnostic.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
      message: diagnostic.message,
      startLineNumber: startLine,
      startColumn,
      endLineNumber: endLine,
      endColumn,
      source: 'typst',
    }
  })

  monaco.editor.setModelMarkers(model, 'typst', markers)
}

onMounted(async () => {
  if (!editorContainer.value) return

  try {
    const monacoInstance = await loader.init()
    monaco = monacoInstance
    registerTypstLanguage(monacoInstance)
    defineTypstThemes(monacoInstance)

    const uri = monacoInstance.Uri.parse(
      `inmemory://latte/${encodeURIComponent(props.filePath || 'untitled.typ')}`
    )
    let model = monacoInstance.editor.getModel(uri)
    if (model) {
      model.setValue(props.content)
    } else {
      model = monacoInstance.editor.createModel(props.content, 'typst', uri)
    }

    editor = monacoInstance.editor.create(editorContainer.value, {
      model,
      theme: monacoTheme(),
      automaticLayout: true,
      fontSize: props.fontSize ?? 14,
      fontFamily:
        "'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
      fontLigatures: true,
      lineHeight: Math.round((props.fontSize ?? 14) * 1.6),
      letterSpacing: 0.2,
      minimap: {
        enabled: true,
        scale: 1,
        showSlider: 'mouseover',
        renderCharacters: false,
        maxColumn: 80,
      },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wrappingIndent: 'same',
      lineNumbers: props.showLineNumbers === false ? 'off' : 'on',
      lineNumbersMinChars: 3,
      glyphMargin: true,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'mouseover',
      renderLineHighlight: 'all',
      renderWhitespace: 'selection',
      renderControlCharacters: true,
      rulers: [100],
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      autoIndent: 'full',
      formatOnPaste: true,
      formatOnType: false,
      matchBrackets: 'always',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      links: true,
      colorDecorators: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      cursorStyle: 'line',
      multiCursorModifier: 'alt',
      accessibilitySupport: 'auto',
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'multiline',
        seedSearchStringFromSelection: 'selection',
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showFunctions: true,
        showConstants: true,
        preview: true,
        insertMode: 'insert',
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      wordBasedSuggestions: 'currentDocument',
      parameterHints: { enabled: true },
      hover: { enabled: true, delay: 300 },
      contextmenu: true,
      mouseWheelZoom: true,
      dragAndDrop: true,
      emptySelectionClipboard: true,
      copyWithSyntaxHighlighting: true,
      padding: { top: 16, bottom: 16 },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        useShadows: false,
      },
      overviewRulerLanes: 3,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: false,
      fixedOverflowWidgets: true,
    })

    // Standard editor keybindings / actions
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run()
    })
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.startFindReplaceAction')?.run()
      }
    )
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyO,
      () => {
        editor.getAction('editor.action.quickOutline')?.run()
      }
    )
    editor.addCommand(
      monacoInstance.KeyMod.Alt | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.formatDocument')?.run()
      }
    )
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Slash, () => {
      editor.getAction('editor.action.commentLine')?.run()
    })
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyD,
      () => {
        editor.getAction('editor.action.addSelectionToNextFindMatch')?.run()
      }
    )

    editor.onDidChangeModelContent(() => {
      if (applyingExternalContent) return
      emit('content-changed', editor.getValue())
    })

    updateMarkers(props.diagnostics)
    editor.focus()
  } catch (error) {
    console.error('Failed to initialize Monaco Editor:', error)
  }
})

watch(
  () => props.content,
  (newContent) => {
    if (!editor) return
    if (editor.getValue() === newContent) return
    applyingExternalContent = true
    const position = editor.getPosition()
    editor.setValue(newContent)
    if (position) editor.setPosition(position)
    applyingExternalContent = false
  }
)

watch(
  () => props.filePath,
  (filePath) => {
    if (!editor || !monaco) return
    const model = editor.getModel()
    if (!model) return
    // Keep language as typst; path is informational for URI-less in-memory model
    void filePath
  }
)

watch(
  () => props.diagnostics,
  (newDiagnostics) => {
    updateMarkers(newDiagnostics ?? [])
  },
  { deep: true }
)

watch(
  () => props.colorMode,
  () => {
    if (monaco) monaco.editor.setTheme(monacoTheme())
  }
)

watch(
  () => props.fontSize,
  (size) => {
    if (!editor || !size) return
    editor.updateOptions({
      fontSize: size,
      lineHeight: Math.round(size * 1.6),
    })
  }
)

watch(
  () => props.showLineNumbers,
  (show) => {
    if (!editor) return
    editor.updateOptions({
      lineNumbers: show === false ? 'off' : 'on',
    })
  }
)

onUnmounted(() => {
  if (editor) {
    const model = editor.getModel()
    editor.dispose()
    // Dispose model only if no other editor uses it
    if (model && !model.isDisposed()) {
      model.dispose()
    }
  }
  editor = null
  monaco = null
})

const goToOffset = (offset: number) => {
  if (!editor) return
  const model = editor.getModel()
  const position = model.getPositionAt(offset)
  editor.setPosition(position)
  editor.revealPositionInCenter(position)
  editor.focus()
}

const goToLine = (line: number, column = 1) => {
  if (!editor) return
  editor.setPosition({ lineNumber: line, column })
  editor.revealPositionInCenter({ lineNumber: line, column })
  editor.focus()
}

defineExpose({ goToOffset, goToLine })
</script>

<template>
  <div
    ref="editorContainer"
    class="monaco-host h-full w-full overflow-hidden rounded-2xl"
  />
</template>

<style scoped>
.monaco-host :deep(.monaco-editor),
.monaco-host :deep(.overflow-guard) {
  border-radius: 1rem;
}
</style>
