/* Installation only: existing initialization and storage remain independent. */
(() => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext ||
      !/^https?:$/.test(location.protocol) || window.top !== window.self) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .catch(error => console.warn('PWA registration unavailable:', error));
  }, { once: true });
})();
