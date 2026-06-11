'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MediaUploaderProps {
  label?: string
  accept?: string
  multiple?: boolean
  maxSize?: number
  onChange?: (files: File[]) => void
  className?: string
}

export function MediaUploader({
  label,
  accept = 'image/*,video/*',
  multiple = false,
  maxSize = 10 * 1024 * 1024,
  onChange,
  className,
}: MediaUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return

    setError(null)
    const validFiles: File[] = []
    const newPreviews: string[] = []

    Array.from(newFiles).forEach((file) => {
      if (file.size > maxSize) {
        setError(`File ${file.name} exceeds max size of ${maxSize / 1024 / 1024}MB`)
        return
      }
      validFiles.push(file)

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string)
          if (newPreviews.length === validFiles.length) {
            setPreviews((prev) => (multiple ? [...prev, ...newPreviews] : newPreviews))
          }
        }
        reader.readAsDataURL(file)
      } else {
        newPreviews.push('')
      }
    })

    const updatedFiles = multiple ? [...files, ...validFiles] : validFiles
    setFiles(updatedFiles)
    onChange?.(updatedFiles)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setFiles(newFiles)
    setPreviews(newPreviews)
    onChange?.(newFiles)
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-bzr-blue bg-bzr-blue/5'
            : 'border-gray-700 hover:border-gray-600'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        <div className="text-gray-400">
          <p className="text-lg mb-1">
            {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-sm text-gray-500">
            {accept.includes('image') && 'Images'} {accept.includes('video') && 'Videos'}{' '}
            {accept.includes('audio') && 'Audio'} up to {maxSize / 1024 / 1024}MB
          </p>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

      <AnimatePresence>
        {previews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex flex-wrap gap-4"
          >
            {files.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative group"
              >
                {previews[index] ? (
                  <img
                    src={previews[index]}
                    alt={file.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-800 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📄</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(index)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-[80px]">
                  {file.name}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
