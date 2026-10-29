import { Users } from "../models/userModel.js";

export const isTutor = async (req, res, next) => {
  try {
    const user = await Users.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      })
    }
    if (user.role !== 'tutor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied, tutors only'
      })
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
