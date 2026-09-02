import { ref, computed, onMounted, onUnmounted } from 'vue'

export type SimulatedNetworkMode = 'auto' | 'wifi' | 'cellular' | 'offline'

const HOME_IP_STORAGE_KEY = 'router_manager_home_ip'

const simulatedMode = ref<SimulatedNetworkMode>('auto')
const realIsOnline = ref(true)
const realConnectionType = ref<string>('unknown')
const realEffectiveType = ref<string>('unknown')
const isLanReachable = ref<boolean | null>(null)

// 公网出口 IP 与家庭网络指纹状态
const currentPublicIp = ref<string>('')
const currentIsp = ref<string>('')
const homePublicIp = ref<string>('')
const isFetchingIp = ref(false)

export function useNetworkEnv() {
  // 从本地持久化存储加载绑定的家庭公网 IP
  const loadHomeIp = () => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(HOME_IP_STORAGE_KEY)
      if (saved) {
        homePublicIp.value = saved.trim()
      }
    } catch {
      // 忽略本地存储异常
    }
  }

  // 绑定指定或当前出口 IP 为家庭网络 IP
  const bindHomePublicIp = (ip?: string) => {
    if (typeof window === 'undefined') return
    const targetIp = (ip || currentPublicIp.value).trim()
    if (!targetIp) return
    homePublicIp.value = targetIp
    try {
      localStorage.setItem(HOME_IP_STORAGE_KEY, targetIp)
    } catch (e) {
      console.error('Failed to save home public IP:', e)
    }
  }

  // 清空绑定的家庭公网 IP
  const clearHomePublicIp = () => {
    if (typeof window === 'undefined') return
    homePublicIp.value = ''
    try {
      localStorage.removeItem(HOME_IP_STORAGE_KEY)
    } catch {
      // 忽略异常
    }
  }

  // 高性能探测当前设备公网出口 IP（双通道容灾，带超时与防缓存时间戳）
  const fetchPublicIp = async (): Promise<string | null> => {
    if (typeof window === 'undefined' || !navigator.onLine) {
      currentPublicIp.value = ''
      return null
    }

    isFetchingIp.value = true
    try {
      const now = Date.now()
      // 首选极速且保证纯 IPv4 的 api.ipify.org（带时间戳严格杜绝 Safari 缓存）
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2500)
      try {
        const res = await fetch(`https://api.ipify.org?format=json&_t=${now}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        clearTimeout(timer)
        if (res.ok) {
          const data = await res.json()
          if (data && data.ip) {
            currentPublicIp.value = String(data.ip).trim()
            return currentPublicIp.value
          }
        }
      } catch {
        clearTimeout(timer)
      }

      // 备选 1: api64.ipify.org (带时间戳)
      try {
        const res = await fetch(`https://api64.ipify.org?format=json&_t=${now}`, {
          signal: AbortSignal.timeout(2500),
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.ip) {
            currentPublicIp.value = String(data.ip).trim()
            return currentPublicIp.value
          }
        }
      } catch {
        // 忽略
      }

      // 备选 2: ipwho.is (同时可获取 ISP 运营商组织信息辅助识别)
      try {
        const res = await fetch(`https://ipwho.is/?_t=${now}`, {
          signal: AbortSignal.timeout(3000),
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.ip) {
            currentPublicIp.value = String(data.ip).trim()
            if (data.connection && data.connection.isp) {
              currentIsp.value = String(data.connection.isp)
            }
            return currentPublicIp.value
          }
        }
      } catch {
        // 忽略
      }

      // 若所有通道均无法连通（说明处于网络切换断续或断网状态），清空当前出口 IP 避免残留旧家庭 IP
      currentPublicIp.value = ''
      return null
    } finally {
      isFetchingIp.value = false
    }
  }

  const isOnline = computed(() => {
    if (simulatedMode.value === 'offline') return false
    if (simulatedMode.value === 'wifi' || simulatedMode.value === 'cellular') return true
    return realIsOnline.value
  })

  const connectionType = computed(() => {
    if (simulatedMode.value === 'cellular') return 'cellular'
    if (simulatedMode.value === 'wifi') return 'wifi'
    if (simulatedMode.value === 'offline') return 'none'
    return realConnectionType.value
  })

  // 核心判断：是否为移动蜂窝数据网络或外部非家庭网络
  const isCellular = computed(() => {
    // 1. 模拟模式优先
    if (simulatedMode.value === 'cellular') return true
    if (simulatedMode.value === 'wifi') return false
    if (simulatedMode.value === 'offline') return false

    // 2. 若浏览器 NetworkInformation API 明确报告为蜂窝网络（Android Chrome 等）
    const type = realConnectionType.value.toLowerCase()
    if (type === 'cellular' || type === '2g' || type === '3g' || type === '4g' || type === '5g') {
      return true
    }

    // 3. 关键防线：外网在线前提下的公网出口 IP 指纹比对（iOS Safari / macOS / 全平台通用）
    // 只有在当前能访问外网（保证不是 Wi-Fi 断网导致的误报）且已绑定家庭 IP 时生效
    if (realIsOnline.value && homePublicIp.value && currentPublicIp.value) {
      if (homePublicIp.value !== currentPublicIp.value) {
        return true
      }
    }

    // 4. 辅助识别：运营商名称包含移动蜂窝特征
    if (realIsOnline.value && currentIsp.value) {
      const ispLower = currentIsp.value.toLowerCase()
      if (
        (ispLower.includes('mobile') || ispLower.includes('cellular') || ispLower.includes('mobility')) &&
        !ispLower.includes('broadband') &&
        !ispLower.includes('fiber')
      ) {
        return true
      }
    }

    return false
  })

  // 是否处于 Wi-Fi 或家庭局域网环境
  const isWifiOrLan = computed(() => {
    if (!isOnline.value) return false
    if (isCellular.value) return false

    // 如果处于本地私网域名/IP 访问（如 NAS/本地电脑）
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host === 'localhost' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
        return true
      }
    }

    // 如果已绑定家庭 IP 且当前 IP 一致
    if (homePublicIp.value && currentPublicIp.value && homePublicIp.value === currentPublicIp.value) {
      return true
    }

    return !isCellular.value
  })

  const updateNetworkStatus = () => {
    if (typeof window === 'undefined') return

    realIsOnline.value = navigator.onLine

    const nav = navigator as any
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection

    if (conn) {
      realConnectionType.value = conn.type || 'unknown'
      realEffectiveType.value = conn.effectiveType || 'unknown'
    } else {
      realConnectionType.value = 'unknown'
      realEffectiveType.value = 'unknown'
    }

    // 在线时异步探测最新公网出口 IP
    if (realIsOnline.value) {
      fetchPublicIp()
    } else {
      currentPublicIp.value = ''
    }
  }

  const setLanReachable = (reachable: boolean | null) => {
    isLanReachable.value = reachable
  }

  let cleanupListeners: (() => void) | null = null

  onMounted(() => {
    if (typeof window === 'undefined') return

    loadHomeIp()
    updateNetworkStatus()

    const handleOnline = () => updateNetworkStatus()
    const handleOffline = () => updateNetworkStatus()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateNetworkStatus()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    const nav = navigator as any
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection
    const handleConnChange = () => updateNetworkStatus()

    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleConnChange)
    }

    // 4 秒心跳探测：在页面处于前台可见时持续轮询公网出口 IP
    // 确保任何网络切换（关闭 Wi-Fi 切 5G、开启/关闭 VPN 等）在 4 秒内必被捕获
    const ipHeartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        updateNetworkStatus()
      }
    }, 4000)

    cleanupListeners = () => {
      clearInterval(ipHeartbeatTimer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', handleConnChange)
      }
    }
  })

  onUnmounted(() => {
    if (cleanupListeners) {
      cleanupListeners()
      cleanupListeners = null
    }
  })

  const setSimulatedMode = (mode: SimulatedNetworkMode) => {
    simulatedMode.value = mode
  }

  return {
    isOnline,
    isCellular,
    isWifiOrLan,
    connectionType,
    effectiveType: realEffectiveType,
    isLanReachable,
    setLanReachable,
    simulatedMode,
    setSimulatedMode,
    currentPublicIp,
    currentIsp,
    homePublicIp,
    isFetchingIp,
    bindHomePublicIp,
    clearHomePublicIp,
    fetchPublicIp,
    refreshStatus: updateNetworkStatus,
  }
}
