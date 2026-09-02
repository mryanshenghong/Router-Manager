<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const platform = ref<'mac-safari' | 'ios-safari' | 'chrome' | 'other'>('chrome')
const copied = ref(false)

onMounted(() => {
  if (typeof window !== 'undefined') {
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isMac = /Macintosh|Mac OS X/i.test(ua)
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua)

    if (isIOS) {
      platform.value = 'ios-safari'
    } else if (isMac && isSafari) {
      platform.value = 'mac-safari'
    } else if (/Chrome|CriOS|Edg/i.test(ua)) {
      platform.value = 'chrome'
    } else {
      platform.value = 'other'
    }
  }
})

const copyUrl = async () => {
  if (typeof window !== 'undefined') {
    try {
      await navigator.clipboard.writeText(window.location.href)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch {
      // 降级兼容
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-2"
        >
          <div
            v-if="show"
            class="card-base w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
          >
            <!-- 头部 -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex-center">
                  <span class="i-carbon-download text-xl" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-slate-900 dark:text-white">
                    安装 Router Manager
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    无需应用商店，一键添加为独立桌面/手机应用
                  </p>
                </div>
              </div>
              <button
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                @click="emit('close')"
              >
                <span class="i-carbon-close text-lg" />
              </button>
            </div>

            <!-- 分平台指南 -->
            <div class="space-y-3">
              <!-- macOS Safari 指引 -->
              <div
                v-if="platform === 'mac-safari'"
                class="p-4 rounded-xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/50 space-y-3"
              >
                <div class="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                  <span class="i-carbon-laptop" />
                  <span>检测到 macOS Safari 浏览器</span>
                </div>
                <ol class="text-xs text-slate-700 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    点击屏幕顶部菜单栏的 <strong class="text-brand-600 dark:text-brand-400">「文件 (File)」</strong>
                  </li>
                  <li>
                    选择 <strong class="text-brand-600 dark:text-brand-400">「添加到程序坞 (Add to Dock)...」</strong>
                  </li>
                  <li>
                    点击弹窗右下角的 <strong class="text-brand-600 dark:text-brand-400">「添加」</strong> 即可像独立 Mac 应用一样运行
                  </li>
                </ol>
              </div>

              <!-- iOS Safari 指引 -->
              <div
                v-else-if="platform === 'ios-safari'"
                class="p-4 rounded-xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/50 space-y-3"
              >
                <div class="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                  <span class="i-carbon-mobile" />
                  <span>检测到 iPhone / iPad (iOS Safari)</span>
                </div>
                <ol class="text-xs text-slate-700 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    点击 Safari 底部工具栏正中的 <strong class="text-brand-600 dark:text-brand-400">「分享」</strong> 按钮
                  </li>
                  <li>
                    在滑动菜单中选择 <strong class="text-brand-600 dark:text-brand-400">「添加到主屏幕」</strong>
                  </li>
                  <li>
                    点击右上角 <strong class="text-brand-600 dark:text-brand-400">「添加」</strong>，即可在主屏幕像 App 一样启动
                  </li>
                </ol>
              </div>

              <!-- Chrome / Chromium / 无痕模式指引 -->
              <div
                v-else-if="platform === 'chrome'"
                class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3"
              >
                <div class="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span class="i-carbon-application" />
                  <span>Chrome / Edge 浏览器指引</span>
                </div>
                <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                  <li class="flex items-start gap-2">
                    <span class="text-amber-500 font-bold text-sm leading-none">•</span>
                    <span><strong>无痕窗口限制</strong>：无痕模式出于隐私保护禁用了 PWA 安装功能。若当前是无痕模式，请复制网址并在<strong>正常窗口</strong>中打开。</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="text-brand-500 font-bold text-sm leading-none">•</span>
                    <span><strong>正常窗口安装</strong>：点击地址栏最右侧的电脑+向下箭头 <strong class="text-brand-600 dark:text-brand-400">「安装」</strong> 图标，或右上角菜单 <strong class="text-brand-600 dark:text-brand-400">「保存并共享」➔「安装 Router Manager」</strong>。</span>
                  </li>
                </ul>
              </div>

              <!-- 其他浏览器 -->
              <div
                v-else
                class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2"
              >
                <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  安装指引
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  推荐使用 Chrome、Edge 或 Safari 打开本页面。通过浏览器菜单中的「添加到主屏幕」或「安装应用」即可完成安装。
                </p>
              </div>
            </div>

            <!-- 底部操作按钮 -->
            <div class="flex items-center justify-between gap-3 pt-2">
              <button
                class="btn-secondary text-xs flex items-center gap-1.5"
                @click="copyUrl"
              >
                <span :class="copied ? 'i-carbon-checkmark text-emerald-500' : 'i-carbon-copy'" />
                <span>{{ copied ? '网址已复制' : '复制网址' }}</span>
              </button>
              <button
                class="btn-primary text-xs px-5"
                @click="emit('close')"
              >
                我知道了
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
