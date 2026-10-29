import express from "express"
import { enrollInCourse, getMyCourses, getMyPayments, getCourseVideos, verifyPayment, joinLiveSession, getSessionRecordings } from "../controllers/studentController.js"
import { createReview } from "../controllers/reviewController.js"
import { getRescheduleOptions, createReschedule } from "../controllers/rescheduleController.js"
import { getCertificateStatus, downloadCertificate } from "../controllers/certificateController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { isStudent } from "../middleware/isStudent.js"

const studentRoute = express.Router()

studentRoute.post('/courses/:id/enroll', isAuthenticated, isStudent, enrollInCourse)
studentRoute.post('/verify-payment', isAuthenticated, isStudent, verifyPayment)
studentRoute.post('/courses/:id/join-live', isAuthenticated, isStudent, joinLiveSession)
studentRoute.get('/my-courses', isAuthenticated, isStudent, getMyCourses)
studentRoute.get('/my-payments', isAuthenticated, isStudent, getMyPayments)
studentRoute.get('/courses/:id/videos', isAuthenticated, isStudent, getCourseVideos)
studentRoute.post('/courses/:id/review', isAuthenticated, isStudent, createReview)
studentRoute.get('/courses/:id/reschedule-options', isAuthenticated, isStudent, getRescheduleOptions)
studentRoute.post('/courses/:id/reschedule', isAuthenticated, isStudent, createReschedule)
studentRoute.get('/courses/:id/session-recordings', isAuthenticated, isStudent, getSessionRecordings)
studentRoute.get('/courses/:id/certificate', isAuthenticated, isStudent, getCertificateStatus)
studentRoute.get('/certificates/:certificateId/download', isAuthenticated, isStudent, downloadCertificate)

export default studentRoute
