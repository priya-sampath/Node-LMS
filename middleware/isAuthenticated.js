import jwt from "jsonwebtoken"
import { Users } from "../models/userModel.js";

export const isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access Token is missing or Invalid'
      })
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return res.status(400).json({
            success: false,
            message: 'Access Token has Expired use Refresh token to generate again'
          })
        }
        return res.status(400).json({
          success: false,
          message: 'Access Token is missing or Invalid'
        })
      }
      const { id } = decoded;
      const user = await Users.findById(id)
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User Not Found'
        })
      }
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated'
        })
      }
      req.userId = user._id;
      next();
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}