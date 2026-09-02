<template>
  <div class="file-tabs">
    <div
      v-for="(tab, index) in tabs"
      :key="tab.path ?? `untitled-${index}`"
      :class="['tab', { active: index === activeIndex }]"
      @click="$emit('tab-selected', index)"
    >
      <span class="tab-label">
        {{ tab.label }}<span v-if="tab.isDirty" class="dirty">•</span>
      </span>
      <button
        v-if="tabs.length > 1"
        class="close-tab"
        title="Close tab"
        @click.stop="$emit('tab-closed', index)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OpenTab } from '../types';

defineProps<{
  tabs: OpenTab[];
  activeIndex: number;
}>();

defineEmits<{
  'tab-selected': [index: number];
  'tab-closed': [index: number];
}>();
</script>

<style scoped>
.file-tabs {
  display: flex;
  align-items: stretch;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  overflow-x: auto;
  min-height: 36px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-right: 1px solid #3e3e42;
  color: #858585;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  max-width: 200px;
}

.tab:hover {
  background: #323233;
  color: #cccccc;
}

.tab.active {
  background: #1e1e1e;
  color: #ffffff;
  border-bottom: 2px solid #007acc;
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.dirty {
  color: #dcdcaa;
  margin-left: 2px;
}

.close-tab {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.7;
}

.close-tab:hover {
  opacity: 1;
  color: #f48771;
}
</style>
