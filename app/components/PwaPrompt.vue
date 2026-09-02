<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const { $pwa } = useNuxtApp()

// 网络状态
const isOnline = ref(true)

function updateOnlineStatus() {
  isOnline.value = navigator.onLine
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    isOnline.value = navigator.onLine
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  }
})

const reloadApp = async () => {
  if ($pwa) {
    await $pwa.updateServiceWorker(true)
  } else {
    window.location.reload()
  }
}

const dismissRefresh = () => {
  if ($pwa) {
    $pwa.cancelPrompt()
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end items-center p-4 sm:p-6 gap-3">
    <!-- 离线网络状态栏 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="-translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-4 opacity-0"
    >
      <div
        v-if="!isOnline"
        class="fixed top-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-5 py-2 rounded-full shadow-lg shadow-rose-600/30 text-xs sm:text-sm font-medium flex items-center gap-2 pointer-events-auto"
        role="alert"
      >
        <span class="w-2 h-2 rounded-full bg-white animate-ping" />
        <span>当前处于离线状态，已启用 Service Worker 离线模式</span>
      </div>
    </Transition>

    <!-- 新版本更新提示弹窗 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-4 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-4 opacity-0 scale-95"
    >
      <div
        v-if="$pwa?.needRefresh"
        class="toast-box"
        role="alertdialog"
        aria-labelledby="pwa-toast-title"
      >
        <div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 bg-brand-500 rounded-full animate-pulse" />
            <h4 id="pwa-toast-title" class="text-sm font-semibold text-slate-900 dark:text-white">
              发现新版本资源
            </h4>
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            离线包已完成预载，点击刷新即可立即载入最新的系统功能。
          </p>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button class="btn-secondary btn-sm" @click="dismissRefresh">
            稍后
          </button>
          <button class="btn-primary btn-sm" @click="reloadApp">
            立即刷新
          </button>
        </div>
      </div>
    </Transition>

    <!-- 离线缓存就绪提示 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="$pwa?.offlineReady"
        class="pointer-events-auto bg-slate-900/90 text-white backdrop-blur px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 text-xs"
        role="status"
      >
        <span class="text-emerald-400">⚡</span>
        <span>离线数据与应用缓存已准备就绪</span>
        <button
          class="text-slate-400 hover:text-white ml-2 text-xs font-semibold"
          @click="$pwa.cancelPrompt()"
        >
          知道了
        </button>
      </div>
    </Transition>
  </div>
</template>
