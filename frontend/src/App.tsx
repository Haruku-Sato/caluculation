import { useState, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './App.css'
import MathKeyboard from './MathKeyboard'

interface SolveResponse {
  result: 'unique' | 'parametric' | 'multiple' | 'no_solution'
  solutions: Array<Record<string, string>>
  free_variables: string[]
  note?: string | null
}

function renderLatex(tex: string): string {
  try {
    return katex.renderToString(tex, { displayMode: false, throwOnError: false })
  } catch {
    return tex
  }
}

export default function App() {
  const [equations, setEquations] = useState([''])
  const [response, setResponse] = useState<SolveResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const updateEquation = (i: number, value: string) =>
    setEquations(eqs => eqs.map((eq, idx) => (idx === i ? value : eq)))

  const addEquation = () => setEquations(eqs => [...eqs, ''])

  const removeEquation = (i: number) => {
    if (equations.length === 1) return
    setEquations(eqs => eqs.filter((_, idx) => idx !== i))
  }

  const handleKeyInsert = (key: string) => {
    // フォーカス中の入力欄を探す（なければ先頭）
    let focused = inputRefs.current.findIndex(ref => ref === document.activeElement)
    if (focused === -1) focused = 0
    const input = inputRefs.current[focused]
    if (!input) return

    const start = input.selectionStart ?? input.value.length
    const end   = input.selectionEnd   ?? input.value.length

    if (key === '⌫') {
      // バックスペース
      if (start !== end) {
        const newValue = input.value.slice(0, start) + input.value.slice(end)
        updateEquation(focused, newValue)
        requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start, start) })
      } else if (start > 0) {
        const newValue = input.value.slice(0, start - 1) + input.value.slice(start)
        updateEquation(focused, newValue)
        requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start - 1, start - 1) })
      }
      return
    }

    const char = key === 'Space' ? ' ' : key === '√' ? 'sqrt(' : key
    const newValue = input.value.slice(0, start) + char + input.value.slice(end)
    updateEquation(focused, newValue)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + char.length, start + char.length)
    })
  }

  const solveEquations = async () => {
    const nonEmpty = equations.map(e => e.trim()).filter(Boolean)
    if (!nonEmpty.length) return

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equations: nonEmpty }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.detail ?? '不明なエラー')
        return
      }
      setResponse(await res.json())
    } catch {
      setError('サーバーに接続できませんでした。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <h1>方程式ソルバー</h1>
      <p className="subtitle">
        例：<code>x + 2y = 3x - y</code> や複数の方程式を入力して連立方程式を解けます。
        二次方程式（例：<code>x^2 - 5x + 6 = 0</code>）にも対応しています。
      </p>

      <div className="inputs">
        {equations.map((eq, i) => (
          <div key={i} className="input-row">
            <input
              ref={el => { inputRefs.current[i] = el }}
              value={eq}
              onChange={e => updateEquation(i, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && solveEquations()}
              placeholder={`方程式 ${i + 1}（例: x + 2y = 3）`}
            />
            <button
              className="btn-remove"
              onClick={() => removeEquation(i)}
              disabled={equations.length === 1}
              aria-label="削除"
            >
              ✕
            </button>
          </div>
        ))}
        <button className="btn-add" onClick={addEquation}>
          ＋ 方程式を追加
        </button>
      </div>

      <MathKeyboard onKey={handleKeyInsert} />

      <button className="btn-solve" onClick={solveEquations} disabled={loading}>
        {loading ? '計算中…' : '計算する'}
      </button>

      {error && <div className="error">{error}</div>}

      {response && (
        <div className="result">
          <h2>結果</h2>

          {response.result === 'no_solution' && (
            <p className="no-solution">この方程式系には解がありません。</p>
          )}

          {response.result === 'multiple' && (
            <>
              <p className="multi-label">複数の解があります：</p>
              <div className="solution-sets">
                {response.solutions.map((sol, idx) => (
                  <div key={idx} className="solution-set">
                    <span className="set-label">解 {idx + 1}</span>
                    <ul className="solutions">
                      {Object.entries(sol).map(([k, v]) => (
                        <li key={k}>
                          <span className="var">{k}</span>
                          {' = '}
                          <span
                            className="val katex-val"
                            dangerouslySetInnerHTML={{ __html: renderLatex(v) }}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}

          {(response.result === 'unique' || response.result === 'parametric') && (
            <>
              <ul className="solutions">
                {Object.entries(response.solutions[0] ?? {}).map(([k, v]) => (
                  <li key={k}>
                    <span className="var">{k}</span>
                    {' = '}
                    <span
                      className="val katex-val"
                      dangerouslySetInnerHTML={{ __html: renderLatex(v) }}
                    />
                  </li>
                ))}
              </ul>
              {response.free_variables.length > 0 && (
                <p className="free">
                  自由変数：<strong>{response.free_variables.join(', ')}</strong>（任意の値をとれます）
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
