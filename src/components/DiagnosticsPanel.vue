<template>
  <div class="diagnostics-panel">
    <div v-if="diagnostics.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" class="empty-icon">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
      </svg>
      <p>No errors or warnings</p>
    </div>
    <div v-else class="diagnostics-list">
      <div
        v-for="(diagnostic, index) in diagnostics"
        :key="index"
        :class="['diagnostic-item', `diagnostic-${diagnostic.severity}`]"
        @click="$emit('diagnostic-clicked', diagnostic)"
      >
        <div class="diagnostic-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="severity-icon">
            <path
              v-if="diagnostic.severity === 'error'"
              d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"
            />
            <path
              v-if="diagnostic.severity === 'error'"
              d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"
            />
            <path
              v-if="diagnostic.severity === 'warning'"
              d="M8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
            />
          </svg>
          <span class="severity-label">{{ diagnostic.severity.toUpperCase() }}</span>
          <span v-if="diagnostic.span" class="location">
            Line {{ diagnostic.span.line }}, Col {{ diagnostic.span.column }}
          </span>
        </div>
        <div class="diagnostic-message">{{ diagnostic.message }}</div>
        <div v-if="diagnostic.hints && diagnostic.hints.length > 0" class="diagnostic-hints">
          <div v-for="(hint, hintIndex) in diagnostic.hints" :key="hintIndex" class="hint">
            💡 {{ hint }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiagnosticInfo } from '../types';

defineProps<{
  diagnostics: DiagnosticInfo[];
}>();

defineEmits<{
  'diagnostic-clicked': [diagnostic: DiagnosticInfo];
}>();
</script>

<style scoped>
.diagnostics-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #858585;
}

.empty-icon {
  opacity: 0.5;
}

.diagnostics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diagnostic-item {
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.diagnostic-item:hover {
  background: #2a2d2e;
}

.diagnostic-error {
  border-left: 3px solid #f48771;
  background: #3a1d1d;
}

.diagnostic-warning {
  border-left: 3px solid #dcdcaa;
  background: #3a3a1d;
}

.diagnostic-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.severity-icon {
  flex-shrink: 0;
}

.diagnostic-error .severity-icon {
  color: #f48771;
}

.diagnostic-warning .severity-icon {
  color: #dcdcaa;
}

.severity-label {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.location {
  margin-left: auto;
  font-size: 11px;
  color: #858585;
}

.diagnostic-message {
  color: #cccccc;
  font-size: 13px;
  margin-bottom: 8px;
}

.diagnostic-hints {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3e3e42;
}

.hint {
  font-size: 12px;
  color: #858585;
  margin-top: 4px;
}
</style>
