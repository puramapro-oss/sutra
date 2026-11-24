export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  try {
    anchor.href = url
    anchor.download = filename
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    // Let the browser start reading the Blob before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export function downloadText(content: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([content], { type: mimeType }), filename)
}
