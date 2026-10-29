import { Review } from "../models/reviewModel.js";
import { Enrollment } from "../models/enrollmentModel.js";
import { Course } from "../models/courseModel.js";
import { Users } from "../models/userModel.js";

export const createReview = async (req, res) => {
  try {
    const { id } = req.params; // courseId
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
      })
    }

    const enrollment = await Enrollment.findOne({ studentId: req.userId, courseId: id });
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: "You must be enrolled in this course to leave a review"
      })
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    const existing = await Review.findOne({ studentId: req.userId, courseId: id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You've already reviewed this course"
      })
    }

    await Review.create({
      studentId: req.userId,
      tutorId: course.tutorId,
      courseId: id,
      rating,
      comment: comment || ''
    });

    // recompute the tutor's rating summary and save it directly on their
    // user document, so browsing/sorting tutors doesn't need to aggregate
    // the whole reviews collection on every request
    const stats = await Review.aggregate([
      { $match: { tutorId: course.tutorId } },
      { $group: { _id: '$tutorId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    await Users.findByIdAndUpdate(course.tutorId, {
      averageRating: stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0,
      totalReviews: stats[0]?.count || 0
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getTutorReviews = async (req, res) => {
  try {
    const { id } = req.params; // tutorId
    const reviews = await Review.find({ tutorId: id })
      .populate('studentId', 'username avatarUrl')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    const list = reviews.map((r) => ({
      id: r._id,
      student: r.studentId?.username,
      avatarUrl: r.studentId?.avatarUrl,
      course: r.courseId?.title,
      rating: r.rating,
      comment: r.comment,
      date: r.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: list
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
