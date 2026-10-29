import mongoose from 'mongoose';


const certificateSchema = new mongoose.Schema(
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
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    courseTitle: {
      type: String,
      required: true,
    },
    completionDate: {
      type: Date,
      required: true,
    },
    certificateId: {
      type: String,
      required: true,
      unique: true, // shown on the certificate itself, doubles as a verification code
    },
  },
  { timestamps: true }
);

// one certificate per student per course
certificateSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export const Certificate = mongoose.model('Certificate', certificateSchema);
