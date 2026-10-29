import express from "express"
import { createCourse, getMyCourses, updateCourse, deleteCourse, searchCourses, uploadCourseVideo, startLiveSession, toggleCourseStatus, finalizeRecording, getCourseSessionRecordings } from "../controllers/courseController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { isTutor } from "../middleware/isTutor.js"
import { uploadVideo, uploadCourseAssets } from "../middleware/upload.js"

const courseRoute = express.Router()

courseRoute.post('/', isAuthenticated, isTutor, uploadCourseAssets.fields([{ name: 'notes', maxCount: 1 }, { name: 'video', maxCount: 1 }]), createCourse)
courseRoute.get('/my-courses', isAuthenticated, isTutor, getMyCourses)
courseRoute.get('/search', isAuthenticated, searchCourses)
courseRoute.patch('/:id', isAuthenticated, isTutor, updateCourse)
courseRoute.patch('/:id/toggle-status', isAuthenticated, isTutor, toggleCourseStatus)
courseRoute.delete('/:id', isAuthenticated, isTutor, deleteCourse)
courseRoute.post('/:id/videos', isAuthenticated, isTutor, uploadVideo.single('video'), uploadCourseVideo)
courseRoute.post('/:id/start-live', isAuthenticated, isTutor, startLiveSession)
courseRoute.post('/recordings/:recordingId/finalize', isAuthenticated, isTutor, finalizeRecording)
courseRoute.get('/:id/session-recordings', isAuthenticated, isTutor, getCourseSessionRecordings)

export default courseRoute