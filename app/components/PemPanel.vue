<script setup lang="ts">
import { Copy, Check, Download, Eye } from 'lucide-vue-next'

defineProps<{
  title: string;
  subtitle: string;
  filename: string;
  content: string;
  disabled?: boolean;
  copied?: boolean;
  revealed?: boolean;
}>();

const emit = defineEmits<{
  (e: "copy"): void;
  (e: "download"): void;
  (e: "reveal"): void;
}>();
</script>

<template>
  <div
    class="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden relative group"
    :class="{ revealed }"
  >
    <!-- Click to Reveal Overlay -->
    <div
      v-if="!revealed && content"
      @click="emit('reveal')"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md cursor-pointer hover:bg-slate-900/40 transition-all duration-300 pointer-events-auto"
    >
      <div class="text-center p-4">
        <Eye class="w-8 h-8 text-cyan-400 mx-auto mb-2" />
        <div class="text-sm font-semibold text-slate-100">Click to reveal sensitive data</div>
        <div class="text-xs text-slate-400 mt-1">This area is protected against screen capture</div>
      </div>
    </div>
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
          :class="copied ? 'border-green-500/50 text-green-400' : ''"
        >
          <span class="inline-flex items-center gap-2">
            <Check v-if="copied" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
            {{ copied ? 'Copied!' : 'Copy' }}
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

    <pre
      class="p-4 overflow-x-auto overflow-y-auto text-sm leading-6 text-slate-300 whitespace-pre-wrap h-[240px] no-select reveal-blur"
      :class="{ revealed }"
      >{{ content || "No content yet." }}</pre
    >
  </div>
</template>