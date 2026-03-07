import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '../../stores'
import { SettingsSidebar, type SettingsTab } from './settings-sidebar'
import { ThemeSelector } from './theme-selector'
import { TerminalSettings } from './terminal-settings'
import { NotificationSettings } from './notification-settings'
import { UpdateSettings } from './update-settings'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [isSaving, setIsSaving] = useState(false)
  const { saveSettings, cancelSettings, hasUnsavedChanges } = useSettingsStore()

  const handleCancel = useCallback(() => {
    cancelSettings()
    onClose()
  }, [cancelSettings, onClose])

  // ESC key to close (cancel changes)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, handleCancel])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveSettings()
      onClose()
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 top-10 z-50">
      {/* Backdrop - dark mode: black 80%, light mode: white 80% - starts below titlebar */}
      <div
        data-testid="settings-backdrop"
        className="absolute inset-0 bg-[var(--mc-backdrop)]"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Modal - absolute inset so size is truly fixed regardless of content */}
      <div data-testid="settings-modal" className="absolute inset-4 bottom-14 bg-[var(--mc-bg-primary)] rounded-lg shadow-xl flex flex-col border border-[var(--mc-border)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--mc-border)]">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <SettingsIcon />
              Settings
            </h2>
            <p className="text-sm text-[var(--mc-text-muted)]">App Settings</p>
          </div>
          <button
            data-testid="settings-close-button"
            onClick={handleCancel}
            className="p-1.5 hover:bg-[var(--mc-bg-hover)] rounded transition-colors"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 p-4 overflow-auto">
            {activeTab === 'appearance' && <ThemeSelector />}
            {activeTab === 'terminals' && <TerminalSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'updates' && <UpdateSettings />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--mc-border)]">
          <button
            data-testid="settings-cancel-button"
            onClick={handleCancel}
            className="px-4 py-2 rounded text-sm bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="settings-save-button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className="px-4 py-2 rounded text-sm bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SaveIcon />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SettingsPanelContentProps {
  onClose: () => void
}

/** Settings content for use inside a SlidePanel container */
export function SettingsPanelContent({ onClose }: SettingsPanelContentProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [isSaving, setIsSaving] = useState(false)
  const { saveSettings, cancelSettings, hasUnsavedChanges } = useSettingsStore()

  const handleCancel = useCallback(() => {
    cancelSettings()
    onClose()
  }, [cancelSettings, onClose])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveSettings()
      onClose()
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Horizontal tab bar */}
      <div data-testid="settings-sidebar" className="flex border-b border-[var(--mc-border)] flex-shrink-0">
        {(['appearance', 'terminals', 'notifications', 'updates'] as SettingsTab[]).map(tab => (
          <button
            key={tab}
            data-testid={`settings-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className="px-3 py-2 text-xs capitalize"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color var(--transition-fast)',
              fontFamily: 'inherit'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-4 overflow-auto min-h-0">
        {activeTab === 'appearance' && <ThemeSelector />}
        {activeTab === 'terminals' && <TerminalSettings />}
        {activeTab === 'notifications' && <NotificationSettings />}
        {activeTab === 'updates' && <UpdateSettings />}
      </div>

      {/* Footer: save/cancel */}
      <div className="flex justify-end gap-2 p-3 border-t border-[var(--mc-border)] flex-shrink-0">
        <button
          data-testid="settings-cancel-button"
          onClick={handleCancel}
          className="px-4 py-1.5 text-sm bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] transition-colors"
          style={{ border: '1px solid var(--border)', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          data-testid="settings-save-button"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="px-4 py-1.5 text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
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
