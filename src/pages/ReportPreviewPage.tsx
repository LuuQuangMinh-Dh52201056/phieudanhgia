import { useEffect, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { ArrowLeft, CheckCircle2, Download, FilePenLine, Images, LoaderCircle, RefreshCcw, Share2, TriangleAlert } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { AppFooter } from '../components/AppFooter'
import { ChecklistReport } from '../components/ChecklistReport'
import { EvaluationReport } from '../components/EvaluationReport'
import { PHU_GIAO_LOGO_DATA_URL } from '../components/TrainingCenterBrand'
import type { EvaluationState } from '../types/evaluation'
import { CONCLUSION_META, COURSE_CONCLUSIONS, generateFileName } from '../utils/evaluation'
import { canSharePng, canvasToPngBlob, describeExportError, getExportPixelRatios } from '../utils/reportExport'
import '../styles/report-export.css'

interface ReportPreviewPageProps {
  state: EvaluationState
  onChange: (updates: Partial<EvaluationState>) => void
  onEdit: () => void
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

export function ReportPreviewPage({ state, onChange, onEdit, onNew }: ReportPreviewPageProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const operationRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const [busy, setBusy] = useState<'download' | 'prepare' | 'share' | null>(null)
  const [notice, setNotice] = useState({ text: '', error: false })
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null)
  const prepared = preparedImage?.source === state ? preparedImage : null
  const supportsShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File === 'function'
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

  const prepareNode = async () => {
    const node = reportRef.current
    if (!node) throw new Error('Không tìm thấy phiếu đánh giá.')
    if (document.fonts) await document.fonts.ready
    await Promise.all(Array.from(node.querySelectorAll('img')).map(async (image) => {
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
    const previousStyle = node.getAttribute('style')
    const hadFlatColors = node.classList.contains('report-export-flat')
    node.classList.add('report-export-flat')
    Object.assign(node.style, { transform: 'none', position: 'static', left: '0', marginLeft: '0' })
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return {
      node,
      restore: () => {
        if (!hadFlatColors) node.classList.remove('report-export-flat')
        if (previousStyle === null) node.removeAttribute('style')
        else node.setAttribute('style', previousStyle)
      },
    }
  }

  const createImage = async (): Promise<PreparedImage> => {
    if (prepared) return prepared
    const { node, restore } = await prepareNode()
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
    let file: File | null = null
    try {
      if (typeof File === 'function') file = new File([result.blob], fileName, { type: 'image/png' })
    } catch {
      // A webview may expose File without supporting its constructor. Sharing
      // is optional; the PNG Blob must still remain downloadable.
    }
    const image: PreparedImage = {
      source: state,
      url: URL.createObjectURL(result.blob),
      file,
      fileName,
      width: result.width,
      height: result.height,
    }
    setPreparedImage(image)
    return image
  }

  const downloadImage = async () => {
    if (operationRef.current) return
    operationRef.current = true
    setBusy('download')
    setNotice({ text: '', error: false })
    try {
      const image = await createImage()
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

  const shareImage = async () => {
    if (operationRef.current) return
    operationRef.current = true
    setNotice({ text: '', error: false })
    if (!prepared) {
      setBusy('prepare')
      try {
        const image = await createImage()
        setNotice({ text: canSharePng(image.file)
          ? 'Ảnh đã sẵn sàng. Chạm “Chia sẻ ảnh” để chọn ứng dụng hoặc “Lưu hình ảnh” nếu bảng chia sẻ có lựa chọn này.'
          : 'Trình duyệt chưa hỗ trợ chia sẻ tệp PNG. Bạn có thể tải PNG hoặc mở ảnh để lưu bằng các liên kết bên dưới.', error: false })
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
        setNotice({ text: 'Trình duyệt chưa hỗ trợ chia sẻ tệp PNG. Hãy dùng “Tải PNG” hoặc “Mở ảnh để lưu”.', error: false })
        return
      }
      // The file was prepared on the previous click. Call share immediately
      // during this user gesture, without waiting for fonts/canvas/PNG encoding.
      await navigator.share({ files: [prepared.file!] })
      if (mountedRef.current) setNotice({ text: 'Đã mở bảng chia sẻ. Hãy hoàn tất thao tác trong ứng dụng hoặc mục lưu ảnh bạn đã chọn.', error: false })
    } catch (error) {
      if (mountedRef.current) setNotice({ text: error instanceof Error && error.name === 'AbortError'
        ? 'Đã đóng bảng chia sẻ. Bạn vẫn có thể tải hoặc mở ảnh để lưu.'
        : 'Chưa thể chia sẻ tệp. Hãy chạm “Chia sẻ ảnh” để thử lại, hoặc tải PNG/mở ảnh bằng các liên kết bên dưới.', error: !(error instanceof Error && error.name === 'AbortError') })
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
            <span>PHIẾU ĐÃ HOÀN THÀNH</span>
            <h1>Xem trước & xuất ảnh</h1>
            <p>Kiểm tra thông tin, chọn kết luận cuối cùng rồi tải ảnh hoặc chia sẻ.</p>
          </div>
          <button type="button" onClick={onEdit} disabled={busy !== null}><FilePenLine size={18} /> Sửa đánh giá</button>
        </div>

        {!isChecklist && (
          <section className="conclusion-control">
            <strong>Kết luận cuối cùng</strong>
            <p>Hệ thống đã đề xuất dựa trên kết quả; giáo viên có thể thay đổi trước khi xuất.</p>
            <div className="conclusion-options">
              {COURSE_CONCLUSIONS.map((key) => (
                <button type="button" key={key} className={state.finalConclusion === key ? 'is-selected' : ''} disabled={busy !== null} onClick={() => onChange({ finalConclusion: key })}>
                  <span>{state.finalConclusion === key && <CheckCircle2 size={17} />}</span>{CONCLUSION_META[key].label}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="report-preview-canvas" ref={stageRef}>
          {isChecklist
            ? <ChecklistReport state={state} reportRef={reportRef} />
            : <EvaluationReport state={state} reportRef={reportRef} />}
        </div>

        <div className="export-action-bar">
          <button className="button button--ghost" type="button" onClick={onEdit} disabled={busy !== null}><ArrowLeft size={18} /> Sửa đánh giá</button>
          {supportsShare && (
            <button className="button button--outline" type="button" data-testid="export-share" onClick={() => void shareImage()} disabled={busy !== null}>
              {busy === 'share' || busy === 'prepare' ? <LoaderCircle className="spin" size={19} /> : <Share2 size={19} />}
              {prepared ? 'Chia sẻ ảnh' : 'Chia sẻ / Lưu Ảnh'}
            </button>
          )}
          <button className="button button--primary button--large" type="button" data-testid="export-download" onClick={() => void downloadImage()} disabled={busy !== null}>
            {busy === 'download' ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}
            Tải PNG
          </button>
          <button className="button button--danger-ghost" type="button" onClick={onNew} disabled={busy !== null}><RefreshCcw size={18} /> Tạo phiếu mới</button>
        </div>
        {notice.text && <div className={`export-message ${notice.error ? 'export-message--error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <TriangleAlert size={19} /> : <CheckCircle2 size={19} />} {notice.text}</div>}

        {prepared && (
          <section className="report-export-fallback" data-testid="export-fallback" aria-label="Lưu ảnh PNG đã tạo">
            <strong><Images size={17} aria-hidden="true" /> PNG đã sẵn sàng · {prepared.width} × {prepared.height}px</strong>
            <p>Nếu trình duyệt trong ứng dụng chưa tải tệp, hãy mở ảnh rồi nhấn giữ/chọn lưu. Bạn cũng có thể mở trang này bằng trình duyệt ngoài ứng dụng để tải lại.</p>
            <div className="report-export-fallback__links">
              <a href={prepared.url} download={prepared.fileName} data-testid="export-download-link">Tải lại PNG</a>
              <a href={prepared.url} target="_blank" rel="noopener noreferrer" data-testid="export-open-image">Mở ảnh để lưu</a>
            </div>
            <details>
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
