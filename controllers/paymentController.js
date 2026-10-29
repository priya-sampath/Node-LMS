import { Course } from "../models/courseModel.js";
import { Payment } from "../models/paymentModel.js";

export const getMyRevenue = async (req, res) => {
  try {
    const courses = await Course.find({ tutorId: req.userId }).select('_id');
    const courseIds = courses.map((course) => course._id);

    const payments = await Payment.find({ courseId: { $in: courseIds } })
      .populate('studentId', 'username')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    const totalRevenue = payments
      .filter((payment) => payment.status === 'paid')
      .reduce((sum, payment) => sum + payment.amount, 0);

    const paymentsList = payments.map((payment) => ({
      id: payment._id,
      student: payment.studentId?.username,
      course: payment.courseId?.title,
      amount: payment.amount,
      status: payment.status,
      date: payment.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      totalRevenue,
      data: paymentsList
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
