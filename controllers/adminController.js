import { Users } from "../models/userModel.js";
import { Course } from "../models/courseModel.js";
import { Enrollment } from "../models/enrollmentModel.js";
import { Payment } from "../models/paymentModel.js";
import { Session } from "../models/sessionModel.js";
import { Certificate } from "../models/certificateModel.js";
import { tutorShareOf, payoutHoldDays, minPayoutAmount, payoutEligibleOn, isPayoutEligible } from "../utils/payout.js";

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

// money the platform has collected from students but not yet passed on to
// tutors, grouped per course so the admin can see exactly where to send it.
// Payments are split into "ready to pay" (older than the holding period) and
// "still on hold" (could still be refunded).
export const getPendingPayouts = async (req, res) => {
  try {
    const payments = await Payment.find({
      status: 'paid',
      amount: { $gt: 0 },
      payoutStatus: { $ne: 'paid' }
    })
      .populate({
        path: 'courseId',
        select: 'title tutorId +payoutDetails',
        populate: { path: 'tutorId', select: 'username email' }
      })
      .sort({ createdAt: 1 });

    const minAmount = minPayoutAmount();
    const now = new Date();
    const byCourse = new Map();

    for (const payment of payments) {
      const course = payment.courseId;
      if (!course) continue; // course was hard-deleted

      const key = course._id.toString();
      if (!byCourse.has(key)) {
        byCourse.set(key, {
          courseId: course._id,
          courseTitle: course.title,
          tutor: course.tutorId
            ? { id: course.tutorId._id, username: course.tutorId.username, email: course.tutorId.email }
            : null,
          payoutDetails: course.payoutDetails || null,
          paymentIds: [],          // only the payments that are ready to pay
          paymentsCount: 0,
          grossAmount: 0,
          amountOwed: 0,           // ready to pay now
          holdingAmount: 0,        // still inside the holding period
          nextEligibleOn: null     // when the earliest held payment becomes payable
        });
      }
      const entry = byCourse.get(key);
      const share = tutorShareOf(payment.amount);

      if (isPayoutEligible(payment.createdAt, now)) {
        entry.paymentIds.push(payment._id);
        entry.paymentsCount += 1;
        entry.grossAmount += payment.amount;
        entry.amountOwed += share;
      } else {
        entry.holdingAmount += share;
        const eligibleOn = payoutEligibleOn(payment.createdAt);
        if (!entry.nextEligibleOn || eligibleOn < entry.nextEligibleOn) {
          entry.nextEligibleOn = eligibleOn;
        }
      }
    }

    const round2 = (value) => Math.round(value * 100) / 100;
    const data = Array.from(byCourse.values()).map((entry) => ({
      ...entry,
      amountOwed: round2(entry.amountOwed),
      holdingAmount: round2(entry.holdingAmount),
      meetsMinimum: entry.amountOwed >= minAmount
    }));

    return res.status(200).json({
      success: true,
      message: "Pending payouts fetched successfully",
      settings: { holdDays: payoutHoldDays(), minAmount },
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// the admin sends the money to the tutor (UPI / bank transfer) and then
// records it here, with the bank's reference number
export const markPayoutsPaid = async (req, res) => {
  try {
    const { paymentIds, reference } = req.body;

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "paymentIds is required"
      })
    }
    if (!reference || !String(reference).trim()) {
      return res.status(400).json({
        success: false,
        message: "Enter the UTR / UPI transaction reference of the transfer"
      })
    }

    // enforced here too, not just in the page: nothing inside the holding
    // period can be marked as paid out
    const holdCutoff = new Date(Date.now() - payoutHoldDays() * 24 * 60 * 60 * 1000);

    const result = await Payment.updateMany(
      {
        _id: { $in: paymentIds },
        status: 'paid',
        payoutStatus: { $ne: 'paid' },
        createdAt: { $lte: holdCutoff }
      },
      { payoutStatus: 'paid', payoutReference: String(reference).trim(), paidOutAt: new Date() }
    );

    const skipped = paymentIds.length - result.modifiedCount;
    return res.status(200).json({
      success: true,
      message: skipped > 0
        ? `${result.modifiedCount} payment(s) marked as paid out. ${skipped} skipped (already paid out or still in the holding period).`
        : `${result.modifiedCount} payment(s) marked as paid out`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
