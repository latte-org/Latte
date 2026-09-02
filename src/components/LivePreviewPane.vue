<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { invoke } from '@/lib/backend'

export type PreviewMode = 'html' | 'pages'

const props = defineProps<{
  source: string
  rootDir?: string | null
  mode: PreviewMode
  debounceMs?: number
}>()

const html = ref('')
const pdfUrl = ref<string | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const htmlFrameKey = ref(0)
let timer: ReturnType<typeof setTimeout> | null = null
let requestId = 0
let pdfObjectUrl: string | null = null

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function formatError(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function revokePdfUrl() {
  if (pdfObjectUrl) {
    URL.revokeObjectURL(pdfObjectUrl)
    pdfObjectUrl = null
  }
  pdfUrl.value = null
}

function asPdfBytes(data: unknown) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (Array.isArray(data)) return Uint8Array.from(data)
  if (typeof data === 'string') {
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  throw new Error('Unexpected PDF response from compiler')
}

function errorFrame(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui;padding:1.5rem;color:#b42318;">
  <strong>Preview error</strong>
  <pre style="white-space:pre-wrap;margin-top:0.75rem;font-size:12px;">${escapeHtml(message)}</pre>
</body></html>`
}

function placeholderFrame(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui;padding:1.5rem;color:#667085;">${escapeHtml(message)}</body></html>`
}

const PREVIEW_CSS = `<style>
  html, body { margin: 0; padding: 0; background: #f3f1ec; color: #171717; }
  body {
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    font-size: 16px;
    line-height: 1.65;
    padding: 1.5rem;
  }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.35em 0 0.45em; font-weight: 650; }
  h1 { font-size: 1.85rem; }
  h2 { font-size: 1.4rem; }
  h3 { font-size: 1.15rem; }
  p { margin: 0.7em 0; }
  ul, ol { padding-left: 1.35rem; }
  svg { max-width: 100%; height: auto; }
</style>`

function prepareHtmlPreview(documentHtml: string) {
  const withoutScripts = documentHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
  if (withoutScripts.includes('</head>')) {
    return withoutScripts.replace('</head>', `${PREVIEW_CSS}</head>`)
  }
  return withoutScripts
}

const htmlSrcdoc = computed(() => {
  if (error.value) return errorFrame(error.value)
  if (!html.value) {
    return placeholderFrame(loading.value ? 'Rendering…' : 'Start writing to see a live preview.')
  }
  return prepareHtmlPreview(html.value)
})

const pdfFrameSrc = computed(() =>
  pdfUrl.value
    ? `${pdfUrl.value}#toolbar=0&navpanes=0&scrollbar=1&view=FitH&zoom=page-width`
    : undefined
)

const writeHtmlFrame = () => {
  if (props.mode !== 'html') return
  const frame = iframeRef.value
  if (!frame) return
  const documentHtml = htmlSrcdoc.value
  try {
    const doc = frame.contentDocument
    if (doc) {
      doc.open()
      doc.write(documentHtml)
      doc.close()
      return
    }
  } catch {
    // WebView may block contentDocument; srcdoc is the fallback.
  }
  frame.srcdoc = documentHtml
}

const compile = async (source: string, mode: PreviewMode) => {
  const id = ++requestId
  loading.value = true
  error.value = null
  try {
    if (mode === 'html') {
      const result = await invoke<string>('compile_typst_string_to_html', {
        source,
        rootDir: props.rootDir ?? null,
      })
      if (id !== requestId) return
      html.value = result
      htmlFrameKey.value += 1
      error.value = null
      await nextTick()
      writeHtmlFrame()
    } else {
      try {
        const previewPath = await invoke<string>('compile_typst_string_to_pdf_preview', {
          source,
          rootDir: props.rootDir ?? null,
        })
        if (id !== requestId) return
        revokePdfUrl()
        pdfUrl.value = convertFileSrc(previewPath)
      } catch {
        const result = await invoke<unknown>('compile_typst_string_to_pdf', {
          source,
          rootDir: props.rootDir ?? null,
        })
        if (id !== requestId) return
        const bytes = asPdfBytes(result)
        revokePdfUrl()
        pdfObjectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        pdfUrl.value = pdfObjectUrl
      }
      if (id !== requestId) return
      error.value = null
    }
  } catch (err) {
    if (id !== requestId) return
    if (mode === 'pages') revokePdfUrl()
    error.value = formatError(err)
    console.error('Preview compile failed:', err)
    if (mode === 'html') {
      await nextTick()
      writeHtmlFrame()
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(htmlSrcdoc, () => {
  if (props.mode === 'html') writeHtmlFrame()
})

watch(iframeRef, (frame) => {
  if (frame && props.mode === 'html') writeHtmlFrame()
})

watch(
  () => [props.source, props.rootDir, props.mode] as const,
  ([source, , mode]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void compile(source || '= \n', mode)
    }, props.debounceMs ?? 450)
  },
  { immediate: true }
)

onMounted(() => {
  writeHtmlFrame()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  revokePdfUrl()
})
</script>

<template>
  <div class="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#ebe7e0]">
    <iframe
      v-if="mode === 'html'"
      :key="htmlFrameKey"
      ref="iframeRef"
      class="block h-full min-h-0 w-full flex-1 border-0 bg-[#f3f1ec]"
      title="HTML preview"
      :srcdoc="htmlSrcdoc"
    />

    <template v-else>
      <embed
        v-if="pdfFrameSrc && !error"
        :key="pdfFrameSrc"
        class="block h-full min-h-0 w-full flex-1 border-0 bg-[#ebe7e0]"
        type="application/pdf"
        :src="pdfFrameSrc"
      />
      <p
        v-else-if="error"
        class="m-3 whitespace-pre-wrap rounded-lg bg-white/80 p-3 text-sm text-[#b42318]"
      >
        {{ error }}
      </p>
      <p
        v-else
        class="p-4 text-sm text-[#667085]"
      >
        {{ loading ? 'Compiling PDF preview…' : 'Start writing to see paged output.' }}
      </p>
    </template>
  </div>
</template>
