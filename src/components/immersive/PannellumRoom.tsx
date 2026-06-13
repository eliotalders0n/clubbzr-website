'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react'
import 'pannellum'
import 'pannellum/build/pannellum.css'

interface PannellumRoomProps {
  src: string
  className?: string
  style?: CSSProperties
  hotSpots?: PannellumHotSpot[]
  onLoad?: () => void
  onViewChange?: (view: { pitch: number; yaw: number; hfov: number }) => void
  onSettle?: (view: { pitch: number; yaw: number; hfov: number }) => void
}

export type PannellumHotSpot = {
  id?: string
  pitch: number
  yaw: number
  type?: 'info' | 'scene' | string
  text?: string
  cssClass?: string
  scale?: boolean
  createTooltipFunc?: (hotSpotDiv: HTMLElement, args: unknown) => void
  createTooltipArgs?: unknown
  clickHandlerFunc?: (event: globalThis.MouseEvent, args: unknown) => void
  clickHandlerArgs?: unknown
}

export interface PannellumRoomHandle {
  getView: () => { pitch: number; yaw: number; hfov: number } | null
  lookAt: (view: { pitch?: number; yaw?: number; hfov?: number; duration?: number }) => void
  resize: () => void
}

type PannellumViewer = {
  destroy: () => void
  resize: () => void
  getPitch: () => number
  getYaw: () => number
  getHfov: () => number
  lookAt: (pitch?: number, yaw?: number, hfov?: number, duration?: number) => PannellumViewer
  on: (eventName: string, handler: (...args: unknown[]) => void) => PannellumViewer
}

type PannellumApi = {
  viewer: (container: HTMLElement, config: Record<string, unknown>) => PannellumViewer
}

type WindowWithPannellum = Window & typeof globalThis & {
  pannellum?: PannellumApi
}

export const PannellumRoom = forwardRef<PannellumRoomHandle, PannellumRoomProps>(function PannellumRoom(
  { src, className, style, hotSpots, onLoad, onViewChange, onSettle },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PannellumViewer | null>(null)
  const onLoadRef = useRef(onLoad)
  const onViewChangeRef = useRef(onViewChange)
  const onSettleRef = useRef(onSettle)

  useImperativeHandle(ref, () => ({
    getView: () => {
      const viewer = viewerRef.current
      if (!viewer) return null

      return {
        pitch: viewer.getPitch(),
        yaw: viewer.getYaw(),
        hfov: viewer.getHfov(),
      }
    },
    lookAt: ({ pitch, yaw, hfov, duration = 850 }) => {
      const viewer = viewerRef.current
      if (!viewer) return

      viewer.lookAt(pitch, yaw, hfov, duration)
    },
    resize: () => {
      viewerRef.current?.resize()
    },
  }), [])

  useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])

  useEffect(() => {
    onViewChangeRef.current = onViewChange
  }, [onViewChange])

  useEffect(() => {
    onSettleRef.current = onSettle
  }, [onSettle])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    const pannellumApi = (window as WindowWithPannellum).pannellum
    if (!pannellumApi) {
      console.error('Pannellum failed to load.')
      return
    }

    const viewer = pannellumApi.viewer(container, {
      type: 'equirectangular',
      panorama: src,
      autoLoad: true,
      showControls: false,
      showZoomCtrl: false,
      showFullscreenCtrl: false,
      keyboardZoom: false,
      mouseZoom: true,
      draggable: true,
      hfov: 82,
      minHfov: 54,
      maxHfov: 108,
      pitch: -3,
      minPitch: -24,
      maxPitch: 18,
      yaw: 0,
      minYaw: -180,
      maxYaw: 180,
      avoidShowingBackground: true,
      backgroundColor: [0, 0, 0],
      friction: 0.18,
      touchPanSpeedCoeffFactor: 0.75,
      autoRotateInactivityDelay: -1,
      ignoreGPanoXMP: true,
      escapeHTML: true,
      hotSpots: hotSpots ?? [],
    })
    viewerRef.current = viewer
    let viewFrame = 0
    let lastViewKey = ''

    const readView = () => ({
      pitch: viewer.getPitch(),
      yaw: viewer.getYaw(),
      hfov: viewer.getHfov(),
    })

    const emitView = () => {
      const view = readView()
      const viewKey = `${view.pitch.toFixed(2)}:${view.yaw.toFixed(2)}:${view.hfov.toFixed(2)}`
      if (viewKey !== lastViewKey) {
        lastViewKey = viewKey
        onViewChangeRef.current?.(view)
      }

      return view
    }

    const emitSettle = () => {
      onSettleRef.current?.({
        pitch: viewer.getPitch(),
        yaw: viewer.getYaw(),
        hfov: viewer.getHfov(),
      })
    }

    const trackView = () => {
      if (!onViewChangeRef.current) return
      emitView()
      viewFrame = window.requestAnimationFrame(trackView)
    }

    viewer.on('load', () => {
      onLoadRef.current?.()
      emitView()
      emitSettle()
      if (onViewChangeRef.current) {
        viewFrame = window.requestAnimationFrame(trackView)
      }
    })
    viewer.on('animatefinished', () => {
      emitView()
      emitSettle()
    })
    viewer.on('mouseup', () => {
      emitView()
      emitSettle()
    })
    viewer.on('touchend', () => {
      emitView()
      emitSettle()
    })
    viewer.on('zoomchange', emitView)

    const resizeFrame = window.requestAnimationFrame(() => viewer.resize())
    const resizeObserver = new ResizeObserver(() => viewer.resize())
    resizeObserver.observe(container)

    return () => {
      window.cancelAnimationFrame(viewFrame)
      window.cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
      viewer.destroy()
      viewerRef.current = null
      container.innerHTML = ''
    }
  }, [hotSpots, src])

  return (
    <div
      className={className}
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        minWidth: 0,
        minHeight: 0,
        background: '#000',
        ...style,
      }}
    />
  )
})
