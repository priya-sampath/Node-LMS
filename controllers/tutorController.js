import { Users } from "../models/userModel.js";
import { Course } from "../models/courseModel.js";

export const searchTutors = async (req, res) => {
  try {
    const { subject, minRating, sortBy } = req.query;

    const filter = { role: 'tutor', status: 'active' };
    if (subject) {
      filter.expertise = { $regex: subject, $options: 'i' };
    }
    if (minRating) {
      filter.averageRating = { $gte: Number(minRating) };
    }

    let sort = { averageRating: -1 };
    if (sortBy === 'experience') sort = { experience: -1 };
    if (sortBy === 'newest') sort = { createdAt: -1 };

    const tutors = await Users.find(filter)
      .select('username avatarUrl bio qualifications expertise experience averageRating totalReviews')
      .sort(sort);

    return res.status(200).json({
      success: true,
      message: "Tutors fetched successfully",
      data: tutors
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getTutorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const tutor = await Users.findOne({ _id: id, role: 'tutor' })
      .select('username avatarUrl bio qualifications expertise experience averageRating totalReviews');
    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found"
      })
    }

    const courses = await Course.find({ tutorId: id, status: 'active' })
      .select('title description liveClassAvailable liveFee recordedVideoAvailable recordedFee');

    return res.status(200).json({
      success: true,
      message: "Tutor profile fetched successfully",
      data: { tutor, courses }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
