import jwt from "jsonwebtoken"
import crypto from "crypto"
import 'dotenv/config'

const VIDEOSDK_API_BASE = "https://api.videosdk.live/v2"

// a broad, short-lived token used only to call VideoSDK's own REST API
// (creating the room) — not handed to any user
const generateApiToken = () => {
  return jwt.sign(
    { apikey: process.env.VIDEOSDK_API_KEY, permissions: ["allow_join"] },
    process.env.VIDEOSDK_SECRET_KEY,
    { algorithm: "HS256", expiresIn: "1h", jwtid: crypto.randomUUID() }
  )
}

// safely parses a fetch Response as JSON — if VideoSDK (or a proxy/CDN in
// front of it) ever returns an HTML error page instead of JSON, this throws
// a clear, readable error instead of letting JSON.parse's cryptic
// "Unexpected token '<'" message leak through
const parseJsonResponse = async (res, actionDescription) => {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      `VideoSDK did not return valid JSON while trying to ${actionDescription} ` +
      `(HTTP ${res.status}). This usually means VIDEOSDK_API_KEY/VIDEOSDK_SECRET_KEY ` +
      `are missing or invalid, or VideoSDK's API is temporarily unreachable.`
    )
  }
}

// creates one persistent room for a course — called once, when the tutor
// turns live classes on
export const createVideoSdkMeeting = async () => {
  const apiToken = generateApiToken()

  const res = await fetch(`${VIDEOSDK_API_BASE}/rooms`, {
    method: "POST",
    headers: {
      authorization: apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })
  const data = await parseJsonResponse(res, "create a room")
  if (!res.ok) {
    throw new Error(data.error || data.message || "Failed to create VideoSDK room")
  }
  if (!data.roomId) {
    throw new Error("VideoSDK did not return a roomId when creating the room")
  }
  return data.roomId
}

// generates a fresh, room-scoped token for one person joining one meeting.
// allow_mod = can mute/remove other participants (tutor). Without it, a
// participant can only join and control their own mic/camera (student).
export const generateJoinToken = (meetingId, { isModerator }) => {
  const permissions = isModerator ? ["allow_join", "allow_mod"] : ["allow_join"]
  return jwt.sign(
    {
      apikey: process.env.VIDEOSDK_API_KEY,
      permissions,
      version: 2,
      roomId: meetingId, // locks this token to only this specific meeting
    },
    process.env.VIDEOSDK_SECRET_KEY,
    { algorithm: "HS256", expiresIn: "2h", jwtid: crypto.randomUUID() }
  )
}

// pulls a usable video URL out of a recording object, regardless of exactly
// which shape VideoSDK returns it in (their docs and webhook payloads don't
// agree with each other on this, so we check every plausible field)
const extractVideoUrl = (recording) => {
  if (!recording) return null
  return (
    recording.fileUrl ||
    recording.file?.[0]?.fileUrl ||
    recording.file?.fileUrl ||
    recording.downloadUrl ||
    recording.url ||
    null
  )
}

// looks up the most recently finished recording for a room — used after the
// tutor ends a class to pull down the file URL VideoSDK generated for it.
// Returns { videoUrl } once ready, or { raw } (the actual API response) if
// not ready yet, so the caller can tell "still processing" apart from
// "something is actually wrong" instead of guessing.
export const fetchLatestRecording = async (meetingId) => {
  if (!meetingId) {
    throw new Error("This course doesn't have a video room set up yet — start the live class again to fix it.")
  }

  const apiToken = generateApiToken()

  const res = await fetch(`${VIDEOSDK_API_BASE}/recordings?roomId=${meetingId}`, {
    method: "GET",
    headers: { authorization: apiToken },
  })
  const data = await parseJsonResponse(res, "fetch the recording")
  if (!res.ok) {
    throw new Error(data.error || data.message || "Failed to fetch recording")
  }

  const recordings = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
  if (recordings.length === 0) {
    return { videoUrl: null, raw: data }
  }

  const latest = recordings[0]
  const videoUrl = extractVideoUrl(latest)
  return { videoUrl, raw: latest }
}