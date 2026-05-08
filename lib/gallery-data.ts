export interface GalleryPost {
  id: string
  image: string       // path under /public, e.g. '/gallery/event1.jpg'
  title: string
  description: string
  postedBy: string
  date: string        // display date, e.g. '2026-05-01'
}

// Add images to the /public/gallery/ folder and list them here.
export const GALLERY_POSTS: GalleryPost[] = [
  // Example — replace with real entries:
  // {
  //   id: '1',
  //   image: '/gallery/spring-race.jpg',
  //   title: 'Spring Championship 2026',
  //   description: 'An amazing day at the loft — pigeons flew over 300km with perfect weather.',
  //   postedBy: 'Lahore Pigeon Club',
  //   date: '2026-04-20',
  // },
]
