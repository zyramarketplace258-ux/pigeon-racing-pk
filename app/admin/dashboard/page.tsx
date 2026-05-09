'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'
import AdminGuard from '@/components/admin/AdminGuard'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  slug: string
  city: string
  loginEmail: string
  logoUrl?: string
}

interface GalleryPost {
  id: string
  imageUrl: string
  storagePath: string
  title: string
  description: string
  postedBy: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  const [galleryPosts, setGalleryPosts] = useState<GalleryPost[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', postedBy: '' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsubClubs = onSnapshot(collection(db, 'clubs'), snap => {
      setClubs(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[])
      setLoading(false)
    })
    const unsubGallery = onSnapshot(query(collection(db, 'gallery'), orderBy('createdAt', 'desc')), snap => {
      setGalleryPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as GalleryPost[])
      setGalleryLoading(false)
    })
    return () => { unsubClubs(); unsubGallery() }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (file) setImagePreview(URL.createObjectURL(file))
    else setImagePreview(null)
  }

  const compressImage = (file: File, maxPx = 1200, quality = 0.78): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', quality)
      }
      img.onerror = reject
      img.src = url
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imageFile) { setError('Please select an image.'); return }
    if (!form.title) { setError('Title is required.'); return }
    setError('')
    setSubmitting(true)

    try {
      const compressed = await compressImage(imageFile)
      const storagePath = `gallery/${Date.now()}.jpg`
      const storageRef = ref(storage, storagePath)
      const uploadTask = uploadBytesResumable(storageRef, compressed)

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve()
        )
      })

      const imageUrl = await getDownloadURL(storageRef)

      const docRef = await addDoc(collection(db, 'gallery'), {
        imageUrl, storagePath, ...form, createdAt: serverTimestamp(),
      })

      setGalleryPosts(prev => [{ id: docRef.id, imageUrl, storagePath, ...form }, ...prev])
      setForm({ title: '', description: '', postedBy: '' })
      setImageFile(null)
      setImagePreview(null)
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post.')
    }
    setSubmitting(false)
  }

  const deletePost = async (post: GalleryPost) => {
    await deleteDoc(doc(db, 'gallery', post.id))
    if (post.storagePath) {
      try { await deleteObject(ref(storage, post.storagePath)) } catch { /* already deleted */ }
    }
    setGalleryPosts(prev => prev.filter(p => p.id !== post.id))
  }

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/admin/login')
  }

  return (
    <AdminGuard>
      <main className="min-h-screen bg-dark">
        <header className="bg-primary border-b border-secondary px-6 py-3 relative">
          <Link href="/" target="_blank" className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-green-400 hover:text-secondary transition">
            View Site
          </Link>
          <div className="text-center">
            <img src="/pigeon.png" alt="Pigeon" className="w-10 h-10 object-contain drop-shadow mx-auto" />
            <h1 className="text-sm font-bold text-secondary leading-tight mt-0.5">Admin Dashboard</h1>
            <p className="text-green-400 text-xs">Pakistan Pigeon Racing</p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <button onClick={handleLogout} className="text-xs bg-red-900 hover:bg-red-700 text-white px-3 py-1.5 rounded transition">
              Logout
            </button>
          </div>
        </header>

        <div className="px-6 py-8 max-w-6xl mx-auto">

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface border border-green-800 rounded-xl p-5">
              <p className="text-green-400 text-sm">Total Clubs</p>
              <p className="text-4xl font-bold text-secondary mt-1">{clubs.length}</p>
            </div>
            <div className="bg-surface border border-green-800 rounded-xl p-5">
              <p className="text-green-400 text-sm">Platform</p>
              <p className="text-xl font-bold text-white mt-1">Pakistan Pigeon Racing</p>
            </div>
            <div className="bg-surface border border-green-800 rounded-xl p-5">
              <p className="text-green-400 text-sm">Status</p>
              <p className="text-xl font-bold text-green-400 mt-1">🟢 Live</p>
            </div>
          </div>

          {/* Clubs */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-secondary font-bold text-lg uppercase tracking-widest">🏟️ Clubs</h2>
            <Link href="/admin/clubs/new" className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-4 py-2 rounded-lg transition">
              + Add New Club
            </Link>
          </div>

          {loading ? (
            <p className="text-green-400">Loading clubs...</p>
          ) : clubs.length === 0 ? (
            <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
              <p className="text-4xl mb-3">🏟️</p>
              <p className="text-white font-bold text-lg">No clubs yet</p>
              <Link href="/admin/clubs/new" className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-6 py-2 rounded-lg transition inline-block mt-3">
                + Create First Club
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clubs.map(club => (
                <div key={club.id} className="bg-surface border border-green-800 hover:border-secondary rounded-xl p-5 transition">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary border border-secondary overflow-hidden">
                      <img src={club.logoUrl || '/pigeon.png'} alt={club.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">{club.name}</h3>
                      <p className="text-green-400 text-xs">{club.city}</p>
                    </div>
                  </div>
                  <p className="text-green-600 text-xs mb-4">📧 {club.loginEmail}</p>
                  <div className="flex gap-2">
                    <Link href={`/admin/clubs/${club.id}`} className="flex-1 text-center bg-primary hover:bg-green-800 text-white text-xs py-2 rounded-lg transition">
                      Manage
                    </Link>
                    <Link href={`/${club.slug}`} target="_blank" className="flex-1 text-center bg-secondary hover:bg-accent text-dark text-xs font-bold py-2 rounded-lg transition">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gallery */}
          <div className="mt-10">
            <h2 className="text-secondary font-bold text-lg uppercase tracking-widest mb-4">🖼️ Gallery Posts</h2>

            <div className="bg-surface border border-green-800 rounded-xl p-6 mb-6">
              {error && (
                <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">

                {/* Image picker */}
                <div
                  className="border-2 border-dashed border-green-700 rounded-lg p-4 text-center cursor-pointer hover:border-secondary transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="mx-auto max-h-40 rounded object-cover" />
                  ) : (
                    <div>
                      <p className="text-green-400 text-sm">Click to select image</p>
                      <p className="text-green-700 text-xs mt-1">JPG, PNG, WEBP</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

                <input
                  type="text"
                  placeholder="Title (e.g. Spring Championship 2026)"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
                />
                <textarea
                  placeholder="Description / event details..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-secondary placeholder-green-700 resize-none"
                />
                <input
                  type="text"
                  placeholder="Posted by (e.g. Lahore Pigeon Club)"
                  value={form.postedBy}
                  onChange={e => setForm(f => ({ ...f, postedBy: e.target.value }))}
                  className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
                />

                {uploadProgress !== null && (
                  <div>
                    <div className="h-2 bg-green-900 rounded overflow-hidden">
                      <div className="h-full bg-secondary transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-green-400 text-xs mt-1 text-right">{uploadProgress}%</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Uploading...' : '+ Post to Gallery'}
                </button>
              </form>
            </div>

            {galleryLoading ? (
              <p className="text-green-400 text-sm">Loading posts...</p>
            ) : galleryPosts.length === 0 ? (
              <p className="text-green-600 text-sm">No gallery posts yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {galleryPosts.map(post => (
                  <div key={post.id} className="bg-surface border border-green-800 rounded-xl overflow-hidden">
                    <div className="w-full bg-[#111] flex items-center justify-center" style={{ height: 160 }}>
                      <img src={post.imageUrl} alt={post.title} className="max-w-full max-h-full object-contain" style={{ maxHeight: 160 }} />
                    </div>
                    <div className="p-4">
                      <p className="text-white font-bold text-sm mb-1 truncate">{post.title}</p>
                      {post.description && <p className="text-green-400 text-xs line-clamp-2 mb-3">{post.description}</p>}
                      {post.postedBy && <p className="text-green-600 text-xs mb-3">By: {post.postedBy}</p>}
                      <button onClick={() => deletePost(post)} className="text-xs text-red-400 hover:text-red-300 transition">
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </AdminGuard>
  )
}
