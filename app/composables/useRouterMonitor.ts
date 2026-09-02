import { ref, computed, onMounted, onUnmounted } from 'vue'

export type NodeHealthStatus = 'online' | 'high-latency' | 'offline' | 'checking'

export interface RouterItem {
  id: string
  name: string
  ip: string
  isMain?: boolean
  status: NodeHealthStatus
  latency: number | null
  lastChecked: number | null
  failCount: number
}

export interface StoredTopologyConfig {
  isInitialized: boolean
  mainRouter: {
    name: string
    ip: string
  }
  subRouters: Array<{
    id: string
    name: string
    ip: string
  }>
}

const STORAGE_KEY = 'router_manager_config'

// 全局响应式状态共享
const isInitialized = ref(false)
const mainRouter = ref<RouterItem>({
  id: 'main',
  name: '客厅主路由器',
  ip: '192.168.1.1',
  isMain: true,
  status: 'checking',
  latency: null,
  lastChecked: null,
  failCount: 0,
})

const subRouters = ref<RouterItem[]>([])
const internetStatus = ref<{
  status: 'online' | 'offline' | 'checking'
  latency: number | null
  lastChecked: number | null
}>({
  status: 'checking',
  latency: null,
  lastChecked: null,
})

const isPolling = ref(true)
const isCheckingAll = ref(false)
const lastCheckedTime = ref<number | null>(null)

export function useRouterMonitor() {
  // 加载本地配置
  const loadConfig = () => {
    if (typeof window === 'undefined') return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: StoredTopologyConfig = JSON.parse(saved)
        isInitialized.value = !!parsed.isInitialized

        if (parsed.mainRouter) {
          mainRouter.value.name = parsed.mainRouter.name || '客厅主路由器'
          mainRouter.value.ip = parsed.mainRouter.ip || '192.168.1.1'
        }

        if (Array.isArray(parsed.subRouters)) {
          subRouters.value = parsed.subRouters.map((sub, idx) => ({
            id: sub.id || `sub-${idx}-${Date.now()}`,
            name: sub.name || `分路由器 ${idx + 1}`,
            ip: sub.ip,
            isMain: false,
            status: 'checking',
            latency: null,
            lastChecked: null,
            failCount: 0,
          }))
        }
      } else {
        isInitialized.value = false
      }
    } catch (e) {
      console.error('Failed to load router config:', e)
      isInitialized.value = false
    }
  }

  // 保存配置
  const saveConfig = (config: {
    mainRouter: { name: string; ip: string }
    subRouters: Array<{ id: string; name: string; ip: string }>
  }) => {
    if (typeof window === 'undefined') return

    isInitialized.value = true
    mainRouter.value.name = config.mainRouter.name
    mainRouter.value.ip = config.mainRouter.ip.trim()

    subRouters.value = config.subRouters.map((sub, idx) => ({
      id: sub.id || `sub-${idx}-${Date.now()}`,
      name: sub.name.trim() || `分路由器 ${idx + 1}`,
      ip: sub.ip.trim(),
      isMain: false,
      status: 'checking',
      latency: null,
      lastChecked: null,
      failCount: 0,
    }))

    const storedData: StoredTopologyConfig = {
      isInitialized: true,
      mainRouter: {
        name: mainRouter.value.name,
        ip: mainRouter.value.ip,
      },
      subRouters: subRouters.value.map(s => ({
        id: s.id,
        name: s.name,
        ip: s.ip,
      })),
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData))
    checkAllNodes()
  }

  // 重置配置（清空并重新初始化）
  const resetConfig = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
    isInitialized.value = false
    mainRouter.value = {
      id: 'main',
      name: '客厅主路由器',
      ip: '192.168.1.1',
      isMain: true,
      status: 'checking',
      latency: null,
      lastChecked: null,
      failCount: 0,
    }
    subRouters.value = []
  }

  // 核心探针算法：带超时的局域网 HTTP 往返探测
  const probeLocalIp = async (ip: string, timeoutMs = 2500): Promise<{ ok: boolean; latency: number }> => {
    const start = performance.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      // 通过 mode: 'no-cors' 发起 HEAD/GET 请求探测局域网 IP
      // 若设备在局域网存活，TCP 握手即刻完成，fetch 迅速返回 opaque response
      await fetch(`http://${ip}/?_probe=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timer)
      const latency = Math.max(1, Math.round(performance.now() - start))
      return { ok: true, latency }
    } catch (e: any) {
      clearTimeout(timer)
      const latency = Math.round(performance.now() - start)

      // 超时或中止，判定设备离线
      if (e.name === 'AbortError' || latency >= timeoutMs - 50) {
        return { ok: false, latency: timeoutMs }
      }

      // 如果未超时却报错（例如端口关闭但收到 TCP RST 包），在内网通常在 50ms 内快速返回，证明该 IP 主机在局域网在线
      if (latency < 200) {
        return { ok: true, latency }
      }

      return { ok: false, latency }
    }
  }

  // 公网连通性探测
  const probeInternet = async (timeoutMs = 3000): Promise<{ ok: boolean; latency: number }> => {
    const start = performance.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      // 优先探测极简 204 端点
      await fetch(`https://connectivitycheck.gstatic.com/generate_204?_t=${Date.now()}`, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timer)
      const latency = Math.max(10, Math.round(performance.now() - start))
      return { ok: true, latency }
    } catch {
      clearTimeout(timer)
      // 兜底探测国内常用稳定资源
      try {
        const fallbackStart = performance.now()
        await fetch(`https://www.baidu.com/favicon.ico?_t=${Date.now()}`, {
          mode: 'no-cors',
          cache: 'no-store',
          signal: AbortSignal.timeout(2000),
        })
        return { ok: true, latency: Math.round(performance.now() - fallbackStart) }
      } catch {
        return { ok: typeof navigator !== 'undefined' ? navigator.onLine : true, latency: 999 }
      }
    }
  }

  // 探测单台路由器节点
  const checkNode = async (node: RouterItem) => {
    node.status = 'checking'
    const res = await probeLocalIp(node.ip)
    node.lastChecked = Date.now()

    if (res.ok) {
      node.latency = res.latency
      node.failCount = 0
      node.status = res.latency > 150 ? 'high-latency' : 'online'
    } else {
      node.failCount += 1
      node.latency = null
      node.status = 'offline'
    }
  }

  // 探测所有节点及外网
  const checkAllNodes = async () => {
    if (isCheckingAll.value) return
    isCheckingAll.value = true

    try {
      const probeTasks = [
        checkNode(mainRouter.value),
        ...subRouters.value.map(sub => checkNode(sub)),
        (async () => {
          internetStatus.value.status = 'checking'
          const res = await probeInternet()
          internetStatus.value.lastChecked = Date.now()
          if (res.ok) {
            internetStatus.value.status = 'online'
            internetStatus.value.latency = res.latency
          } else {
            internetStatus.value.status = 'offline'
            internetStatus.value.latency = null
          }
        })(),
      ]

      await Promise.allSettled(probeTasks)
      lastCheckedTime.value = Date.now()
    } finally {
      isCheckingAll.value = false
    }
  }

  // 计算属性：所有路由器列表
  const allRouters = computed(() => [mainRouter.value, ...subRouters.value])

  // 在线节点数量统计
  const onlineCount = computed(() => {
    return allRouters.value.filter(r => r.status === 'online' || r.status === 'high-latency').length
  })

  // 总体网络健康状态评估
  const networkHealth = computed(() => {
    const isMainDown = mainRouter.value.status === 'offline'
    const isWanDown = internetStatus.value.status === 'offline'
    const offlineSubs = subRouters.value.filter(s => s.status === 'offline')

    if (isMainDown) {
      return {
        level: 'critical',
        title: '主网关失联',
        desc: '无法连通主路由器，请检查 Wi-Fi 是否连接或路由器电源是否接通。',
        badge: 'badge-danger',
      }
    }

    if (isWanDown) {
      return {
        level: 'warning',
        title: '外网连接中断',
        desc: '局域网主路由正常，但无法访问互联网。可能是光猫断纤、宽带欠费或运营商故障。',
        badge: 'badge-danger',
      }
    }

    if (offlineSubs.length > 0) {
      return {
        level: 'warning',
        title: `${offlineSubs.length} 个分路由离线`,
        desc: `【${offlineSubs.map(s => s.name).join('、')}】失联，Mesh 节点可能断开或信号距离过远。`,
        badge: 'badge-brand',
      }
    }

    const hasHighLatency = allRouters.value.some(r => r.status === 'high-latency')
    if (hasHighLatency) {
      return {
        level: 'caution',
        title: '内网延迟偏高',
        desc: '部分路由器往返延迟超过 150ms，可能存在无线信道拥堵或大流量下载干扰。',
        badge: 'badge-brand',
      }
    }

    return {
      level: 'good',
      title: '家庭网络状态极佳',
      desc: '主网关及所有分路由器连接稳定，外网通畅。',
      badge: 'badge-success',
    }
  })

  let pollTimer: ReturnType<typeof setInterval> | null = null

  const startPolling = (intervalMs = 6000) => {
    stopPolling()
    pollTimer = setInterval(() => {
      if (isPolling.value && isInitialized.value) {
        checkAllNodes()
      }
    }, intervalMs)
  }

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  onMounted(() => {
    loadConfig()
    if (isInitialized.value) {
      checkAllNodes()
    }
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    isInitialized,
    mainRouter,
    subRouters,
    allRouters,
    internetStatus,
    onlineCount,
    networkHealth,
    isPolling,
    isCheckingAll,
    lastCheckedTime,
    loadConfig,
    saveConfig,
    resetConfig,
    checkNode,
    checkAllNodes,
    probeLocalIp,
  }
}
