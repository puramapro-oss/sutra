/** Profile images are raster files, never executable SVG/HTML or an unchecked extension. */
export async function validateProfileImage(file: Blob): Promise<{ type: string; extension: string }> {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Choisis une image de moins de 5 Mo.')
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  const detected = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    ? { type: 'image/png', extension: 'png' }
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? { type: 'image/jpeg', extension: 'jpg' }
    : ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' ? { type: 'image/webp', extension: 'webp' } : null
  if (!detected || (file.type && file.type !== detected.type)) throw new Error('Format non valide. Choisis une image PNG, JPEG ou WebP.')
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Cette image ne peut pas être décodée.') })
    const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 8192 && bitmap.height <= 8192 && bitmap.width * bitmap.height <= 24_000_000
    bitmap.close()
    if (!valid) throw new Error('Cette image est trop grande. Maximum : 8 192 pixels par côté et 24 mégapixels.')
  }
  return detected
}
