import { expect, test, type Page, type Route } from '@playwright/test';

const endpoint = 'https://formspree.io/f/testform';
const values = {
  name: 'Test Visitor',
  email: 'visitor@example.test',
  company: 'Example Studio',
  message: 'We need a website and a mobile app.',
};

// The suite must never send a real contact message or depend on external fonts.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'formspree.io' || host.endsWith('.formspree.io') || host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') {
      return route.abort();
    }
    return route.continue();
  });
});

async function fillForm(page: Page) {
  for (const [name, value] of Object.entries(values)) {
    await page.locator(`[data-form] [name="${name}"]`).fill(value);
  }
}

async function assertValuesPreserved(page: Page) {
  for (const [name, value] of Object.entries(values)) {
    await expect(page.locator(`[data-form] [name="${name}"]`)).toHaveValue(value);
  }
}

async function submit(page: Page) {
  await page.locator('[data-form] button[type="submit"]').click();
}

async function openContact(page: Page, url = '/#contact') {
  await page.goto(url);
  await expect(page.locator('[data-form]')).toBeVisible();
  await fillForm(page);
}

async function instrumentCanvas(page: Page) {
  await page.addInitScript(() => {
    const counts: Record<string, number> = {};
    (window as unknown as { __canvasPaints: Record<string, number> }).__canvasPaints = counts;
    for (const name of ['clearRect', 'fillRect', 'drawImage', 'fill', 'stroke'] as const) {
      const original = CanvasRenderingContext2D.prototype[name];
      Object.defineProperty(CanvasRenderingContext2D.prototype, name, {
        value: function (this: CanvasRenderingContext2D, ...args: unknown[]) {
          const key = this.canvas.id || (this.canvas.hasAttribute('data-viewer-canvas') ? 'viewer' : 'other');
          counts[key] = (counts[key] ?? 0) + 1;
          return Reflect.apply(original, this, args);
        },
      });
    }
  });
}

async function paintCount(page: Page, name = 'colony') {
  return page.evaluate((key) => (window as unknown as { __canvasPaints: Record<string, number> }).__canvasPaints[key] ?? 0, name);
}

async function expectCanvasIdle(page: Page, name = 'colony') {
  const before = await paintCount(page, name);
  await page.waitForTimeout(400);
  expect(await paintCount(page, name)).toBe(before);
}

test('three coherent story chapters translate and persist the selected language', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#story .chapter')).toHaveCount(3);
  await expect(page.locator('#story .chapter__title')).toHaveText([
    'Hər həll bir hüceyrədir.', 'Həllər bir-biri ilə danışır.', 'Birlikdə daha güclüdürlər.',
  ]);
  await expect(page.locator('[data-rail]')).toHaveCount(3);
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#story .chapter__title')).toHaveText([
    'Every solution is a cell.', 'Solutions talk to each other.', 'Stronger together.',
  ]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'az');
});

test('mobile portrait, tablet and landscape have no horizontal overflow in either language', async ({ page }) => {
  for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const language of ['az', 'en']) {
      if (language === 'en') await page.locator('[data-lang-toggle]').click();
      for (const selector of ['#concept', '#story', '#cells', '#work', '#contact']) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
    }
    // The next viewport begins in Azerbaijani again.
    await page.locator('[data-lang-toggle]').click();
  }
});

test('wheel and keyboard retain native continuous scrolling', async ({ page }) => {
  await page.goto('/');
  const prevented = await page.evaluate(() => {
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 220 });
    const key = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'PageDown', code: 'PageDown' });
    document.body.dispatchEvent(wheel);
    document.body.dispatchEvent(key);
    return { wheel: wheel.defaultPrevented, key: key.defaultPrevented };
  });
  expect(prevented).toEqual({ wheel: false, key: false });
  await page.mouse.wheel(0, 320);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(150);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(700);
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
});

test('touch scrolling is not intercepted and moves the mobile document', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const prevented = await page.evaluate(() => {
    const event = new Event('touchmove', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 640 }] });
  for (const y of [560, 480, 400, 320, 240]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
});

test('hero introduction settles and stops painting while idle', async ({ page }) => {
  await instrumentCanvas(page);
  await page.goto('/');
  await expect(page.locator('#colony')).toBeVisible();
  await page.waitForTimeout(3000);
  expect(await paintCount(page)).toBeGreaterThan(0);
  await expectCanvasIdle(page);
});

test('reduced motion skips ongoing canvas animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await instrumentCanvas(page);
  await page.goto('/');
  await page.waitForTimeout(250);
  expect(await paintCount(page)).toBeGreaterThan(0);
  await expectCanvasIdle(page);
});

test('name and story scenes settle between scroll interactions', async ({ page }) => {
  await instrumentCanvas(page);
  await page.goto('/');
  for (const selector of ['#concept', '[data-scene="single"]', '[data-scene="signal"]', '[data-scene="organism"]']) {
    await page.locator(selector).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(1800);
    await expectCanvasIdle(page);
  }
});

test('mobile service illustration remains static and covered colony stops', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await instrumentCanvas(page);
  await page.goto('/');
  await page.locator('[data-viewer-canvas]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  await expectCanvasIdle(page, 'viewer');
  await expectCanvasIdle(page);
});

test('missing endpoint disables submission, states unavailability and preserves inputs', async ({ page }) => {
  let requests = 0;
  await page.route(endpoint, (route) => { requests += 1; return route.abort(); });
  await openContact(page, 'http://127.0.0.1:5181/#contact');
  await expect(page.locator('[data-form] button[type="submit"]')).toBeDisabled();
  await expect(page.locator('[data-status]')).toContainText('Forma hazırda aktiv deyil');
  await page.locator('[data-form]').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await assertValuesPreserved(page);
  expect(requests).toBe(0);
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('[data-status]')).toContainText('The form is currently unavailable');
  await expect(page.locator('[data-status] a')).toHaveAttribute('href', 'mailto:hello@cybcell.az');
  await expect(page.locator('[data-status]')).not.toHaveAttribute('data-tone', 'ok');
});

test('invalid required fields are marked and no request is attempted', async ({ page }) => {
  let requests = 0;
  await page.route(endpoint, (route) => { requests += 1; return route.abort(); });
  await page.goto('/#contact');
  await page.locator('[name="email"]').fill('invalid-email');
  await submit(page);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-tone', 'error');
  await expect(page.locator('[name="name"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[name="email"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[name="message"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[name="name"]')).toBeFocused();
  expect(requests).toBe(0);
  await page.locator('[name="name"]').fill(values.name);
  await expect(page.locator('[name="name"]')).not.toHaveAttribute('aria-invalid', 'true');
});

test('acknowledged multipart POST shows success and clears the submitted form', async ({ page }) => {
  let captured: { method: string; headers: Record<string, string>; body: string } | undefined;
  await page.route(endpoint, async (route) => {
    const request = route.request();
    captured = { method: request.method(), headers: request.headers(), body: request.postDataBuffer()?.toString() ?? '' };
    await route.fulfill({ json: { ok: true } });
  });
  await openContact(page);
  await submit(page);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-tone', 'ok');
  expect(captured?.method).toBe('POST');
  expect(captured?.headers.accept).toBe('application/json');
  expect(captured?.headers['content-type']).toContain('multipart/form-data; boundary=');
  for (const [name, value] of Object.entries(values)) {
    expect(captured?.body).toContain(`name="${name}"`);
    expect(captured?.body).toContain(value);
    await expect(page.locator(`[name="${name}"]`)).toHaveValue('');
  }
  expect(captured?.body).toContain('CybCell · Test Visitor (Example Studio)');
  await expect(page.locator('[data-form]')).toHaveAttribute('aria-busy', 'false');
});

test('pending request prevents duplicates and survives a language switch', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(endpoint, async (route) => {
    requests += 1;
    await pending;
    await route.fulfill({ json: { ok: true } });
  });
  await openContact(page);
  await submit(page);
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator('[data-form]')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-form] button[type="submit"]')).toBeDisabled();
  await page.locator('[data-form]').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('[data-form] button[type="submit"]')).toHaveText('Sending…');
  await expect(page.locator('[data-status]')).toHaveText('Sending…');
  await assertValuesPreserved(page);
  expect(requests).toBe(1);
  release();
  await expect(page.locator('[data-status]')).toContainText('Your message was received');
  await expect(page.locator('[data-form] button[type="submit"]')).toBeEnabled();
});

test('new edits made during submission are preserved after acknowledgement', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(endpoint, async (route) => { await pending; await route.fulfill({ json: { ok: true } }); });
  await openContact(page);
  await submit(page);
  await expect(page.locator('[data-form]')).toHaveAttribute('aria-busy', 'true');
  await page.locator('[name="message"]').fill('A second project description edited during sending.');
  release();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-tone', 'ok');
  await expect(page.locator('[name="message"]')).toHaveValue('A second project description edited during sending.');
  await expect(page.locator('[name="name"]')).toHaveValue(values.name);
});

for (const failure of [
  { name: 'HTTP server error', reply: (route: Route) => route.fulfill({ status: 503, json: { ok: true } }) },
  { name: 'network failure', reply: (route: Route) => route.abort('failed') },
  { name: 'application rejection', reply: (route: Route) => route.fulfill({ json: { ok: true, errors: [{ message: 'Rejected' }] } }) },
  { name: 'malformed response', reply: (route: Route) => route.fulfill({ contentType: 'application/json', body: '<html>Unexpected response</html>' }) },
]) {
  test(`${failure.name} reports failure without clearing inputs or claiming success`, async ({ page }) => {
    await page.route(endpoint, failure.reply);
    await openContact(page);
    await submit(page);
    await expect(page.locator('[data-status]')).toHaveAttribute('data-tone', 'error');
    await expect(page.locator('[data-status]')).toContainText('Mesaj göndərilmədi');
    await assertValuesPreserved(page);
    await expect(page.locator('[data-form] button[type="submit"]')).toBeEnabled();
    await expect(page.locator('[data-status] a')).toHaveAttribute('href', 'mailto:hello@cybcell.az');
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('[data-status]')).toContainText('Your message could not be sent');
  });
}

test('request timeout aborts submission and preserves the draft for retry', async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(endpoint, async (route) => {
    requested = true;
    await pending;
    await route.abort().catch(() => {});
  });
  await openContact(page);
  await page.clock.install();
  await submit(page);
  await expect.poll(() => requested).toBe(true);
  await page.clock.fastForward(15_001);
  await expect(page.locator('[data-status]')).toContainText('Göndəriş çox vaxt apardı');
  await expect(page.locator('[data-status]')).toHaveAttribute('data-tone', 'error');
  await assertValuesPreserved(page);
  await expect(page.locator('[data-form] button[type="submit"]')).toBeEnabled();
  release();
});


test('Canvas unavailable preserves the readable hero and contact workflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-colony-unavailable', '');
  await expect(page.locator('.hero h1')).toBeVisible();
  await expect(page.locator('.viewer')).toBeHidden();
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('[data-form] button[type="submit"]')).toBeEnabled();
  expect(errors).toEqual([]);
});
