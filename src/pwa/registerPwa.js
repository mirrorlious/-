const DISMISS_PREFIX = 'yang-reader-pwa-dismissed:';
let deferredInstallPrompt = null;
let activeBanner = null;
let refreshing = false;

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice() {
  const agent = window.navigator.userAgent || '';
  const classicIos = /iPad|iPhone|iPod/.test(agent);
  const modernIpad = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return classicIos || modernIpad;
}

function isDismissedRecently(kind, days = 7) {
  try {
    const value = Number(window.localStorage.getItem(`${DISMISS_PREFIX}${kind}`));
    return Number.isFinite(value) && Date.now() - value < days * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismissal(kind) {
  try {
    window.localStorage.setItem(`${DISMISS_PREFIX}${kind}`, String(Date.now()));
  } catch {
    // Storage can be unavailable in private browsing; dismissal is optional.
  }
}

function removeBanner() {
  activeBanner?.remove();
  activeBanner = null;
}

function showBanner({ kind, title, message, primaryLabel, onPrimary }) {
  if (activeBanner || isStandalone()) return;

  const banner = document.createElement('section');
  banner.className = 'pwa-install-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const icon = document.createElement('img');
  icon.className = 'pwa-install-banner__icon';
  icon.src = '/icons/icon-192.png';
  icon.alt = '';
  icon.width = 48;
  icon.height = 48;

  const content = document.createElement('div');
  content.className = 'pwa-install-banner__content';

  const heading = document.createElement('strong');
  heading.className = 'pwa-install-banner__title';
  heading.textContent = title;

  const copy = document.createElement('p');
  copy.className = 'pwa-install-banner__message';
  copy.textContent = message;

  content.append(heading, copy);

  const actions = document.createElement('div');
  actions.className = 'pwa-install-banner__actions';

  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'pwa-install-banner__primary';
  primary.textContent = primaryLabel;
  primary.addEventListener('click', async () => {
    await onPrimary?.();
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pwa-install-banner__close';
  close.setAttribute('aria-label', '暂不安装');
  close.textContent = '×';
  close.addEventListener('click', () => {
    rememberDismissal(kind);
    removeBanner();
  });

  actions.append(primary, close);
  banner.append(icon, content, actions);
  document.body.append(banner);
  activeBanner = banner;
}

async function promptForInstall() {
  if (!deferredInstallPrompt) return false;

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  removeBanner();
  return choice?.outcome === 'accepted';
}

function showInstallBanner() {
  if (!deferredInstallPrompt || isDismissedRecently('install')) return;
  showBanner({
    kind: 'install',
    title: '安装“杨的阅读器”',
    message: '添加到手机桌面后，可像独立 App 一样打开，并获得更稳定的全屏阅读体验。',
    primaryLabel: '安装',
    onPrimary: promptForInstall
  });
}

function showIosInstructions() {
  if (!isIosDevice() || isStandalone() || isDismissedRecently('ios-install')) return;
  showBanner({
    kind: 'ios-install',
    title: '添加到 iPhone 主屏幕',
    message: '请点 Safari 的“共享”按钮，再选择“添加到主屏幕”。',
    primaryLabel: '知道了',
    onPrimary: () => {
      rememberDismissal('ios-install');
      removeBanner();
    }
  });
}

function showUpdateBanner(worker) {
  removeBanner();
  const banner = document.createElement('section');
  banner.className = 'pwa-install-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const content = document.createElement('div');
  content.className = 'pwa-install-banner__content';

  const heading = document.createElement('strong');
  heading.className = 'pwa-install-banner__title';
  heading.textContent = '发现新版本';

  const copy = document.createElement('p');
  copy.className = 'pwa-install-banner__message';
  copy.textContent = '更新已下载，重新载入即可使用最新功能。';
  content.append(heading, copy);

  const actions = document.createElement('div');
  actions.className = 'pwa-install-banner__actions';

  const update = document.createElement('button');
  update.type = 'button';
  update.className = 'pwa-install-banner__primary';
  update.textContent = '立即更新';
  update.addEventListener('click', () => worker.postMessage({ type: 'SKIP_WAITING' }));

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pwa-install-banner__close';
  close.setAttribute('aria-label', '稍后更新');
  close.textContent = '×';
  close.addEventListener('click', removeBanner);

  actions.append(update, close);
  banner.append(content, actions);
  document.body.append(banner);
  activeBanner = banner;
}

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });

    if (registration.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(installing);
        }
      });
    });

    const checkForUpdate = () => registration.update().catch(() => undefined);
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });

    return registration;
  } catch (error) {
    console.warn('PWA Service Worker registration failed:', error);
    return null;
  }
}

export function registerPwa() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    removeBanner();
  });

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const start = async () => {
    const registration = await setupServiceWorker();

    window.yangReaderPwa = {
      isStandalone,
      canInstall: () => Boolean(deferredInstallPrompt),
      install: promptForInstall,
      checkForUpdate: () => registration?.update()
    };

    if (isIosDevice() && !isStandalone()) {
      window.setTimeout(showIosInstructions, 1600);
    }
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
