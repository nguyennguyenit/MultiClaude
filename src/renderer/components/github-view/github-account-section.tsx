import { useState, useEffect, useCallback, useRef } from 'react'
import type { GitHubAuth, GitConfig } from '@shared/types'

interface GitHubAccountSectionProps {
  currentBranch: string | undefined
  hasRemote: boolean
}

export function GitHubAccountSection({ currentBranch, hasRemote }: GitHubAccountSectionProps) {
  const [auth, setAuth] = useState<GitHubAuth | null>(null)
  const [config, setConfig] = useState<GitConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  // Inline edit state
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Fetch both auth status and git config in parallel
  const fetchAll = useCallback(async () => {
    try {
      const [authRes, configRes] = await Promise.all([
        window.electron.github.authStatus(),
        window.electron.git.configGet()
      ])
      setAuth(authRes)
      setConfig(configRes)
    } catch {
      // silently fail — panel still renders with empty state
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
  }, [fetchAll])

  // Focus name input when entering edit mode
  useEffect(() => {
    if (editingIdentity) {
      nameInputRef.current?.focus()
    }
  }, [editingIdentity])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  const handleLogin = async () => {
    setLoggingIn(true)
    try {
      await window.electron.github.login()
      await fetchAll()
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await window.electron.github.logout()
    await fetchAll()
  }

  const startEditIdentity = () => {
    setEditName(config?.userName ?? '')
    setEditEmail(config?.userEmail ?? '')
    setEditingIdentity(true)
  }

  const cancelEditIdentity = () => setEditingIdentity(false)

  const saveIdentity = async () => {
    setSaving(true)
    try {
      await window.electron.git.configSet({ userName: editName, userEmail: editEmail })
      const configRes = await window.electron.git.configGet()
      setConfig(configRes)
      setEditingIdentity(false)
    } finally {
      setSaving(false)
    }
  }

  const handleIdentityKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveIdentity()
    if (e.key === 'Escape') cancelEditIdentity()
  }

  if (loading) return <LoadingSkeleton />

  const isAuthenticated = auth?.isAuthenticated ?? false

  return (
    <div style={{
      borderTop: '1px solid var(--mc-border)',
      flexShrink: 0,
      background: 'var(--mc-bg-primary, #0d1117)',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
    }}>
      {/* Collapsed: single compact row — click to expand */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          title="Show GitHub Account"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            width: '100%',
            padding: '6px 10px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <Avatar username={auth?.username} authenticated={isAuthenticated} size={20} />
          <span style={{
            fontSize: 12,
            color: 'var(--mc-text-secondary, #8b949e)',
            whiteSpace: 'nowrap',
          }}>
            {auth?.username ?? 'GitHub Account'}
          </span>
          {isAuthenticated && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950', flexShrink: 0 }} />
          )}
          <span style={{ color: 'var(--mc-text-muted, #6e7681)', fontSize: 10, flexShrink: 0 }}>▾</span>
        </button>
      ) : (
        <>
          {/* Minimal collapse button — just a small chevron icon at the right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '4px 10px 0',
          }}>
            <IconBtn onClick={() => setCollapsed(true)} title="Collapse">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </IconBtn>
          </div>

          {/* Bordered content card */}
          <div style={{ padding: '4px 10px 12px' }}>
            <div style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.03)',
            }}>
              {/* Account info block */}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* "GITHUB ACCOUNT" label inside card, above avatar row */}
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--mc-text-muted, #6e7681)',
                  textTransform: 'uppercase',
                }}>
                  GitHub Account
                </span>
                {/* Avatar + username + action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar username={auth?.username} authenticated={isAuthenticated} size={36} />
                  {/* Username + status — takes remaining space */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--mc-text-primary, #e6edf3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {auth?.username ?? 'Not signed in'}
                    </span>
                    <ConnectionStatus connected={isAuthenticated} />
                  </div>
                  {/* Refresh + login/logout next to name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <IconBtn onClick={handleRefresh} title="Refresh" disabled={refreshing}>
                      <RefreshIcon spinning={refreshing} />
                    </IconBtn>
                    {isAuthenticated ? (
                      <IconBtn onClick={handleLogout} title="Logout">
                        <LogoutIcon />
                      </IconBtn>
                    ) : (
                      <TextBtn onClick={handleLogin} disabled={loggingIn}>
                        {loggingIn ? 'Opening…' : 'Login'}
                      </TextBtn>
                    )}
                  </div>
                </div>

                {/* Branch + remote indicators */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {currentBranch && <BranchBadge branch={currentBranch} />}
                  {hasRemote && <RemoteBadge />}
                </div>
              </div>

              {/* Git Identity block — separated by border */}
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    color: 'var(--mc-text-muted, #6e7681)',
                    textTransform: 'uppercase',
                  }}>
                    Git Identity
                  </span>
                  {!editingIdentity && (
                    <IconBtn onClick={startEditIdentity} title="Edit git identity">
                      <PencilIcon />
                    </IconBtn>
                  )}
                </div>

                {editingIdentity ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      ref={nameInputRef}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={handleIdentityKeyDown}
                      placeholder="Your name"
                      style={inputStyle}
                    />
                    <input
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      onKeyDown={handleIdentityKeyDown}
                      placeholder="you@example.com"
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <TextBtn onClick={cancelEditIdentity} disabled={saving} secondary>Cancel</TextBtn>
                      <TextBtn onClick={saveIdentity} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </TextBtn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <IdentityRow icon={<UserIcon />} value={config?.userName} placeholder="No name set" />
                    <IdentityRow icon={<MailIcon />} value={config?.userEmail} placeholder="No email set" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ username, authenticated, size = 32 }: { username?: string; authenticated: boolean; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const showImg = authenticated && username && !imgError
  const iconSize = Math.round(size * 0.5)

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      flexShrink: 0,
      background: 'var(--mc-bg-hover, rgba(255,255,255,0.07))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {showImg ? (
        <img
          src={`https://github.com/${username}.png?size=${size}`}
          alt={username}
          width={size}
          height={size}
          onError={() => setImgError(true)}
          style={{ display: 'block' }}
        />
      ) : (
        <svg width={iconSize} height={iconSize} fill="none" stroke="var(--mc-text-muted, #6e7681)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )}
    </div>
  )
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: connected ? '#3fb950' : '#6e7681',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 11,
        color: connected ? '#3fb950' : 'var(--mc-text-muted, #6e7681)',
      }}>
        {connected ? 'Connected' : 'Not connected'}
      </span>
    </div>
  )
}

function BranchBadge({ branch }: { branch: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '1px 6px',
      borderRadius: 10,
      background: 'rgba(88,166,255,0.1)',
      border: '1px solid rgba(88,166,255,0.2)',
    }}>
      <svg width="9" height="9" fill="none" stroke="var(--mc-accent, #58a6ff)" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M6 3v12M6 21a3 3 0 100-6 3 3 0 000 6zM18 6a3 3 0 100-6 3 3 0 000 6zM6 9a9 9 0 009 9" />
      </svg>
      <span style={{ fontSize: 10, color: 'var(--mc-accent, #58a6ff)', fontWeight: 500 }}>{branch}</span>
    </div>
  )
}

function RemoteBadge() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '1px 6px',
      borderRadius: 10,
      background: 'rgba(63,185,80,0.1)',
      border: '1px solid rgba(63,185,80,0.2)',
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3fb950' }} />
      <span style={{ fontSize: 10, color: '#3fb950', fontWeight: 500 }}>Remote</span>
    </div>
  )
}

function IdentityRow({ icon, value, placeholder }: { icon: React.ReactNode; value?: string; placeholder: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: 'var(--mc-text-muted, #6e7681)', flexShrink: 0 }}>{icon}</span>
      <span style={{
        fontSize: 11,
        color: value ? 'var(--mc-text-secondary, #8b949e)' : 'var(--mc-text-muted, #6e7681)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontStyle: value ? 'normal' : 'italic',
      }}>
        {value ?? placeholder}
      </span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{
      borderBottom: '1px solid var(--mc-border)',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      flexShrink: 0,
      opacity: 0.4,
    }}>
      <div style={{ width: 100, height: 10, borderRadius: 4, background: 'var(--mc-text-muted)' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mc-text-muted)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: 80, height: 10, borderRadius: 4, background: 'var(--mc-text-muted)' }} />
          <div style={{ width: 60, height: 8, borderRadius: 4, background: 'var(--mc-text-muted)' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function IconBtn({
  onClick,
  title,
  disabled,
  children
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        border: 'none',
        background: 'transparent',
        color: 'var(--mc-text-muted, #6e7681)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        padding: 0,
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.color = 'var(--mc-text-secondary, #8b949e)'
          e.currentTarget.style.background = 'var(--mc-bg-hover, rgba(255,255,255,0.06))'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--mc-text-muted, #6e7681)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function TextBtn({
  onClick,
  disabled,
  secondary,
  children
}: {
  onClick: () => void
  disabled?: boolean
  secondary?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '2px 7px',
        borderRadius: 4,
        border: `1px solid ${secondary ? 'rgba(255,255,255,0.1)' : 'rgba(88,166,255,0.4)'}`,
        background: secondary ? 'transparent' : 'rgba(88,166,255,0.1)',
        color: secondary ? 'var(--mc-text-muted, #6e7681)' : 'var(--mc-accent, #58a6ff)',
        fontSize: 10,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '3px 7px',
  borderRadius: 4,
  border: '1px solid rgba(88,166,255,0.3)',
  background: 'var(--mc-bg-primary, #0d1117)',
  color: 'var(--mc-text-primary, #e6edf3)',
  fontSize: 11,
  outline: 'none',
  boxSizing: 'border-box',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="11" height="11"
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
      style={{ transition: 'transform 0.3s', animation: spinning ? 'spin 1s linear infinite' : undefined }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}
