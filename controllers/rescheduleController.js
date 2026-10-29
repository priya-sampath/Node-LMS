import { Course } from "../models/courseModel.js";
import { Enrollment } from "../models/enrollmentModel.js";
import { Reschedule } from "../models/rescheduleModel.js";
import { generateSlotsForDate, isRescheduleWindowOpenNow, getCandidateRescheduleDates } from "../utils/liveSchedule.js";

export const getRescheduleOptions = async (req, res) => {
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
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    const windowOpen = isRescheduleWindowOpenNow(course.liveSchedule);
    const remaining = course.liveSchedule.maxReschedules - enrollment.reschedulesUsed;

    if (!windowOpen || remaining <= 0) {
      return res.status(200).json({
        success: true,
        message: "Reschedule options fetched",
        data: { windowOpen, remaining: Math.max(remaining, 0), dates: [] }
      });
    }

    const allSlots = generateSlotsForDate(course.liveSchedule);
    const candidateDates = getCandidateRescheduleDates(course.liveSchedule);

    // pull every slot already claimed on any candidate date for this course in one query
    const taken = await Reschedule.find({
      courseId: id,
      newDate: { $gte: candidateDates[0], $lte: candidateDates[candidateDates.length - 1] }
    });

    const dates = candidateDates.map((date) => {
      const dateKey = date.toISOString().slice(0, 10);
      const takenTimesForDate = taken
        .filter((r) => r.newDate.toISOString().slice(0, 10) === dateKey)
        .map((r) => r.newSlotTime);

      const slots = allSlots.map((slot) => ({
        ...slot,
        taken: takenTimesForDate.includes(slot.time)
      }));

      return {
        date: dateKey,
        fullyBooked: slots.every((s) => s.taken),
        slots
      };
    });

    // if every date is fully booked, the student truly can't reschedule
    const anyDateAvailable = dates.some((d) => !d.fullyBooked);

    return res.status(200).json({
      success: true,
      message: "Reschedule options fetched",
      data: { windowOpen: true, remaining, anyDateAvailable, dates }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const createReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, newSlotTime } = req.body;
    if (!newDate || !newSlotTime) {
      return res.status(400).json({
        success: false,
        message: "New date and slot time are required"
      })
    }

    const enrollment = await Enrollment.findOne({ studentId: req.userId, courseId: id });
    if (!enrollment || !enrollment.wantsLive) {
      return res.status(403).json({
        success: false,
        message: "You didn't enroll in the live class option for this course"
      })
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    if (!isRescheduleWindowOpenNow(course.liveSchedule)) {
      return res.status(400).json({
        success: false,
        message: "Rescheduling is only available today, before your class starts"
      })
    }

    if (enrollment.reschedulesUsed >= course.liveSchedule.maxReschedules) {
      return res.status(400).json({
        success: false,
        message: "You've used up all your reschedules for this course"
      })
    }

    const validSlots = generateSlotsForDate(course.liveSchedule).map((s) => s.time);
    if (!validSlots.includes(newSlotTime)) {
      return res.status(400).json({
        success: false,
        message: "That is not a valid time slot"
      })
    }

    try {
      await Reschedule.create({
        studentId: req.userId,
        courseId: id,
        originalDate: new Date(),
        newDate,
        newSlotTime
      });
    } catch (dbError) {
      // the unique index on (courseId, newDate, newSlotTime) catches the
      // race condition of two students grabbing the same slot at once
      if (dbError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "That slot was just taken — please pick another"
        })
      }
      throw dbError;
    }

    enrollment.reschedulesUsed += 1;
    await enrollment.save();

    return res.status(201).json({
      success: true,
      message: "Class rescheduled successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
