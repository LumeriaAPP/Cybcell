import { onLang, t } from './i18n';

const REQUEST_TIMEOUT_MS = 15_000;
type ContactField = HTMLInputElement | HTMLTextAreaElement;
type StatusTone = 'error' | 'ok' | 'info';

/** The endpoint is public configuration, never a Formspree API key. */
function formspreeEndpoint(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'formspree.io' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/f\/[a-z0-9]+$/i.test(url.pathname)
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function initContact() {
  const form = document.querySelector<HTMLFormElement>('[data-form]');
  const status = document.querySelector<HTMLElement>('[data-status]');
  const emailElement = document.querySelector<HTMLElement>('[data-email]');
  const copyButton = document.querySelector<HTMLButtonElement>('[data-copy]');
  const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !status || !submitButton || !emailElement) return;

  const email = emailElement.textContent?.trim() ?? '';
  const endpoint = formspreeEndpoint(import.meta.env.VITE_CONTACT_ENDPOINT);
  const fieldNames = ['name', 'email', 'company', 'message'] as const;
  const fields = Object.fromEntries(fieldNames.map((name) => [
    name, form.elements.namedItem(name) as ContactField,
  ])) as Record<typeof fieldNames[number], ContactField>;
  if (fieldNames.some((name) => !fields[name])) return;

  let sending = false;
  let statusKey = '';
  let statusTone: StatusTone = 'info';
  let showEmail = false;
  let copied = false;
  let copyTimer: number | undefined;

  status.id ||= 'contact-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  for (const name of ['name', 'email', 'message'] as const) {
    const descriptions = new Set((fields[name].getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    descriptions.add(status.id);
    fields[name].setAttribute('aria-describedby', [...descriptions].join(' '));
    fields[name].addEventListener('input', () => fields[name].removeAttribute('aria-invalid'));
  }

  function renderStatus() {
    status!.textContent = statusKey ? t(statusKey) : '';
    status!.dataset.tone = statusTone;
    if (showEmail && email) {
      const link = document.createElement('a');
      link.className = 'form__fallback';
      link.href = `mailto:${email}`;
      link.textContent = email;
      status!.append(document.createTextNode(' '), link);
    }
  }

  function setStatus(key: string, tone: StatusTone, fallback = false) {
    statusKey = key;
    statusTone = tone;
    showEmail = fallback;
    renderStatus();
  }

  function renderButtons() {
    submitButton!.disabled = sending || !endpoint;
    submitButton!.textContent = t(sending ? 'ct.sending' : 'ct.send');
    form!.setAttribute('aria-busy', String(sending));
    if (copyButton) copyButton.textContent = t(copied ? 'ct.copied' : 'ct.copy');
  }

  onLang(() => {
    renderButtons();
    renderStatus();
  });
  renderButtons();
  if (!endpoint) setStatus('ct.unavailable', 'info', true);

  copyButton?.addEventListener('click', async () => {
    window.clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(email);
      copied = true;
    } catch {
      copied = false;
      const range = document.createRange();
      range.selectNodeContents(emailElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (!sending) setStatus('ct.copyFallback', 'info');
    }
    renderButtons();
    copyTimer = window.setTimeout(() => {
      copied = false;
      renderButtons();
    }, 1800);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!endpoint) {
      setStatus('ct.unavailable', 'info', true);
      return;
    }

    const values = Object.fromEntries(fieldNames.map((name) => [name, fields[name].value.trim()])) as Record<typeof fieldNames[number], string>;
    let firstInvalid: ContactField | undefined;
    for (const name of ['name', 'email', 'message'] as const) {
      const invalid = !values[name] || !fields[name].validity.valid;
      fields[name].setAttribute('aria-invalid', String(invalid));
      if (invalid && !firstInvalid) firstInvalid = fields[name];
    }
    if (firstInvalid) {
      setStatus('ct.err', 'error');
      firstInvalid.focus();
      return;
    }

    sending = true;
    renderButtons();
    setStatus('ct.sending', 'info');
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const payload = new FormData();
      for (const name of fieldNames) payload.set(name, values[name]);
      payload.set('_subject', `CybCell · ${values.name}${values.company ? ` (${values.company})` : ''}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: payload,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
      });
      const result: unknown = await response.json();
      // Formspree's JSON acknowledgement is required before claiming delivery.
      if (
        controller.signal.aborted ||
        !response.ok ||
        !result ||
        typeof result !== 'object' ||
        !('ok' in result) ||
        result.ok !== true ||
        ('errors' in result && (!Array.isArray(result.errors) || result.errors.length > 0)) ||
        ('error' in result && Boolean(result.error))
      ) throw new Error('Submission was not acknowledged');

      // Preserve any new edits made while the submitted message was in flight.
      if (fieldNames.every((name) => fields[name].value.trim() === values[name])) form.reset();
      for (const name of fieldNames) fields[name].removeAttribute('aria-invalid');
      setStatus('ct.ok', 'ok');
    } catch {
      setStatus(timedOut ? 'ct.timeout' : 'ct.failed', 'error', true);
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      renderButtons();
    }
  });
}
