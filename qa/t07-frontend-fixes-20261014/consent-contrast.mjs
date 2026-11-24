// Runs in Chromium through page.evaluate; no imports or external resources.
export function readConsentContrast() {
  const banner = document.querySelector('[data-testid="cookie-banner"]')
  const accept = banner.querySelector('[data-testid="cookie-accept"]')
  const link = banner.querySelector('a')
  const luminance = css => {
    const rgb = css.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255)
    return rgb.map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0)
  }
  const ratio = (fg, bg) => (Math.max(luminance(fg), luminance(bg)) + .05) / (Math.min(luminance(fg), luminance(bg)) + .05)
  const acceptStyle = getComputedStyle(accept), linkStyle = getComputedStyle(link), bannerStyle = getComputedStyle(banner)
  // Canvas converts browser OKLCH color serialization to RGB for this ratio.
  const rgb = css => {
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  }
  return { accept: ratio(rgb(acceptStyle.color), rgb(acceptStyle.backgroundColor)), link: ratio(rgb(linkStyle.color), rgb(bannerStyle.backgroundColor)) }
}
