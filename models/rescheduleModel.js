import mongoose from 'mongoose';


const rescheduleSchema = new mongoose.Schema(
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
    originalDate: {
      type: Date, // the date of the regular class being moved away from
      required: true,
    },
    newDate: {
      type: Date, // the date the student is moving the class to
      required: true,
    },
    newSlotTime: {
      type: String, // "HH:mm" — which discrete slot on newDate
      required: true,
    },
  },
  { timestamps: true }
);

// a slot can only be claimed by one student — this is what makes a
// date "fully booked" once every generated slot on it is taken
rescheduleSchema.index({ courseId: 1, newDate: 1, newSlotTime: 1 }, { unique: true });

export const Reschedule = mongoose.model('Reschedule', rescheduleSchema);
