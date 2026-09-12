import { useState } from 'react'
import { uploadStoreFile, type StoreAsset } from '../../../../lib/store'

export function StoreFiles({ files, onChange, label = 'Protected files', multiple = true, orderId }: { files: StoreAsset[]; onChange: (files: StoreAsset[]) => void; label?: string; multiple?: boolean; orderId?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <div><label>{label}<input type="file" multiple={multiple} disabled={busy} accept=".jpg,.jpeg,.png,.webp,.pdf,.zip,.mp4,.mp3" onChange={async (event) => {
    const selected = Array.from(event.target.files || [])
    if (!selected.length) return
    setBusy(true); setError('')
    try { const uploaded = await Promise.all(selected.map((file) => uploadStoreFile(file, orderId))); onChange(multiple ? [...files, ...uploaded].slice(0, 20) : uploaded.slice(0, 1)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed.') }
    finally { setBusy(false); event.target.value = '' }
  }} /></label><p className="store-muted">{busy ? 'Uploading… Please wait before saving.' : 'Up to 50 MB per file. Package brushes, presets and source files in a ZIP.'}</p>
    {error && <p role="alert">{error}</p>}{files.map((file) => <div key={file.path} className="store-inline" style={{ justifyContent: 'space-between', marginTop: 8 }}><span>{file.name} · {Math.ceil(file.size / 1024)} KB</span><button type="button" className="store-button" onClick={() => onChange(files.filter((item) => item.path !== file.path))}>Remove</button></div>)}
  </div>
}
