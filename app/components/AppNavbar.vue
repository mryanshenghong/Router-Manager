<script setup lang="ts">
withDefaults(
  defineProps<{
    isStandalone?: boolean
    canInstall?: boolean
  }>(),
  {
    isStandalone: false,
    canInstall: false,
  }
)

const emit = defineEmits<{
  (e: 'install'): void
  (e: 'open-settings'): void
}>()
</script>

<template>
  <header class="sticky top-0 z-40 glass-panel">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex-between">
      <!-- 品牌 Logo 与标题 -->
      <div class="flex items-center gap-3">
        <div class="relative flex-center">
          <img
            src="/icon.svg"
            alt="Router Manager"
            class="w-10 h-10 rounded-xl shadow-md shadow-brand-500/20"
          />
          <span
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"
            title="在线"
          />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Router Manager
            </h1>
            <span
              :class="isStandalone ? 'badge-success' : 'badge-brand'"
            >
              {{ isStandalone ? '桌面端 (PWA)' : '网页端' }}
            </span>
            <span class="badge-base bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-950 dark:text-brand-400 text-[10px] font-mono">
              v1.0.1
            </span>
          </div>
        </div>
      </div>

      <!-- 快捷操作栏 -->
      <div class="flex items-center gap-2">
        <button
          v-if="canInstall"
          class="btn-primary"
          @click="emit('install')"
        >
          <span class="i-carbon-download mr-1.5 text-base" />
          安装应用
        </button>

        <button
          type="button"
          class="btn-ghost p-2 rounded-lg"
          title="路由器与网络配置"
          @click="emit('open-settings')"
        >
          <span class="i-carbon-settings text-lg" />
        </button>
      </div>
    </div>
  </header>
</template>
