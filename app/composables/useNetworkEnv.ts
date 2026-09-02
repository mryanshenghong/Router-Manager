import { ref, computed, onMounted, onUnmounted } from 'vue'

export type SimulatedNetworkMode = 'auto' | 'wifi' | 'cellular' | 'offline'

const simulatedMode = ref<SimulatedNetworkMode>('auto')
const realIsOnline = ref(true)
const realConnectionType = ref<string>('unknown')
const realEffectiveType = ref<string>('unknown')

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

  // 核心判断：是否为移动蜂窝数据网络
  const isCellular = computed(() => {
    if (simulatedMode.value === 'cellular') return true
    if (simulatedMode.value === 'wifi') return false
    if (simulatedMode.value === 'offline') return false

    const type = realConnectionType.value.toLowerCase()
    // 标准 NetworkInformation API 的 cellular 类型，如 cellular, 2g, 3g, 4g 等
    if (type === 'cellular') return true
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

  let cleanupListeners: (() => void) | null = null

  onMounted(() => {
    if (typeof window === 'undefined') return

    updateNetworkStatus()

    const handleOnline = () => updateNetworkStatus()
    const handleOffline = () => updateNetworkStatus()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const nav = navigator as any
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection
    const handleConnChange = () => updateNetworkStatus()

    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleConnChange)
    }

    cleanupListeners = () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
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
    simulatedMode,
    setSimulatedMode,
    refreshStatus: updateNetworkStatus,
  }
}
