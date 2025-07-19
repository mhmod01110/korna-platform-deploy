const express = require('express');
const router = express.Router();
const { isAuth, isTeacher } = require('../middleware/auth');
const resultsSurveyController = require('../controllers/resultsSurveyController');

// Main Results Survey page - accessible to both teachers and students
router.get('/results-survey', isAuth, resultsSurveyController.getResultsSurvey);

// API endpoints for analysis
router.get('/results-survey/exam', isAuth, isTeacher, resultsSurveyController.getExamResults);
router.get('/results-survey/department', isAuth, isTeacher, resultsSurveyController.getDepartmentResults);
router.get('/results-survey/student', isAuth, isTeacher, resultsSurveyController.getStudentResults);

module.exports = router; 
