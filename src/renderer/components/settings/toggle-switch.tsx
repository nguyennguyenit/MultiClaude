interface ToggleSwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-checked={checked}
      role="switch"
      style={{ backgroundColor: checked ? 'var(--mc-accent)' : 'var(--mc-bg-tertiary)' }}
      className={`
        relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 outline-none border-0
        focus-visible:ring-2 focus-visible:ring-[var(--mc-accent)] focus-visible:ring-offset-1
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className="absolute rounded-full bg-white"
        style={{
          top: '50%',
          left: '3px',
          width: '18px',
          height: '18px',
          transform: checked ? 'translateY(-50%) translateX(20px)' : 'translateY(-50%)',
          transition: 'transform 200ms',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
          pointerEvents: 'none'
        }}
      />
    </button>
  )
}
