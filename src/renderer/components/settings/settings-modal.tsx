import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useNotificationStore, useSettingsStore, useToastStore } from '../../stores'
import { SettingsSidebar, type SettingsTab } from './settings-sidebar'
import { ThemeSelector } from './theme-selector'
import { TerminalSettings } from './terminal-settings'
import { NotificationSettings } from './notification-settings'
import { UpdateSettings } from './update-settings'
import { DiagnosticsSettings } from './diagnostics-settings'
import { AgentsIntegrationsSettings } from './agents-integrations-settings'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [isSaving, setIsSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const isSavingRef = useRef(false)
  const isOpenRef = useRef(isOpen)
  const wasOpenRef = useRef(isOpen)
  const closeRollbackHandledRef = useRef(false)
  const { saveSettings, cancelSettings, hasUnsavedChanges } = useSettingsStore()
  const {
    saveSettings: saveNotificationSettings,
    cancelSettings: cancelNotificationSettings,
    hasUnsavedChanges: hasUnsavedNotificationChanges,
    loadSettings: loadNotificationSettings
  } = useNotificationStore()
  const hasAnyUnsavedChanges = hasUnsavedChanges || hasUnsavedNotificationChanges

  const rollbackPendingSettings = useCallback(() => {
    cancelSettings()
    cancelNotificationSettings()
  }, [cancelNotificationSettings, cancelSettings])

  const handleCancel = useCallback(() => {
    if (isSavingRef.current) return
    if (!closeRollbackHandledRef.current) {
      closeRollbackHandledRef.current = true
      rollbackPendingSettings()
    }
    onClose()
  }, [onClose, rollbackPendingSettings])

  // App owns modal visibility, so a prop-driven close must discard previews too.
  // Layout timing prevents a dirty preview from reaching the next paint.
  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current
    isOpenRef.current = isOpen

    if (isOpen && !wasOpen) {
      closeRollbackHandledRef.current = false
    } else if (wasOpen && !isOpen && !isSavingRef.current && !closeRollbackHandledRef.current) {
      closeRollbackHandledRef.current = true
      rollbackPendingSettings()
    }

    wasOpenRef.current = isOpen
  }, [isOpen, rollbackPendingSettings])

  // Keep keyboard focus inside the modal and restore it on close.
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement
    const frame = requestAnimationFrame(() => {
      modalRef.current
        ?.querySelector<HTMLElement>('[aria-label="Close Settings"]')
        ?.focus()
    })
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isSavingRef.current) handleCancel()
        return
      }
      if (event.key !== 'Tab' || !modalRef.current) return
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyboard)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [isOpen, handleCancel])

  useEffect(() => {
    if (isOpen) {
      void loadNotificationSettings()
    }
  }, [isOpen, loadNotificationSettings])

  const handleSave = async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    setIsSaving(true)
    try {
      const saveOperations: Promise<void>[] = []

      if (hasUnsavedChanges) {
        saveOperations.push(saveSettings())
      }

      if (hasUnsavedNotificationChanges) {
        saveOperations.push(saveNotificationSettings())
      }

      const results = await Promise.allSettled(saveOperations)
      if (results.some(({ status }) => status === 'rejected')) {
        cancelNotificationSettings()
        useToastStore.getState().addToast(
          'Failed to save settings. Please try again.',
          'error'
        )
      } else if (isOpenRef.current) {
        onClose()
      }
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 top-10 z-50 flex items-center justify-center">
      {/* Backdrop - dark mode: black 80%, light mode: white 80% - starts below titlebar */}
      <div
        data-testid="settings-backdrop"
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
        onClick={isSaving ? undefined : handleCancel}
        aria-hidden="true"
      />

      {/* Modal - centered with max dimensions */}
      <div
        data-testid="settings-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-busy={isSaving}
        aria-labelledby="settings-dialog-title"
        className="relative bg-[var(--mc-bg-primary)] shadow-xl flex flex-col overflow-hidden rounded-xl"
        style={{ border: '1px solid color-mix(in srgb, var(--mc-accent) 30%, var(--mc-border))', width: 'calc(100% - 80px)', height: 'calc(100% - 60px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '25px 40px 25px 32px', borderBottom: '1px solid color-mix(in srgb, var(--mc-accent) 20%, var(--mc-border))' }}>
          <div>
            <h2 id="settings-dialog-title" className="text-xl font-semibold flex items-center gap-2">
              <span style={{ color: 'var(--mc-accent)' }}><SettingsIcon /></span>
              Settings
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--mc-accent)', opacity: 0.7 }}>Preferences, diagnostics &amp; integrations</p>
          </div>
          <button
            data-testid="settings-close-button"
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1.5 rounded transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--mc-accent)', border: 'none', background: 'transparent', cursor: isSaving ? 'not-allowed' : 'pointer' }}
            title="Close"
            aria-label="Close Settings"
          >
            <CloseIcon />
          </button>
        </div>

        <fieldset
          data-testid="settings-form"
          disabled={isSaving}
          className="m-0 min-w-0 border-0 p-0 flex flex-1 flex-col overflow-hidden"
        >
          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="flex-1 overflow-y-scroll text-left" style={{ padding: '32px 40px', scrollbarGutter: 'stable' }}>
              {activeTab === 'appearance' && <ThemeSelector />}
              {activeTab === 'terminals' && <TerminalSettings />}
              {activeTab === 'notifications' && <NotificationSettings onNavigateToMobile={() => setActiveTab('agents-integrations')} />}
              {activeTab === 'diagnostics' && <DiagnosticsSettings />}
              {activeTab === 'agents-integrations' && <AgentsIntegrationsSettings />}
              {activeTab === 'updates' && <UpdateSettings />}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-4" style={{ padding: '25px 40px 25px 32px', borderTop: '1px solid color-mix(in srgb, var(--mc-accent) 20%, var(--mc-border))' }}>
            <button
              data-testid="settings-cancel-button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-lg text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: '10px 28px', background: 'transparent', border: '2px solid var(--mc-text-secondary)', color: 'var(--mc-text-primary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mc-text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mc-text-secondary)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              Cancel
            </button>
            <button
              data-testid="settings-save-button"
              onClick={handleSave}
              disabled={!hasAnyUnsavedChanges || isSaving}
              className="rounded-lg text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ padding: '10px 28px', background: 'var(--mc-accent)', color: 'var(--mc-bg-primary)', border: '2px solid var(--mc-accent)', boxShadow: '0 0 12px color-mix(in srgb, var(--mc-accent) 50%, transparent)' }}
            >
              <SaveIcon />
              {isSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}

// Icons
function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  )
}
