const mongoose = require('mongoose');
const Question = require('../models/Question');
const Exam = require('../models/Exam');
const ExamAttempt = require('../models/ExamAttempt');
const Submission = require('../models/Submission');
const Result = require('../models/Result');
const AppError = require('../utils/AppError');
const cloudinary = require('cloudinary').v2;
const path = require('path'); // Added missing import for path

// Display all questions (for general question bank)
exports.getQuestions = async (req, res) => {
    try {
        // Get all questions with exam and creator info
        const questions = await Question.find()
            .populate('createdBy', 'firstName lastName')
            .populate('examId', 'title type')
            .sort({ createdAt: -1 });
        
        // Get stats for the questions
        const stats = {
            total: questions.length,
            mcq: questions.filter(q => q.type === 'MCQ').length,
            essay: questions.filter(q => q.type === 'ESSAY').length,
            tf: questions.filter(q => q.type === 'TrueFalse').length
        };
        
        res.render('question/list', {
            title: 'بنك الأسئلة',
            questions,
            stats,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getQuestions:', error);
        req.flash('error', 'Error fetching questions');
        res.redirect('/');
    }
};

// Display question list for a specific exam
exports.getExamQuestions = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        const questions = await Question.find({ examId: req.params.examId })
            .populate('createdBy', 'firstName lastName');
        
        res.render('question/list', {
            title: `الإسئلة - ${exam.title}`,
            exam,
            questions,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getExamQuestions:', error);
        req.flash('error', 'Error fetching questions');
        res.redirect(`/exams/${req.params.examId}`);
    }
};

// Display question creation form
exports.getCreateQuestion = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to add questions
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to add questions to this exam');
            return res.redirect(`/exams/${exam._id}`);
        }
        
        res.render('question/create', {
            title: 'إضافة سؤال',
            exam,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getCreateQuestion:', error);
        req.flash('error', 'Error loading question form');
        res.redirect(`/exams/${req.params.examId}`);
    }
};

// Handle question creation
exports.postCreateQuestion = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to add questions
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to add questions to this exam');
            return res.redirect(`/exams/${exam._id}`);
        }
        
        // Validate MCQ options if question type is MCQ
        if (req.body.type === 'MCQ') {
            // Extract and format options
            const options = [];
            
            // Parse flattened option structure: options[0][text], options[0][isCorrect], etc.
            const optionKeys = Object.keys(req.body).filter(key => key.startsWith('options['));
            
            // Group options by index
            const optionsMap = {};
            
            optionKeys.forEach(key => {
                // Extract index and property from key like "options[0][text]"
                const match = key.match(/options\[(\d+)\]\[(\w+)\]/);
                if (match) {
                    const index = match[1];
                    const property = match[2];
                    const value = req.body[key];
                    
                    if (!optionsMap[index]) {
                        optionsMap[index] = {};
                    }
                    optionsMap[index][property] = value;
                }
            });
            
            // Convert map to array and validate each option
            Object.keys(optionsMap).forEach(index => {
                const optionData = optionsMap[index];
                
                if (optionData && optionData.text && optionData.text.trim()) {
                    const processedOption = {
                        text: optionData.text.trim(),
                        isCorrect: optionData.isCorrect === 'true'
                    };
                    options.push(processedOption);
                }
            });

            // Validate options
            if (options.length < 2) {
                req.flash('error', 'MCQ questions must have at least 2 options');
                return res.redirect(`/exams/${exam._id}/questions/create`);
            }
            
            const correctOptionsCount = options.filter(opt => opt.isCorrect).length;
            
            if (correctOptionsCount !== 1) {
                req.flash('error', 'MCQ questions must have exactly one correct answer');
                return res.redirect(`/exams/${exam._id}/questions/create`);
            }
            
            // Replace the options in req.body
            req.body.options = options;
        }
        
        // Prepare question data
        const questionData = {
            ...req.body,
            examId: exam._id,
            createdBy: req.user._id
        };

        // Handle image uploads if present
        let imageFiles = null;
        if (req.files) {
            // Check different possible field names
            imageFiles = req.files.images || req.files["images[]"] || null;
        }
        
        if (imageFiles) {
            const uploadedImages = Array.isArray(imageFiles) 
                ? imageFiles 
                : [imageFiles];
            
            const images = [];
            for (let i = 0; i < uploadedImages.length; i++) {
                const file = uploadedImages[i];
                
                // Skip empty files
                if (!file.name || file.size === 0) {
                    continue;
                }
                
                try {
                    const result = await cloudinary.uploader.upload(file.tempFilePath, {
                        folder: 'exam-questions'
                    });
                    
                    // Handle captions with different field names
                    let caption = '';
                    const captionsArray = req.body.captions || req.body["captions[]"];
                    if (captionsArray) {
                        if (Array.isArray(captionsArray)) {
                            caption = captionsArray[i] || '';
                        } else {
                            caption = i === 0 ? captionsArray : '';
                        }
                    }
                    
                    const imageData = {
                        url: result.secure_url,
                        caption: caption
                    };
                    images.push(imageData);
                } catch (error) {
                    console.error(`Error uploading image ${i}:`, error);
                    req.flash('error', 'Error uploading image');
                    return res.redirect(`/exams/${exam._id}/questions/create`);
                }
            }
            
            if (images.length > 0) {
                questionData.images = images;
            }
        } else {
            // No images uploaded
        }
        
        // Create question
        const question = await Question.create(questionData);
        
        // Add question to exam
        exam.questions.push(question._id);
        await exam.save();
        
        req.flash('success', 'Question added successfully');
        res.redirect(`/exams/${exam._id}/questions`);
    } catch (error) {
        console.error('Error in postCreateQuestion:', error);
        req.flash('error', error.message || 'Error creating question');
        res.redirect(`/exams/${req.params.examId}/questions/create`);
    }
};

// Display question details
exports.getQuestion = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id)
            .populate('createdBy', 'username firstName lastName')
            .populate('examId', 'title type');
        
        if (!question) {
            req.flash('error', 'Question not found');
            return res.redirect(`/exams/${req.params.examId}/questions`);
        }
        
        res.render('question/detail', {
            title: 'تفاصيل خاصة بالسؤال',
            question,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getQuestion:', error);
        req.flash('error', 'Error fetching question details');
        res.redirect(`/exams/${req.params.examId}/questions`);
    }
};

// Display question edit form
exports.getEditQuestion = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id)
            .populate('examId', 'title type');
        
        if (!question) {
            req.flash('error', 'Question not found');
            return res.redirect(`/exams/${req.params.examId}/questions`);
        }
        
        // Check if user is authorized to edit
        if (question.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to edit this question');
            return res.redirect(`/exams/${req.params.examId}/questions`);
        }
        
        res.render('question/edit', {
            title: 'تعديل السؤال',
            question,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getEditQuestion:', error);
        req.flash('error', 'Error fetching question for editing');
        res.redirect(`/exams/${req.params.examId}/questions`);
    }
};

exports.postEditQuestion = async (req, res, next) => {
    try {
      // 1. Find the question
      let question = await Question.findById(req.params.id);
      if (!question) {
        throw new AppError('Question not found', 404);
      }
  
      // 2. Authorization check
      if (
        question.createdBy.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin'
      ) {
        throw new AppError('Not authorized to edit this question', 403);
      }
  
      // 3. Base update data
      const updateData = {
        text: req.body.text,
        marks: req.body.marks,
        difficulty: req.body.difficulty || 'Medium',
        explanation: req.body.explanation || '',
        tags: req.body.tags
          ? req.body.tags.split(',').map((tag) => tag.trim()).filter((tag) => tag)
          : []
      };
  
      // 4. For MCQ questions, handle options and detect if the correct answer changed
      let oldCorrectAnswer;
      let correctAnswerChanged = false;
      let correctOptionIndex;
  
      if (question.type === 'MCQ') {
        // Normalize options input into an array
        let optionsArray = Array.isArray(req.body['options[]'])
          ? req.body['options[]']
          : [req.body['options[]']];
  
        // Validate minimum number of options
        if (!optionsArray || optionsArray.length < 2) {
          throw new AppError('MCQ questions must have at least 2 options', 400);
        }
  
        // Get the new correct option index
        correctOptionIndex = parseInt(req.body.correctOption);
        if (
          isNaN(correctOptionIndex) ||
          correctOptionIndex < 0 ||
          correctOptionIndex >= optionsArray.length
        ) {
          throw new AppError('Invalid correct option selected', 400);
        }
  
        // Store the old correct answer index
        oldCorrectAnswer = question.options.findIndex((opt) => opt.isCorrect);
  
        // Build the new options array with the correct answer marked
        updateData.options = optionsArray.map((text, index) => ({
          text: text.trim(),
          isCorrect: index === correctOptionIndex
        }));
  
        // Determine if the correct answer changed
        correctAnswerChanged = oldCorrectAnswer !== correctOptionIndex;
      }
  
      // 5. Handle image uploads (using express-fileupload and Cloudinary)
      let imageFiles = null;
      if (req.files) {
          // Check different possible field names
          imageFiles = req.files.images || req.files["images[]"] || null;
      }
      
      if (imageFiles) {
        const uploadedImages = Array.isArray(imageFiles)
          ? imageFiles
          : [imageFiles];

        const newImages = [];
        for (let i = 0; i < uploadedImages.length; i++) {
          const file = uploadedImages[i];
          
          // Skip empty files
          if (!file.name || file.size === 0) {
            continue;
          }
          
          try {
            const result = await cloudinary.uploader.upload(file.tempFilePath, {
              folder: 'exam-questions'
            });
            
            // Handle captions with different field names
            let caption = '';
            const captionsArray = req.body.captions || req.body["captions[]"];
            if (captionsArray) {
              if (Array.isArray(captionsArray)) {
                caption = captionsArray[i] || '';
              } else {
                caption = i === 0 ? captionsArray : '';
              }
            }
            
            newImages.push({
              url: result.secure_url,
              caption: caption
            });
          } catch (error) {
            console.error('Error uploading image:', error);
            throw new AppError('Error uploading image', 500);
          }
        }

        // Combine new images with any existing images
        updateData.images = [...(question.images || []), ...newImages];
      } else {
        // If no new images, start with existing images
        updateData.images = question.images || [];
      }

      // 6. Handle image deletions (if provided)
      if (req.body.deleteImages) {
        const deleteIndices = Array.isArray(req.body.deleteImages)
          ? req.body.deleteImages.map(Number)
          : [Number(req.body.deleteImages)];

        updateData.images = updateData.images.filter(
          (_, index) => !deleteIndices.includes(index)
        );
      }

      // 7. Update captions for existing images
      if (req.body.existingImageCaptions && updateData.images) {
        const captions = Array.isArray(req.body.existingImageCaptions)
          ? req.body.existingImageCaptions
          : [req.body.existingImageCaptions];
        updateData.images = updateData.images.map((image, index) => ({
          ...image,
          caption: captions[index] !== undefined ? captions[index].trim() : image.caption
        }));
      }
      
      // 8. Update the question document
      const updatedQuestion = await Question.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );
      if (!updatedQuestion) {
        throw new AppError('Failed to update question', 500);
      }
  
      // 9. If the correct answer changed, propagate the changes to ExamAttempts, Submissions, and Results
      if (correctAnswerChanged) {
        // Use the updated examId to ensure consistency
        const examId = updatedQuestion.examId;

        // Fetch related exam attempts (only those that are SUBMITTED)
        const examAttempts = await ExamAttempt.find({
          'questions.question': question._id,
          status: 'SUBMITTED'
        });

        // Fetch related submissions (using updatedQuestion.examId)
        const submissions = await Submission.find({
          examId: examId,
          status: 'SUBMITTED',
          $or: [
            { 'answers.questionId': question._id },
            { 'tfAnswers.questionId': question._id }
          ]
        });

        // Fetch related results (using updatedQuestion.examId)
        const results = await Result.find({
          examId: examId,
          'questionResults.questionId': question._id
        });
  
        await Promise.all([
          // 9a. Update ExamAttempts
          ...examAttempts.map(async (attempt) => {
            const questionAttempt = attempt.questions.find(
              (q) => q.question.toString() === question._id.toString()
            );
            if (questionAttempt) {
              // For MCQ, recalc marks based on the new correct answer
              if (question.type === 'MCQ') {
                const selectedOptionIndex = parseInt(questionAttempt.answer);
                questionAttempt.marks =
                  selectedOptionIndex === correctOptionIndex
                    ? updatedQuestion.marks
                    : 0;
              }
              // Recalculate total marks for the attempt
              attempt.totalMarks = attempt.questions.reduce(
                (sum, q) => sum + q.marks,
                0
              );
              await attempt.save();
            }
          }),
  
          // 9b. Update Submissions
          ...submissions.map(async (submission) => {
            if (question.type === 'MCQ') {
              const answer = submission.answers.find(
                (a) => a.questionId.toString() === question._id.toString()
              );
              if (answer) {
                const selectedOptionIndex = parseInt(answer.selectedOption);
                answer.isCorrect = selectedOptionIndex === correctOptionIndex;
                answer.marksObtained = answer.isCorrect ? updatedQuestion.marks : 0;
                submission.totalMarksObtained = submission.answers.reduce(
                  (sum, a) => sum + a.marksObtained,
                  0
                );
                await submission.save();
              }
            }
          }),
  
          // 9c. Update Results
          ...results.map(async (result) => {
            const questionResult = result.questionResults.find(
              (qr) => qr.questionId.toString() === question._id.toString()
            );
            if (questionResult && question.type === 'MCQ') {
              const submission = await Submission.findById(result.submissionId);
              if (submission) {
                const answer = submission.answers.find(
                  (a) => a.questionId.toString() === question._id.toString()
                );
                if (answer) {
                  questionResult.isCorrect = answer.isCorrect;
                  questionResult.obtainedMarks = answer.marksObtained;
                  // Recalculate total obtained marks and percentage
                  result.obtainedMarks = result.questionResults.reduce(
                    (sum, qr) => sum + qr.obtainedMarks,
                    0
                  );
                  result.percentage = (result.obtainedMarks / result.totalMarks) * 100;
                  result.status = result.percentage >= 50 ? 'PASS' : 'FAIL';
                  await result.save();
                }
              }
            }
          })
        ]);
  
        req.flash(
          'success',
          'Question updated successfully. All related submissions and results have been recalculated.'
        );
      } else {
        req.flash('success', 'Question updated successfully');
      }
  
      // 10. Redirect to the updated question view
      res.redirect(`/exams/${req.params.examId}/questions/${updatedQuestion._id}`);
    } catch (error) {
      console.error('Error in postEditQuestion:', error);
      req.flash('error', error.message || 'Error updating question');
      res.redirect(`/exams/${req.params.examId}/questions/${req.params.id}/edit`);
    }
  };
  
// Handle question deletion
exports.deleteQuestion = async (req, res) => {
    try {
        const { examId, id } = req.params;

        // Find the exam first
        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        // Find the question
        const question = await Question.findById(id);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        // Check authorization
        if (question.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this question'
            });
        }

        try {
            // 1. Remove question from exam's questions array
            exam.questions = exam.questions.filter(q => q.toString() !== id);
            await exam.save();

            // 2. Clean up ExamAttempts
            await ExamAttempt.updateMany(
                { 'questions.question': id },
                { 
                    $pull: { questions: { question: id } },
                    $inc: { totalMarks: -question.marks } // Decrease total marks
                }
            );

            // 3. Clean up Submissions
            const submissions = await Submission.find({
                examId: examId,
                $or: [
                    { 'answers.questionId': id },
                    { 'tfAnswers.questionId': id }
                ]
            });

            for (const submission of submissions) {
                // Remove the question's answer and update total marks
                const answer = submission.answers.find(a => a.questionId.toString() === id);
                if (answer) {
                    submission.totalMarksObtained -= (answer.marksObtained || 0);
                    submission.answers = submission.answers.filter(a => a.questionId.toString() !== id);
                }
                
                // Also check tfAnswers if exists
                if (submission.tfAnswers) {
                    const tfAnswer = submission.tfAnswers.find(a => a.questionId.toString() === id);
                    if (tfAnswer) {
                        submission.totalMarksObtained -= (tfAnswer.marksObtained || 0);
                        submission.tfAnswers = submission.tfAnswers.filter(a => a.questionId.toString() !== id);
                    }
                }

                await submission.save();
            }

            // 4. Clean up Results
            const results = await Result.find({
                examId: examId,
                'questionResults.questionId': id
            });

            for (const result of results) {
                // Remove the question result and update totals
                const questionResult = result.questionResults.find(qr => qr.questionId.toString() === id);
                if (questionResult) {
                    result.totalMarks -= question.marks;
                    result.obtainedMarks -= (questionResult.obtainedMarks || 0);
                    result.questionResults = result.questionResults.filter(qr => qr.questionId.toString() !== id);
                    
                    // Recalculate percentage and status
                    if (result.totalMarks > 0) {
                        result.percentage = (result.obtainedMarks / result.totalMarks) * 100;
                        result.status = result.percentage >= 50 ? 'PASS' : 'FAIL';
                    }
                }
                await result.save();
            }

            // 5. Finally delete the question
            await Question.findByIdAndDelete(id);

            return res.json({
                success: true,
                message: 'Question and all related data deleted successfully'
            });
        } catch (error) {
            // If there's an error, try to restore the exam's questions array
            try {
                exam.questions.push(id);
                await exam.save();
            } catch (restoreError) {
                console.error('Error restoring exam questions:', restoreError);
            }
            throw error;
        }
    } catch (error) {
        console.error('Error in deleteQuestion:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting question and related data'
        });
    }
};

// Handle question image upload
exports.postUploadImage = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        
        if (!question) {
            if (req.xhr || req.headers.accept.indexOf('application/json') > -1) {
                return res.status(404).json({ success: false, message: 'Question not found' });
            }
            req.flash('error', 'Question not found');
            return res.redirect(`/exams/${req.params.examId}/questions`);
        }
        
        // Check if user is authorized to upload
        if (question.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            if (req.xhr || req.headers.accept.indexOf('application/json') > -1) {
                return res.status(403).json({ success: false, message: 'Not authorized to upload images for this question' });
            }
            req.flash('error', 'Not authorized to upload images for this question');
            return res.redirect(`/exams/${req.params.examId}/questions`);
        }
        
        if (!req.files || !req.files.image) {
            if (req.xhr || req.headers.accept.indexOf('application/json') > -1) {
                return res.status(400).json({ success: false, message: 'Please upload an image' });
            }
            req.flash('error', 'Please upload an image');
            return res.redirect(`/exams/${req.params.examId}/questions/${question._id}/edit`);
        }
        
        const file = req.files.image;
        
        // Validate file type
        if (!file.mimetype.startsWith('image/')) {
            if (req.xhr || req.headers.accept.indexOf('application/json') > -1) {
                return res.status(400).json({ success: false, message: 'Please upload an image file' });
            }
            req.flash('error', 'Please upload an image file');
            return res.redirect(`/exams/${req.params.examId}/questions/${question._id}/edit`);
        }
        
        // Create custom filename
        const filename = `question_${question._id}_${Date.now()}${path.extname(file.name)}`;
        
        // Move file to upload directory
        await file.mv(`./public/uploads/${filename}`);
        
        // Add image to question
        question.images.push({
            url: `/uploads/${filename}`,
            caption: req.body.caption || ''
        });
        await question.save();
        
        if (req.xhr || req.headers.accept.indexOf('application/json') > -1) {
            return res.json({ success: true, url: `/uploads/${filename}`, caption: req.body.caption || '' });
        }
        req.flash('success', 'Image uploaded successfully');
        res.redirect(`/exams/${req.params.examId}/questions/${question._id}/edit`);
    } catch (error) {
        console.error('Error in postUploadImage:', error);
        if (req.xhr || req.headers.accept.indexOf('application/json') > -1) {
            return res.status(500).json({ success: false, message: 'Error uploading image' });
        }
        req.flash('error', 'Error uploading image');
        res.redirect(`/exams/${req.params.examId}/questions/${req.params.id}/edit`);
    }
};

// Handle temporary image upload for new questions (no questionId)
exports.postUploadImageTemp = async (req, res) => {
    try {
        if (!req.files || !req.files.image) {
            return res.status(400).json({ success: false, message: 'Please upload an image' });
        }
        const file = req.files.image;
        // Validate file type
        if (!file.mimetype.startsWith('image/')) {
            return res.status(400).json({ success: false, message: 'Please upload an image file' });
        }
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(file.tempFilePath, {
            folder: 'exam-questions-temp'
        });
        // Return the Cloudinary URL
        return res.json({ success: true, url: result.secure_url });
    } catch (error) {
        console.error('Error in postUploadImageTemp:', error);
        return res.status(500).json({ success: false, message: 'Error uploading image' });
    }
};

// Display question type selection form
exports.getPlanQuestions = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to add questions
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to add questions to this exam');
            return res.redirect(`/exams/${exam._id}`);
        }
        
        res.render('question/select-types', {
            title: 'وضع أسئلة',
            exam,
            examId: exam._id,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getPlanQuestions:', error);
        req.flash('error', 'Error loading question planning form');
        res.redirect(`/exams/${req.params.examId}`);
    }
};

// Handle question type selection and show bulk creation form
exports.postPlanQuestions = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to add questions
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to add questions to this exam');
            return res.redirect(`/exams/${exam._id}`);
        }

        const { mcqCount, trueFalseCount, shortAnswerCount, longAnswerCount } = req.body;
        
        // Validate that at least one question type is selected
        const totalQuestions = parseInt(mcqCount || 0) + 
                             parseInt(trueFalseCount || 0) + 
                             parseInt(shortAnswerCount || 0) + 
                             parseInt(longAnswerCount || 0);
        
        if (totalQuestions === 0) {
            req.flash('error', 'Please select at least one question to add');
            return res.redirect(`/exams/${exam._id}/questions/plan`);
        }
        
        res.render('question/create-planned', {
            title: 'إضافة الأسئلة',
            exam,
            examId: exam._id,
            mcqCount: parseInt(mcqCount || 0),
            trueFalseCount: parseInt(trueFalseCount || 0),
            shortAnswerCount: parseInt(shortAnswerCount || 0),
            longAnswerCount: parseInt(longAnswerCount || 0),
            user: req.user
        });
    } catch (error) {
        console.error('Error in postPlanQuestions:', error);
        req.flash('error', 'Error processing question plan');
        res.redirect(`/exams/${req.params.examId}/questions/plan`);
    }
};

// Handle bulk question creation
exports.postCreateBulkQuestions = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to add questions
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to add questions to this exam');
            return res.redirect(`/exams/${exam._id}`);
        }

        // Parse questions from flattened form data
        let questions = [];
        
        // Parse the flattened question structure like questions[0][type], questions[0][text], etc.
        const questionKeys = Object.keys(req.body).filter(key => key.startsWith('questions['));
        const questionsMap = {};
        
        questionKeys.forEach(key => {
            // Extract index and property from key like "questions[0][type]"
            const match = key.match(/questions\[(\d+)\]\[(\w+)\](\[\])?$/);
            if (match) {
                const index = parseInt(match[1]);
                const property = match[2];
                const isArray = match[3] === '[]';
                const value = req.body[key];
                
                if (!questionsMap[index]) {
                    questionsMap[index] = {};
                }
                
                if (isArray) {
                    questionsMap[index][property] = Array.isArray(value) ? value : [value];
                } else {
                    questionsMap[index][property] = value;
                }
            }
        });
        
        // Convert map to array
        const questionIndices = Object.keys(questionsMap).map(Number).sort((a, b) => a - b);
        questions = questionIndices.map(index => questionsMap[index]);
                
        if (!Array.isArray(questions) || questions.length === 0) {
            req.flash('error', 'Invalid question data - no valid questions found');
            return res.redirect(`/exams/${exam._id}/questions/plan`);
        }

        // Format questions before creation
        const formattedQuestions = await Promise.all(
            questions.map(async (question, index) => {
                const formattedQuestion = {
                    ...question,
                    examId: exam._id,
                    createdBy: req.user._id
                };

                // Format MCQ options
                if (question.type === 'MCQ') {
                    // console.log(`Processing MCQ options for question ${index}:`, question.options);
                    // console.log(`Correct option index:`, question.correctOption);
                    
                    if (Array.isArray(question.options) && question.options.length > 0) {
                        const correctOption = parseInt(question.correctOption);
                        
                        // Validate MCQ options
                        if (question.options.length < 2) {
                            throw new Error(`MCQ Question #${index + 1}: At least 2 options are required`);
                        }
                        
                        if (isNaN(correctOption) || correctOption < 0 || correctOption >= question.options.length) {
                            throw new Error(`MCQ Question #${index + 1}: Invalid correct option selected`);
                        }
                        
                        formattedQuestion.options = question.options.map((text, optionIndex) => ({
                            text: text.trim(),
                            isCorrect: optionIndex === correctOption
                        }));
                        delete formattedQuestion.correctOption;
                    } else {
                        throw new Error(`MCQ Question #${index + 1}: No options provided`);
                    }
                }

                // Format TrueFalse answer
                if (question.type === 'TrueFalse') {
                    formattedQuestion.correctAnswer = question.correctAnswer.toString().toLowerCase();
                }

                // Format ShortAnswer and Essay
                if (question.type === 'ShortAnswer' || question.type === 'Essay') {
                    formattedQuestion.correctAnswer = question.correctAnswer;
                }

                // Process tags
                if (question.tags) {
                    formattedQuestion.tags = question.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                }

                // Handle image uploads for this question
                if (req.files) {
                    const questionImages = [];
                    
                    // Try different possible field names for images
                    const possibleImageFields = [
                        `questions[${index}][images]`,
                        `questions[${index}][images][]`,
                        `questions[${index}][images][0]`,
                        `questions[${index}][images][1]`,
                        `questions[${index}][images][2]`,
                        `questions[${index}][images][3]`,
                        `questions[${index}][images][4]`
                    ];
                    
                    // console.log(`Looking for images for question ${index}:`, possibleImageFields);
                    
                    let imageFiles = [];
                    possibleImageFields.forEach(fieldName => {
                        if (req.files[fieldName]) {
                            const files = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];
                            imageFiles.push(...files);
                        }
                    });
                    
                    // console.log(`Found ${imageFiles.length} image files for question ${index}`);
                    
                    if (imageFiles.length > 0) {
                        const imageCaptions = question.captions || [];
                        
                        for (let i = 0; i < imageFiles.length; i++) {
                            const file = imageFiles[i];
                            if (file && file.tempFilePath && file.size > 0) {
                                try {
                                    const result = await cloudinary.uploader.upload(file.tempFilePath, {
                                        folder: 'exam-questions'
                                    });
                                    questionImages.push({
                                        url: result.secure_url,
                                        caption: imageCaptions[i] || ''
                                    });
                                } catch (error) {
                                    console.error(`Error uploading image for question ${index}:`, error);
                                    // Continue with other images if one fails
                                }
                            }
                        }
                    }
                    
                    if (questionImages.length > 0) {
                        formattedQuestion.images = questionImages;
                    }
                }

                return formattedQuestion;
            })
        );

        // Create all questions
        const createdQuestions = await Promise.all(
            formattedQuestions.map(async (questionData) => {
                const question = await Question.create(questionData);
                return question._id;
            })
        );

        // Add questions to exam
        exam.questions.push(...createdQuestions);
        await exam.save();
        
        req.flash('success', `Successfully added ${createdQuestions.length} questions`);
        res.redirect(`/exams/${exam._id}/questions`);
    } catch (error) {
        console.error('Error in postCreateBulkQuestions:', error);
        req.flash('error', error.message || 'Error creating questions');
        res.redirect(`/exams/${req.params.examId}/questions/plan`);
    }
}; 