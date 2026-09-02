<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouterMonitor, type RouterItem } from '~/composables/useRouterMonitor'
import { useNetworkEnv } from '~/composables/useNetworkEnv'

const emit = defineEmits<{
  (e: 'open-setup'): void
}>()

const {
  mainRouter,
  subRouters,
  allRouters,
  internetStatus,
  onlineCount,
  networkHealth,
  isCheckingAll,
  lastCheckedTime,
  checkNode,
  checkAllNodes,
} = useRouterMonitor()

const {
  isCellular,
  simulatedMode,
  setSimulatedMode,
} = useNetworkEnv()

// 单独测速节点防抖/状态
const testingNodeId = ref<string | null>(null)

const handleTestSingle = async (node: RouterItem) => {
  testingNodeId.value = node.id
  await checkNode(node)
  testingNodeId.value = null
}

// 格式化最后检测时间
const formattedLastChecked = computed(() => {
  if (!lastCheckedTime.value) return '从未检测'
  const diffSec = Math.floor((Date.now() - lastCheckedTime.value) / 1000)
  if (diffSec < 5) return '刚刚'
  if (diffSec < 60) return `${diffSec} 秒前`
  return `${Math.floor(diffSec / 60)} 分钟前`
})

// 综合延迟计算 (取在线路由器的平均延迟)
const averageLatency = computed(() => {
  const onlineNodes = allRouters.value.filter(r => r.status === 'online' || r.status === 'high-latency')
  if (onlineNodes.length === 0) return null
  const total = onlineNodes.reduce((acc, cur) => acc + (cur.latency || 0), 0)
  return Math.round(total / onlineNodes.length)
})

// 打开路由器管理页面
const openRouterAdmin = (ip: string) => {
  window.open(`http://${ip}`, '_blank', 'noopener')
}
</script>

<template>
  <div class="space-y-6">
    <!-- 顶部状态横幅与操作工具栏 -->
    <div class="card-base p-5 sm:p-6 bg-gradient-to-r from-white via-slate-50 to-brand-50/20 dark:from-slate-800 dark:via-slate-800 dark:to-brand-950/20">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- 核心状态指示 -->
        <div class="flex items-start sm:items-center gap-3.5">
          <div
            class="w-12 h-12 rounded-2xl flex-center transition-transform duration-300"
            :class="[
              networkHealth.level === 'critical' ? 'bg-rose-500/15 text-rose-500' :
              networkHealth.level === 'warning' ? 'bg-amber-500/15 text-amber-500' :
              'bg-emerald-500/15 text-emerald-500'
            ]"
          >
            <span
              :class="[
                networkHealth.level === 'critical' ? 'i-carbon-warning-filled' :
                networkHealth.level === 'warning' ? 'i-carbon-warning-alt' :
                'i-carbon-wifi'
              ]"
              class="text-2xl"
            />
          </div>

          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {{ networkHealth.title }}
              </h2>
              <span :class="networkHealth.badge">
                {{ networkHealth.level === 'good' ? '网络通畅' : (networkHealth.level === 'critical' ? '连接异常' : '需注意') }}
              </span>
              <span v-if="isCellular" class="badge-base bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                蜂窝数据模式
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ networkHealth.desc }}
            </p>
          </div>
        </div>

        <!-- 快捷操作按钮组 -->
        <div class="flex items-center gap-2 flex-wrap self-end md:self-center">
          <button
            class="btn-secondary btn-sm text-xs flex items-center gap-1.5"
            :disabled="isCheckingAll"
            @click="checkAllNodes"
          >
            <span
              class="i-carbon-renew text-sm"
              :class="isCheckingAll ? 'animate-spin text-brand-500' : ''"
            />
            <span>{{ isCheckingAll ? '正在探测...' : '立即检测' }}</span>
          </button>

          <button
            class="btn-secondary btn-sm text-xs flex items-center gap-1.5 text-brand-600 dark:text-brand-400"
            @click="emit('open-setup')"
          >
            <span class="i-carbon-settings-adjust text-sm" />
            <span>网络配置</span>
          </button>
        </div>
      </div>

      <!-- 快捷状态信息条 -->
      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div class="flex items-center gap-4">
          <span>上次刷新：<strong class="text-slate-600 dark:text-slate-300">{{ formattedLastChecked }}</strong></span>
          <span class="hidden sm:inline">自动轮询：<span class="text-emerald-500 font-medium">每 6 秒探测</span></span>
        </div>

        <!-- 环境模拟测试快捷开关 -->
        <div class="flex items-center gap-1.5 text-[11px]">
          <span class="text-slate-400">测试环境:</span>
          <button
            class="px-2 py-0.5 rounded border text-[11px] transition-colors"
            :class="simulatedMode === 'wifi' ? 'bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950' : 'border-slate-200 dark:border-slate-700'"
            @click="setSimulatedMode(simulatedMode === 'wifi' ? 'auto' : 'wifi')"
          >
            Wi-Fi
          </button>
          <button
            class="px-2 py-0.5 rounded border text-[11px] transition-colors"
            :class="simulatedMode === 'cellular' ? 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-950' : 'border-slate-200 dark:border-slate-700'"
            @click="setSimulatedMode(simulatedMode === 'cellular' ? 'auto' : 'cellular')"
          >
            蜂窝数据
          </button>
        </div>
      </div>
    </div>

    <!-- 4 项核心数据指标卡片网格 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 1. 主路由内网延迟 -->
      <div class="card-base p-4 sm:p-5 flex items-center justify-between">
        <div>
          <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            主网关延迟
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <template v-if="mainRouter.status === 'checking'">
              <span class="text-xl font-bold text-slate-400">检测中...</span>
            </template>
            <template v-else-if="mainRouter.status === 'offline'">
              <span class="text-2xl font-bold text-rose-500">超时</span>
              <span class="text-xs text-rose-400 font-semibold">离线</span>
            </template>
            <template v-else>
              <span class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {{ mainRouter.latency }}
              </span>
              <span class="text-xs text-slate-400 font-semibold">ms</span>
            </template>
          </div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 flex-center text-brand-600 dark:text-brand-400">
          <span class="i-carbon-edge-cluster text-xl" />
        </div>
      </div>

      <!-- 2. 公网连通延迟 -->
      <div class="card-base p-4 sm:p-5 flex items-center justify-between">
        <div>
          <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            外网互联网
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <template v-if="internetStatus.status === 'checking'">
              <span class="text-xl font-bold text-slate-400">检测中...</span>
            </template>
            <template v-else-if="internetStatus.status === 'offline'">
              <span class="text-2xl font-bold text-rose-500">已断开</span>
            </template>
            <template v-else>
              <span class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {{ internetStatus.latency }}
              </span>
              <span class="text-xs text-slate-400 font-semibold">ms</span>
            </template>
          </div>
        </div>
        <div
          class="w-10 h-10 rounded-xl flex-center"
          :class="internetStatus.status === 'offline' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'"
        >
          <span :class="internetStatus.status === 'offline' ? 'i-carbon-earth-europe-africa-filled' : 'i-carbon-earth-filled'" class="text-xl" />
        </div>
      </div>

      <!-- 3. 在线路由器节点 -->
      <div class="card-base p-4 sm:p-5 flex items-center justify-between">
        <div>
          <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            在线路由器
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <span class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {{ onlineCount }} / {{ allRouters.length }}
            </span>
            <span class="text-xs text-slate-400 font-semibold">台在线</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex-center text-indigo-600 dark:text-indigo-400">
          <span class="i-carbon-network-3 text-xl" />
        </div>
      </div>

      <!-- 4. 局域网综合平均延迟 -->
      <div class="card-base p-4 sm:p-5 flex items-center justify-between">
        <div>
          <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Wi-Fi 平均延迟
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <span class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {{ averageLatency !== null ? averageLatency : '--' }}
            </span>
            <span class="text-xs text-slate-400 font-semibold">ms</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex-center text-amber-600 dark:text-amber-400">
          <span class="i-carbon-activity text-xl" />
        </div>
      </div>
    </div>

    <!-- 路由器网络拓扑列表与卡片流 -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="i-carbon-connection-signal text-brand-500" />
          <span>家庭多路由器拓扑监控列表</span>
        </h3>
        <span class="text-xs text-slate-400">
          共 {{ allRouters.length }} 个受控节点
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- 主路由器卡片 -->
        <div
          class="card-base p-5 relative overflow-hidden transition-all duration-200 border-2"
          :class="[
            mainRouter.status === 'offline' ? 'border-rose-300 dark:border-rose-800 bg-rose-50/10' :
            mainRouter.status === 'high-latency' ? 'border-amber-300 dark:border-amber-800' :
            'border-brand-500/30 dark:border-brand-500/20'
          ]"
        >
          <!-- 头部信息 -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400 flex-center">
                <span class="i-carbon-edge-cluster text-lg" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white">
                  {{ mainRouter.name }}
                </h4>
                <div class="font-mono text-xs text-slate-400">
                  {{ mainRouter.ip }}
                </div>
              </div>
            </div>

            <span class="badge-brand text-[11px]">
              主网关
            </span>
          </div>

          <!-- 状态与延迟数值 -->
          <div class="py-3 px-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs">
              <span
                class="w-2 h-2 rounded-full"
                :class="[
                  mainRouter.status === 'online' ? 'bg-emerald-500 animate-pulse' :
                  mainRouter.status === 'high-latency' ? 'bg-amber-500 animate-pulse' :
                  mainRouter.status === 'checking' ? 'bg-slate-400' :
                  'bg-rose-500'
                ]"
              />
              <span class="font-medium text-slate-700 dark:text-slate-300">
                {{
                  mainRouter.status === 'online' ? '在线' :
                  mainRouter.status === 'high-latency' ? '延迟偏高' :
                  mainRouter.status === 'checking' ? '正在探测...' :
                  isCellular ? '蜂窝不可达' : '离线 / 超时'
                }}
              </span>
            </div>

            <div class="font-mono text-sm font-bold">
              <span
                :class="[
                  mainRouter.status === 'online' ? 'text-emerald-600 dark:text-emerald-400' :
                  mainRouter.status === 'high-latency' ? 'text-amber-600 dark:text-amber-400' :
                  'text-rose-500'
                ]"
              >
                {{ mainRouter.latency ? `${mainRouter.latency} ms` : '--' }}
              </span>
            </div>
          </div>

          <!-- 操作按钮栏 -->
          <div class="flex items-center gap-2 pt-1">
            <button
              class="btn-secondary btn-sm text-xs flex-1 flex-center gap-1"
              :disabled="testingNodeId === mainRouter.id"
              @click="handleTestSingle(mainRouter)"
            >
              <span
                class="i-carbon-ping text-xs"
                :class="testingNodeId === mainRouter.id ? 'animate-spin' : ''"
              />
              <span>{{ testingNodeId === mainRouter.id ? '测速中' : '单独测速' }}</span>
            </button>

            <button
              class="btn-primary btn-sm text-xs flex-1 flex-center gap-1"
              title="访问路由器管理后台"
              @click="openRouterAdmin(mainRouter.ip)"
            >
              <span class="i-carbon-launch text-xs" />
              <span>管理后台</span>
            </button>
          </div>
        </div>

        <!-- 各分路由器卡片 -->
        <div
          v-for="sub in subRouters"
          :key="sub.id"
          class="card-base p-5 relative overflow-hidden transition-all duration-200 border"
          :class="[
            sub.status === 'offline' ? 'border-rose-300 dark:border-rose-800 bg-rose-50/10' :
            sub.status === 'high-latency' ? 'border-amber-300 dark:border-amber-800' :
            'border-slate-200 dark:border-slate-700/60'
          ]"
        >
          <!-- 头部信息 -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex-center">
                <span class="i-carbon-network-2 text-lg" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white">
                  {{ sub.name }}
                </h4>
                <div class="font-mono text-xs text-slate-400">
                  {{ sub.ip }}
                </div>
              </div>
            </div>

            <span class="badge-base bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 text-[11px]">
              Mesh 节点
            </span>
          </div>

          <!-- 状态与延迟数值 -->
          <div class="py-3 px-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs">
              <span
                class="w-2 h-2 rounded-full"
                :class="[
                  sub.status === 'online' ? 'bg-emerald-500 animate-pulse' :
                  sub.status === 'high-latency' ? 'bg-amber-500 animate-pulse' :
                  sub.status === 'checking' ? 'bg-slate-400' :
                  'bg-rose-500'
                ]"
              />
              <span class="font-medium text-slate-700 dark:text-slate-300">
                {{
                  sub.status === 'online' ? '在线' :
                  sub.status === 'high-latency' ? '延迟偏高' :
                  sub.status === 'checking' ? '正在探测...' :
                  isCellular ? '蜂窝不可达' : '离线 / 超时'
                }}
              </span>
            </div>

            <div class="font-mono text-sm font-bold">
              <span
                :class="[
                  sub.status === 'online' ? 'text-emerald-600 dark:text-emerald-400' :
                  sub.status === 'high-latency' ? 'text-amber-600 dark:text-amber-400' :
                  'text-rose-500'
                ]"
              >
                {{ sub.latency ? `${sub.latency} ms` : '--' }}
              </span>
            </div>
          </div>

          <!-- 操作按钮栏 -->
          <div class="flex items-center gap-2 pt-1">
            <button
              class="btn-secondary btn-sm text-xs flex-1 flex-center gap-1"
              :disabled="testingNodeId === sub.id"
              @click="handleTestSingle(sub)"
            >
              <span
                class="i-carbon-ping text-xs"
                :class="testingNodeId === sub.id ? 'animate-spin' : ''"
              />
              <span>{{ testingNodeId === sub.id ? '测速中' : '单独测速' }}</span>
            </button>

            <button
              class="btn-secondary btn-sm text-xs flex-1 flex-center gap-1"
              title="访问路由器管理后台"
              @click="openRouterAdmin(sub.ip)"
            >
              <span class="i-carbon-launch text-xs" />
              <span>后台</span>
            </button>
          </div>
        </div>

        <!-- 添加新分路由器快捷卡片 -->
        <button
          type="button"
          class="card-base p-6 border-dashed border-2 border-slate-200 dark:border-slate-700/80 hover:border-brand-500 dark:hover:border-brand-500/80 bg-transparent flex-col-center gap-2 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group cursor-pointer min-h-[160px]"
          @click="emit('open-setup')"
        >
          <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex-center group-hover:bg-brand-50 dark:group-hover:bg-brand-950 transition-colors">
            <span class="i-carbon-add text-xl" />
          </div>
          <span class="text-xs font-semibold">添加更多 Mesh 分路由</span>
          <span class="text-[11px] text-slate-400">支持多房间 AP 节点拓扑</span>
        </button>
      </div>
    </div>

    <!-- 离线或异常网络排障指引卡片 -->
    <div
      v-if="networkHealth.level !== 'good'"
      class="card-base p-5 border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20 space-y-2"
    >
      <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
        <span class="i-carbon-tools text-base" />
        <span>故障自检与排障建议</span>
      </div>
      <div class="text-xs text-slate-600 dark:text-slate-300 space-y-1 pl-6">
        <p v-if="isCellular">
          • <strong>处于移动蜂窝网络</strong>：当前设备使用 5G/4G 移动数据，无法访问 192.168.x.x 等家庭私网。请连接家庭 Wi-Fi 后进行管理。
        </p>
        <p v-else-if="mainRouter.status === 'offline' && internetStatus.status !== 'offline'">
          • <strong>未连接家庭 Wi-Fi</strong>：当前公网正常，但无法连接局域网主路由（{{ mainRouter.ip }}）。若当前处于外部网络，请连接家庭 Wi-Fi 后进行管理。
        </p>
        <p v-else-if="mainRouter.status === 'offline'">
          • <strong>主网关无响应</strong>：无法连通主路由器，请确保手机/电脑已连接至该 Wi-Fi，且路由器电源接通正常。
        </p>
        <p v-if="internetStatus.status === 'offline'">
          • <strong>外网中断</strong>：局域网连接正常，但公网不可达。请检查光猫 PON 灯是否常亮，或拨打宽带运营商排查故障。
        </p>
        <p v-for="sub in subRouters.filter(s => s.status === 'offline')" :key="sub.id">
          • <strong>分节点【{{ sub.name }}】失联</strong>：请检查该 Mesh 节点插座电源，或将其移近主路由器以保证回程信号质量。
        </p>
      </div>
    </div>
  </div>
</template>
