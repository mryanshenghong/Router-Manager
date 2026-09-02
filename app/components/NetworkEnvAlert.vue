<script setup lang="ts">
import { ref } from 'vue'
import { useNetworkEnv } from '~/composables/useNetworkEnv'

const {
  isCellular,
  connectionType,
  effectiveType,
  simulatedMode,
  setSimulatedMode,
  refreshStatus,
} = useNetworkEnv()

const isDismissedForPreview = ref(false)

const handleRefresh = () => {
  refreshStatus()
  isDismissedForPreview.value = false
}
</script>

<template>
  <div v-if="isCellular && !isDismissedForPreview" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md transition-all">
    <div
      class="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fade-in"
      role="alertdialog"
      aria-labelledby="non-wifi-alert-title"
    >
      <!-- 顶部警示横条与插图 -->
      <div class="bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-transparent p-6 sm:p-8 flex flex-col items-center text-center relative border-b border-slate-100 dark:border-slate-800/80">
        <div class="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-center mb-4 ring-8 ring-amber-500/10 shadow-inner">
          <span class="i-carbon-cellular-off text-3xl" />
        </div>

        <span class="badge-base bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 mb-2">
          非家庭 Wi-Fi 网络
        </span>

        <h2 id="non-wifi-alert-title" class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          检测到当前使用移动蜂窝数据
        </h2>

        <p class="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
          家庭路由器管理器需要直接与本地私网网关通信（如 192.168.1.1 等局域网 IP）。在移动数据环境下无法访问内网，应用已暂停监控。
        </p>
      </div>

      <!-- 操作与引导区 -->
      <div class="p-6 sm:p-8 space-y-4">
        <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/50 space-y-2">
          <div class="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span class="i-carbon-information text-brand-500 text-sm" />
            <span>建议操作指南</span>
          </div>
          <ul class="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-disc list-inside">
            <li>进入手机或电脑设置，开启 <strong class="text-slate-700 dark:text-slate-300">Wi-Fi 无线网络</strong></li>
            <li>连接至您的家庭主路由器或 Mesh 分路由器 Wi-Fi</li>
            <li>连接成功后点击下方“重新检测网络”即可自动唤醒</li>
          </ul>
        </div>

        <!-- 详细网络信息 -->
        <div class="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
          <span>网络模式: {{ connectionType }}</span>
          <span>网络级别: {{ effectiveType }}</span>
        </div>

        <!-- 按钮组 -->
        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            class="btn-primary flex-1 py-3 text-sm shadow-md shadow-brand-500/20"
            @click="handleRefresh"
          >
            <span class="i-carbon-renew mr-1.5 text-base" />
            重新检测网络
          </button>

          <button
            class="btn-secondary py-3 text-xs"
            @click="isDismissedForPreview = true"
          >
            仍要进入预览
          </button>
        </div>

        <!-- 开发者/测试模拟工具切换 -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span class="text-xs text-slate-400">开发与环境测试：</span>
          <div class="flex items-center gap-1.5">
            <button
              class="btn-ghost btn-sm text-xs"
              :class="simulatedMode === 'auto' ? 'bg-slate-200 dark:bg-slate-700 font-bold' : ''"
              @click="setSimulatedMode('auto')"
            >
              自动
            </button>
            <button
              class="btn-ghost btn-sm text-xs text-emerald-600 dark:text-emerald-400"
              :class="simulatedMode === 'wifi' ? 'bg-emerald-100 dark:bg-emerald-950 font-bold' : ''"
              @click="setSimulatedMode('wifi')"
            >
              模拟 Wi-Fi
            </button>
            <button
              class="btn-ghost btn-sm text-xs text-amber-600 dark:text-amber-400"
              :class="simulatedMode === 'cellular' ? 'bg-amber-100 dark:bg-amber-950 font-bold' : ''"
              @click="setSimulatedMode('cellular')"
            >
              模拟蜂窝
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
