import type { StoreListing, CheckoutInput, StoreAsset } from '../../../../lib/store'
import { StoreFiles } from './StoreFiles'

export function BriefFields({ listing, brief, onChange }: { listing: StoreListing; brief: CheckoutInput['brief']; onChange: (value: CheckoutInput['brief']) => void }) {
  return <>{listing.fulfilment.questions.map((q) => {
    const answer = brief[q.id]
    const set = (value: CheckoutInput['brief'][string]) => onChange({ ...brief, [q.id]: value })
    if (q.type === 'reference_image') return <StoreFiles key={q.id} label={`${q.label}${q.required ? ' (required)' : ''}`} multiple={false} files={answer && typeof answer === 'object' && !Array.isArray(answer) ? [answer as StoreAsset] : []} onChange={(files) => set(files[0] || '')} />
    if (q.type === 'multiple_choice') return <fieldset key={q.id}><legend>{q.label}{q.required && ' (required)'}</legend>{q.options.map((option) => <label key={option} className="store-inline"><input type="checkbox" checked={Array.isArray(answer) && answer.includes(option)} onChange={(e) => set(e.target.checked ? [...(Array.isArray(answer) ? answer : []), option] : (Array.isArray(answer) ? answer : []).filter((v) => v !== option))} />{option}</label>)}</fieldset>
    return <label key={q.id}>{q.label}{q.required && ' (required)'}{q.type === 'long_text' ? <textarea maxLength={4000} required={q.required} value={typeof answer === 'string' ? answer : ''} onChange={(e) => set(e.target.value)} /> : q.type === 'single_choice' ? <select required={q.required} value={typeof answer === 'string' ? answer : ''} onChange={(e) => set(e.target.value)}><option value="">Choose an option</option>{q.options.map((o) => <option key={o}>{o}</option>)}</select> : <input required={q.required} maxLength={500} value={typeof answer === 'string' ? answer : ''} onChange={(e) => set(e.target.value)} />}</label>
  })}</>
}
