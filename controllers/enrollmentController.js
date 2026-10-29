import { Course } from "../models/courseModel.js";
import { Enrollment } from "../models/enrollmentModel.js";

export const getMyStudents = async (req, res) => {
  try {
    const courses = await Course.find({ tutorId: req.userId }).select('_id title');
    const courseIds = courses.map((course) => course._id);

    const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
      .populate('studentId', 'username email')
      .populate('courseId', 'title');

    const students = enrollments.map((enrollment) => ({
      id: enrollment._id,
      name: enrollment.studentId?.username,
      email: enrollment.studentId?.email,
      course: enrollment.courseId?.title,
      progress: `${enrollment.progress}%`
    }));

    return res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: students
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
