import express from "express"
import { getAllUsers, updateUserStatus, deleteUser, getDashboardStats, getAllCourses, deleteCourseAsAdmin, updateUserRole } from "../controllers/adminController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { isAdmin } from "../middleware/isAdmin.js"

const adminRoute = express.Router()

adminRoute.get('/dashboard-stats', isAuthenticated, isAdmin, getDashboardStats)
adminRoute.get('/users', isAuthenticated, isAdmin, getAllUsers)
adminRoute.patch('/users/:id/status', isAuthenticated, isAdmin, updateUserStatus)
adminRoute.patch('/users/:id/role', isAuthenticated, isAdmin, updateUserRole)
adminRoute.delete('/users/:id', isAuthenticated, isAdmin, deleteUser)
adminRoute.get('/courses', isAuthenticated, isAdmin, getAllCourses)
adminRoute.delete('/courses/:id', isAuthenticated, isAdmin, deleteCourseAsAdmin)

export default adminRoute
