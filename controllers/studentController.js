import crypto from "crypto";
import { Course } from "../models/courseModel.js";
import { Enrollment } from "../models/enrollmentModel.js";
import { Payment } from "../models/paymentModel.js";
import { SessionRecording } from "../models/sessionRecordingModel.js";
import { Users } from "../models/userModel.js";
import { isLiveNow, isRescheduleWindowOpenNow } from "../utils/liveSchedule.js";
import { generateJoinToken } from "../utils/videosdk.js";
import { razorpay } from "../utils/razorpay.js";
import { sendPaymentConfirmationMail } from "../emailVerify/sendPaymentConfirmationMail.js";

export const enrollInCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { wantsLive, wantsRecorded } = req.body;

    const course = await Course.findOne({ _id: id, status: 'active' });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    if (wantsLive && !course.liveClassAvailable) {
      return res.status(400).json({
        success: false,
        message: "This course does not offer live classes"
      })
    }
    if (wantsRecorded && !course.recordedVideoAvailable) {
      return res.status(400).json({
        success: false,
        message: "This course does not offer recorded videos"
      })
    }

    const alreadyEnrolled = await Enrollment.findOne({ studentId: req.userId, courseId: id });
    if (alreadyEnrolled) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course"
      })
    }

    const amount = (wantsLive ? course.liveFee : 0) + (wantsRecorded ? course.recordedFee : 0);

    // free (notes-only, or a free course) — enroll immediately, no payment needed
    if (amount <= 0) {
      const enrollment = await Enrollment.create({
        studentId: req.userId,
        courseId: id,
        wantsLive: false,
        wantsRecorded: false
      });
      await Payment.create({
        studentId: req.userId,
        courseId: id,
        amount: 0,
        status: 'paid'
      });
      return res.status(201).json({
        success: true,
        message: "Enrolled successfully",
        data: enrollment
      });
    }

    // paid option(s) selected — create a Razorpay order and hand it to the
    // frontend, which opens Razorpay's checkout widget right on the page
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay wants paise, not rupees
      currency: 'INR',
      notes: {
        studentId: req.userId.toString(),
        courseId: id,
        wantsLive: wantsLive ? 'true' : 'false',
        wantsRecorded: wantsRecorded ? 'true' : 'false',
      },
    });

    // recorded as 'pending' the moment checkout starts — if the student
    // closes the widget without paying, this stays pending and shows up
    // as such on their Payments page, rather than vanishing silently
    await Payment.create({
      studentId: req.userId,
      courseId: id,
      amount,
      status: 'pending',
      razorpayOrderId: order.id
    });

    return res.status(200).json({
      success: true,
      message: "Order created",
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      courseName: course.title,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// called by the frontend right after Razorpay's widget reports a successful
// payment — this is what actually creates the Enrollment record and flips
// the matching Payment from pending to paid, only once the signature
// proves the payment is genuine
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
      wantsLive,
      wantsRecorded
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification details"
      })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      })
    }

    const course = await Course.findOne({ _id: courseId, status: 'active' });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    const alreadyEnrolled = await Enrollment.findOne({ studentId: req.userId, courseId });
    if (alreadyEnrolled) {
      return res.status(200).json({
        success: true,
        message: "Already enrolled"
      })
    }

    const amount = (wantsLive ? course.liveFee : 0) + (wantsRecorded ? course.recordedFee : 0);

    const enrollment = await Enrollment.create({
      studentId: req.userId,
      courseId,
      wantsLive: !!wantsLive,
      wantsRecorded: !!wantsRecorded
    });

    // flip the pending record from checkout-start into paid, rather than
    // creating a fresh one — keeps one clean row per attempt
    let payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, studentId: req.userId },
      { status: 'paid' },
      { new: true }
    );
    if (!payment) {
      // fallback in case the pending record wasn't found for some reason
      payment = await Payment.create({
        studentId: req.userId,
        courseId,
        amount,
        status: 'paid',
        razorpayOrderId: razorpay_order_id
      });
    }

    // best-effort — a failed email shouldn't block the student's enrollment
    try {
      const student = await Users.findById(req.userId);
      await sendPaymentConfirmationMail(student.email, {
        studentName: student.username,
        courseTitle: course.title,
        amount: payment.amount,
        paymentId: razorpay_payment_id,
        date: new Date().toLocaleDateString()
      });
    } catch (emailError) {
      console.error('Payment confirmation email failed:', emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Payment verified, enrolled successfully",
      data: enrollment
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getMyCourses = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ studentId: req.userId })
      .populate('courseId')
      .sort({ createdAt: -1 });

    const courses = enrollments.map((enrollment) => {
      const course = enrollment.courseId;
      // only students who opted into live get a join link, and only while it's actually live right now
      const liveNow = course && enrollment.wantsLive ? isLiveNow(course.liveSchedule) : false;
      // only students who opted into recorded get the video list
      const videos = enrollment.wantsRecorded ? (course?.recordedVideos || []) : [];
      const remainingReschedules = course ? course.liveSchedule.maxReschedules - enrollment.reschedulesUsed : 0;
      const canReschedule = enrollment.wantsLive && remainingReschedules > 0 && isRescheduleWindowOpenNow(course?.liveSchedule);

      return {
        id: course?._id,
        title: course?.title,
        description: course?.description,
        notesUrl: course?.notesUrl,
        wantsLive: enrollment.wantsLive,
        wantsRecorded: enrollment.wantsRecorded,
        progress: enrollment.progress,
        recordedVideos: videos,
        canJoin: liveNow,
        canReschedule,
        remainingReschedules
      };
    });

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

export const joinLiveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const enrollment = await Enrollment.findOne({ studentId: req.userId, courseId: id });
    if (!enrollment || !enrollment.wantsLive) {
      return res.status(403).json({
        success: false,
        message: "You didn't enroll in the live class option for this course"
      })
    }
    const course = await Course.findById(id);
    if (!course || !isLiveNow(course.liveSchedule)) {
      return res.status(400).json({
        success: false,
        message: "This course is not live right now"
      })
    }
    const token = generateJoinToken(course.liveSchedule.videoSdkMeetingId, { isModerator: false });
    return res.status(200).json({
      success: true,
      message: "Joining live session",
      token,
      meetingId: course.liveSchedule.videoSdkMeetingId
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getCourseVideos = async (req, res) => {
  try {
    const { id } = req.params;
    const enrollment = await Enrollment.findOne({ studentId: req.userId, courseId: id });
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this course"
      })
    }
    if (!enrollment.wantsRecorded) {
      return res.status(403).json({
        success: false,
        message: "You didn't enroll in the recorded video option for this course"
      })
    }
    const course = await Course.findById(id).select('recordedVideos title');
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }
    return res.status(200).json({
      success: true,
      message: "Videos fetched successfully",
      data: course.recordedVideos
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ studentId: req.userId })
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    const list = payments.map((payment) => ({
      id: payment._id,
      course: payment.courseId?.title,
      amount: payment.amount,
      status: payment.status,
      date: payment.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      data: {
        pending: list.filter((p) => p.status === 'pending'),
        completed: list.filter((p) => p.status === 'paid')
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getSessionRecordings = async (req, res) => {
  try {
    const { id } = req.params;
    const enrollment = await Enrollment.findOne({ studentId: req.userId, courseId: id });
    if (!enrollment || !enrollment.wantsLive) {
      return res.status(403).json({
        success: false,
        message: "You didn't enroll in the live class option for this course"
      })
    }

    // regular group-class recordings are visible to every live student;
    // rescheduled 1-on-1 recordings are visible ONLY to the student who
    // rescheduled to that slot
    const recordings = await SessionRecording.find({
      courseId: id,
      videoUrl: { $ne: null },
      $or: [
        { isRescheduled: false },
        { isRescheduled: true, rescheduledStudentId: req.userId }
      ]
    }).sort({ sessionDate: -1 });

    const list = recordings.map((r) => ({
      id: r._id,
      date: r.sessionDate,
      videoUrl: r.videoUrl,
      isRescheduled: r.isRescheduled
    }));

    return res.status(200).json({
      success: true,
      message: "Session recordings fetched successfully",
      data: list
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
