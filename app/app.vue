<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNetworkEnv } from '~/composables/useNetworkEnv'
import { useRouterMonitor } from '~/composables/useRouterMonitor'

const { $pwa } = useNuxtApp()
const isStandalone = ref(false)
const deferredPrompt = ref<any>(null)
const isInstalled = ref(false)

const showGuideModal = ref(false)
const showSetupModal = ref(false)

const { isWifiOrLan } = useNetworkEnv()
const { isInitialized, loadConfig } = useRouterMonitor()

// 是否可以安装：处于普通浏览器网页访问环境（非已安装独立窗口）时均可点击安装
const canInstall = computed<boolean>(() => {
  if (isStandalone.value || isInstalled.value) return false
  return true
})

const handleInstall = async () => {
  const prompt = deferredPrompt.value || (typeof window !== 'undefined' ? (window as any).__deferredPrompt : null)
  if (prompt) {
    try {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') {
        isInstalled.value = true
        deferredPrompt.value = null
        if (typeof window !== 'undefined') {
          ;(window as any).__deferredPrompt = null
        }
      }
      return
    } catch (e) {
      console.warn('Native prompt error:', e)
    }
  } else if ($pwa?.showInstallPrompt && $pwa?.install) {
    try {
      await $pwa.install()
      return
    } catch (e) {
      console.warn('PWA install error:', e)
    }
  }

  // Safari、iOS、Chrome 无痕模式或无原生凭据时，展示安装引导弹窗
  showGuideModal.value = true
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    isStandalone.value =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    // 优先读取 head 脚本中已捕获的 beforeinstallprompt 事件
    if ((window as any).__deferredPrompt) {
      deferredPrompt.value = (window as any).__deferredPrompt
    }

    // 监听 head 脚本派发的自定义事件（如果事件在应用初始化期间触发）
    window.addEventListener('pwa-can-install', () => {
      deferredPrompt.value = (window as any).__deferredPrompt
    })

    // 保留原生事件监听以防在不同浏览器下延迟触发
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault()
      deferredPrompt.value = e
      ;(window as any).__deferredPrompt = e
    })

    window.addEventListener('appinstalled', () => {
      isInstalled.value = true
      deferredPrompt.value = null
      ;(window as any).__deferredPrompt = null
    })

    // 检查是否未初始化，如果在 Wi-Fi / 局域网环境下未初始化，主动引导打开配置向导
    loadConfig()
    if (!isInitialized.value && isWifiOrLan.value) {
      // 延时少许让界面丝滑就绪
      setTimeout(() => {
        showSetupModal.value = true
      }, 300)
    }
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
    <!-- PWA Manifest 自动注入组件 -->
    <VitePwaManifest />

    <NuxtRouteAnnouncer />

    <!-- 统一导航栏组件 -->
    <AppNavbar
      :is-standalone="isStandalone"
      :can-install="canInstall"
      @install="handleInstall"
      @open-settings="showSetupModal = true"
    />

    <!-- 主视图区域 -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- 路由器管理控制台状态看板 -->
      <RouterStats @open-setup="showSetupModal = true" />
    </main>

    <!-- 底部状态页脚 -->
    <footer class="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Router Manager</span>
        <span>© 2026 Shenghong Yan</span>
      </div>
    </footer>

    <!-- PWA 更新与离线提示 -->
    <ClientOnly>
      <PwaPrompt />
      <InstallGuideModal
        :show="showGuideModal"
        @close="showGuideModal = false"
      />

      <!-- 需求1：移动蜂窝网络（非 Wi-Fi 环境）阻断告警组件 -->
      <NetworkEnvAlert />

      <!-- 需求2：首次使用引导向导与路由器拓扑配置弹窗 -->
      <RouterSetupModal
        :show="showSetupModal"
        :is-first-time="!isInitialized"
        @close="showSetupModal = false"
        @saved="showSetupModal = false"
      />
    </ClientOnly>
  </div>
</template>
