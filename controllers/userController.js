
import { verifymail } from "../emailVerify/verifyMail.js";
import { Users } from "../models/userModel.js";
import { Session } from "../models/sessionModel.js";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { sendOtpMail } from "../emailVerify/sendOtpMail.js";
export const registerUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      })
    }
    const existingUser = await Users.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User Already Exists"
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await Users.create({
      username,
      email,
      password: hashedPassword,
      role: role
    });
    const token = await jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, { expiresIn: "10m" })
    verifymail(token, email);
    newUser.token = token;
    await newUser.save();
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}


export const verification = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is missing or invalid"
      })
    }
    const token = authHeader.split(" ")[1]
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY)
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(400).json({
          success: false,
          message: "The registration token has Expired"
        })
      }
      return res.status(400).json({
        success: false,
        message: "Token verification failed"
      })

    }
    const user = await Users.findById(decoded.id)
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not Found"
      })
    }
    user.token = null;
    user.isVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email Verified Successfully"
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      })
    }
    const user = await Users.findOne({ email }).select("+password")
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized Access"
      })
    }
    const passwordCheck = await bcrypt.compare(password, user.password)
    if (!passwordCheck) {
      return res.status(402).json({
        success: false,
        message: "Incorrect Password"
      })
    }
    //check if iser is verified
    if (user.isVerified !== true) {
      return res.status(402).json({
        success: false,
        message: "Verify your account then login"
      })
    }
    //check if account is deactivated
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated"
      })
    }
    //check for existing session then delete it
    const exixtingSession = await Session.findOne({ userId: user._id })
    if (exixtingSession) {
      await Session.deleteOne({ userId: user._id })
    }
    //create new Session
    await Session.create({ userId: user._id });
    //Generate Tokens
    const accessToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: "10d" })
    const refreshToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: "30d" })

    user.isLoggedIn = true;
    await user.save();
    return res.status(200).json({
      success: true,
      message: `Welcome Back ${user.username}`,
      accessToken,
      refreshToken,
      user
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const logoutUser = async (req, res) => {
  try {
    const userId = req.userId;
    await Session.deleteMany({ userId });
    await Users.findByIdAndUpdate(userId, { isLoggedIn: false })
    return res.status(200).json({
      success: true,
      message: 'Logged out Successfully'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      })
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otp = otp;
    user.otpExpiry = expiry;
    await user.save();
    await sendOtpMail(email, otp);
    return res.status(200).json({
      success: true,
      message: "otp send successfully"
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const verifyOTP = async (req, res) => {
  const { otp } = req.body;
  const email = req.params.email;
  if (!otp) {
    return res.status(400).json({
      success: false,
      message: 'OTP is required'
    })
  }
  try {
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    if (!user.otp || !user.otpExpiry) {
      return res.status(404).json({
        success: false,
        message: 'OTP not generated or already verified'
      })
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. please request a new one'
      })
    }

    if (otp != user.otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      })
    }
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'OTP vaerified Successfully'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const changePassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const email = req.params.email;
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    })
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Password do not match'
    })
  }
  try {
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Password changed Successfully"
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const getMe = async (req, res) => {
  try {
    const user = await Users.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      })
    }
    return res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',
      data: user
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const updateMe = async (req, res) => {
  try {
    const { username, avatarUrl, bio, qualifications, expertise, experience } = req.body;
    const user = await Users.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      })
    }
    if (username) user.username = username;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    // tutor-only fields — harmless to allow on any account, but only
    // meaningful (and only shown in the UI) for tutors
    if (bio !== undefined) user.bio = bio;
    if (qualifications !== undefined) user.qualifications = qualifications;
    if (expertise !== undefined) user.expertise = expertise;
    if (experience !== undefined) user.experience = experience;
    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      })
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.SECRET_KEY)
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(400).json({
          success: false,
          message: 'Refresh token has Expired, please login again'
        })
      }
      return res.status(400).json({
        success: false,
        message: 'Refresh token verification failed'
      })
    }
    const user = await Users.findById(decoded.id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not Found'
      })
    }
    const accessToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: "10d" })
    return res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      accessToken
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Avatar image is required'
      })
    }
    const user = await Users.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      })
    }
    user.avatarUrl = req.file.path;
    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: user
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const deactivateMyAccount = async (req, res) => {
  try {
    const user = await Users.findById(req.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found'
      })
    }
    // soft delete — flip status instead of removing the account/data
    user.status = 'deactivated';
    user.isLoggedIn = false;
    user.token = null;
    await user.save();
    await Session.deleteMany({ userId: req.userId });

    return res.status(200).json({
      success: true,
      message: 'Your account has been deactivated'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}