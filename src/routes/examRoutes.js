const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const questionController = require('../controllers/questionController');
const { isAuth, isTeacher, isAdmin, isStudent } = require('../middleware/auth');

// Exam routes
router.get('/', isAuth, examController.getExams);
router.get('/create', isAuth, isTeacher, examController.getCreateExam);
router.post('/create', isAuth, isTeacher, examController.postCreateExam);
router.get('/:id', isAuth, examController.getExam);
router.get('/:id/edit', isAuth, isTeacher, examController.getEditExam);
router.post('/:id/edit', isAuth, isTeacher, examController.postEditExam);
router.delete('/:id', isAuth, isTeacher, examController.deleteExam);
router.post('/:id/publish', isAuth, isTeacher, examController.publishExam);
router.post('/:id/unpublish', isAuth, isTeacher, examController.unpublishExam);

// Start exam routes
router.get('/:id/start', isAuth, isStudent, examController.startExam);

// Question routes
router.get('/:examId/questions', isAuth, isTeacher, questionController.getExamQuestions);
router.get('/:examId/questions/plan', isAuth, isTeacher, questionController.getPlanQuestions);
router.post('/:examId/questions/plan', isAuth, isTeacher, questionController.postPlanQuestions);
router.post('/:examId/questions/create-bulk', isAuth, isTeacher, questionController.postCreateBulkQuestions);
router.get('/:examId/questions/create', isAuth, isTeacher, questionController.getCreateQuestion);
router.post('/:examId/questions/create', isAuth, isTeacher, questionController.postCreateQuestion);
router.get('/:examId/questions/:id', isAuth, isTeacher, questionController.getQuestion);
router.get('/:examId/questions/:id/edit', isAuth, isTeacher, questionController.getEditQuestion);
router.post('/:examId/questions/:id/edit', isAuth, isTeacher, questionController.postEditQuestion);
router.delete('/:examId/questions/:id', isAuth, isTeacher, questionController.deleteQuestion);
router.post('/:examId/questions/:id/upload-image', isAuth, isTeacher, questionController.postUploadImage);

// Exam attempt routes
router.get('/:id/attempt/:attemptId', isAuth, examController.getExamAttempt);
router.post('/:id/attempt/:attemptId/submit', isAuth, examController.submitExamAttempt);
router.post('/:id/attempt/:attemptId/grade', isAuth, isTeacher, examController.gradeExamAttempt);

// View detailed exam result
router.get('/:examId/results/:resultId', isAuth, examController.getExamResultDetails);

// Update result display option
router.post('/:id/update-result-display', isAuth, isTeacher, examController.updateResultDisplayOption);

// Submission review route (for teachers)
router.get('/:examId/submissions/:submissionId', isAuth, isTeacher, examController.getSubmissionDetails);

// Submission management routes (for teachers and admins)
router.get('/:examId/submissions', isAuth, isTeacher, examController.getExamSubmissions);
router.get('/:examId/submissions/:submissionId/grade', isAuth, isTeacher, examController.getGradeSubmission);

// Delete exam route (protected for teachers and admins)
router.delete('/:id', isAuth, isTeacher, examController.deleteExam);

// Project submission routes
router.get('/:examId/submit-project', isAuth, isStudent, examController.getProjectSubmission);
router.post('/:examId/submit-project', isAuth, isStudent, examController.submitProjectExam);
router.post('/submissions/:submissionId/grade-project', isAuth, isTeacher, examController.gradeProjectSubmission);

// API routes for exam-specific grading
router.get('/api/exams/:examId/pending-submissions', isAuth, isTeacher, examController.getPendingSubmissions);
router.get('/api/exams/:examId/grading-stats', isAuth, isTeacher, examController.getGradingStats);

module.exports = router; 