import { useCallback, useEffect, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { CheckCircle2, Download, FilePenLine, Images, LoaderCircle, RefreshCcw, Save, Share2, TriangleAlert } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { AppFooter } from '../components/AppFooter'
import { ChecklistReport } from '../components/ChecklistReport'
import { EvaluationReport } from '../components/EvaluationReport'
import { PHU_GIAO_LOGO_DATA_URL } from '../components/TrainingCenterBrand'
import type { EvaluationState } from '../types/evaluation'
import { CONCLUSION_META, COURSE_CONCLUSIONS, generateFileName } from '../utils/evaluation'
import { canSharePng, canvasToPngBlob, describeExportError, getExportPixelRatios, getPhotoDevice, getPngFile, photoSaveInstructions } from '../utils/reportExport'
import '../styles/report-export.css'

interface ReportPreviewPageProps {
  state: EvaluationState
  saved: boolean
  awaitingConfirmation: boolean
  onChange: (updates: Partial<EvaluationState>) => void
  onEdit: () => void
  onSave: () => void
  onNew: () => void
}

interface ExportLogoRect {
  x: number
  y: number
  width: number
  height: number
}

interface PreparedImage {
  source: EvaluationState
  url: string
  file: File | null
  fileName: string
  width: number
  height: number
}

export function ReportPreviewPage({ state, saved, awaitingConfirmation, onChange, onEdit, onSave, onNew }: ReportPreviewPageProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const operationRef = useRef(false)
  const manualRef = useRef<HTMLDetailsElement>(null)
  const autoPrepared = useRef<EvaluationState | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const [busy, setBusy] = useState<'download' | 'prepare' | 'share' | null>(null)
  const [notice, setNotice] = useState({ text: '', error: false })
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null)
  const prepared = preparedImage?.source === state ? preparedImage : null
  const supportsShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File === 'function'
  const photoDevice = getPhotoDevice()
  const isChecklist = state.trainingType === 'BASIC' || state.trainingType === 'ROAD'

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    setPreparedImage(null)
    setNotice({ text: '', error: false })
  }, [state])

  useEffect(() => {
    if (!preparedImage) return
    return () => {
      // Keep the URL valid while its links/preview are visible. A grace period
      // also lets an in-flight download or newly opened image tab finish loading.
      window.setTimeout(() => URL.revokeObjectURL(preparedImage.url), 60_000)
    }
  }, [preparedImage])

  useEffect(() => {
    const stage = stageRef.current
    const report = reportRef.current
    if (!stage || !report) return

    const resize = () => {
      const scale = Math.max(0, Math.min(1, (stage.clientWidth - 2) / 1080))
      stage.style.setProperty('--report-scale', String(scale))
      stage.style.height = `${report.offsetHeight * scale}px`
    }
    resize()
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(resize)
      observer.observe(stage)
      observer.observe(report)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [state])

  const prepareNode = useCallback(async (offscreen: boolean) => {
    const report = reportRef.current
    if (!report) throw new Error('Không tìm thấy phiếu đánh giá.')
    if (document.fonts) await document.fonts.ready
    await Promise.all(Array.from(report.querySelectorAll('img')).map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          const finish = () => {
            window.clearTimeout(timeout)
            image.removeEventListener('load', finish)
            image.removeEventListener('error', finish)
            resolve()
          }
          const timeout = window.setTimeout(() => {
            image.removeEventListener('load', finish)
            image.removeEventListener('error', finish)
            reject(new Error('Ảnh trên phiếu chưa tải xong.'))
          }, 15_000)
          image.addEventListener('load', finish, { once: true })
          image.addEventListener('error', finish, { once: true })
        })
      }
      try { await image.decode?.() } catch { /* A failed decode can still be rendered by the browser. */ }
    }))
    const host = offscreen ? document.createElement('div') : null
    const node = host ? report.cloneNode(true) as HTMLDivElement : report
    if (host) {
      host.className = 'report-preview-canvas report-export-host'
      host.setAttribute('aria-hidden', 'true')
      node.removeAttribute('data-testid')
      host.appendChild(node)
      stageRef.current?.parentElement?.appendChild(host)
    }
    const previousStyle = node.getAttribute('style')
    const hadFlatColors = node.classList.contains('report-export-flat')
    node.classList.add('report-export-flat')
    Object.assign(node.style, { transform: 'none', position: 'static', left: '0', marginLeft: '0' })
    if (!offscreen) await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return {
      node,
      restore: () => {
        if (host) { host.remove(); return }
        if (!hadFlatColors) node.classList.remove('report-export-flat')
        if (previousStyle === null) node.removeAttribute('style')
        else node.setAttribute('style', previousStyle)
      },
    }
  }, [])

  const createImage = useCallback(async (offscreen = false): Promise<PreparedImage> => {
    if (prepared) return prepared
    const { node, restore } = await prepareNode(offscreen)
    let result: { blob: Blob; width: number; height: number } | null = null
    try {
      const width = node.offsetWidth
      const height = node.offsetHeight
      const reportRect = node.getBoundingClientRect()
      const logoRects: ExportLogoRect[] = Array.from(node.querySelectorAll<HTMLElement>('[data-export-logo-slot]')).map((slot) => {
        const rect = slot.getBoundingClientRect()
        return { x: rect.left - reportRect.left, y: rect.top - reportRect.top, width: rect.width, height: rect.height }
      })
      const logo = new Image()
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve()
        logo.onerror = () => reject(new Error('Không thể nạp logo Phú Giáo.'))
        logo.src = PHU_GIAO_LOGO_DATA_URL
      })

      let lastError: unknown
      for (const pixelRatio of getExportPixelRatios(width, height)) {
        let canvas: HTMLCanvasElement | null = null
        try {
          canvas = await toCanvas(node, {
            cacheBust: true,
            backgroundColor: '#f8fbf9',
            imagePlaceholder: PHU_GIAO_LOGO_DATA_URL,
            skipAutoScale: true,
            pixelRatio,
          })
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Trình duyệt không cấp được bộ nhớ dựng ảnh.')
          context.imageSmoothingEnabled = true
          context.imageSmoothingQuality = 'high'
          // foreignObject can omit embedded images in WebKit; finish the logos
          // directly on the canvas, using the captured unscaled coordinates.
          logoRects.forEach((rect) => {
            const x = rect.x * canvas!.width / width
            const y = rect.y * canvas!.height / height
            const slotWidth = rect.width * canvas!.width / width
            const slotHeight = rect.height * canvas!.height / height
            const imageScale = Math.min(slotWidth / logo.naturalWidth, slotHeight / logo.naturalHeight)
            const drawWidth = logo.naturalWidth * imageScale
            const drawHeight = logo.naturalHeight * imageScale
            context.save()
            context.beginPath()
            context.ellipse(x + slotWidth / 2, y + slotHeight / 2, slotWidth / 2, slotHeight / 2, 0, 0, Math.PI * 2)
            context.clip()
            context.drawImage(logo, x + (slotWidth - drawWidth) / 2, y + (slotHeight - drawHeight) / 2, drawWidth, drawHeight)
            context.restore()
          })
          result = { blob: await canvasToPngBlob(canvas), width: canvas.width, height: canvas.height }
          break
        } catch (error) {
          lastError = error
        } finally {
          if (canvas) { canvas.width = 1; canvas.height = 1 }
        }
      }
      if (!result) throw lastError ?? new Error('Không thể dựng ảnh phiếu đánh giá.')
    } finally {
      restore()
    }
    if (!mountedRef.current || stateRef.current !== state) throw new Error('Nội dung phiếu đã thay đổi. Vui lòng tạo lại ảnh.')
    const fileName = generateFileName(state)
    const image: PreparedImage = {
      source: state,
      url: URL.createObjectURL(result.blob),
      file: getPngFile(result.blob, fileName),
      fileName,
      width: result.width,
      height: result.height,
    }
    setPreparedImage(image)
    return image
  }, [prepareNode, prepared, state])

  useEffect(() => {
    if (!saved || !photoDevice || prepared || autoPrepared.current === state) return
    const timer = window.setTimeout(() => {
      if (operationRef.current) return
      autoPrepared.current = state
      operationRef.current = true
      setBusy('prepare')
      void createImage(true).catch((error: unknown) => {
        if (mountedRef.current) setNotice({ text: describeExportError(error), error: true })
      }).finally(() => {
        operationRef.current = false
        if (mountedRef.current) setBusy(null)
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [createImage, photoDevice, prepared, saved, state])

  const downloadImage = async () => {
    if (operationRef.current) return
    operationRef.current = true
    setBusy('download')
    setNotice({ text: '', error: false })
    try {
      const image = await createImage(Boolean(photoDevice))
      const link = document.createElement('a')
      link.download = image.fileName
      link.href = image.url
      document.body.appendChild(link)
      try { link.click() } finally { link.remove() }
      setNotice({ text: `Đã tạo PNG ${image.width} × ${image.height}px và gửi yêu cầu tải. Nếu chưa thấy tệp, dùng “Tải lại PNG” hoặc “Mở ảnh để lưu” bên dưới.`, error: false })
    } catch (error) {
      if (mountedRef.current) setNotice({ text: describeExportError(error), error: true })
    } finally {
      operationRef.current = false
      if (mountedRef.current) setBusy(null)
    }
  }

  const openManualSave = () => {
    window.requestAnimationFrame(() => {
      if (!manualRef.current) return
      manualRef.current.open = true
      manualRef.current.scrollIntoView({ block: 'nearest' })
    })
  }

  const shareImage = async () => {
    if (operationRef.current) return
    operationRef.current = true
    setNotice({ text: '', error: false })
    if (!prepared) {
      setBusy('prepare')
      try {
        const image = await createImage(Boolean(photoDevice))
        if (canSharePng(image.file)) {
          setNotice({ text: 'Ảnh đã sẵn sàng. Chạm lại nút lưu ảnh để mở bảng chia sẻ.', error: false })
        } else {
          openManualSave()
        }
      } catch (error) {
        if (mountedRef.current) setNotice({ text: describeExportError(error), error: true })
      } finally {
        operationRef.current = false
        if (mountedRef.current) setBusy(null)
      }
      return
    }
    setBusy('share')
    try {
      if (!canSharePng(prepared.file)) {
        setNotice({ text: 'Trình duyệt chưa hỗ trợ chia sẻ tệp PNG. Nhấn giữ ảnh bên dưới để xem các tùy chọn lưu.', error: false })
        openManualSave()
        return
      }
      // Call share during this gesture, with the prepared file already available.
      await navigator.share({ files: [prepared.file!] })
      if (mountedRef.current) setNotice({ text: `Đã mở bảng chia sẻ. ${photoSaveInstructions(photoDevice)}`, error: false })
    } catch (error) {
      if (mountedRef.current) {
        const cancelled = error instanceof Error && error.name === 'AbortError'
        setNotice({ text: cancelled ? 'Đã đóng bảng chia sẻ. Bạn có thể thử lại hoặc mở ảnh để lưu.'
          : 'Chưa thể mở bảng chia sẻ. Nhấn giữ ảnh bên dưới để xem các tùy chọn lưu.', error: !cancelled })
        if (!cancelled) openManualSave()
      }
    } finally {
      operationRef.current = false
      if (mountedRef.current) setBusy(null)
    }
  }

  return (
    <div className="app-shell report-preview-page">
      <AppHeader activeStep={6} />
      <main className="report-preview-content">
        <div className="report-preview-heading">
          <div>
            {saved && <span className="report-saved-label"><CheckCircle2 size={15} /> Đã lưu tại trung tâm</span>}
            <h1>{saved ? 'Phiếu đánh giá đã lưu' : 'Kiểm tra phiếu đánh giá'}</h1>
            <p>{saved ? state.studentName : 'Kiểm tra nội dung và chốt kết quả trước khi lưu phiếu.'}</p>
          </div>
          {!saved && !awaitingConfirmation && <button type="button" onClick={onEdit}><FilePenLine size={18} /> Sửa đánh giá</button>}
        </div>

        {!saved && !isChecklist && (
          <section className="conclusion-control">
            <strong>Kết luận cuối cùng</strong>
            <p>Chọn kết luận sẽ xuất hiện trên phiếu lưu và ảnh.</p>
            <div className="conclusion-options">
              {COURSE_CONCLUSIONS.map((key) => (
                <button type="button" key={key} className={state.finalConclusion === key ? 'is-selected' : ''} disabled={awaitingConfirmation}
                  aria-pressed={state.finalConclusion === key} onClick={() => onChange({ finalConclusion: key })}>
                  <span>{state.finalConclusion === key && <CheckCircle2 size={17} />}</span>{CONCLUSION_META[key].label}
                </button>
              ))}
            </div>
          </section>
        )}

        {saved && <section className="report-delivery" aria-label="Lưu và chia sẻ ảnh phiếu">
          <div className="report-delivery__copy">
            <div className="report-delivery__icon"><Images size={22} aria-hidden="true" /></div>
            <div><h2>Ảnh phiếu đánh giá</h2><p>{photoDevice ? photoSaveInstructions(photoDevice) : 'Xuất ảnh PNG để lưu hoặc gửi cho học viên.'}</p></div>
          </div>
          <div className="export-action-bar">
            {(photoDevice || supportsShare) && <button className={`button ${photoDevice ? 'button--primary' : 'button--outline'}`} type="button"
              data-testid="export-share" onClick={() => void shareImage()} disabled={busy !== null}>
              {busy === 'share' || busy === 'prepare' ? <LoaderCircle className="spin" size={19} /> : <Share2 size={19} />}
              {busy === 'prepare' ? 'Đang chuẩn bị ảnh…' : photoDevice === 'ios' ? 'Lưu vào Ảnh' : photoDevice === 'android' ? 'Lưu vào bộ sưu tập' : 'Chia sẻ ảnh'}
            </button>}
            <button className={`button ${photoDevice ? 'button--ghost' : 'button--primary'}`} type="button" data-testid="export-download"
              onClick={() => void downloadImage()} disabled={busy !== null}>
              {busy === 'download' ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />} Tải PNG
            </button>
            <button className="button button--ghost report-delivery__new" type="button" onClick={onNew} disabled={busy !== null}><RefreshCcw size={18} /> Tạo phiếu mới</button>
          </div>
        </section>}

        {notice.text && <div className={`export-message ${notice.error ? 'export-message--error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <TriangleAlert size={19} /> : <CheckCircle2 size={19} />} {notice.text}</div>}

        <div className="report-preview-canvas" ref={stageRef}>
          {isChecklist
            ? <ChecklistReport state={state} reportRef={reportRef} />
            : <EvaluationReport state={state} reportRef={reportRef} />}
        </div>

        {!saved && <div className="report-commit">
          <p>{awaitingConfirmation ? 'Đang chờ Firebase xác nhận yêu cầu lưu.' : 'Ảnh được xuất từ nội dung đã lưu tại trung tâm.'}</p>
          <button className="button button--primary" type="button" data-testid="save-evaluation" onClick={onSave}>
            <Save size={18} /> {awaitingConfirmation ? 'Kiểm tra lưu phiếu' : 'Lưu phiếu đánh giá'}
          </button>
        </div>}

        {prepared && (
          <section className="report-export-fallback" data-testid="export-fallback" aria-label="Lưu ảnh PNG đã tạo">
            <strong><Images size={17} aria-hidden="true" /> PNG đã sẵn sàng · {prepared.width} × {prepared.height}px</strong>
            <p>{photoDevice ? 'Mở ảnh hoặc nhấn giữ ảnh bên dưới rồi chọn thao tác lưu ảnh của trình duyệt.' : 'Mở ảnh để xem toàn bộ hoặc tải xuống dưới dạng PNG.'}</p>
            <div className="report-export-fallback__links">
              <a href={prepared.url} download={prepared.fileName} data-testid="export-download-link">Tải lại PNG</a>
              <a href={prepared.url} target="_blank" rel="noopener noreferrer" data-testid="export-open-image">Mở ảnh để lưu</a>
            </div>
            <details ref={manualRef}>
              <summary>Xem ảnh để lưu thủ công</summary>
              <img src={prepared.url} alt={`Phiếu đánh giá của ${state.studentName}; nhấn giữ hoặc mở menu ảnh để lưu`} />
            </details>
          </section>
        )}
      </main>
      <AppFooter />
    </div>
  )
}
