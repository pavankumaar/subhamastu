import { spawn } from 'node:child_process'

function startProcess(name, command) {
  return {
    name,
    child: spawn(command, {
      stdio: 'inherit',
      shell: true,
    }),
  }
}

const processes = [
  startProcess('api', 'npm run server'),
  startProcess('client', 'npm run dev:client'),
]

let isStopping = false

function stopAll(exitCode = 0) {
  if (isStopping) {
    return
  }

  isStopping = true
  for (const entry of processes) {
    if (!entry.child.killed) {
      entry.child.kill()
    }
  }
  process.exit(exitCode)
}

for (const entry of processes) {
  entry.child.on('exit', (code, signal) => {
    if (isStopping) {
      return
    }

    const reason =
      code === 0
        ? `${entry.name} exited normally.`
        : `${entry.name} exited unexpectedly (code: ${code ?? 'n/a'}, signal: ${signal ?? 'n/a'}).`
    console.error(reason)
    stopAll(code ?? 1)
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
