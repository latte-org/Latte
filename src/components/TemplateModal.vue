<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FileText, Mail, BookOpen, Presentation } from '@lucide/vue'
import { invoke } from '@/lib/backend'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'template-selected': [name: string]
}>()

const templates = ref<string[]>([])

onMounted(async () => {
  try {
    templates.value = await invoke<string[]>('list_templates')
  } catch (error) {
    console.error('Failed to load templates:', error)
  }
})

const selectTemplate = (template: string) => {
  emit('template-selected', template)
  emit('update:open', false)
}

const getTemplateIcon = (template: string) => {
  const icons: Record<string, typeof FileText> = {
    article: FileText,
    letter: Mail,
    report: BookOpen,
    presentation: Presentation,
  }
  return icons[template] || FileText
}

const getTemplateName = (template: string) =>
  template.charAt(0).toUpperCase() + template.slice(1)

const getTemplateDescription = (template: string) => {
  const descriptions: Record<string, string> = {
    article: 'Academic or blog article layout',
    letter: 'Formal letter template',
    report: 'Structured report with sections',
    presentation: 'Slide-style Typst document',
  }
  return descriptions[template] || 'Typst template'
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl">
      <DialogHeader class="space-y-1 border-b border-border/60 px-6 py-5">
        <DialogTitle>Choose a template</DialogTitle>
        <DialogDescription>
          Start a new document from a built-in Typst template.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-2 p-5 sm:grid-cols-2">
        <button
          v-for="template in templates"
          :key="template"
          class="flex flex-col items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition hover:border-primary/30 hover:bg-accent/40"
          @click="selectTemplate(template)"
        >
          <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <component
              :is="getTemplateIcon(template)"
              class="size-5"
            />
          </div>
          <div>
            <p class="font-medium">{{ getTemplateName(template) }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ getTemplateDescription(template) }}
            </p>
          </div>
        </button>

        <p
          v-if="templates.length === 0"
          class="col-span-full py-8 text-center text-sm text-muted-foreground"
        >
          No templates available.
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
