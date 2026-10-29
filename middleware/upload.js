import multer from "multer"
import path from "path"
import { CloudinaryStorage } from "multer-storage-cloudinary"
import cloudinary from "../utils/cloudinary.js"

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "lms/avatars",
    resource_type: "image",
  },
})

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "lms/videos",
    resource_type: "video",
  },
})

// used when a single request can include BOTH a notes document and a video
// (creating a course) — routes the file to a different Cloudinary folder/type
// depending on which field it came in on
const courseAssetsStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.fieldname === 'notes') {
      return {
        folder: "lms/notes",
        resource_type: "raw", // pdf/doc, not an image or video
      }
    }
    return {
      folder: "lms/videos",
      resource_type: "video",
    }
  },
})

// --- explicit allow-lists, checked by BOTH mimetype and extension ---
// (checking both matters: some browsers/OSes send a generic
// "application/octet-stream" mimetype for unfamiliar files, so a
// mimetype-only check can be fooled by renaming e.g. malware.exe -> notes.pdf)

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska']
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv']

const NOTES_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
const NOTES_EXTENSIONS = ['.pdf', '.doc', '.docx']

const matches = (file, allowedMimeTypes, allowedExtensions) => {
  const ext = path.extname(file.originalname).toLowerCase()
  return allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)
}

const imageFilter = (req, file, cb) => {
  if (!matches(file, IMAGE_MIME_TYPES, IMAGE_EXTENSIONS)) {
    return cb(new Error('Only JPG, PNG, or WEBP images are allowed'))
  }
  cb(null, true)
}

const videoFilter = (req, file, cb) => {
  if (!matches(file, VIDEO_MIME_TYPES, VIDEO_EXTENSIONS)) {
    return cb(new Error('Only MP4, MOV, WEBM, AVI, or MKV video files are allowed'))
  }
  cb(null, true)
}

const courseAssetsFilter = (req, file, cb) => {
  if (file.fieldname === 'notes') {
    if (!matches(file, NOTES_MIME_TYPES, NOTES_EXTENSIONS)) {
      return cb(new Error('Notes must be a PDF, DOC, or DOCX file'))
    }
    return cb(null, true)
  }
  if (file.fieldname === 'video') {
    if (!matches(file, VIDEO_MIME_TYPES, VIDEO_EXTENSIONS)) {
      return cb(new Error('Only MP4, MOV, WEBM, AVI, or MKV video files are allowed'))
    }
    return cb(null, true)
  }
  cb(new Error('Unexpected file field'))
}

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
})

export const uploadCourseAssets = multer({
  storage: courseAssetsStorage,
  fileFilter: courseAssetsFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB (video is the big one; notes are tiny)
})
