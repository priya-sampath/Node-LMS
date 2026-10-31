import mongoose from 'mongoose';


const paymentSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    // what the student chose at checkout, saved server-side so verifyPayment
    // never has to trust values sent back by the browser
    wantsLive: {
      type: Boolean,
      default: false,
    },
    wantsRecorded: {
      type: Boolean,
      default: false,
    },
    // tutor payout tracking — money is collected into the platform's Razorpay
    // account, so each paid payment needs to be passed on to the tutor
    payoutStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },
    payoutReference: {
      type: String,
      default: null, // UTR / UPI transaction id entered by the admin
    },
    paidOutAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
