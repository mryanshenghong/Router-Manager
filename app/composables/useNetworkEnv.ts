import { ref, computed, onMounted, onUnmounted } from 'vue'

export type SimulatedNetworkMode = 'auto' | 'wifi' | 'cellular' | 'offline'

const simulatedMode = ref<SimulatedNetworkMode>('auto')
const realIsOnline = ref(true)
const realConnectionType = ref<string>('unknown')
const realEffectiveType = ref<string>('unknown')
const isLanReachable = ref<boolean | null>(null)

export function useNetworkEnv() {
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

  // 核心判断：是否为移动蜂窝数据网络或脱离家庭局域网模式
  const isCellular = computed(() => {
    if (simulatedMode.value === 'cellular') return true
    if (simulatedMode.value === 'wifi') return false
    if (simulatedMode.value === 'offline') return false

    // 1. 若浏览器 NetworkInformation API 明确报告为蜂窝网络类型（Android Chrome 等）
    const type = realConnectionType.value.toLowerCase()
    if (type === 'cellular' || type === '2g' || type === '3g' || type === '4g' || type === '5g') {
      return true
    }

    // 2. 跨平台智能识别：在外网在线（isOnline === true），但确认无法连通局域网主网关（isLanReachable === false）时，
    // 在移动端代表已脱离家庭 Wi-Fi（如切换至蜂窝数据或连接外部非家庭网络）
    if (realIsOnline.value && isLanReachable.value === false) {
      return true
    }

    return false
  })

  // 是否处于 Wi-Fi 或局域网环境
  const isWifiOrLan = computed(() => {
    if (!isOnline.value) return false
    if (isCellular.value) return false
    return true
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
  }

  const setLanReachable = (reachable: boolean | null) => {
    isLanReachable.value = reachable
  }

  let cleanupListeners: (() => void) | null = null

  onMounted(() => {
    if (typeof window === 'undefined') return

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

    cleanupListeners = () => {
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
    refreshStatus: updateNetworkStatus,
  }
}
