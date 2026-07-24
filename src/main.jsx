import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Capacitor } from '@capacitor/core'
import { initializeNativeDeepLinks } from './services/nativeDeepLinks.js'

const LEGACY_SW_CLEANUP_FLAG = 'heritage-sw-cleanup-v1'

try {
  if (Capacitor.isNativePlatform?.()) {
    document.documentElement.classList.add('capacitor-native', `capacitor-${Capacitor.getPlatform()}`)
  }
} catch {
  // Platform classes are only a progressive enhancement.
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled app error:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center shadow">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            The app hit an unexpected error during startup or rendering.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-blue-700 transition-colors"
          >
            Reload App
          </button>
        </div>
      </div>
    )
  }
}

async function cleanupLegacyServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  try {
    if (localStorage.getItem(LEGACY_SW_CLEANUP_FLAG) === 'done') return
  } catch {
    // Ignore storage errors.
  }

  let hadLegacyRegistration = false
  let hasController = false

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    hadLegacyRegistration = registrations.length > 0
    await Promise.all(registrations.map(registration => registration.unregister().catch(() => false)))
    hasController = Boolean(navigator.serviceWorker.controller)
  } catch (error) {
    console.warn('Service worker cleanup failed', error)
  }

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName).catch(() => false)))
    }
  } catch (error) {
    console.warn('Cache cleanup failed', error)
  }

  try {
    localStorage.setItem(LEGACY_SW_CLEANUP_FLAG, 'done')
  } catch {
    // Ignore storage errors.
  }

  if (hadLegacyRegistration || hasController) {
    window.location.reload()
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)

initializeNativeDeepLinks().catch(error => {
  console.warn('Native app-link startup failed', error)
})

// PWA/SW intentionally disabled for reliability; keep one-time cleanup for legacy registrations.
window.addEventListener('load', () => {
  cleanupLegacyServiceWorker().catch(error => {
    console.warn('Legacy service worker cleanup error', error)
  })
})
