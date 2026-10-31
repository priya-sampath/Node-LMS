import { Course } from "../models/courseModel.js";
import { Payment } from "../models/paymentModel.js";
import { tutorShareOf, payoutEligibleOn, payoutHoldDays } from "../utils/payout.js";

export const getMyRevenue = async (req, res) => {
  try {
    // payoutDetails is hidden by default, so ask for it to see which courses
    // are still missing somewhere to send the tutor's money
    const courses = await Course.find({ tutorId: req.userId }).select('_id title liveFee recordedFee liveClassAvailable recordedVideoAvailable status +payoutDetails');
    const courseIds = courses.map((course) => course._id);

    const payments = await Payment.find({ courseId: { $in: courseIds } })
      .populate('studentId', 'username')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    const paidPayments = payments.filter((payment) => payment.status === 'paid');

    const totalRevenue = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // what the tutor is owed after the platform's cut, and how much of it
    // has already been sent to them
    const totalEarnings = paidPayments.reduce((sum, payment) => sum + tutorShareOf(payment.amount), 0);
    const paidOut = paidPayments
      .filter((payment) => payment.payoutStatus === 'paid')
      .reduce((sum, payment) => sum + tutorShareOf(payment.amount), 0);

    const paymentsList = payments.map((payment) => ({
      id: payment._id,
      student: payment.studentId?.username,
      course: payment.courseId?.title,
      amount: payment.amount,
      yourShare: payment.status === 'paid' ? tutorShareOf(payment.amount) : 0,
      status: payment.status,
      payoutStatus: payment.status === 'paid' && payment.amount > 0 ? (payment.payoutStatus || 'unpaid') : null,
      payoutReference: payment.payoutReference || null,
      payoutEligibleOn: payment.status === 'paid' && payment.amount > 0 ? payoutEligibleOn(payment.createdAt) : null,
      date: payment.createdAt
    }));

    // paid courses with no payout details saved yet (e.g. created before
    // payout details existed) — the tutor needs to add them
    const coursesMissingPayoutDetails = courses
      .filter((course) => {
        const charges = (course.liveClassAvailable && course.liveFee > 0) || (course.recordedVideoAvailable && course.recordedFee > 0);
        return course.status !== 'deleted' && charges && !course.payoutDetails;
      })
      .map((course) => course.title);

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      totalRevenue,
      totalEarnings,
      paidOut,
      pendingPayout: Math.round((totalEarnings - paidOut) * 100) / 100,
      holdDays: payoutHoldDays(),
      coursesMissingPayoutDetails,
      data: paymentsList
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
