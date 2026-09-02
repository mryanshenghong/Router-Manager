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

// 同步初始值
watch(
  () => props.show,
  (visible) => {
    if (visible) {
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
    }
  },
  { immediate: true }
)

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
            <span class="i-carbon-network-3 text-2xl" />
          </div>
          <div>
            <h3 id="setup-modal-title" class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {{ isFirstTime ? '初始化家庭路由器网络设置' : '管理路由器设备与拓扑' }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              配置家庭主路由及各房间 Mesh 分路由的局域网 IP
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

      <!-- 模态框主体内容 -->
      <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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

      <!-- 模态框底部操作栏 -->
      <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-3">
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
      </div>
    </div>
  </div>
</template>
