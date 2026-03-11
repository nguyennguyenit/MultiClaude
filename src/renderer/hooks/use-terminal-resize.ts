import { useState, useCallback, useEffect, useRef } from 'react'

/** Sum of flex values */
function sumFlex(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

/**
 * Manages drag-to-resize state for a terminal grid.
 * Tracks row heights and per-row column widths as flex values.
 * Resets to equal distribution when the grid layout changes.
 */
export function useTerminalResize(
  numRows: number,
  numColsPerRow: number[],
  containerRef: React.RefObject<HTMLElement | null>
) {
  const [rowFlex, setRowFlex] = useState<number[]>(() => Array(numRows).fill(1))
  const [colFlex, setColFlex] = useState<Map<number, number[]>>(new Map())

  // Keep refs in sync for use inside event handlers without stale closures
  const rowFlexRef = useRef(rowFlex)
  rowFlexRef.current = rowFlex

  const colFlexRef = useRef(colFlex)
  colFlexRef.current = colFlex

  // Reset to equal distribution when grid layout changes
  const layoutKey = `${numRows}/${numColsPerRow.join(',')}`
  useEffect(() => {
    setRowFlex(Array(numRows).fill(1))
    setColFlex(new Map())
  }, [layoutKey, numRows]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Get flex value for a row (defaults to 1 if not set) */
  const getRowFlex = useCallback((i: number): number => {
    const flex = rowFlexRef.current
    return (flex.length > i ? flex[i] : undefined) ?? 1
  }, [])

  /** Get flex value for a cell (defaults to 1 if not set) */
  const getColFlex = useCallback((rowIdx: number, colIdx: number): number => {
    const numCols = numColsPerRow[rowIdx] ?? 1
    const flex = colFlexRef.current.get(rowIdx)
    return (flex && flex.length === numCols ? flex[colIdx] : undefined) ?? 1
  }, [numColsPerRow])

  /** Start dragging the horizontal divider between row[rowIndex] and row[rowIndex+1] */
  const startRowResize = useCallback((rowIndex: number, startY: number) => {
    const initial = rowFlexRef.current.length === numRows
      ? [...rowFlexRef.current]
      : Array(numRows).fill(1)

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
      setRowFlex(updated)
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [numRows, containerRef])

  /** Start dragging the vertical divider between col[colIndex] and col[colIndex+1] in a row */
  const startColResize = useCallback((rowIndex: number, colIndex: number, startX: number) => {
    const numCols = numColsPerRow[rowIndex] ?? 1
    const initial = colFlexRef.current.get(rowIndex)?.slice() ?? Array(numCols).fill(1)

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
      setColFlex(prev => new Map(prev).set(rowIndex, updated))
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [numColsPerRow, containerRef])

  return { getRowFlex, getColFlex, startRowResize, startColResize }
}
