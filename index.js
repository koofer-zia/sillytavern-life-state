 
let desired = false, ready = false, epoch = 0, controller = null;
let queue = Promise.resolve();
const waiting = [];
const clearWaiting = () => { for (const off of waiting.splice(0)) off(); };
const context = () => globalThis.SillyTavern?.getContext?.();

function report(error) {
  console.error('[LifeState] 原生扩展未启动；聊天数据未迁移。', error);
  try { globalThis.toastr?.warning?.(error.message || String(error)); } catch (_) {   }
}

function scheduleStart(token) {
  queue = queue.catch(() => {}).then(async () => {
    if (!desired || token !== epoch || !ready || !context()?.chatId) return;
    if (controller?.isRunning()) { clearWaiting(); return; }
    const { createNativeRuntime } = await import('./runtime-31b3f0a55ce14819.js');
    if (!desired || token !== epoch) return;
    if (!controller) controller = createNativeRuntime(globalThis).createController();
    await controller.start();
    if (!desired || token !== epoch) { await controller.stop(); return; }
    clearWaiting();
  }).catch(error => {
    if (token !== epoch) return;
    desired = false; clearWaiting(); report(error);
  });
  return queue;
}

function requestStart() {
  if (desired) return;
  const ctx = context();
  if (!ctx?.eventSource?.on || !ctx.eventSource.removeListener || !ctx.eventTypes?.APP_READY || !ctx.eventTypes?.CHAT_CHANGED) {
    report(new Error('原生扩展需要 SillyTavern 1.18.0 的宿主接口；请检查酒馆版本并刷新。'));
    return;
  }
  desired = true;
  const token = ++epoch;
  const listen = (name, callback) => {
    const event = ctx.eventTypes[name];
    waiting.push(() => ctx.eventSource.removeListener(event, callback));
    ctx.eventSource.on(event, callback);
  };
   
  listen('CHAT_CHANGED', () => scheduleStart(token));
  listen('APP_READY', () => { ready = true; return scheduleStart(token); });
}

async function stop() {
  desired = false; epoch++; clearWaiting();
  const pendingStop = controller?.stop();
  await Promise.allSettled([queue, pendingStop]);
}

export function onActivate() { requestStart(); }
export function onEnable() { requestStart(); }
export async function onDisable() { await stop(); }
export async function onDelete() { await stop(); }
 
export async function onUpdate() { await stop(); }
export function getStatus() { return { requested: desired, running: controller?.isRunning() === true }; }
