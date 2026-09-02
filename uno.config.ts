import {
  defineConfig,
  presetUno,
  presetIcons,
  presetAttributify,
  presetTypography,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: false,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  theme: {
    colors: {
      brand: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554',
      },
    },
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
  },
  shortcuts: [
    // 布局快捷
    ['flex-center', 'flex items-center justify-center'],
    ['flex-between', 'flex items-center justify-between'],
    ['flex-col-center', 'flex flex-col items-center justify-center'],

    // 玻璃拟态与容器
    ['glass-panel', 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80'],
    ['card-base', 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm'],

    // 状态徽章
    ['badge-base', 'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-colors'],
    ['badge-brand', 'badge-base bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-950/50 dark:text-brand-400 dark:border-brand-800'],
    ['badge-success', 'badge-base bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'],
    ['badge-danger', 'badge-base bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800'],

    // 按钮体系
    ['btn-base', 'inline-flex items-center justify-center font-medium rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed select-none'],
    ['btn-primary', 'btn-base px-4 py-2 text-sm bg-brand-600 text-white hover:bg-brand-700 active:scale-98 shadow-sm hover:shadow-brand-500/25'],
    ['btn-secondary', 'btn-base px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-98'],
    ['btn-danger', 'btn-base px-4 py-2 text-sm bg-rose-600 text-white hover:bg-rose-700 active:scale-98 shadow-sm hover:shadow-rose-500/25'],
    ['btn-ghost', 'btn-base px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'],
    ['btn-sm', 'px-2.5 py-1 text-xs rounded-md'],

    // 交互 Toast 弹窗
    ['toast-box', 'pointer-events-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 w-full max-w-sm flex flex-col gap-3'],
  ],
})
