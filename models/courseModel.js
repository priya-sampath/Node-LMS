import mongoose from 'mongoose';


const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['inactive', 'active', 'deleted'],
      default: 'inactive',
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    notesUrl: {
      type: String,
      required: [true, 'Notes document is required'],
    },
    liveClassAvailable: {
      type: Boolean,
      required: [true, 'Please specify whether live classes are available'],
    },
    recordedVideoAvailable: {
      type: Boolean,
      required: [true, 'Please specify whether recorded videos are available'],
    },
    liveFee: {
      type: Number,
      min: [0, 'Fee cannot be negative'],
      // only required when the tutor turned live classes on
      required: [function () { return this.liveClassAvailable === true }, 'Live class fee is required'],
    },
    recordedFee: {
      type: Number,
      min: [0, 'Fee cannot be negative'],
      // only required when the tutor turned recorded videos on
      required: [function () { return this.recordedVideoAvailable === true }, 'Recorded video fee is required'],
    },
    liveSchedule: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      availableDays: {
        type: [String],
        enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        default: [],
      },
      startTime: { type: String, default: null }, // "HH:mm" format, e.g. "14:00" — the regular class time
      endTime: { type: String, default: null },   // "HH:mm" format, e.g. "15:00"
      videoSdkMeetingId: { type: String, default: null },
      // reschedule settings
      maxReschedules: { type: Number, default: 0 }, // how many times a student may reschedule over the whole course
      rescheduleWindowStart: { type: String, default: null }, // "HH:mm" — earliest a makeup slot can start, e.g. "09:00"
      rescheduleWindowEnd: { type: String, default: null },   // "HH:mm" — latest a makeup slot can end, e.g. "18:00"
    },
    recordedVideos: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Course = mongoose.model('Course', courseSchema);
