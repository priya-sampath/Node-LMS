import { LiveClass } from "../models/liveClassModel.js";

export const scheduleLiveClass = async (req, res) => {
  try {
    const { courseId, scheduledAt, meetingLink } = req.body;
    if (!courseId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      })
    }
    const liveClass = await LiveClass.create({
      courseId,
      tutorId: req.userId,
      scheduledAt,
      meetingLink: meetingLink || null
    });
    return res.status(201).json({
      success: true,
      message: "Live class scheduled successfully",
      data: liveClass
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getUpcomingClasses = async (req, res) => {
  try {
    const classes = await LiveClass.find({
      tutorId: req.userId,
      status: 'scheduled',
      scheduledAt: { $gte: new Date() }
    })
      .populate('courseId', 'title')
      .sort({ scheduledAt: 1 });

    const upcoming = classes.map((cls) => ({
      id: cls._id,
      course: cls.courseId?.title,
      scheduledAt: cls.scheduledAt
    }));

    return res.status(200).json({
      success: true,
      message: "Upcoming classes fetched successfully",
      data: upcoming
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
