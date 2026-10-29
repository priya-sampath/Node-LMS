import mongoose from 'mongoose';


const sessionRecordingSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    sessionDate: {
      type: Date, // the actual calendar date this session happened on
      required: true,
    },
    videoUrl: {
      type: String,
      default: null, // filled in once VideoSDK finishes processing the recording
    },
    // a reschedule is a 1-on-1 makeup slot — its recording is private to
    // just that one student, not the whole class
    isRescheduled: {
      type: Boolean,
      default: false,
    },
    rescheduledStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      default: null,
    },
  },
  { timestamps: true }
);

export const SessionRecording = mongoose.model('SessionRecording', sessionRecordingSchema);
