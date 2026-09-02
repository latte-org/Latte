<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { TooltipProvider } from '@/components/ui/tooltip'
import EditorToolbar from '@/components/EditorToolbar.vue'
import ImagePickerDialog from '@/components/ImagePickerDialog.vue'
import {
  applyRichTextFormat,
  isRichTextFormatActive,
  typstFigureSource,
  type EditorToolbarCommand,
} from '@/lib/typst-source-format'
import { tiptapToTypst, typstToTiptap } from '@/lib/typst-subset'
import { parseUserTypstVariables } from '@/lib/typst-catalog'

const props = defineProps<{
  content: string
  workspacePath?: string | null
}>()

const emit = defineEmits<{
  'content-changed': [content: string]
  'update:editorMode': [mode: 'code' | 'text']
}>()

const preamble = ref('')
const applyingExternal = ref(false)
const localSource = ref(props.content)
const toolbarTick = ref(0)
const imagePickerOpen = ref(false)

const parsed = typstToTiptap(props.content)
preamble.value = parsed.preamble

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: {
        HTMLAttributes: {
          class:
            'raw-typst-block rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 font-mono text-[13px] leading-relaxed',
        },
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-700 underline underline-offset-2',
      },
    }),
    Placeholder.configure({
      placeholder: 'Start writing like a document…',
    }),
  ],
  content: parsed.doc,
  editorProps: {
    attributes: {
      class: 'typst-doc-editor focus:outline-none',
    },
  },
  onTransaction: () => {
    toolbarTick.value += 1
  },
  onUpdate: ({ editor: current }) => {
    if (applyingExternal.value) return
    const next = tiptapToTypst(preamble.value, current.getJSON())
    localSource.value = next
    emit('content-changed', next)
  },
})

const syncFromTypst = (source: string) => {
  if (!editor.value) return
  const result = typstToTiptap(source)
  preamble.value = result.preamble
  applyingExternal.value = true
  editor.value.commands.setContent(result.doc, { emitUpdate: false })
  applyingExternal.value = false
  localSource.value = source
}

watch(
  () => props.content,
  (source) => {
    if (source === localSource.value) return
    syncFromTypst(source)
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

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
  return editor.value ? isRichTextFormatActive(editor.value, command) : false
}

const onCommand = (command: EditorToolbarCommand) => {
  if (!editor.value) return
  if (command === 'figure') {
    imagePickerOpen.value = true
    return
  }
  applyRichTextFormat(editor.value, command)
}

const onImagePicked = (relativePath: string) => {
  if (!editor.value) return
  editor.value.chain().focus().setCodeBlock().insertContent(typstFigureSource(relativePath)).run()
}

const onInsertVariable = (name: string) => {
  if (!editor.value) return
  editor.value.chain().focus().setCodeBlock().insertContent(`#${name}`).run()
}

const documentVariables = computed(() => parseUserTypstVariables(localSource.value))
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#ebe7e0]">
      <EditorToolbar
        editor-mode="text"
        :can-undo="canUndo()"
        :can-redo="canRedo()"
        :is-active="isActive"
        :variables="documentVariables"
        @update:editor-mode="emit('update:editorMode', $event)"
        @undo="editor?.chain().focus().undo().run()"
        @redo="editor?.chain().focus().redo().run()"
        @command="onCommand"
        @insert-variable="onInsertVariable"
      />

      <ImagePickerDialog
        v-model:open="imagePickerOpen"
        :workspace-path="workspacePath ?? null"
        @select="onImagePicked"
      />

      <div
        v-if="preamble.trim()"
        class="border-b border-border/60 bg-card/80 px-4 py-2"
      >
        <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Preamble (read-only in Text mode)
        </p>
        <pre class="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">{{ preamble }}</pre>
      </div>

      <div class="min-h-0 flex-1 overflow-auto">
        <div class="flex justify-center px-4 py-5">
          <div class="paper-sheet w-full max-w-[42rem]">
            <EditorContent :editor="editor" />
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<style>
.paper-sheet {
  background: #fff;
  color: #171717;
  border-radius: 2px;
  box-shadow:
    0 1px 2px rgb(0 0 0 / 5%),
    0 10px 28px rgb(0 0 0 / 8%);
  min-height: calc(100% - 0.5rem);
  padding: 2rem 2.25rem 3rem;
}

.typst-doc-editor {
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
  font-size: 16px;
  line-height: 1.65;
  color: #171717;
  min-height: 18rem;
}

.typst-doc-editor h1 {
  font-size: 1.85rem;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.01em;
  margin: 1.1em 0 0.45em;
}

.typst-doc-editor h2 {
  font-size: 1.4rem;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.01em;
  margin: 1em 0 0.4em;
}

.typst-doc-editor h3 {
  font-size: 1.15rem;
  font-weight: 650;
  margin: 0.9em 0 0.35em;
}

.typst-doc-editor p {
  margin: 0.65em 0;
}

.typst-doc-editor ul {
  list-style: disc;
  padding-left: 1.35rem;
  margin: 0.65em 0;
}

.typst-doc-editor ol {
  list-style: decimal;
  padding-left: 1.35rem;
  margin: 0.65em 0;
}

.typst-doc-editor hr {
  border: none;
  border-top: 1px solid rgb(0 0 0 / 12%);
  margin: 1.4em 0;
}

.typst-doc-editor a {
  color: #1d4ed8;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.typst-doc-editor code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: rgb(0 0 0 / 5%);
  border-radius: 0.35rem;
  padding: 0.1em 0.35em;
}

.typst-doc-editor pre {
  margin: 0.85em 0;
}

.typst-doc-editor .ProseMirror-focused {
  outline: none;
}

.typst-doc-editor p.is-editor-empty:first-child::before {
  color: #98a2b3;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.dark .paper-sheet {
  background: #141414;
  color: #f5f5f5;
  box-shadow:
    0 1px 2px rgb(0 0 0 / 35%),
    0 10px 28px rgb(0 0 0 / 35%);
}

.dark .typst-doc-editor {
  color: #f5f5f5;
}

.dark .typst-doc-editor a {
  color: #93c5fd;
}

.dark .typst-doc-editor code {
  background: rgb(255 255 255 / 8%);
}

.dark .typst-doc-editor hr {
  border-top-color: rgb(255 255 255 / 14%);
}
</style>
