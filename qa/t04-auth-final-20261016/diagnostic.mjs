// Audit-only classifications. Never return a provider message or a credential in proof.
import { parse } from 'dotenv';

export const fields = ['SALAD_API_KEY', 'SALAD_ORGANIZATION_NAME', 'SALAD_PROJECT_NAME',
  'SALAD_ORGANIZATION', 'SALAD_PROJECT', 'PEXELS_API_KEY', 'ELEVENLABS_API_KEY'];

export function inspect(source) {
  const values = Object.create(null);
  const metadata = fields.map(name => {
    const matches = source.split(/\r?\n/).flatMap(line => {
      const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line);
      return match?.[1] === name ? [match[2]] : [];
    });
    const raw = matches[0] ?? '';
    const value = matches.length === 1 ? parse(`${name}=${raw}`)[name] ?? '' : '';
    const scope = name.startsWith('SALAD_') && name !== 'SALAD_API_KEY';
    const pattern = scope ? /^[a-z][a-z0-9-]{0,61}[a-z0-9]$/ : /^[A-Za-z0-9._~-]{8,512}$/;
    const shellSyntax = /[`$\\]/.test(raw);
    const valid = matches.length === 1 && !shellSyntax && pattern.test(value);
    if (valid) values[name] = value;
    return { name, present: matches.length > 0, unique: matches.length === 1,
      source: matches.length ? 'master' : 'absent', dotenvParsedTransportSafe: valid,
      shellSyntax, escapedQuote: /\\["']/.test(raw), commandSubstitution: /\$\(|`/.test(raw),
      parsedHasWhitespace: /\s/.test(value), parsedHasQuote: /["']/.test(value),
      reason: !matches.length ? 'ABSENT' : matches.length !== 1 ? 'DUPLICATE' : valid ? 'PASS' : 'MALFORMED_LOCAL_CONFIGURATION' };
  });
  return { values, metadata };
}

export function elevenFailure(http, body) {
  const known = ['invalid_api_key', 'missing_permissions', 'quota_exceeded', 'rate_limit_exceeded',
    'too_many_concurrent_requests', 'ip_not_allowed', 'unauthorized', 'account_disabled'];
  const candidate = body?.detail?.status;
  const code = known.includes(candidate) ? candidate : 'UNCLASSIFIED_PROVIDER_ERROR';
  const permission = code === 'missing_permissions' && typeof body.detail.message === 'string'
    && /\bvoices_read\b/.test(body.detail.message) ? 'voices_read' : undefined;
  return { status: 'BLOQUE', http, providerCode: code,
    ...(permission ? { requiredPermission: permission } : {}),
    cause: code === 'invalid_api_key' ? 'ACCOUNT_CREDENTIAL_REFUSED'
      : code === 'missing_permissions' ? 'ACCOUNT_PERMISSION_REFUSED'
        : http === 429 ? 'RATE_LIMIT' : 'EXTERNAL_REASON_UNCLASSIFIED',
    authentication: code === 'missing_permissions' ? 'KEY_RECOGNIZED_SCOPE_REFUSED' : 'UNPROVEN',
    credits: 'NON_TESTE', generation: 'NON_TESTE' };
}
