import express from "express"
import { searchTutors, getTutorProfile } from "../controllers/tutorController.js"
import { getTutorReviews } from "../controllers/reviewController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"

const tutorRoute = express.Router()

tutorRoute.get('/search', isAuthenticated, searchTutors)
tutorRoute.get('/:id', isAuthenticated, getTutorProfile)
tutorRoute.get('/:id/reviews', isAuthenticated, getTutorReviews)

export default tutorRoute
