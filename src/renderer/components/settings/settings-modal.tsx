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
    <div className="fixed inset-0 top-10 z-50 flex items-center justify-center">
      {/* Backdrop - dark mode: black 80%, light mode: white 80% - starts below titlebar */}
      <div
        data-testid="settings-backdrop"
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Modal - centered with max dimensions */}
      <div data-testid="settings-modal" className="relative bg-[var(--mc-bg-primary)] shadow-xl flex flex-col overflow-hidden rounded-xl" style={{ border: '1px solid color-mix(in srgb, var(--mc-accent) 30%, var(--mc-border))', width: 'calc(100% - 80px)', height: 'calc(100% - 60px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '25px 40px 25px 32px', borderBottom: '1px solid color-mix(in srgb, var(--mc-accent) 20%, var(--mc-border))' }}>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span style={{ color: 'var(--mc-accent)' }}><SettingsIcon /></span>
              Settings
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--mc-accent)', opacity: 0.7 }}>App Settings & Project Settings</p>
          </div>
          <button
            data-testid="settings-close-button"
            onClick={handleCancel}
            className="p-1.5 rounded transition-colors hover:bg-[var(--mc-bg-hover)]"
            style={{ color: 'var(--mc-accent)', border: 'none', background: 'transparent', cursor: 'pointer' }}
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 overflow-y-scroll text-left" style={{ padding: '32px 40px', scrollbarGutter: 'stable' }}>
            {activeTab === 'appearance' && <ThemeSelector />}
            {activeTab === 'terminals' && <TerminalSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'updates' && <UpdateSettings />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4" style={{ padding: '25px 40px 25px 32px', borderTop: '1px solid color-mix(in srgb, var(--mc-accent) 20%, var(--mc-border))' }}>
          <button
            data-testid="settings-cancel-button"
            onClick={handleCancel}
            className="rounded-lg text-base font-semibold transition-all"
            style={{ padding: '10px 28px', background: 'transparent', border: '2px solid var(--mc-text-secondary)', color: 'var(--mc-text-primary)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mc-text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mc-text-secondary)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            Cancel
          </button>
          <button
            data-testid="settings-save-button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className="rounded-lg text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ padding: '10px 28px', background: 'var(--mc-accent)', color: 'var(--mc-bg-primary)', border: '2px solid var(--mc-accent)', boxShadow: '0 0 12px color-mix(in srgb, var(--mc-accent) 50%, transparent)' }}
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
      <div className="flex-1 overflow-auto min-h-0" style={{ padding: '32px 40px' }}>
        {activeTab === 'appearance' && <ThemeSelector />}
        {activeTab === 'terminals' && <TerminalSettings />}
        {activeTab === 'notifications' && <NotificationSettings />}
        {activeTab === 'updates' && <UpdateSettings />}
      </div>

      {/* Footer: save/cancel */}
      <div className="flex justify-end gap-4 flex-shrink-0" style={{ padding: '16px 24px', borderTop: '1px solid color-mix(in srgb, var(--mc-accent) 20%, var(--mc-border))' }}>
        <button
          data-testid="settings-cancel-button"
          onClick={handleCancel}
          className="rounded-lg text-base font-semibold transition-all"
          style={{ padding: '8px 20px', background: 'transparent', border: '2px solid var(--mc-text-secondary)', color: 'var(--mc-text-primary)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mc-text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-bg-hover)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mc-text-secondary)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          Cancel
        </button>
        <button
          data-testid="settings-save-button"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="rounded-lg text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ padding: '8px 20px', background: 'var(--mc-accent)', color: 'var(--mc-bg-primary)', border: '2px solid var(--mc-accent)', boxShadow: '0 0 12px color-mix(in srgb, var(--mc-accent) 50%, transparent)' }}
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
