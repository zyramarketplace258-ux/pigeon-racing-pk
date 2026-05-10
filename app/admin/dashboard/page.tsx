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
  nameUrdu?: string
  slug: string
  city: string
  cityUrdu?: string
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

  const [activeSection, setActiveSection] = useState<'clubs' | 'gallery'>('clubs')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [galleryFormOpen, setGalleryFormOpen] = useState(false)

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
        uploadTask.on('state_changed', snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, () => resolve())
      })
      const imageUrl = await getDownloadURL(storageRef)
      const docRef = await addDoc(collection(db, 'gallery'), { imageUrl, storagePath, ...form, createdAt: serverTimestamp() })
      setGalleryPosts(prev => [{ id: docRef.id, imageUrl, storagePath, ...form }, ...prev])
      setForm({ title: '', description: '', postedBy: '' })
      setImageFile(null)
      setImagePreview(null)
      setUploadProgress(null)
      setGalleryFormOpen(false)
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

  const navTo = (section: typeof activeSection) => {
    setActiveSection(section)
    setSidebarOpen(false)
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#0d1a0d] flex">

        {/* ── Sidebar ── */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-[#081208] border-r border-green-900 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

          {/* Brand */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-green-900">
            <img src="/pigeon.png" alt="" className="w-9 h-9 object-contain drop-shadow" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Admin Panel</p>
              <p className="text-green-600 text-[11px]">High Fly Pigeons</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            <button
              onClick={() => navTo('clubs')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === 'clubs' ? 'bg-green-800 text-white' : 'text-green-400 hover:bg-green-900 hover:text-white'}`}
            >
              <span>🏟️</span>
              <span className="flex-1 text-left">Clubs</span>
              <span className="bg-green-900 text-green-300 text-xs px-1.5 py-0.5 rounded-full">{clubs.length}</span>
            </button>
            <button
              onClick={() => navTo('gallery')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === 'gallery' ? 'bg-green-800 text-white' : 'text-green-400 hover:bg-green-900 hover:text-white'}`}
            >
              <span>🖼️</span>
              <span className="flex-1 text-left">Gallery</span>
              <span className="bg-green-900 text-green-300 text-xs px-1.5 py-0.5 rounded-full">{galleryPosts.length}</span>
            </button>
          </nav>

          {/* Bottom actions */}
          <div className="px-3 py-4 border-t border-green-900 space-y-1">
            <Link
              href="/"
              target="_blank"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-green-400 hover:bg-green-900 hover:text-white transition"
            >
              🌐 <span>View Site</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/40 hover:text-red-300 transition"
            >
              🚪 <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Sidebar backdrop (mobile) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Main area ── */}
        <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">

          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-[#081208] border-b border-green-900 px-4 py-3 flex items-center gap-3">
            <button
              className="lg:hidden text-green-400 hover:text-white text-xl leading-none"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <h1 className="text-white font-bold text-base">
              {activeSection === 'clubs' ? '🏟️ Clubs' : '🖼️ Gallery'}
            </h1>
            <button
              onClick={handleLogout}
              className="lg:hidden ml-auto text-xs text-red-400 border border-red-900 px-2.5 py-1 rounded hover:bg-red-900/40 transition"
            >
              Logout
            </button>
          </header>

          {/* Page content */}
          <main className="flex-1 p-5 max-w-5xl w-full mx-auto">

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#081208] border border-green-900 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-white">{loading ? '—' : clubs.length}</p>
                <p className="text-green-500 text-xs mt-1">Total Clubs</p>
              </div>
              <div className="bg-[#081208] border border-green-900 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-white">{galleryLoading ? '—' : galleryPosts.length}</p>
                <p className="text-green-500 text-xs mt-1">Gallery Posts</p>
              </div>
              <div className="bg-[#081208] border border-green-900 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">🟢</p>
                <p className="text-green-500 text-xs mt-1">Live</p>
              </div>
            </div>

            {/* ── Clubs section ── */}
            {activeSection === 'clubs' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-green-600 text-sm">{clubs.length} registered</p>
                  <Link
                    href="/admin/clubs/new"
                    className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-4 py-2 rounded-lg transition"
                  >
                    + Add Club
                  </Link>
                </div>

                {loading ? (
                  <p className="text-green-500 text-sm">Loading clubs...</p>
                ) : clubs.length === 0 ? (
                  <div className="bg-[#081208] border border-green-900 rounded-xl p-10 text-center">
                    <p className="text-4xl mb-3">🏟️</p>
                    <p className="text-white font-bold">No clubs yet</p>
                    <Link href="/admin/clubs/new" className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-6 py-2 rounded-lg transition inline-block mt-4">
                      + Create First Club
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clubs.map(club => (
                      <div key={club.id} className="bg-[#081208] border border-green-900 hover:border-green-600 rounded-xl p-4 transition">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-11 h-11 rounded-full bg-green-900 border border-green-700 overflow-hidden shrink-0">
                            <img src={club.logoUrl || '/pigeon.png'} alt={club.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{club.nameUrdu || club.name}</p>
                            <p className="text-green-500 text-xs">{club.cityUrdu || club.city}</p>
                          </div>
                        </div>
                        <p className="text-green-800 text-xs mb-3 truncate">📧 {club.loginEmail}</p>
                        <div className="flex gap-2">
                          <Link href={`/admin/clubs/${club.id}`} className="flex-1 text-center bg-green-900 hover:bg-green-800 text-white text-xs py-2 rounded-lg transition font-medium">
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
              </div>
            )}

            {/* ── Gallery section ── */}
            {activeSection === 'gallery' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-green-600 text-sm">{galleryPosts.length} posts</p>
                  <button
                    onClick={() => setGalleryFormOpen(v => !v)}
                    className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-4 py-2 rounded-lg transition"
                  >
                    {galleryFormOpen ? '✕ Cancel' : '+ New Post'}
                  </button>
                </div>

                {/* Collapsible upload form */}
                {galleryFormOpen && (
                  <div className="bg-[#081208] border border-green-900 rounded-xl p-5 mb-5">
                    {error && (
                      <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div
                        className="border-2 border-dashed border-green-800 rounded-xl p-5 text-center cursor-pointer hover:border-green-500 transition"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {imagePreview ? (
                          <img src={imagePreview} alt="preview" className="mx-auto max-h-44 rounded object-cover" />
                        ) : (
                          <>
                            <p className="text-3xl mb-2">📷</p>
                            <p className="text-green-400 text-sm font-semibold">Click to select image</p>
                            <p className="text-green-700 text-xs mt-1">JPG, PNG, WEBP</p>
                          </>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      <input
                        type="text"
                        placeholder="Title"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        required
                        className="w-full bg-[#0d1a0d] border border-green-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 placeholder-green-800"
                      />
                      <textarea
                        placeholder="Description / event details..."
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        rows={3}
                        className="w-full bg-[#0d1a0d] border border-green-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 placeholder-green-800 resize-none"
                      />
                      <input
                        type="text"
                        placeholder="Posted by"
                        value={form.postedBy}
                        onChange={e => setForm(f => ({ ...f, postedBy: e.target.value }))}
                        className="w-full bg-[#0d1a0d] border border-green-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 placeholder-green-800"
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
                        className="w-full bg-secondary hover:bg-accent text-dark font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                      >
                        {submitting ? 'Uploading...' : '+ Post to Gallery'}
                      </button>
                    </form>
                  </div>
                )}

                {galleryLoading ? (
                  <p className="text-green-500 text-sm">Loading posts...</p>
                ) : galleryPosts.length === 0 ? (
                  <div className="bg-[#081208] border border-green-900 rounded-xl p-10 text-center">
                    <p className="text-4xl mb-3">🖼️</p>
                    <p className="text-white font-bold">No gallery posts yet</p>
                    <button
                      onClick={() => setGalleryFormOpen(true)}
                      className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-6 py-2 rounded-lg transition inline-block mt-4"
                    >
                      + Add First Post
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {galleryPosts.map(post => (
                      <div key={post.id} className="bg-[#081208] border border-green-900 rounded-xl overflow-hidden">
                        <div className="w-full bg-black flex items-center justify-center" style={{ height: 160 }}>
                          <img src={post.imageUrl} alt={post.title} className="max-w-full max-h-full object-contain" style={{ maxHeight: 160 }} />
                        </div>
                        <div className="p-4">
                          <p className="text-white font-bold text-sm mb-1 truncate">{post.title}</p>
                          {post.description && <p className="text-green-500 text-xs line-clamp-2 mb-2">{post.description}</p>}
                          {post.postedBy && <p className="text-green-700 text-xs mb-3">By: {post.postedBy}</p>}
                          <button onClick={() => deletePost(post)} className="text-xs text-red-500 hover:text-red-400 transition">
                            🗑 Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
