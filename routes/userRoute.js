import express from "express"
import { loginUser, registerUser, verification, logoutUser, forgotPassword, verifyOTP, changePassword, getMe, updateMe, refreshToken, uploadAvatar, deactivateMyAccount } from "../controllers/userController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { userSchema, validateUser } from "../validators/userValidate.js"
import { uploadAvatar as uploadAvatarMiddleware } from "../middleware/upload.js"

const userRoute = express.Router()

userRoute.post('/register', validateUser(userSchema), registerUser)
userRoute.post('/verify', verification)
userRoute.post('/login', loginUser)
userRoute.post('/logout', isAuthenticated, logoutUser)
userRoute.post('/forgot-password', forgotPassword)
userRoute.post('/verify-otp/:email', verifyOTP)
userRoute.post('/change-password/:email', changePassword)
userRoute.post('/refresh-token', refreshToken)
userRoute.get('/me', isAuthenticated, getMe)
userRoute.patch('/me', isAuthenticated, updateMe)
userRoute.patch('/me/avatar', isAuthenticated, uploadAvatarMiddleware.single('avatar'), uploadAvatar)
userRoute.patch('/deactivate', isAuthenticated, deactivateMyAccount)
export default userRoute