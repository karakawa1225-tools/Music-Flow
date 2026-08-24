export function isWebRuntime(): boolean {
  return import.meta.env.VITE_APP_TARGET === 'web'
}

export function isDesktopRuntime(): boolean {
  return !isWebRuntime()
}
