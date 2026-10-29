import express from "express"
import { scheduleLiveClass, getUpcomingClasses } from "../controllers/liveClassController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { isTutor } from "../middleware/isTutor.js"

const liveClassRoute = express.Router()

liveClassRoute.post('/', isAuthenticated, isTutor, scheduleLiveClass)
liveClassRoute.get('/upcoming', isAuthenticated, isTutor, getUpcomingClasses)

export default liveClassRoute
