import mongoose from 'mongoose';


const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by default in queries
    },
    role: {
      type: String,
      enum: ['student', 'tutor', 'admin'],
      default: 'student',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'deactivated'],
      default: 'active',
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isLoggedIn: {
      type: Boolean,
      default: false
    },
    token: {
      type: String,
      default: null
    },
    otp: {
      type: String,
      default: null
    },
    otpExpiry: {
      type: Date,
      default: null
    },
    // tutor-only profile fields
    bio: {
      type: String,
      default: '',
    },
    qualifications: {
      type: String,
      default: '',
    },
    expertise: {
      type: [String],
      default: [],
    },
    experience: {
      type: Number, // years
      default: 0,
    },
    // denormalized rating summary — kept in sync by reviewController
    // whenever a new review comes in, so tutor search/sort doesn't need
    // to aggregate the whole reviews collection on every request
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Users = mongoose.model('Users', userSchema);
