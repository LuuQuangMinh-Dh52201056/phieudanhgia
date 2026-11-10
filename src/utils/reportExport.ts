// These are canvas budgets, not device restrictions. Every browser can try the
// same resolutions, then retry at a smaller size if its graphics memory is low.
const MAX_CANVAS_PIXELS = 16_000_000
const MAX_CANVAS_SIDE = 8192

export function getExportPixelRatios(width: number, height: number): number[] {
  if (width <= 0 || height <= 0) throw new Error('Phiếu chưa có kích thước để xuất ảnh.')
  const largest = Math.min(2.5, MAX_CANVAS_SIDE / Math.max(width, height), Math.sqrt(MAX_CANVAS_PIXELS / (width * height)))
  const compatible = Math.min(1, 4096 / Math.max(width, height), Math.sqrt(4_000_000 / (width * height)))
  return [...new Set([largest, 2, 1.5, 1, compatible].filter((ratio) => ratio > 0 && ratio <= largest))]
    .sort((left, right) => right - left)
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  if (!canvas.width || !canvas.height) throw new Error('Trình duyệt không tạo được vùng ảnh.')
  if (typeof canvas.toBlob === 'function') {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob?.size) resolve(blob)
        else reject(new Error('Trình duyệt không mã hóa được ảnh PNG ở độ phân giải này.'))
      }, 'image/png')
    })
  }

  // Older webviews may support canvas but not toBlob. The final download still
  // uses a Blob URL, rather than a large data URL in a download link.
  const dataUrl = canvas.toDataURL('image/png')
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('Trình duyệt không hỗ trợ tạo ảnh PNG.')
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: 'image/png' })
}

export function canSharePng(file: File | null): boolean {
  if (!file || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export function describeExportError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'SecurityError') {
      return 'Trình duyệt chặn đọc ảnh hoặc phông chữ của phiếu. Hãy mở trang bằng Chrome, Safari hoặc trình duyệt ngoài ứng dụng rồi thử lại.'
    }
    return `${error.message} Hãy thử lại; nếu đang mở trong Zalo/Facebook, hãy mở trang bằng trình duyệt ngoài ứng dụng.`
  }
  return 'Chưa thể tạo ảnh PNG. Hãy thử lại hoặc mở trang bằng trình duyệt ngoài ứng dụng.'
}
