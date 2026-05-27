import { useState } from 'react'
import './App.css'

interface SolveResponse {
  result: 'unique' | 'parametric' | 'no_solution'
  solutions: Record<string, string>
  free_variables: string[]
  note?: string
}

export default function App() {
  const [equations, setEquations] = useState([''])
  const [response, setResponse] = useState<SolveResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const updateEquation = (i: number, value: string) =>
    setEquations(eqs => eqs.map((eq, idx) => (idx === i ? value : eq)))

  const addEquation = () => setEquations(eqs => [...eqs, ''])

  const removeEquation = (i: number) => {
    if (equations.length === 1) return
    setEquations(eqs => eqs.filter((_, idx) => idx !== i))
  }

  const solve = async () => {
    const nonEmpty = equations.map(e => e.trim()).filter(Boolean)
    if (!nonEmpty.length) return

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equations: nonEmpty }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.detail ?? 'Unknown error')
        return
      }
      setResponse(await res.json())
    } catch {
      setError('Failed to reach the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <h1>Equation Solver</h1>
      <p className="subtitle">
        Try <code>x + 2y = 3x - y</code> or add multiple equations for a system.
      </p>

      <div className="inputs">
        {equations.map((eq, i) => (
          <div key={i} className="input-row">
            <input
              value={eq}
              onChange={e => updateEquation(i, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && solve()}
              placeholder={`Equation ${i + 1}`}
            />
            <button
              className="btn-remove"
              onClick={() => removeEquation(i)}
              disabled={equations.length === 1}
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        <button className="btn-add" onClick={addEquation}>
          + Add equation
        </button>
      </div>

      <button className="btn-solve" onClick={solve} disabled={loading}>
        {loading ? 'Solving…' : 'Solve'}
      </button>

      {error && <div className="error">{error}</div>}

      {response && (
        <div className="result">
          <h2>Result</h2>
          {response.result === 'no_solution' ? (
            <p className="no-solution">No solution exists for this system.</p>
          ) : (
            <>
              <ul className="solutions">
                {Object.entries(response.solutions).map(([k, v]) => (
                  <li key={k}>
                    <span className="var">{k}</span>
                    {' = '}
                    <span className="val">{v}</span>
                  </li>
                ))}
              </ul>
              {response.free_variables.length > 0 && (
                <p className="free">
                  Free variable(s): <strong>{response.free_variables.join(', ')}</strong>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
