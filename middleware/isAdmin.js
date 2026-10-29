import { Users } from "../models/userModel.js";

export const isAdmin = async (req, res, next) => {
  try {
    const user = await Users.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      })
    }
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied, admins only'
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
