<template>
  <div class="preview-panel">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Compiling...</p>
    </div>
    <div v-else-if="pdfData" class="pdf-viewer">
      <iframe :src="pdfUrl ?? undefined" frameborder="0" class="pdf-iframe" title="PDF Preview"></iframe>
    </div>
    <div v-else-if="error" class="error-state">
      <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" class="error-icon">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
        <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
      </svg>
      <p class="error-title">Compilation failed</p>
      <pre class="error-message">{{ error }}</pre>
    </div>
    <div v-else class="empty-state">
      <svg width="64" height="64" viewBox="0 0 16 16" fill="currentColor" class="empty-icon">
        <path d="M14 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5v4.5a.5.5 0 0 0 .5.5H14z" />
        <path d="M9.5 0H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v3h3L9.5 1z" />
      </svg>
      <p>No preview available</p>
      <p class="hint">Compile your Typst document to see the preview</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps<{
  pdfData: Uint8Array | null;
  isLoading: boolean;
  error?: string | null;
}>();

const pdfUrl = ref<string | null>(null);
let currentBlobUrl: string | null = null;

watch(
  () => props.pdfData,
  (newData) => {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }

    if (newData && newData.length > 0) {
      try {
        const blob = new Blob([newData as BlobPart], { type: 'application/pdf' });
        currentBlobUrl = URL.createObjectURL(blob);
        pdfUrl.value = currentBlobUrl;
      } catch (err) {
        console.error('Failed to create blob URL:', err);
        pdfUrl.value = null;
      }
    } else {
      pdfUrl.value = null;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
  }
});
</script>

<style scoped>
.preview-panel {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1e1e;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #cccccc;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #3e3e42;
  border-top-color: #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pdf-viewer {
  width: 100%;
  height: 100%;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
}

.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: #858585;
  text-align: center;
  max-width: 100%;
}

.empty-icon,
.error-icon {
  opacity: 0.5;
}

.error-icon {
  color: #f48771;
  opacity: 1;
}

.error-title {
  color: #f48771;
  font-weight: 600;
}

.error-message {
  max-width: 90%;
  overflow-x: auto;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: #cccccc;
  background: #2d2d30;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #3e3e42;
}

.hint {
  font-size: 12px;
  color: #6a6a6a;
}
</style>
