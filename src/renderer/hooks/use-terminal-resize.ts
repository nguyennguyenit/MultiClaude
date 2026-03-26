import { useState, useCallback, useEffect, useRef } from 'react'

/** Sum of flex values */
function sumFlex(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

const DEFAULT_PROJECT_ID = '__default_project__'

interface ResizeSnapshot {
  rowFlex: number[]
  colFlex: Map<number, number[]>
}

function createDefaultSnapshot(numRows: number): ResizeSnapshot {
  return {
    rowFlex: Array(numRows).fill(1),
    colFlex: new Map()
  }
}

function getResizeKey(projectId: string | null, layoutKey: string): string {
  return `${projectId ?? DEFAULT_PROJECT_ID}:${layoutKey}`
}

/**
 * Manages drag-to-resize state for a terminal grid.
 * Tracks row heights and per-row column widths as flex values.
 * Stores resize snapshots per project and grid shape so switching projects
 * does not reset the user's manual pane sizes.
 */
export function useTerminalResize(
  projectId: string | null,
  numRows: number,
  numColsPerRow: number[],
  containerRef: React.RefObject<HTMLElement | null>
) {
  const layoutKey = `${numRows}/${numColsPerRow.join(',')}`
  const resizeKey = getResizeKey(projectId, layoutKey)
  const [snapshots, setSnapshots] = useState<Map<string, ResizeSnapshot>>(new Map())

  const activeSnapshot = snapshots.get(resizeKey) ?? createDefaultSnapshot(numRows)
  const snapshotRef = useRef(activeSnapshot)
  snapshotRef.current = activeSnapshot

  // Clean up impossible snapshots if row count for the current layout reaches zero.
  useEffect(() => {
    if (numRows !== 0) return

    setSnapshots((prev) => {
      if (!prev.has(resizeKey)) return prev
      const next = new Map(prev)
      next.delete(resizeKey)
      return next
    })
  }, [numRows, resizeKey])

  /** Get flex value for a row (defaults to 1 if not set) */
  const getRowFlex = useCallback((i: number): number => {
    const flex = snapshotRef.current.rowFlex
    return (flex.length > i ? flex[i] : undefined) ?? 1
  }, [])

  /** Get flex value for a cell (defaults to 1 if not set) */
  const getColFlex = useCallback((rowIdx: number, colIdx: number): number => {
    const numCols = numColsPerRow[rowIdx] ?? 1
    const flex = snapshotRef.current.colFlex.get(rowIdx)
    return (flex && flex.length === numCols ? flex[colIdx] : undefined) ?? 1
  }, [numColsPerRow])

  /** Start dragging the horizontal divider between row[rowIndex] and row[rowIndex+1] */
  const startRowResize = useCallback((rowIndex: number, startY: number) => {
    const initial = snapshotRef.current.rowFlex.length === numRows
      ? [...snapshotRef.current.rowFlex]
      : createDefaultSnapshot(numRows).rowFlex

    const onMove = (e: PointerEvent) => {
      const container = containerRef.current
      if (!container) return
      const height = container.clientHeight
      if (!height) return
      const delta = e.clientY - startY
      const total = sumFlex(initial)
      const dFlex = (delta / height) * total
      const updated = [...initial]
      updated[rowIndex] = Math.max(0.1, initial[rowIndex] + dFlex)
      updated[rowIndex + 1] = Math.max(0.1, initial[rowIndex + 1] - dFlex)
      setSnapshots((prev) => {
        const current = prev.get(resizeKey) ?? createDefaultSnapshot(numRows)
        const next = new Map(prev)
        next.set(resizeKey, {
          rowFlex: updated,
          colFlex: current.colFlex
        })
        return next
      })
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [numRows, containerRef, resizeKey])

  /** Start dragging the vertical divider between col[colIndex] and col[colIndex+1] in a row */
  const startColResize = useCallback((rowIndex: number, colIndex: number, startX: number) => {
    const numCols = numColsPerRow[rowIndex] ?? 1
    const initial = snapshotRef.current.colFlex.get(rowIndex)?.slice() ?? Array(numCols).fill(1)

    const onMove = (e: PointerEvent) => {
      const container = containerRef.current
      if (!container) return
      const width = container.clientWidth
      if (!width) return
      const delta = e.clientX - startX
      const total = sumFlex(initial)
      const dFlex = (delta / width) * total
      const updated = [...initial]
      updated[colIndex] = Math.max(0.1, initial[colIndex] + dFlex)
      updated[colIndex + 1] = Math.max(0.1, initial[colIndex + 1] - dFlex)
      setSnapshots((prev) => {
        const current = prev.get(resizeKey) ?? createDefaultSnapshot(numRows)
        const next = new Map(prev)
        const nextColFlex = new Map(current.colFlex)
        nextColFlex.set(rowIndex, updated)
        next.set(resizeKey, {
          rowFlex: current.rowFlex,
          colFlex: nextColFlex
        })
        return next
      })
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [numColsPerRow, numRows, containerRef, resizeKey])

  return { getRowFlex, getColFlex, startRowResize, startColResize }
}
