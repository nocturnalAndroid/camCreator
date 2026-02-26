import { useRef } from 'react'

export default function ImageUpload({ onImageLoaded }) {
  const inputRef = useRef()

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      // Note: url is intentionally NOT revoked here so ImagePreview can use it
      onImageLoaded({ imageData, url, file, width: img.width, height: img.height })
    }
    img.src = url
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => inputRef.current.click()}
      style={{
        border: '2px dashed #888', borderRadius: 8, padding: 32,
        textAlign: 'center', cursor: 'pointer', marginBottom: 16,
      }}
    >
      <p>Drag & drop a B&W image here, or click to select</p>
      <input
        ref={inputRef} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  )
}
