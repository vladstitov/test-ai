import { spawn } from 'child_process';
import path from 'path';
import http from 'http';

let qdrantProcess: ReturnType<typeof spawn> | null = null;


const URL_QDRANT = 'http://127.0.0.1:6333';
async function isHealthy(): Promise<boolean> {
  const url = new URL('/healthz',URL_QDRANT);
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      // Qdrant returns 200 OK when healthy
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(timeoutMs: number = 15000, intervalMs: number = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Qdrant did not become healthy in time');
}

function resolveQdrantExePath(): string | null {
  const candidates: string[] = [];
  // Common locations relative to compiled JS (__dirname points to bin)
  candidates.push(   
    path.join(process.cwd(), 'qdrant', 'qdrant.exe'),   
    path.join(__dirname, 'qdrant', 'qdrant.exe')
  );
  for (const p of candidates) {
    try {
      // fs exists check without importing fs promises
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      if (fs.existsSync(p)) return p;
    } catch {
      // continue
    }
  }
  return null;
}

export async function startQdrant(): Promise<void> {
  // If already running, return early
  if (await isHealthy()) return;
  if (qdrantProcess) return;

  const exePath = 'E:\\qdrant\\qdrant.exe';
  const configPath = 'E:\\qdrant\\cfg.yml';
  
  console.log(`Starting Qdrant from ${exePath}`);


  qdrantProcess = spawn(exePath, ['--config-path', configPath], {
    cwd: path.dirname(exePath),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });


  qdrantProcess.stdout?.on('data', (d) => console.log('[Qdrant]', d.toString().trim()));
  qdrantProcess.stderr?.on('data', (d) => console.error('[Qdrant ERROR]', d.toString().trim()));
  qdrantProcess.on('exit', (code) => {
    console.log(`[Qdrant exited ${code}]`);
    qdrantProcess = null;
  });

  await waitForHealth();
  console.log('Qdrant is ready');
}

export async function ensureQdrantRunning(baseUrl: string): Promise<void> {
  if (await isHealthy()) return;
  await startQdrant();
}

// Optional CLI entrypoint
if (require.main === module) {
  startQdrant()
    .then(() => console.log('Qdrant started'))
    .catch((e) => {
      console.error('[FATAL] Failed to start Qdrant:', e?.message || e);
      process.exit(1);
    });
}
