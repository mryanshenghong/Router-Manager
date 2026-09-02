import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNetworkEnv } from '~/composables/useNetworkEnv'

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
  const { setLanReachable } = useNetworkEnv()

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
    setLanReachable(null)
  }

  // 核心探针算法：带超时的局域网 HTTP 往返探测
  const probeLocalIp = async (ip: string, timeoutMs = 2500): Promise<{ ok: boolean; latency: number }> => {
    const { isCellular, isWifiOrLan, homePublicIp, currentPublicIp } = useNetworkEnv()

    // 1. 若当前明确处于移动蜂窝网络（5G/4G）或非家庭公网环境，私网 IP 绝不可达，坚决判定离线
    if (isCellular.value) {
      return { ok: false, latency: timeoutMs }
    }

    const start = performance.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      // 通过 mode: 'no-cors' 发起 GET 请求探测局域网 IP
      // 若设备在局域网存活并提供 Web 服务，TCP 握手完成并返回 HTTP 响应，fetch 顺利 resolve 为 opaque response
      await fetch(`http://${ip}/?_probe=${Date.now()}`, {
        method: 'GET',
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

      // 真正超时（如 2.5 秒后仍无响应）：确定是目标设备离线或不可达
      if (e.name === 'AbortError' || latency >= timeoutMs - 100) {
        return { ok: false, latency: timeoutMs }
      }

      // 平台适配：云端 HTTPS 部署下的 PWA 客户端沙箱环境
      const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:'
      if (isHttpsPage) {
        // 若已绑定家庭出口 IP 且当前出口 IP 完全匹配：确认为家庭 Wi-Fi 环境，赋予基准局域网延迟
        if (homePublicIp.value && currentPublicIp.value && homePublicIp.value === currentPublicIp.value) {
          return { ok: true, latency: Math.max(8, latency) }
        }

        // 若尚未绑定家庭 IP，但在推测的 Wi-Fi/局域网环境下
        if (!homePublicIp.value && isWifiOrLan.value) {
          return { ok: true, latency: Math.max(8, latency) }
        }

        // 其它情况（如出口 IP 不匹配或无法确定家庭网络）：安全起见判定为不可达
        return { ok: false, latency: timeoutMs }
      }

      return { ok: false, latency: timeoutMs }
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
      const { fetchPublicIp } = useNetworkEnv()
      // 先行同步刷新当前最新公网出口 IP，保证节点判定时网络指纹绝对新鲜
      await fetchPublicIp()

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

      // 同步局域网主网关连通性状态到全局网络环境
      if (mainRouter.value.status === 'online' || mainRouter.value.status === 'high-latency') {
        setLanReachable(true)
      } else if (mainRouter.value.status === 'offline') {
        setLanReachable(false)
      }
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
    const { isCellular, currentPublicIp, homePublicIp } = useNetworkEnv()
    const isMainDown = mainRouter.value.status === 'offline'
    const isWanDown = internetStatus.value.status === 'offline'
    const offlineSubs = subRouters.value.filter(s => s.status === 'offline')

    // 1. 若处于移动蜂窝网络环境（如 5G/4G 或开启了蜂窝模拟）
    if (isCellular.value) {
      const ipMismatch = homePublicIp.value && currentPublicIp.value && homePublicIp.value !== currentPublicIp.value
      return {
        level: 'warning',
        title: '5G 移动蜂窝数据模式',
        desc: ipMismatch
          ? `当前公网出口 IP（${currentPublicIp.value}）与绑定的家庭网络（${homePublicIp.value}）不一致。无法直连家庭私网设备，请连接家庭 Wi-Fi。`
          : '当前处于移动蜂窝网络，无法访问 192.168.x.x 等本地私网网关。如需管理家庭路由器，请连接家庭 Wi-Fi。',
        badge: 'badge-brand',
      }
    }

    // 2. 若主网关离线，但外网正常（典型为脱离家庭 Wi-Fi 进入外部网络）
    if (isMainDown && !isWanDown) {
      return {
        level: 'critical',
        title: '无法连接主网关 (未连家庭 Wi-Fi)',
        desc: `当前公网通畅，但无法连通主路由器（${mainRouter.value.ip}）。您可能处于移动数据或外部非家庭网络，请连接家庭 Wi-Fi。`,
        badge: 'badge-danger',
      }
    }

    // 3. 若外网中断（宽带欠费/光猫断纤），但局域网主路由存活
    if (isWanDown && !isMainDown) {
      return {
        level: 'warning',
        title: '外网连接中断',
        desc: '局域网主路由正常，但无法访问互联网。可能是光猫断纤、宽带欠费或运营商故障。',
        badge: 'badge-danger',
      }
    }

    // 4. 若主网关离线且外网断开（Wi-Fi 彻底关闭或总电源故障）
    if (isMainDown && isWanDown) {
      return {
        level: 'critical',
        title: '主网关失联且外网断开',
        desc: `无法连通主路由器（${mainRouter.value.ip}）且无公网连接。请检查手机 Wi-Fi 开关或路由器电源是否接通。`,
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

  let cleanupListeners: (() => void) | null = null

  onMounted(() => {
    loadConfig()
    if (isInitialized.value) {
      checkAllNodes()
    }
    startPolling()

    if (typeof window !== 'undefined') {
      const handleVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          if (isInitialized.value) {
            checkAllNodes()
          }
        }
      }

      const handleOnline = () => {
        if (isInitialized.value) {
          checkAllNodes()
        }
      }

      window.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('focus', handleVisibility)
      window.addEventListener('online', handleOnline)

      cleanupListeners = () => {
        window.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleVisibility)
        window.removeEventListener('online', handleOnline)
      }
    }
  })

  onUnmounted(() => {
    stopPolling()
    if (cleanupListeners) {
      cleanupListeners()
      cleanupListeners = null
    }
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
