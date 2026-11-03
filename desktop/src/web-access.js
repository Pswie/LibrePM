/** Bounded, cancellable access bootstrap. No session values are stored here. */
export class WebAccessError extends Error {
  constructor(phase, code, status) {
    super('Unable to complete access');
    this.name = 'WebAccessError';
    this.phase = phase;
    this.code = code;
    this.status = status;
  }
}

export function accessStep(phase, action, { signal, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
      callback(value);
    };
    const aborted = () => {
      controller.abort();
      finish(reject, new WebAccessError(phase, 'cancelled'));
    };
    if (signal?.aborted) {
      aborted();
      return;
    }
    signal?.addEventListener('abort', aborted, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      finish(reject, new WebAccessError(phase, 'timeout'));
    }, timeoutMs);
    Promise.resolve().then(() => {
      if (settled) return;
      return action(controller.signal);
    }).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error instanceof WebAccessError ? error : new WebAccessError(phase, 'failed', error?.status)),
    );
  });
}

export function boundedTokenProvider(getToken, signal, timeoutMs = 15000) {
  return () => accessStep('session', async () => {
    const token = await getToken();
    if (!token) throw new WebAccessError('session', 'missing', 401);
    return token;
  }, { signal, timeoutMs });
}

export async function resolveWebAccess({ api, signal, activateOrganization, organizationId, timeouts = {} }) {
  if (organizationId) {
    await accessStep('organization', () => activateOrganization({ organization: organizationId }), { signal, timeoutMs: timeouts.organization ?? 15000 });
  }
  await accessStep('initialization', () => api.init(), { signal, timeoutMs: timeouts.initialization ?? 5000 });
  const me = await accessStep('profile', (stepSignal) => api.me({ signal: stepSignal }), { signal, timeoutMs: timeouts.profile ?? 75000 });
  if (!me || typeof me.id !== 'string' || !me.id || !Array.isArray(me.roles)) {
    throw new WebAccessError('profile', 'invalid_response');
  }
  if (me.access) {
    if (me.access.schemaVersion !== 1 || typeof me.access.subject !== 'string' || !Array.isArray(me.access.permissions)
        || !['pending', 'active', 'suspended'].includes(me.access.status) || !me.access.applications?.librepm) throw new WebAccessError('profile', 'invalid_response');
    api.setAccessApiUrl?.(me.accessApiUrl);
  }
  return { user: me, roles: me.roles };
}
