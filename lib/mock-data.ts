export interface Module {
  id: string
  title: string
  duration: string
  completed: boolean
  locked: boolean
}

export interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  modules: Module[]
  totalModules: number
  completedModules: number
  instructor: string
  price: number
  isPaid: boolean
  thumbnail: string
  enrollmentCount: number
}

// Courses will be loaded from the database
// This file is kept for type definitions only
export const mockCourses: Course[] = []
