interface Props {
  onKey: (key: string) => void
}

// JIS配列をベースにした数式用キーボード
const ROWS: string[][] = [
  ['1','2','3','4','5','6','7','8','9','0','(',')','⌫'],
  ['q','w','e','r','t','y','u','i','o','p','^','√'],
  ['a','s','d','f','g','h','j','k','l','=','+','-'],
  ['z','x','c','v','b','n','m','*','/',' '],
  ['Space'],
]

export default function MathKeyboard({ onKey }: Props) {
  return (
    <div className="math-keyboard">
      {ROWS.map((row, ri) => (
        <div key={ri} className="keyboard-row">
          {row.map((key, ki) => (
            <button
              key={ki}
              className={[
                'key',
                key === 'Space' ? 'key-space' : '',
                key === '⌫' ? 'key-del' : '',
              ].filter(Boolean).join(' ')}
              onMouseDown={e => {
                e.preventDefault() // フォーカスを奪わない
                onKey(key)
              }}
              aria-label={
                key === '⌫' ? 'バックスペース'
                : key === 'Space' ? 'スペース'
                : key === '√' ? 'sqrt('
                : key
              }
            >
              {key === 'Space' ? 'スペース' : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
