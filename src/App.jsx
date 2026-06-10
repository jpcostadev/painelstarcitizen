import { useEffect, useMemo, useState } from 'react'
import './App.css'

const targetList = [
  { id: 'A-01', name: 'CUTLASS BLACK', range: '3.2 km', threat: 28, faction: 'NEUTRAL' },
  { id: 'B-17', name: 'HOSTILE MANTIS', range: '1.4 km', threat: 91, faction: 'HOSTILE' },
  { id: 'C-09', name: 'FREELANCER MAX', range: '5.8 km', threat: 46, faction: 'UNKNOWN' },
]

const systemDefaults = {
  power: true,
  engines: true,
  shields: true,
  weapons: true,
  comms: true,
  nav: true,
  scan: false,
  stealth: false,
}

const powerDefaults = {
  engines: 34,
  weapons: 22,
  shields: 28,
  systems: 16,
}

const gameCommandBySystem = {
  power: 'power_toggle',
  engines: 'engines_toggle',
  shields: 'shields_toggle',
  weapons: 'weapons_toggle',
  comms: 'comms_toggle',
  nav: 'nav_toggle',
}

const gameCommandByFlight = {
  cruise: 'cruise_toggle',
  vtol: 'vtol_toggle',
  landing: 'landing_gear_toggle',
}

function App() {
  const [systems, setSystems] = useState(systemDefaults)
  const [targetIndex, setTargetIndex] = useState(1)
  const [lockedTarget, setLockedTarget] = useState('B-17')
  const [lockMode, setLockMode] = useState('AUTO')
  const [operatorMode, setOperatorMode] = useState('PILOT')
  const [flight, setFlight] = useState({
    cruise: false,
    gsafe: true,
    auto: false,
    vtol: false,
    landing: false,
    speedMode: 'M/S',
  })
  const [doors, setDoors] = useState({
    all: false,
    front: false,
    rear: false,
    left: false,
    right: false,
    cargo: false,
  })
  const [power, setPower] = useState(powerDefaults)
  const [shieldBias, setShieldBias] = useState(52)
  const [shieldPoint, setShieldPoint] = useState({ x: 50, y: 50 })
  const [capacitorPoint, setCapacitorPoint] = useState({ x: 50, y: 48 })
  const [danger, setDanger] = useState({
    quantum: false,
    collision: true,
    hijack: false,
    fire: false,
  })
  const [quickState, setQuickState] = useState({
    boost: false,
    hail: false,
    dock: false,
  })
  const [bridgeStatus, setBridgeStatus] = useState('checking')
  const [log, setLog] = useState([
    'Idris-M command interface online',
    'Target B-17 marked as primary',
    'Power grid balanced at 27.6 MW',
  ])

  const activeTarget = targetList[targetIndex]
  const totalPower = Object.values(power).reduce((sum, value) => sum + Number(value), 0)
  const shieldStrength = Math.min(100, Math.round(power.shields * 2.8 + (systems.shields ? 12 : 0)))
  const engineOutput = Math.min(100, Math.round(power.engines * 2.35 + (systems.engines ? 10 : -8)))
  const weaponHeat = Math.min(100, Math.round(power.weapons * 2.4 + (danger.fire ? 18 : 0)))
  const threatLevel = Math.max(activeTarget.threat, danger.hijack ? 96 : 0, danger.fire ? 88 : 0)

  const status = useMemo(() => {
    if (!systems.power) return 'COLD'
    if (danger.fire || danger.hijack) return 'DANGER'
    if (danger.quantum) return 'SPOOLING'
    if (flight.cruise) return 'CRUISE'
    return 'READY'
  }, [danger.fire, danger.hijack, danger.quantum, flight.cruise, systems.power])

  useEffect(() => {
    fetch('http://127.0.0.1:8787/health')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(() => setBridgeStatus('linked'))
      .catch(() => setBridgeStatus('offline'))
  }, [])

  const addLog = (message) => {
    setLog((items) => (items[0] === message ? items : [message, ...items].slice(0, 8)))
  }

  const sendGameCommand = (command) => {
    if (!command) return

    fetch('http://127.0.0.1:8787/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw data
        return data
      })
      .then(() => setBridgeStatus('linked'))
      .catch((error) => {
        if (error?.error) {
          setBridgeStatus('linked')
          addLog(error.error.includes('Target window') ? 'Star Citizen window not found' : 'Game command failed')
          return
        }

        setBridgeStatus('offline')
        addLog('Game bridge offline')
      })
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const pointFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 10, 90),
    }
  }

  const capacitorPointFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 38, 62),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 36, 58),
    }
  }

  const activateShields = () => {
    if (!systems.shields) {
      setSystems((current) => ({ ...current, shields: true }))
      sendGameCommand('shields_toggle')
      addLog('SHD enabled')
    }
  }

  const moveShieldPoint = (event) => {
    const next = pointFromEvent(event)
    setShieldPoint(next)
    setShieldBias(Math.round(next.x))
  }

  const startShieldDrag = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    activateShields()
    moveShieldPoint(event)
  }

  const dragShieldPoint = (event) => {
    if (event.buttons !== 1) return
    moveShieldPoint(event)
  }

  const moveCapacitorPoint = (event) => {
    setCapacitorPoint(capacitorPointFromEvent(event))
  }

  const startCapacitorDrag = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    moveCapacitorPoint(event)
  }

  const toggleSystem = (key, label) => {
    setSystems((current) => {
      const next = { ...current, [key]: !current[key] }
      addLog(`${label} ${next[key] ? 'enabled' : 'disabled'}`)
      sendGameCommand(gameCommandBySystem[key])
      return next
    })
  }

  const selectTarget = (index) => {
    setTargetIndex(index)
    addLog(`Target ${targetList[index].id} selected`)
  }

  const cycleTarget = (direction) => {
    const next = (targetIndex + direction + targetList.length) % targetList.length
    selectTarget(next)
  }

  const toggleFlight = (key, label) => {
    setFlight((current) => {
      const next = { ...current, [key]: !current[key] }
      addLog(`${label} ${next[key] ? 'active' : 'standby'}`)
      sendGameCommand(gameCommandByFlight[key])
      return next
    })
  }

  const toggleDoor = (key) => {
    setDoors((current) => {
      const value = !current[key]
      const next = key === 'all'
        ? Object.fromEntries(Object.keys(current).map((door) => [door, value]))
        : { ...current, [key]: value }
      addLog(`${key.toUpperCase()} hatch ${value ? 'open' : 'sealed'}`)
      return next
    })
  }

  const toggleDanger = (key, label) => {
    setDanger((current) => {
      const next = { ...current, [key]: !current[key] }
      addLog(`${label} ${next[key] ? 'armed' : 'cleared'}`)
      if (key === 'quantum') sendGameCommand('quantum_toggle')
      return next
    })
  }

  const setPowerChannel = (key, value) => {
    setPower((current) => ({ ...current, [key]: Number(value) }))
  }

  const resetPower = () => {
    setPower(powerDefaults)
    addLog('Power distribution reset')
  }

  const executeQuick = (key, label) => {
    setQuickState((current) => ({ ...current, [key]: !current[key] }))
    addLog(`${label} command executed`)
    sendGameCommand(`${key}_toggle`)
  }

  const capacitorNode = {
    x: Math.round(90 + (capacitorPoint.x - 50) * 0.95),
    y: Math.round(64 + (capacitorPoint.y - 48) * 0.9),
  }

  const capacitorTriangle = {
    leftX: capacitorNode.x - 18,
    rightX: capacitorNode.x + 18,
    topY: capacitorNode.y - 10,
    bottomY: capacitorNode.y + 21,
  }

  const shieldReadout = {
    front: Math.round(100 - shieldPoint.y * 0.42),
    rear: Math.round(58 + shieldPoint.y * 0.42),
    left: Math.round(100 - shieldPoint.x * 0.42),
    right: Math.round(58 + shieldPoint.x * 0.42),
  }

  return (
    <main className="bridge-shell">
      <section className="top-rail">
        <div className="brand-panel panel">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div>
            <p className="eyebrow">Aegis Dynamics</p>
            <h1>Idris-M Command Deck</h1>
          </div>
          <div className="clock-block">
            <span>2954.05.23</span>
            <strong>{status}</strong>
            <em className={`bridge-status ${bridgeStatus}`}>BRIDGE {bridgeStatus}</em>
          </div>
        </div>

        <Panel title="Systems" className="systems-panel">
          <div className="system-strip">
            {[
              ['power', 'PWR'],
              ['engines', 'ENG'],
              ['shields', 'SHD'],
              ['weapons', 'WPN'],
              ['comms', 'COM'],
              ['nav', 'NAV'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`round-control ${systems[key] ? 'is-on' : ''}`}
                onClick={() => toggleSystem(key, label)}
                aria-pressed={systems[key]}
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Dashboard" className="dashboard-panel">
          <div className="mini-grid">
            {[
              ['MFD', 'GRID'],
              ['COMM', 'WAVE'],
              ['NAV', 'VECTOR'],
              ['DATA', 'LINK'],
              ['CREW', '4/12'],
              ['CFG', 'SYNC'],
            ].map(([label, value]) => (
              <button key={label} type="button" className="mini-button" onClick={() => addLog(`${label} panel opened`)}>
                <span>{label}</span>
                <strong>{value}</strong>
              </button>
            ))}
          </div>
        </Panel>
      </section>

      <section className="cockpit-grid">
        <aside className="left-stack">
          <Panel title="Targeting">
            <div className="segment-group">
              {['SCAN', 'GTS', 'RDR', 'PNT'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`segment ${mode === 'RDR' ? 'active' : ''}`}
                  onClick={() => {
                    addLog(`${mode} targeting mode requested`)
                    if (mode === 'SCAN') sendGameCommand('scan_toggle')
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="segment-group">
              {['HST', 'FRD', 'NTRL', 'ALL'].map((filter) => (
                <button key={filter} type="button" className="segment" onClick={() => addLog(`${filter} filter applied`)}>
                  {filter}
                </button>
              ))}
            </div>

            <div className="segment-group">
              {['MANUAL', 'AUTO', 'HOLD'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`segment ${lockMode === mode ? 'active' : ''}`}
                  onClick={() => {
                    setLockMode(mode)
                    addLog(`Lock mode set to ${mode}`)
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="cycle-row">
              <button type="button" className="control-button" onClick={() => cycleTarget(-1)}>PREV</button>
              <button
                type="button"
                className="control-button danger-lite"
                onClick={() => {
                  setLockedTarget(activeTarget.id)
                  addLog(`Target ${activeTarget.id} locked`)
                  sendGameCommand('lock_target')
                }}
              >
                LOCK
              </button>
              <button type="button" className="control-button" onClick={() => cycleTarget(1)}>NEXT</button>
            </div>

            <div className="target-cards">
              {targetList.map((target, index) => (
                <button
                  key={target.id}
                  type="button"
                  className={`target-card ${target.id === lockedTarget ? 'locked' : ''} ${index === targetIndex ? 'selected' : ''}`}
                  onClick={() => selectTarget(index)}
                >
                  <strong>{target.id}</strong>
                  <span>{target.name}</span>
                  <small>{target.range}</small>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Operator Modes">
            <div className="operator-row">
              {['PILOT', 'GUNNER', 'ENGINEER', 'SCIENCE'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`control-button ${operatorMode === mode ? 'is-active' : ''}`}
                  onClick={() => {
                    setOperatorMode(mode)
                    addLog(`${mode} station linked`)
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Quick Actions">
            <div className="quick-grid">
              <button type="button" className={`control-button ${quickState.boost ? 'is-active' : ''}`} onClick={() => executeQuick('boost', 'Boost')}>
                BOOST
              </button>
              <button type="button" className={`control-button ${flight.vtol ? 'is-active' : ''}`} onClick={() => toggleFlight('vtol', 'VTOL')}>
                VTOL
              </button>
              <button type="button" className={`control-button ${flight.cruise ? 'is-active' : ''}`} onClick={() => toggleFlight('cruise', 'Cruise')}>
                CRUISE
              </button>
              <button type="button" className={`control-button ${flight.landing ? 'is-active' : ''}`} onClick={() => toggleFlight('landing', 'Landing gear')}>
                LAND
              </button>
              <button type="button" className="control-button danger-lite" onClick={() => addLog('Ejection interlock rejected')}>
                EJECT
              </button>
              <button type="button" className="control-button danger-lite" onClick={() => toggleDanger('hijack', 'Self destruct')}>
                SELF DEST
              </button>
              <button type="button" className={`control-button ${quickState.hail ? 'is-active' : ''}`} onClick={() => executeQuick('hail', 'Hail')}>
                HAIL
              </button>
              <button type="button" className={`control-button ${quickState.dock ? 'is-active' : ''}`} onClick={() => executeQuick('dock', 'Dock')}>
                DOCK
              </button>
            </div>
          </Panel>
        </aside>

        <section className="center-stack">
          <div className="upper-controls">
            <Panel title="Danger" className="danger-panel">
              <div className="danger-grid">
                {[
                  ['quantum', 'Q.DRIVE'],
                  ['collision', 'COLLISION'],
                  ['hijack', 'HIJACK'],
                  ['fire', 'FIRE'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`danger-button ${danger[key] ? 'is-hot' : ''}`}
                    onClick={() => toggleDanger(key, label)}
                    aria-pressed={danger[key]}
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Flight Control" className="flight-panel">
              <div className="flight-grid">
                <button type="button" className="control-button" onClick={() => setFlight((current) => ({ ...current, speedMode: current.speedMode === 'M/S' ? 'SCM' : 'M/S' }))}>
                  {flight.speedMode}
                </button>
                <button type="button" className={`control-button ${flight.cruise ? 'is-active' : ''}`} onClick={() => toggleFlight('cruise', 'Cruise')}>
                  CRUISE
                </button>
                <button type="button" className={`control-button ${flight.gsafe ? 'is-active' : ''}`} onClick={() => toggleFlight('gsafe', 'G-safe')}>
                  G-SAFE
                </button>
                <button type="button" className={`control-button ${flight.auto ? 'is-active' : ''}`} onClick={() => toggleFlight('auto', 'Auto flight')}>
                  AUTO
                </button>
                <button type="button" className={`control-button ${flight.vtol ? 'is-active' : ''}`} onClick={() => toggleFlight('vtol', 'VTOL')}>
                  VTOL
                </button>
                <button type="button" className={`control-button ${flight.landing ? 'is-active' : ''}`} onClick={() => toggleFlight('landing', 'Landing gear')}>
                  LNDG
                </button>
              </div>
            </Panel>
          </div>

          <div className="upper-controls">
            <Panel title="Weapons / Turrets">
              <div className="weapon-grid">
                {['GIMBAL', 'GROUP 01', 'FIRE', 'PRESET', 'CYCLE', 'LINK'].map((item) => (
                  <button key={item} type="button" className="control-button" onClick={() => addLog(`${item} weapons command`)}>
                    {item}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Doors / Hatches">
              <div className="doors-grid">
                {Object.keys(doors).map((door) => (
                  <button
                    key={door}
                    type="button"
                    className={`control-button ${doors[door] ? 'is-active' : ''}`}
                    onClick={() => toggleDoor(door)}
                    aria-pressed={doors[door]}
                  >
                    {door.toUpperCase()}
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          <div className="core-grid">
            <Panel title="Power Management">
              <div className="power-list">
                {[
                  ['engines', 'Engines', engineOutput],
                  ['weapons', 'Weapons', 100 - weaponHeat],
                  ['shields', 'Shields', shieldStrength],
                  ['systems', 'Systems', Math.min(100, power.systems * 4)],
                ].map(([key, label, value]) => (
                  <div className="power-item" key={key}>
                    <div className="bar-icon" style={{ '--level': `${value}%` }} />
                    <span>{label}</span>
                    <strong>{value}%</strong>
                  </div>
                ))}
                <div className="output-meter">
                  <span>Output</span>
                  <strong>{(totalPower / 3.6).toFixed(1)} / 34.0 MW</strong>
                  <div className="thin-meter"><i style={{ width: `${totalPower}%` }} /></div>
                </div>
              </div>
            </Panel>

            <Panel title="Shields" className="shield-panel">
              <div className={`shield-console ${systems.shields ? 'online' : 'offline'}`}>
                <div
                  className="capacitor-scope"
                  onPointerDown={startCapacitorDrag}
                  onPointerMove={(event) => {
                    if (event.buttons === 1) moveCapacitorPoint(event)
                  }}
                >
                  <div className="scope-label">
                    <span>Capacitors</span>
                    <strong>{shieldStrength}%</strong>
                  </div>
                  <svg className="capacitor-graph" viewBox="0 0 180 136" role="img" aria-label="Shield capacitor flow">
                    <path className="graph-line faint" d="M27 24 L90 116 L153 24" />
                    <path className="graph-line" d={`M27 24 L${capacitorTriangle.leftX} ${capacitorTriangle.topY} L${capacitorTriangle.rightX} ${capacitorTriangle.topY} L153 24`} />
                    <path className="graph-line" d={`M${capacitorNode.x} ${capacitorTriangle.bottomY} L90 116`} />
                    <path className="graph-line hot" d={`M${capacitorTriangle.leftX} ${capacitorTriangle.topY} L${capacitorNode.x} ${capacitorTriangle.bottomY} L${capacitorTriangle.rightX} ${capacitorTriangle.topY}`} />
                    <path className="graph-fill" d={`M${capacitorTriangle.leftX} ${capacitorTriangle.topY} L${capacitorTriangle.rightX} ${capacitorTriangle.topY} L${capacitorNode.x} ${capacitorTriangle.bottomY} Z`} />
                    <circle cx="27" cy="24" r="4" />
                    <circle cx="153" cy="24" r="4" />
                    <circle cx="90" cy="116" r="4" />
                    <circle className="drag-node" cx={capacitorNode.x} cy={capacitorNode.y} r="6" />
                    <path className="cap-icon left" d="M15 16 l7 -7 M20 19 l7 -7 M25 22 l7 -7" />
                    <path className="cap-icon right" d="M160 13 h8 v8 h-8 z M164 8 v18 M155 17 h18" />
                    <path className="bottom-chevron" d="M82 126 L90 119 L98 126 M84 130 L90 124 L96 130" />
                  </svg>
                  <button
                    type="button"
                    className="shield-action"
                    onClick={() => {
                      setShieldBias(50)
                      addLog('Shield capacitor bias reset')
                    }}
                  >
                    RESET CAPACITORS
                  </button>
                </div>

                <div
                  className="shield-scope"
                  role="slider"
                  tabIndex="0"
                  aria-label="Shield distribution"
                  aria-valuetext={`Left ${shieldReadout.left}, right ${shieldReadout.right}, front ${shieldReadout.front}, rear ${shieldReadout.rear}`}
                  onPointerDown={startShieldDrag}
                  onPointerMove={dragShieldPoint}
                  style={{ '--shield-x': `${shieldPoint.x}%`, '--shield-y': `${shieldPoint.y}%` }}
                >
                  <span className="scope-label">
                    <span>Shields</span>
                    <strong>{systems.shields ? 'ACTIVE' : 'OFFLINE'}</strong>
                  </span>
                  <span className="shield-grid">
                    <b className="shield-label front">FRONT {shieldReadout.front}</b>
                    <b className="shield-label rear">REAR {shieldReadout.rear}</b>
                    <b className="shield-label left">L {shieldReadout.left}</b>
                    <b className="shield-label right">R {shieldReadout.right}</b>
                    <i className="axis x" />
                    <i className="axis y" />
                    <i className="target-box" />
                    <i className="pulse-ring" />
                  </span>
                  <button
                    type="button"
                    className="shield-action reset-shields"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      setSystems((current) => ({ ...current, shields: true }))
                      setShieldPoint({ x: 50, y: 50 })
                      setShieldBias(50)
                      addLog('Shield grid reset')
                    }}
                  >
                    RESET SHIELDS
                  </button>
                </div>
              </div>
              <label className="range-control">
                <span>Shield Balance</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={shieldBias}
                  onChange={(event) => setShieldBias(event.target.value)}
                  style={{ '--value': `${shieldBias}%` }}
                />
              </label>
            </Panel>

            <Panel title="Power Distribution" className="distribution-panel">
              <div className="slider-bank">
                {[
                  ['engines', 'ENG'],
                  ['weapons', 'WEP'],
                  ['shields', 'SHD'],
                  ['systems', 'SYS'],
                ].map(([key, label]) => (
                  <label key={key} className="vertical-slider">
                    <span>{label}</span>
                    <div className="slider-column">
                      <input
                        type="range"
                        min="0"
                        max="45"
                        value={power[key]}
                        onChange={(event) => setPowerChannel(key, event.target.value)}
                      />
                    </div>
                    <strong>{power[key]}</strong>
                  </label>
                ))}
              </div>
              <div className="priority-row">
                {['LOW', 'MED', 'HIGH', 'CRIT'].map((priority) => (
                  <button key={priority} type="button" className={`control-button ${priority === 'HIGH' ? 'is-warning' : ''}`} onClick={() => addLog(`${priority} priority queued`)}>
                    {priority}
                  </button>
                ))}
              </div>
              <button type="button" className="wide-link" onClick={resetPower}>RESET DISTRIBUTION</button>
            </Panel>

            <Panel title="Propulsion">
              <div className="propulsion-list">
                {[
                  ['Main engine', engineOutput],
                  ['Maneuver thrusters', Math.max(0, engineOutput - 11)],
                  ['Retro thrusters', Math.max(0, engineOutput - 26)],
                  ['Quantum drive', danger.quantum ? 100 : 64],
                ].map(([label, value]) => (
                  <div className="propulsion-item" key={label}>
                    <span>{label}</span>
                    <div className="thin-meter"><i style={{ width: `${value}%` }} /></div>
                    <strong>{label === 'Quantum drive' && danger.quantum ? 'SPOOLING' : `${value}%`}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <aside className="right-stack">
          <Panel title="Threat Monitor">
            <div className={`threat-ring ${threatLevel > 80 ? 'critical' : ''}`}>
              <span>{threatLevel}</span>
              <small>THREAT</small>
            </div>
            <div className="active-target">
              <span>Primary</span>
              <strong>{activeTarget.name}</strong>
              <small>{activeTarget.faction} / {activeTarget.range}</small>
            </div>
          </Panel>

          <Panel title="Quantum Drive">
            <div className="quantum-card">
              <div className={`spool ${danger.quantum ? 'spooling' : ''}`} />
              <div>
                <span>Calibration</span>
                <strong>{danger.quantum ? '100%' : '72%'}</strong>
                <div className="thin-meter"><i style={{ width: danger.quantum ? '100%' : '72%' }} /></div>
                <small>{danger.quantum ? 'READY TO JUMP' : 'STANDING BY'}</small>
              </div>
            </div>
          </Panel>

          <Panel title="Comms">
            <div className="comms-grid">
              <div>
                <span>Channel</span>
                <strong>GLOBAL</strong>
              </div>
              <div>
                <span>Encryption</span>
                <strong>{systems.comms ? 'ENABLED' : 'OFFLINE'}</strong>
              </div>
            </div>
            <div className="log-feed" aria-live="polite">
              {log.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  )
}

function Panel({ title, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

export default App
