<template>
  <div class="workspace-sidebar">
    <div class="sidebar-header">
      <h3>{{ workspaceName }}</h3>
    </div>

    <div class="sidebar-section">
      <div class="section-header">
        <span>📄 Documents</span>
        <button class="icon-btn-small" @click="refresh" title="Refresh">↻</button>
      </div>
      <div class="file-list">
        <div
          v-for="doc in documents"
          :key="doc"
          :class="['file-item', { active: doc === currentFile }]"
          @click="$emit('file-selected', doc)"
        >
          <span class="file-icon">📄</span>
          <span v-if="renamingPath !== doc" class="file-name">{{ getFileName(doc) }}</span>
          <input
            v-else
            ref="renameInputRef"
            v-model="renameValue"
            class="rename-input"
            @keydown.enter="submitRename(doc)"
            @keydown.escape="cancelRename"
            @blur="submitRename(doc)"
            @click.stop
          />
          <button class="action-btn" title="Rename file" @click.stop="startRename(doc)">✎</button>
          <button class="action-btn delete-btn" title="Delete file" @click.stop="handleDelete(doc)">
            ×
          </button>
        </div>
        <div v-if="documents.length === 0" class="empty-state">No documents</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="section-header">
        <span>📋 Templates</span>
      </div>
      <div class="file-list">
        <div
          v-for="template in templates"
          :key="template"
          class="file-item template-item"
          @click="$emit('template-selected', template)"
        >
          <span class="file-icon">📋</span>
          <span class="file-name">{{ template }}</span>
        </div>
        <div v-if="templates.length === 0" class="empty-state">No templates</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="section-header">
        <span>📦 Resources</span>
      </div>
      <div class="file-list">
        <div
          v-for="resource in resources"
          :key="resource"
          class="file-item resource-item"
          :title="resource"
        >
          <span class="file-icon">📦</span>
          <span class="file-name">{{ getFileName(resource) }}</span>
        </div>
        <div v-if="resources.length === 0" class="empty-state">No resources</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { invoke } from '../lib/backend';

const props = defineProps<{
  workspacePath: string | null;
  workspaceName: string;
  currentFile: string | null;
}>();

const emit = defineEmits<{
  'file-selected': [path: string];
  'template-selected': [name: string];
  'file-deleted': [path: string];
  'file-renamed': [oldPath: string, newPath: string];
}>();

const documents = ref<string[]>([]);
const templates = ref<string[]>([]);
const resources = ref<string[]>([]);
const renamingPath = ref<string | null>(null);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

const getFileName = (path: string) => {
  return path.split(/[/\\]/).pop() || path;
};

const getDirectory = (path: string) => {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join(path.includes('\\') ? '\\' : '/');
};

const loadWorkspaceData = async () => {
  if (!props.workspacePath) return;

  try {
    const [docs, tmpls, res] = await Promise.all([
      invoke<string[]>('list_workspace_documents', {
        workspacePath: props.workspacePath,
      }),
      invoke<string[]>('list_workspace_templates', {
        workspacePath: props.workspacePath,
      }),
      invoke<string[]>('list_workspace_resources', {
        workspacePath: props.workspacePath,
      }),
    ]);

    documents.value = docs;
    templates.value = tmpls;
    resources.value = res;
  } catch (error) {
    console.error('Failed to load workspace data:', error);
  }
};

const refresh = async () => {
  await loadWorkspaceData();
};

const handleDelete = async (filePath: string) => {
  if (!confirm(`Delete ${getFileName(filePath)}?`)) return;

  try {
    await invoke('delete_file', { path: filePath });
    emit('file-deleted', filePath);
    await loadWorkspaceData();
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
};

const startRename = async (filePath: string) => {
  renamingPath.value = filePath;
  renameValue.value = getFileName(filePath);
  await nextTick();
  renameInputRef.value?.focus();
  renameInputRef.value?.select();
};

const cancelRename = () => {
  renamingPath.value = null;
  renameValue.value = '';
};

const submitRename = async (filePath: string) => {
  if (renamingPath.value !== filePath) return;

  const newName = renameValue.value.trim();
  renamingPath.value = null;

  if (!newName || newName === getFileName(filePath)) {
    renameValue.value = '';
    return;
  }

  const separator = filePath.includes('\\') ? '\\' : '/';
  const newPath = `${getDirectory(filePath)}${separator}${newName.endsWith('.typ') ? newName : `${newName}.typ`}`;

  try {
    await invoke('rename_file', { oldPath: filePath, newPath: newPath });
    emit('file-renamed', filePath, newPath);
    await loadWorkspaceData();
  } catch (error) {
    console.error('Failed to rename file:', error);
  } finally {
    renameValue.value = '';
  }
};

watch(() => props.workspacePath, loadWorkspaceData, { immediate: true });
onMounted(() => {
  loadWorkspaceData();
});

defineExpose({ refresh });
</script>

<style scoped>
.workspace-sidebar {
  width: 250px;
  background: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
}

.sidebar-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #cccccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-section {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  font-size: 12px;
  font-weight: 600;
  color: #858585;
  text-transform: uppercase;
}

.icon-btn-small,
.action-btn {
  background: transparent;
  border: none;
  color: #858585;
  cursor: pointer;
  padding: 0 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s;
}

.file-item:hover .icon-btn-small,
.file-item:hover .action-btn {
  opacity: 1;
}

.icon-btn-small:hover,
.action-btn:hover {
  color: #cccccc;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: #cccccc;
  font-size: 13px;
}

.file-item:hover {
  background: #2a2d2e;
}

.file-item.active {
  background: #094771;
  color: white;
}

.file-icon {
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rename-input {
  flex: 1;
  min-width: 0;
  background: #1e1e1e;
  border: 1px solid #007acc;
  border-radius: 3px;
  color: #cccccc;
  font-size: 12px;
  padding: 2px 4px;
}

.delete-btn:hover {
  color: #f48771;
}

.template-item:hover {
  background: #2a3a2e;
}

.resource-item:hover {
  background: #3a2a2e;
}

.empty-state {
  padding: 12px;
  text-align: center;
  color: #6a6a6a;
  font-size: 12px;
}
</style>
