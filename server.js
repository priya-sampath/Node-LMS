import express from "express"
import 'dotenv/config'
import cors from "cors"
import connectDB from "./database/db.js"
import userRoute from "./routes/userRoute.js"
import courseRoute from "./routes/courseRoute.js"
import enrollmentRoute from "./routes/enrollmentRoute.js"
import paymentRoute from "./routes/paymentRoute.js"
import liveClassRoute from "./routes/liveClassRoute.js"
import studentRoute from "./routes/studentRoute.js"
import adminRoute from "./routes/adminRoute.js"
import tutorRoute from "./routes/tutorRoute.js"

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}))
app.use(express.json())
app.use('/user', userRoute)
app.use('/courses', courseRoute)
app.use('/enrollments', enrollmentRoute)
app.use('/payments', paymentRoute)
app.use('/live-classes', liveClassRoute)
app.use('/student', studentRoute)
app.use('/admin', adminRoute)
app.use('/tutors', tutorRoute)

// catches errors thrown by middleware (like multer/cloudinary upload failures)
// that happen before a controller's own try/catch can run — without this,
// Express sends back an HTML error page and the frontend can't read the real message
app.use((err, req, res, next) => {
  console.error(err)
  return res.status(500).json({
    success: false,
    message: err.message || "Something went wrong"
  })
})

//http://localhost:8000/user/register
app.listen(PORT,()=>{
  connectDB()
  console.log(`server listening to port ${PORT}`);
})