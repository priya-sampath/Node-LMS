import { Course } from "../models/courseModel.js";
import { Enrollment } from "../models/enrollmentModel.js";
import { Reschedule } from "../models/rescheduleModel.js";
import { SessionRecording } from "../models/sessionRecordingModel.js";
import { doSchedulesConflict, isLiveNow, isWithinRescheduledSlotNow } from "../utils/liveSchedule.js";
import { createVideoSdkMeeting, generateJoinToken, fetchLatestRecording } from "../utils/videosdk.js";

// parses the liveSchedule fields out of req.body (sent as a multipart form, so
// availableDays arrives as a JSON string, e.g. '["Monday","Wednesday"]')
const buildScheduleFromBody = (body) => {
  const { startDate, endDate, availableDays, startTime, endTime, maxReschedules, rescheduleWindowStart, rescheduleWindowEnd } = body;
  if (!startDate && !endDate && !availableDays && !startTime && !endTime) {
    return null; // tutor didn't send a schedule at all, that's fine — course can be created without one
  }
  return {
    startDate: startDate || null,
    endDate: endDate || null,
    availableDays: availableDays ? JSON.parse(availableDays) : [],
    startTime: startTime || null,
    endTime: endTime || null,
    maxReschedules: maxReschedules !== undefined ? Number(maxReschedules) : 0,
    rescheduleWindowStart: rescheduleWindowStart || null,
    rescheduleWindowEnd: rescheduleWindowEnd || null,
  };
}

// makes sure this tutor doesn't already have another course live at the same
// day/time — returns the clashing course's title, or null if there's no conflict
const findScheduleConflict = async (tutorId, newSchedule, excludeCourseId) => {
  if (!newSchedule || !newSchedule.startDate) return null;

  const otherCourses = await Course.find({
    tutorId,
    _id: { $ne: excludeCourseId },
    'liveSchedule.startDate': { $ne: null }
  });

  for (const course of otherCourses) {
    if (doSchedulesConflict(newSchedule, course.liveSchedule)) {
      return course.title;
    }
  }
  return null;
}

export const searchCourses = async (req, res) => {
  try {
    const { query } = req.query;
    const filter = { status: 'active' };
    if (query) {
      filter.title = { $regex: query, $options: 'i' };
    }
    const courses = await Course.find(filter)
      .populate('tutorId', 'username')
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

export const createCourse = async (req, res) => {
  try {
    const { title, description, liveClassAvailable, recordedVideoAvailable, liveFee, recordedFee } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required"
      })
    }

    // radios are mandatory — both must be explicitly answered
    if (liveClassAvailable === undefined || recordedVideoAvailable === undefined) {
      return res.status(400).json({
        success: false,
        message: "Please specify whether live classes and recorded videos are available"
      })
    }

    const isLiveOn = liveClassAvailable === 'true' || liveClassAvailable === true;
    const isRecordedOn = recordedVideoAvailable === 'true' || recordedVideoAvailable === true;

    const notesFile = req.files?.notes?.[0];
    if (!notesFile) {
      return res.status(400).json({
        success: false,
        message: "Notes document is required"
      })
    }

    let liveSchedule = null;
    if (isLiveOn) {
      if (!liveFee) {
        return res.status(400).json({
          success: false,
          message: "Live class fee is required when live classes are available"
        })
      }
      liveSchedule = buildScheduleFromBody(req.body);
      if (!liveSchedule || !liveSchedule.startDate || !liveSchedule.endDate || !liveSchedule.availableDays.length || !liveSchedule.startTime || !liveSchedule.endTime) {
        return res.status(400).json({
          success: false,
          message: "Start date, end date, weekly availability, and timings are required when live classes are available"
        })
      }
      if (!liveSchedule.rescheduleWindowStart || !liveSchedule.rescheduleWindowEnd) {
        return res.status(400).json({
          success: false,
          message: "Reschedule window start/end times are required when live classes are available"
        })
      }
      const conflictTitle = await findScheduleConflict(req.userId, liveSchedule, null);
      if (conflictTitle) {
        return res.status(400).json({
          success: false,
          message: `This schedule clashes with your existing course "${conflictTitle}". Pick a different day/time.`
        })
      }
    }

    const recordedVideos = [];
    if (isRecordedOn) {
      if (!recordedFee) {
        return res.status(400).json({
          success: false,
          message: "Recorded video fee is required when recorded videos are available"
        })
      }
      const videoFile = req.files?.video?.[0];
      if (!videoFile) {
        return res.status(400).json({
          success: false,
          message: "A recorded video is required when recorded videos are available"
        })
      }
      recordedVideos.push({
        title: videoFile.originalname,
        url: videoFile.path
      });
    }

    const course = await Course.create({
      title,
      description,
      tutorId: req.userId,
      notesUrl: notesFile.path,
      liveClassAvailable: isLiveOn,
      recordedVideoAvailable: isRecordedOn,
      liveFee: isLiveOn ? liveFee : undefined,
      recordedFee: isRecordedOn ? recordedFee : undefined,
      liveSchedule: liveSchedule || undefined,
      recordedVideos
    });

    // a meeting doesn't need the course's real _id, so this can happen
    // right after the schedule is validated
    if (isLiveOn) {
      try {
        const meetingId = await createVideoSdkMeeting();
        course.liveSchedule.videoSdkMeetingId = meetingId;
        await course.save();
      } catch (videoSdkError) {
        // the course itself was created fine — just flag that the live room setup failed
        console.error('VideoSDK meeting creation failed:', videoSdkError.message);
        return res.status(201).json({
          success: true,
          message: `Course created, but the live class room could not be set up: ${videoSdkError.message}`,
          data: course
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: course
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
    const courses = await Course.find({ tutorId: req.userId }).sort({ createdAt: -1 });

    // attach a live student count and whether "Start Live Session" should be enabled right now
    const coursesWithExtras = await Promise.all(
      courses.map(async (course) => {
        const studentCount = await Enrollment.countDocuments({ courseId: course._id });
        return {
          ...course.toObject(),
          students: studentCount,
          canStartLive: isLiveNow(course.liveSchedule)
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      data: coursesWithExtras
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findOne({ _id: id, tutorId: req.userId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }
    const { title, description, status, liveFee, recordedFee } = req.body;
    if (title) course.title = title;
    if (description) course.description = description;
    if (status) course.status = status;
    if (liveFee !== undefined && course.liveClassAvailable) course.liveFee = liveFee;
    if (recordedFee !== undefined && course.recordedVideoAvailable) course.recordedFee = recordedFee;

    const liveSchedule = buildScheduleFromBody(req.body);
    if (liveSchedule) {
      const conflictTitle = await findScheduleConflict(req.userId, liveSchedule, id);
      if (conflictTitle) {
        return res.status(400).json({
          success: false,
          message: `This schedule clashes with your existing course "${conflictTitle}". Pick a different day/time.`
        })
      }
      course.liveSchedule = liveSchedule;
    }

    await course.save();
    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: course
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const toggleCourseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findOne({ _id: id, tutorId: req.userId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }
    if (course.status === 'deleted') {
      return res.status(400).json({
        success: false,
        message: "This course has been deleted and can't be reactivated"
      })
    }
    // flip between inactive <-> active — never touches the 'deleted' state
    course.status = course.status === 'active' ? 'inactive' : 'active';
    await course.save();

    return res.status(200).json({
      success: true,
      message: `Course is now ${course.status}`,
      data: course
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findOne({ _id: id, tutorId: req.userId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }
    // soft delete only — state 3. New students can no longer find/enroll in
    // it (search only returns 'active' courses), but students who already
    // paid keep their access since their Enrollment record is untouched.
    course.status = 'deleted';
    await course.save();

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

export const uploadCourseVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findOne({ _id: id, tutorId: req.userId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Video file is required"
      })
    }
    course.recordedVideos.push({
      title: req.file.originalname,
      url: req.file.path
    });
    await course.save();
    return res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: course.recordedVideos
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const startLiveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findOne({ _id: id, tutorId: req.userId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    // figure out what today's session actually is: the regular group
    // class, or a specific student's 1-on-1 rescheduled makeup slot
    let sessionContext = null;

    if (isLiveNow(course.liveSchedule)) {
      sessionContext = { isRescheduled: false, rescheduledStudentId: null };
    } else {
      const todaysReschedules = await Reschedule.find({
        courseId: id,
        newDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      });
      const activeReschedule = todaysReschedules.find((r) => isWithinRescheduledSlotNow(course.liveSchedule, r));
      if (activeReschedule) {
        sessionContext = { isRescheduled: true, rescheduledStudentId: activeReschedule.studentId };
      }
    }

    if (!sessionContext) {
      return res.status(400).json({
        success: false,
        message: "This course is not scheduled to be live right now"
      })
    }

    // self-heal: if the meeting was never successfully created (e.g. bad
    // VideoSDK keys at the time the course was made), create it now
    // instead of failing — no need to delete/recreate the whole course
    if (!course.liveSchedule.videoSdkMeetingId) {
      try {
        const meetingId = await createVideoSdkMeeting();
        course.liveSchedule.videoSdkMeetingId = meetingId;
        await course.save();
      } catch (videoSdkError) {
        return res.status(500).json({
          success: false,
          message: `Could not set up the live video room: ${videoSdkError.message}. Double check your VIDEOSDK_API_KEY and VIDEOSDK_SECRET_KEY in .env.`
        })
      }
    }

    const recording = await SessionRecording.create({
      courseId: id,
      sessionDate: new Date(),
      isRescheduled: sessionContext.isRescheduled,
      rescheduledStudentId: sessionContext.rescheduledStudentId
    });

    const token = generateJoinToken(course.liveSchedule.videoSdkMeetingId, { isModerator: true });
    return res.status(200).json({
      success: true,
      message: "Live session started",
      token,
      meetingId: course.liveSchedule.videoSdkMeetingId,
      sessionRecordingId: recording._id
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const finalizeRecording = async (req, res) => {
  try {
    const { recordingId } = req.params;
    const recording = await SessionRecording.findById(recordingId);
    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      })
    }
    const course = await Course.findOne({ _id: recording.courseId, tutorId: req.userId });
    if (!course) {
      return res.status(403).json({
        success: false,
        message: "Not your course"
      })
    }

    const { videoUrl, raw } = await fetchLatestRecording(course.liveSchedule.videoSdkMeetingId);
    if (!videoUrl) {
      return res.status(202).json({
        success: false,
        message: "Recording is still processing — try again in a minute",
        debug: raw || null
      })
    }

    recording.videoUrl = videoUrl;
    await recording.save();

    return res.status(200).json({
      success: true,
      message: "Recording saved to course",
      data: recording
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const getCourseSessionRecordings = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findOne({ _id: id, tutorId: req.userId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    const recordings = await SessionRecording.find({
      courseId: id,
      videoUrl: { $ne: null }
    })
      .populate('rescheduledStudentId', 'username')
      .sort({ sessionDate: -1 });

    const list = recordings.map((r) => ({
      id: r._id,
      date: r.sessionDate,
      videoUrl: r.videoUrl,
      isRescheduled: r.isRescheduled,
      studentName: r.isRescheduled ? r.rescheduledStudentId?.username : null
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