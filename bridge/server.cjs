const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const root = __dirname
const configPath = path.join(root, 'keybinds.json')
const scriptPath = path.join(root, 'send-keys.ps1')

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'))
}

function writeJson(request, response, status, body) {
  const origin = request.headers.origin
  const allowedOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173'])

  response.writeHead(status, {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'http://127.0.0.1:5173',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => {
      data += chunk
      if (data.length > 1024 * 16) {
        reject(new Error('Request body too large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function sendKeys(command, config) {
  const target = config.target || {}
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-Keys',
    command.keys,
    '-ProcessName',
    target.processName || 'StarCitizen',
    '-WindowTitle',
    target.windowTitle || 'Star Citizen',
    '-HoldMs',
    String(command.holdMs || 35),
  ]

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr.trim() || `PowerShell exited with ${code}`))
      }
    })
  })
}

const config = readConfig()
const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    writeJson(request, response, 200, { ok: true })
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    const currentConfig = readConfig()
    writeJson(request, response, 200, {
      ok: true,
      commands: Object.keys(currentConfig.commands).length,
      target: currentConfig.target,
    })
    return
  }

  if (request.method === 'GET' && request.url === '/keybinds') {
    writeJson(request, response, 200, readConfig())
    return
  }

  if (request.method === 'POST' && request.url === '/command') {
    try {
      const body = await readBody(request)
      const currentConfig = readConfig()
      const command = currentConfig.commands[body.command]

      if (!command) {
        writeJson(request, response, 404, { ok: false, error: `Unknown command '${body.command}'` })
        return
      }

      await sendKeys(command, currentConfig)
      writeJson(request, response, 200, {
        ok: true,
        command: body.command,
        label: command.label,
        keys: command.keys,
      })
    } catch (error) {
      writeJson(request, response, 500, { ok: false, error: error.message })
    }
    return
  }

  writeJson(request, response, 404, { ok: false, error: 'Not found' })
})

server.listen(config.port || 8787, '127.0.0.1', () => {
  console.log(`Star Citizen bridge listening on http://127.0.0.1:${config.port || 8787}`)
  console.log('Keep Star Citizen running and focused normally; the bridge will focus it before sending keys.')
})
