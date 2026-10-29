import express from "express"
import { getMyStudents } from "../controllers/enrollmentController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { isTutor } from "../middleware/isTutor.js"

const enrollmentRoute = express.Router()

enrollmentRoute.get('/my-students', isAuthenticated, isTutor, getMyStudents)

export default enrollmentRoute
