import { useEffect, useId, useRef } from 'react'
import { LoaderCircle, Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Xóa', busy = false, error, onCancel, onConfirm }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  return <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="confirm-dialog__content">
      <button className="icon-button confirm-dialog__close" type="button" aria-label="Đóng xác nhận" disabled={busy} onClick={onCancel}><X size={19} /></button>
      <span className="confirm-dialog__icon"><Trash2 size={27} /></span>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}
      <div className="confirm-dialog__actions">
        <button ref={cancelRef} data-testid="confirm-cancel" className="button button--ghost" type="button" disabled={busy} onClick={onCancel}>Hủy</button>
        <button data-testid="confirm-action" className="button button--danger" type="button" disabled={busy} onClick={() => { void onConfirm() }}>{busy ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}{busy ? 'Đang xóa…' : confirmLabel}</button>
      </div>
    </div>
  </dialog>
}
