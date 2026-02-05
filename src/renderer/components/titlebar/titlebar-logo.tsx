import logoImg from '../../assets/logo.png'

interface TitlebarLogoProps {
  showText: boolean
}

export function TitlebarLogo({ showText }: TitlebarLogoProps) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <img src={logoImg} alt="MultiClaude" className="w-5 h-5 flex-shrink-0 aspect-square object-contain" />
      {showText && (
        <span className="font-semibold text-sm text-[var(--mc-text-primary)] whitespace-nowrap">
          MultiClaude
        </span>
      )}
    </div>
  )
}
