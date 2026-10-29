import express from "express"
import { getMyRevenue } from "../controllers/paymentController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { isTutor } from "../middleware/isTutor.js"

const paymentRoute = express.Router()

paymentRoute.get('/my-revenue', isAuthenticated, isTutor, getMyRevenue)

export default paymentRoute
