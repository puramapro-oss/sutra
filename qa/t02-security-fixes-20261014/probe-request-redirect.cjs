/* eslint-disable @typescript-eslint/no-require-imports -- diagnostic of installed CommonJS transport */
// Installed transport decision only: no socket, DNS, calendar or secret access.
const assert = require('node:assert/strict')
const { Redirect } = require('request/lib/redirect')
const transport = new Redirect({ method: 'GET', debug() {} })
transport.onRequest({ method: 'GET', encoding: null }) // RemoteCalendar.getTimestamp options
const results = ['http://127.0.0.1/private', 'http://169.254.169.254/latest/meta-data', 'https://127.0.0.1/private'].map(location => {
  const response = { statusCode: 302, caseless: { has: () => true, get: () => location } }
  const followed = transport.redirectTo(response) === location && transport.allowRedirect(response)
  assert.equal(followed, true)
  return { destination: location, internalRedirectAllowed: followed, expectedSecurityDecision: 'DENY', status: 'FAIL' }
})
process.stdout.write(JSON.stringify({ package: 'request@2.88.2', networkCalls: 0, scope: 'installed redirect decision, not remote exploitation', results }, null, 2) + '\n')
