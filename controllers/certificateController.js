import crypto from "crypto";
import { Enrollment } from "../models/enrollmentModel.js";
import { Course } from "../models/courseModel.js";
import { Users } from "../models/userModel.js";
import { Certificate } from "../models/certificateModel.js";
import { generateCertificatePdf } from "../utils/certificate.js";

// checks whether a course is "done" for this student, marking the
// enrollment completed the first time it detects this
const checkAndMarkCompleted = async (enrollment, course) => {
  if (enrollment.completed) return true;

  let isDone = false;
  if (course.liveClassAvailable && course.liveSchedule?.endDate) {
    // live courses: done once the scheduled end date has passed
    isDone = new Date() > new Date(course.liveSchedule.endDate);
  } else {
    // notes-only / recorded-only courses have no session structure to
    // finish, so they're considered complete as soon as enrolled
    isDone = true;
  }

  if (isDone) {
    enrollment.completed = true;
    enrollment.completedAt = new Date();
    await enrollment.save();
  }
  return isDone;
}

export const getCertificateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const enrollment = await Enrollment.findOne({ studentId: req.userId, courseId: id });
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this course"
      })
    }
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      })
    }

    const isDone = await checkAndMarkCompleted(enrollment, course);

    let certificate = await Certificate.findOne({ studentId: req.userId, courseId: id });
    if (isDone && !certificate) {
      const student = await Users.findById(req.userId);
      certificate = await Certificate.create({
        studentId: req.userId,
        courseId: id,
        tutorId: course.tutorId,
        studentName: student.username,
        courseTitle: course.title,
        completionDate: enrollment.completedAt,
        certificateId: `CERT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificate status fetched",
      data: {
        completed: isDone,
        certificateId: certificate?.certificateId || null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export const downloadCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const certificate = await Certificate.findOne({ certificateId, studentId: req.userId });
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      })
    }
    const tutor = await Users.findById(certificate.tutorId);

    const pdfBuffer = await generateCertificatePdf({
      studentName: certificate.studentName,
      courseTitle: certificate.courseTitle,
      tutorName: tutor?.username || 'the instructor',
      completionDate: new Date(certificate.completionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      certificateId: certificate.certificateId
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.certificateId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
