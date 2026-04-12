import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

let YoloWarningDialog: typeof import('./yolo-warning-dialog').YoloWarningDialog

beforeAll(async () => {
  const mod = await import('./yolo-warning-dialog')
  YoloWarningDialog = mod.YoloWarningDialog
})

describe('YoloWarningDialog', () => {
  test('renders with dialog role', () => {
    const html = renderToStaticMarkup(
      <YoloWarningDialog onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(html).toContain('role="dialog"')
  })

  test('renders Enable YOLO Mode title', () => {
    const html = renderToStaticMarkup(
      <YoloWarningDialog onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(html).toContain('Enable YOLO Mode')
  })

  test('contains plain-language explanation (no --dangerously jargon)', () => {
    const html = renderToStaticMarkup(
      <YoloWarningDialog onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(html).not.toContain('--dangerously')
    expect(html).toContain('without asking for permission')
  })

  test('renders Cancel button', () => {
    const html = renderToStaticMarkup(
      <YoloWarningDialog onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(html).toContain('Cancel')
  })

  test('renders Enable YOLO Mode confirm button', () => {
    const html = renderToStaticMarkup(
      <YoloWarningDialog onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(html).toContain('Enable YOLO Mode')
  })

  test('has overlay and dialog CSS classes', () => {
    const html = renderToStaticMarkup(
      <YoloWarningDialog onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(html).toContain('yolo-dialog-overlay')
    expect(html).toContain('yolo-dialog')
  })
})
