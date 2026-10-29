import mongoose from 'mongoose';


const enrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // a student can want either, both, or neither (notes-only) —
    // notes access is always included regardless of these two
    wantsLive: {
      type: Boolean,
      default: false,
    },
    wantsRecorded: {
      type: Boolean,
      default: false,
    },
    // how many times this student has used their reschedule allowance —
    // capped by course.liveSchedule.maxReschedules
    reschedulesUsed: {
      type: Number,
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
