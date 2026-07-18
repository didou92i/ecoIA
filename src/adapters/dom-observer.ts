export function subscribeToScopedMutations(
  root: HTMLElement,
  listener: () => void,
  minimumIntervalMs = 500,
): () => void {
  let lastNotificationAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = true;

  const notify = () => {
    timer = null;
    if (!active) return;
    lastNotificationAt = performance.now();
    listener();
  };
  const observer = new MutationObserver(() => {
    if (!active || timer !== null) return;
    const elapsed = performance.now() - lastNotificationAt;
    if (elapsed >= minimumIntervalMs) {
      notify();
      return;
    }
    timer = setTimeout(notify, minimumIntervalMs - elapsed);
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });

  return () => {
    active = false;
    observer.disconnect();
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}
