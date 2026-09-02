<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouterMonitor } from '~/composables/useRouterMonitor'

const props = defineProps<{
  show: boolean
  isFirstTime?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const {
  mainRouter,
  subRouters,
  saveConfig,
  probeLocalIp,
} = useRouterMonitor()

// 常用网关 IP 快捷预设
const ipPresets = [
  { label: 'TP-Link / 华为', ip: '192.168.1.1' },
  { label: '小米 / 红米', ip: '192.168.31.1' },
  { label: '华硕 ASUS', ip: '192.168.50.1' },
  { label: '普联 / 腾达', ip: '192.168.0.1' },
  { label: 'OpenWrt', ip: '192.168.123.1' },
]

// 表单临时编辑状态
const formMainName = ref('客厅主路由器')
const formMainIp = ref('192.168.1.1')
const formSubRouters = ref<Array<{ id: string; name: string; ip: string; testStatus?: string; testLatency?: number }>>([])

// 连通性测试状态
const mainTestStatus = ref<'idle' | 'testing' | 'success' | 'fail'>('idle')
const mainTestLatency = ref<number | null>(null)

// 选项卡状态：'ip' (IP 设置) | 'app' (App 设置)
const activeTab = ref<'ip' | 'app'>('ip')

const { $pwa } = useNuxtApp()
const checkingUpdate = ref(false)
const updateStatusText = ref('')
const isHardResetting = ref(false)

// 同步初始值
watch(
  () => props.show,
  (visible) => {
    if (visible) {
      if (props.isFirstTime) {
        activeTab.value = 'ip'
      }
      formMainName.value = mainRouter.value.name || '客厅主路由器'
      formMainIp.value = mainRouter.value.ip || '192.168.1.1'
      formSubRouters.value = subRouters.value.map(s => ({
        id: s.id,
        name: s.name,
        ip: s.ip,
        testStatus: 'idle',
      }))
      mainTestStatus.value = 'idle'
      mainTestLatency.value = null
      updateStatusText.value = ''
    }
  },
  { immediate: true }
)

// 检查 PWA 最新版本
const checkForUpdates = async () => {
  checkingUpdate.value = true
  updateStatusText.value = '正在向服务器检测更新...'
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.update()
        // 延时等待 Service Worker 状态流转
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if ($pwa?.needRefresh) {
          updateStatusText.value = '发现新版本！请点击「立即更新并重载」'
        } else {
          updateStatusText.value = '当前已是最新版本'
        }
      } else {
        updateStatusText.value = '未检测到活跃的 Service Worker'
      }
    } else {
      updateStatusText.value = '当前浏览器环境不支持 Service Worker'
    }
  } catch (err: any) {
    updateStatusText.value = `检查失败: ${err.message || '网络异常'}`
  } finally {
    checkingUpdate.value = false
    setTimeout(() => {
      if (updateStatusText.value === '当前已是最新版本') {
        updateStatusText.value = ''
      }
    }, 5000)
  }
}

// 强制刷新应用
const forceRefreshApp = async () => {
  if (typeof window !== 'undefined') {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) await reg.update()
        if ($pwa) {
          await $pwa.updateServiceWorker(true)
        }
      } catch (e) {
        console.warn('Force refresh error:', e)
      }
    }
    window.location.reload()
  }
}

// 彻底清除静态缓存并重载（专门针对老旧系统如 iPadOS 15 的顽固缓存）
const hardResetCache = async () => {
  if (typeof window === 'undefined') return
  if (!confirm('是否清除本地应用静态缓存并重新拉取最新版本？\n（注：您保存的路由器 IP 配置不会丢失）')) {
    return
  }
  isHardResetting.value = true
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(key => caches.delete(key)))
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(reg => reg.unregister()))
    }
    window.location.reload()
  } catch (e) {
    console.error('Hard reset error:', e)
    window.location.reload()
  }
}

const addSubRouter = () => {
  const index = formSubRouters.value.length + 1
  // 智能推断分路由默认 IP
  const baseParts = formMainIp.value.split('.')
  let defaultSubIp = '192.168.1.2'
  if (baseParts.length === 4) {
    defaultSubIp = `${baseParts[0]}.${baseParts[1]}.${baseParts[2]}.${Number(baseParts[3]) + index}`
  }

  formSubRouters.value.push({
    id: `sub-${Date.now()}`,
    name: `Mesh 分路由器 ${index}`,
    ip: defaultSubIp,
    testStatus: 'idle',
  })
}

const removeSubRouter = (index: number) => {
  formSubRouters.value.splice(index, 1)
}

const selectPreset = (ip: string) => {
  formMainIp.value = ip
  mainTestStatus.value = 'idle'
}

// 单独测试主路由连通性
const testMainRouter = async () => {
  mainTestStatus.value = 'testing'
  const res = await probeLocalIp(formMainIp.value, 2000)
  if (res.ok) {
    mainTestStatus.value = 'success'
    mainTestLatency.value = res.latency
  } else {
    mainTestStatus.value = 'fail'
    mainTestLatency.value = null
  }
}

// 单独测试某个分路由连通性
const testSubRouter = async (item: any) => {
  item.testStatus = 'testing'
  const res = await probeLocalIp(item.ip, 2000)
  if (res.ok) {
    item.testStatus = 'success'
    item.testLatency = res.latency
  } else {
    item.testStatus = 'fail'
    item.testLatency = null
  }
}

const handleSave = () => {
  if (!formMainIp.value.trim()) {
    alert('请输入主路由器网关 IP 地址')
    return
  }

  saveConfig({
    mainRouter: {
      name: formMainName.value,
      ip: formMainIp.value,
    },
    subRouters: formSubRouters.value.map(s => ({
      id: s.id,
      name: s.name,
      ip: s.ip,
    })),
  })

  emit('saved')
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm transition-all overflow-y-auto">
    <div
      class="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-modal-title"
    >
      <!-- 模态框头部 -->
      <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex-center">
            <span :class="activeTab === 'ip' ? 'i-carbon-network-3' : 'i-carbon-application-mobile'" class="text-2xl" />
          </div>
          <div>
            <h3 id="setup-modal-title" class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {{ isFirstTime ? '初始化家庭路由器网络设置' : (activeTab === 'ip' ? '路由器设备与 IP 配置' : 'App 与系统设置') }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ activeTab === 'ip' ? '配置家庭主路由及各房间 Mesh 分路由的局域网 IP' : '版本检查、PWA 离线运行与缓存控制' }}
            </p>
          </div>
        </div>

        <button
          v-if="!isFirstTime"
          class="btn-ghost p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          @click="emit('close')"
        >
          <span class="i-carbon-close text-lg" />
        </button>
      </div>

      <!-- Tab 切换栏 -->
      <div v-if="!isFirstTime" class="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 px-6 gap-2">
        <button
          type="button"
          class="relative py-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all"
          :class="activeTab === 'ip' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'ip'"
        >
          <span class="i-carbon-network-3 text-base" />
          <span>IP 设置</span>
        </button>
        <button
          type="button"
          class="relative py-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all"
          :class="activeTab === 'app' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'app'"
        >
          <span class="i-carbon-application-mobile text-base" />
          <span>App 设置</span>
          <!-- 新版本小红点标记 -->
          <span
            v-if="$pwa?.needRefresh"
            class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
            title="有新版本可用"
          />
        </button>
      </div>

      <!-- 模态框主体内容 -->
      <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        <!-- 选项卡 1：IP 设置 -->
        <div v-if="activeTab === 'ip'" class="space-y-6">
          <!-- 首次使用引导提醒 -->
          <div v-if="isFirstTime" class="bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/50 rounded-2xl p-4 text-xs text-brand-700 dark:text-brand-300 flex items-start gap-3">
            <span class="i-carbon-help-filled text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-semibold mb-0.5">欢迎使用 Router Manager！</p>
              <p class="text-slate-600 dark:text-slate-300">
                请录入您家中的主路由器 IP（网关地址）以及各个房间的 Mesh 分路由节点 IP，系统将为您实时监控每个节点的连通性与网络延迟。
              </p>
            </div>
          </div>

          <!-- 1. 主路由器配置 -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-brand-500" />
                主路由器 (Gateway)
              </label>
              <span class="text-xs text-slate-400 font-normal">必须项</span>
            </div>

            <!-- 快捷预设 IP -->
            <div class="flex flex-wrap gap-1.5 items-center">
              <span class="text-xs text-slate-400 mr-1">快捷填入:</span>
              <button
                v-for="preset in ipPresets"
                :key="preset.ip"
                type="button"
                class="btn-secondary btn-sm text-[11px] font-mono px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-400"
                :class="formMainIp === preset.ip ? 'border-brand-500 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400' : ''"
                @click="selectPreset(preset.ip)"
              >
                {{ preset.label }} ({{ preset.ip }})
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div class="sm:col-span-5">
                <input
                  v-model="formMainName"
                  type="text"
                  placeholder="名称 (如 客厅主路由)"
                  class="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div class="sm:col-span-4">
                <input
                  v-model="formMainIp"
                  type="text"
                  placeholder="IP 地址 (如 192.168.1.1)"
                  class="w-full px-3.5 py-2 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div class="sm:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  class="btn-secondary w-full py-2 text-xs flex-center gap-1.5"
                  :disabled="mainTestStatus === 'testing'"
                  @click="testMainRouter"
                >
                  <span v-if="mainTestStatus === 'testing'" class="i-carbon-circle-dash animate-spin text-sm" />
                  <span v-else-if="mainTestStatus === 'success'" class="i-carbon-checkmark text-emerald-500 text-sm" />
                  <span v-else-if="mainTestStatus === 'fail'" class="i-carbon-close text-rose-500 text-sm" />
                  <span v-else class="i-carbon-ping text-sm text-brand-500" />
                  <span>{{ mainTestStatus === 'testing' ? '测试中' : '测通' }}</span>
                </button>
              </div>
            </div>

            <!-- 主路由测试结果反馈 -->
            <div v-if="mainTestStatus === 'success'" class="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span class="i-carbon-checkmark-filled" />
              <span>连通成功！往返延迟约 {{ mainTestLatency }}ms</span>
            </div>
            <div v-else-if="mainTestStatus === 'fail'" class="text-xs text-rose-500 flex items-center gap-1">
              <span class="i-carbon-warning-filled" />
              <span>未响应或连接超时。请确认已连接该 Wi-Fi 且 IP 正确。</span>
            </div>
          </div>

          <!-- 2. 分路由器列表 (Mesh 节点) -->
          <div class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <label class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-indigo-500" />
                分路由器 / Mesh 子节点 (可选)
              </label>
              <button
                type="button"
                class="btn-secondary btn-sm text-xs flex items-center gap-1 text-brand-600 dark:text-brand-400"
                @click="addSubRouter"
              >
                <span class="i-carbon-add text-sm" />
                添加分路由器
              </button>
            </div>

            <p class="text-xs text-slate-400">
              如果您家中有书房、卧室等 Mesh 分路由或副 AP，可添加其 IP 共同纳入监控。
            </p>

            <!-- 列表为空时的空状态 -->
            <div
              v-if="formSubRouters.length === 0"
              class="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/20"
            >
              暂未添加分路由器。若家中仅有单台主路由器，可直接保存。
            </div>

            <!-- 列表项 -->
            <div
              v-for="(sub, idx) in formSubRouters"
              :key="sub.id"
              class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2"
            >
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div class="sm:col-span-5">
                  <input
                    v-model="sub.name"
                    type="text"
                    placeholder="节点名称 (如 书房分路由)"
                    class="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div class="sm:col-span-4">
                  <input
                    v-model="sub.ip"
                    type="text"
                    placeholder="分路由 IP (如 192.168.1.2)"
                    class="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div class="sm:col-span-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    class="btn-secondary flex-1 py-1.5 text-xs flex-center gap-1"
                    :disabled="sub.testStatus === 'testing'"
                    @click="testSubRouter(sub)"
                  >
                    <span v-if="sub.testStatus === 'testing'" class="i-carbon-circle-dash animate-spin text-xs" />
                    <span v-else class="i-carbon-ping text-xs text-indigo-500" />
                    <span>{{ sub.testStatus === 'testing' ? '测试中' : '测通' }}</span>
                  </button>
                  <button
                    type="button"
                    class="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                    title="删除该节点"
                    @click="removeSubRouter(idx)"
                  >
                    <span class="i-carbon-trash-can text-sm" />
                  </button>
                </div>
              </div>

              <!-- 分路由测试反馈 -->
              <div v-if="sub.testStatus === 'success'" class="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pl-1">
                <span class="i-carbon-checkmark" />
                <span>连通成功 (延迟 {{ sub.testLatency }}ms)</span>
              </div>
              <div v-else-if="sub.testStatus === 'fail'" class="text-[11px] text-rose-500 flex items-center gap-1 pl-1">
                <span class="i-carbon-warning" />
                <span>未响应，请检查该分路由是否已连网或 IP 是否正确</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 选项卡 2：App 设置 -->
        <div v-else-if="activeTab === 'app'" class="space-y-5">
          <!-- 1. 应用基本信息卡片 -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div class="flex items-center gap-3.5">
              <img
                src="/icon.svg"
                alt="Router Manager"
                class="w-12 h-12 rounded-xl shadow-md shadow-brand-500/20"
              />
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-slate-900 dark:text-white">Router Manager</h4>
                  <span class="badge-base bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-mono font-semibold">
                    v1.0.4
                  </span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  智能家庭路由器监控与网络状态面板 (PWA)
                </p>
              </div>
            </div>
          </div>

          <!-- 2. 版本更新与强制刷新控制 -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3.5">
            <div class="flex items-center justify-between">
              <label class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-brand-500" />
                版本检查与缓存刷新
              </label>
              <span v-if="$pwa?.needRefresh" class="badge-base bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-400 text-xs animate-pulse font-medium">
                发现新版本
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              应用会在后台自动探测更新。如果您的设备（如 iPad / 老版本 iOS）未自动弹出更新提示，可通过下方按钮手动检查或强制刷新。
            </p>

            <!-- 发现新版本时的强提醒条 -->
            <div
              v-if="$pwa?.needRefresh"
              class="p-3 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 rounded-xl flex items-center justify-between gap-2"
            >
              <div class="flex items-center gap-2 text-xs text-brand-700 dark:text-brand-300 font-medium">
                <span class="i-carbon-upgrade text-base text-brand-500 animate-bounce" />
                <span>检测到服务器已有新版本就绪</span>
              </div>
              <button
                type="button"
                class="btn-primary btn-sm text-xs px-3.5 py-1.5 shadow-sm whitespace-nowrap"
                @click="forceRefreshApp"
              >
                立即更新并重载
              </button>
            </div>

            <!-- 检查更新状态文本反馈 -->
            <div
              v-if="updateStatusText"
              class="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              :class="updateStatusText.includes('失败') ? 'text-rose-500' : 'text-brand-600 dark:text-brand-400'"
            >
              <span :class="checkingUpdate ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-information'" class="text-sm flex-shrink-0" />
              <span>{{ updateStatusText }}</span>
            </div>

            <!-- 操作按钮网格 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                class="btn-secondary py-2.5 text-xs flex-center gap-2"
                :disabled="checkingUpdate"
                @click="checkForUpdates"
              >
                <span :class="checkingUpdate ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-renew'" class="text-sm text-brand-500" />
                <span>{{ checkingUpdate ? '正在检测更新...' : '检查最新版本' }}</span>
              </button>

              <button
                type="button"
                class="btn-secondary py-2.5 text-xs flex-center gap-2 hover:border-brand-400"
                @click="forceRefreshApp"
              >
                <span class="i-carbon-reset text-sm text-indigo-500" />
                <span>强制刷新应用</span>
              </button>
            </div>

            <!-- 彻底清空缓存并硬重启（专门针对老 iPad / 顽固缓存） -->
            <div class="pt-3 border-t border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="text-[11px] text-slate-400">
                遇到缓存卡死、页面不更新等异常情况时可使用
              </div>
              <button
                type="button"
                class="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline flex items-center gap-1 py-1 self-start sm:self-auto"
                :disabled="isHardResetting"
                @click="hardResetCache"
              >
                <span v-if="isHardResetting" class="i-carbon-circle-dash animate-spin" />
                <span v-else class="i-carbon-trash-can" />
                <span>{{ isHardResetting ? '正在清理缓存...' : '清除本地缓存并硬重启' }}</span>
              </button>
            </div>
          </div>

          <!-- 3. 本地存储安全提示 -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
            <div class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500" />
              数据安全与隐私保护
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              所有路由器 IP 与拓扑配置仅保存在当前设备的本地存储中，不经过任何云端数据库，完全保护您的家庭内网安全。
            </p>
          </div>
        </div>
      </div>

      <!-- 模态框底部操作栏 -->
      <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-3">
        <template v-if="activeTab === 'ip'">
          <button
            v-if="!isFirstTime"
            type="button"
            class="btn-secondary"
            @click="emit('close')"
          >
            取消
          </button>

          <button
            type="button"
            class="btn-primary px-6 py-2.5 shadow-md shadow-brand-500/20"
            @click="handleSave"
          >
            <span class="i-carbon-checkmark mr-1.5 text-base" />
            {{ isFirstTime ? '完成设置并开启监控' : '保存拓扑配置' }}
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="btn-secondary px-6 py-2"
            @click="emit('close')"
          >
            关闭
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
