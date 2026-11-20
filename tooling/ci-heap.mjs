// Only an explicit numeric budget may add a Node option to isolated checks.
// Application credentials and arbitrary NODE_OPTIONS are never inherited.
export function ciHeapOptions(value) {
  if (value === undefined) return []
  if (typeof value !== 'string' || !/^[1-9]\d{2,3}$/.test(value)
    || Number(value) < 512 || Number(value) > 4096) {
    throw new Error('SUTRA_CI_HEAP_MB must be an integer from 512 to 4096')
  }
  return [`--max-old-space-size=${value}`]
}
