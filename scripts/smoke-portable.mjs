import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.argv[2] || 9222);
const deadline = Date.now() + 90000;
let last = 'No Bloop renderer found.';
async function inspect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Renderer inspection timed out.')); }, 5000);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
      expression: `({title:document.title, ready:!!document.querySelector('textarea:not([disabled]),[contenteditable="true"][role="textbox"],[contenteditable="true"][data-slate-editor]')})`, returnByValue: true,
    } })));
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer); socket.close();
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result.result.value);
    });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Renderer connection failed.')); });
  });
}
while (Date.now() < deadline) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
    const targets = await response.json();
    const target = targets.find(t => t.type === 'page' && t.url.startsWith('dsh-app://app/'));
    if (target) {
      const state = await inspect(target);
      if (state.ready) { console.log(JSON.stringify({ ...state, check: 'relocated portable renderer and chat input ready' })); process.exit(0); }
      last = 'Bloop renderer opened but chat input is not ready.';
    }
  } catch (error) { last = error.message; }
  await delay(1000);
}
throw new Error(last);
