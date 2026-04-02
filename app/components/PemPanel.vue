<script setup lang="ts">
import { Copy, Download } from 'lucide-vue-next'

defineProps<{
  title: string
  subtitle: string
  filename: string
  content: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'download'): void
}>()
</script>

<template>
  <div class="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
    <div class="px-4 py-3 border-b border-slate-800 flex items-start justify-between gap-4">
      <div>
        <div class="font-semibold text-slate-100">{{ title }}</div>
        <div class="text-sm text-slate-400 mt-1">{{ subtitle }}</div>
        <div class="text-xs text-cyan-300 mt-2">{{ filename }}</div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="emit('copy')"
          :disabled="disabled"
          class="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span class="inline-flex items-center gap-2">
            <Copy class="w-4 h-4" />
            Copy
          </span>
        </button>

        <button
          type="button"
          @click="emit('download')"
          :disabled="disabled"
          class="rounded-xl bg-cyan-500 text-slate-950 px-3 py-2 text-sm font-semibold hover:bg-cyan-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span class="inline-flex items-center gap-2">
            <Download class="w-4 h-4" />
            Download
          </span>
        </button>
      </div>
    </div>

    <pre class="p-4 overflow-x-auto text-sm leading-6 text-slate-300 whitespace-pre-wrap min-h-[240px]">{{ content || 'No content yet.' }}</pre>
  </div>
</template>