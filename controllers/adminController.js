import { Users } from "../models/userModel.js";
import { Course } from "../models/courseModel.js";
import { Enrollment } from "../models/enrollmentModel.js";
import { Payment } from "../models/paymentModel.js";
import { Session } from "../models/sessionModel.js";
import { Certificate } from "../models/certificateModel.js";

export const getDashboardStats = async (req, res) => {
  try {
    const totalTutors = await Users.countDocuments({ role: 'tutor' });
    const totalStudents = await Users.countDocuments({ role: 'student' });
    const totalCourses = await Course.countDocuments();

    return res.status(200).json({
      success: true,
      message: "Stats fetched successfully",
      data: { totalTutors, totalStudents, totalCourses }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : { role: { $ne: 'admin' } };
    const users = await Users.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'deactivated'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'deactivated'"
      })
    }
    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User Not Found"
      })
    }
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be deactivated from here"
      })
    }
    user.status = status;
    if (status === 'deactivated') {
      user.isLoggedIn = false;
      user.token = null;
    }
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// hard delete — actually removes the user and everything tied to them
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User Not Found"
      })
    }
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be deleted from here"
      })
    }

    if (user.role === 'tutor') {
      const courses = await Course.find({ tutorId: id }).select('_id');
      const courseIds = courses.map((course) => course._id);
      await Enrollment.deleteMany({ courseId: { $in: courseIds } });
      await Payment.deleteMany({ courseId: { $in: courseIds } });
      await Certificate.deleteMany({ courseId: { $in: courseIds } });
      await Course.deleteMany({ tutorId: id });
    }

    if (user.role === 'student') {
      await Enrollment.deleteMany({ studentId: id });
      await Payment.deleteMany({ studentId: id });
      await Certificate.deleteMany({ studentId: id });
    }

    await Session.deleteMany({ userId: id });
    await Users.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('tutorId', 'username email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      data: courses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// hard delete — removes the course and everything tied to it
export const deleteCourseAsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course Not Found"
      })
    }

    await Enrollment.deleteMany({ courseId: id });
    await Payment.deleteMany({ courseId: id });
    await Certificate.deleteMany({ courseId: id });
    await Course.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['student', 'tutor', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be 'student', 'tutor', or 'admin'"
      })
    }
    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User Not Found"
      })
    }
    user.role = role;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Role updated to ${role}`,
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
