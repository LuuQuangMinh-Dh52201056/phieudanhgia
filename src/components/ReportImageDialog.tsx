import { useEffect, useId, useRef, useState } from 'react'
import { Download, LoaderCircle, Share2, X } from 'lucide-react'
import { canSharePng, getPngFile, photoSaveInstructions, type getPhotoDevice } from '../utils/reportExport'

export interface ReportImage {
  blob: Blob
  filename: string
  studentName: string
  original?: boolean
}

export function ReportImageDialog({ image, device, onClose }: { image: ReportImage; device: NonNullable<ReturnType<typeof getPhotoDevice>>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [url, setUrl] = useState('')
  const [notice, setNotice] = useState('')
  const [sharing, setSharing] = useState(false)
  const [file] = useState(() => getPngFile(image.blob, image.filename))
  const canShare = canSharePng(file)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(image.blob)
    setUrl(objectUrl)
    const node = dialog.current
    node?.showModal()
    return () => {
      node?.close()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    }
  }, [image])

  const share = async () => {
    if (!canShare || !file || sharing) return
    setSharing(true)
    setNotice('')
    try {
      await navigator.share({ files: [file] })
    } catch (error) {
      setNotice(error instanceof Error && error.name === 'AbortError' ? 'Đã đóng bảng chia sẻ.' : 'Chưa thể mở bảng chia sẻ. Hãy nhấn giữ ảnh để xem các tùy chọn lưu.')
    } finally {
      setSharing(false)
    }
  }

  return <dialog className="admin-edit-dialog admin-image-dialog" ref={dialog} aria-labelledby={title}
    onCancel={(event) => { event.preventDefault(); if (!sharing) onClose() }}>
    <header>
      <div><h2 id={title}>{image.original ? 'Ảnh gốc trước khi sửa' : 'Ảnh phiếu đánh giá'}</h2><p>{image.studentName}</p></div>
      <button type="button" className="admin-icon-button" aria-label="Đóng ảnh" disabled={sharing} onClick={onClose}><X size={21} /></button>
    </header>
    <div className="admin-edit-body">
      {canShare && <button className="admin-button is-primary" type="button" disabled={sharing} onClick={() => { void share() }}>
        {sharing ? <LoaderCircle className="admin-spin" size={17} /> : <Share2 size={17} />}
        {device === 'ios' ? 'Lưu vào Ảnh' : 'Lưu vào bộ sưu tập'}
      </button>}
      <p>{canShare ? photoSaveInstructions(device) : 'Nhấn giữ ảnh để xem các tùy chọn lưu của trình duyệt.'}</p>
      {notice && <p role="status">{notice}</p>}
      {url && <>
        <img src={url} alt={`Phiếu đánh giá của ${image.studentName}`} />
        <a className="admin-button" href={url} download={image.filename}><Download size={17} /> Tải PNG</a>
      </>}
    </div>
  </dialog>
}
