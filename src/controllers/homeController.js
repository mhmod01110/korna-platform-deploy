const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const Department = require('../models/Department');

exports.getHome = async (req, res) => {
    try {
        // Get active departments with populated exams
        const departments = await Department.find({ isActive: true })
            .populate({
                path: 'exams',
                match: { status: 'PUBLISHED' },
                select: 'title startDate endDate allowedStudents type projectTotalMarks questions',
                options: { limit: 3 }
            })
            .sort('name');

        // If user is not logged in, render the guest view
        if (!req.session.user) {
            return res.render('index', {
                title: 'نورت منصتنا المتكاملة Korna-Mistry',
                user: null,
                departments
            });
        }

        // For students
        if (req.session.user.role === 'student') {
            // Get the 3 most recent exams regardless of status
            const recentExams = await Exam.find({})
                .select('title startDate endDate duration status')
                .sort({ createdAt: -1 })
                .limit(10); // Get more to filter out submitted ones
            
            // Get exams that the student has already submitted (only SUBMITTED or GRADED status)
            const submittedExams = await Submission.find({
                studentId: req.session.user._id,
                status: { $in: ['SUBMITTED', 'GRADED'] }
            }).distinct('examId');
            
            // Get exams that the student has already completed (from Results)
            const completedExams = await Result.find({
                studentId: req.session.user._id
            }).distinct('examId');
            
            // Combine both arrays and convert to strings for comparison
            const allSubmittedExamIds = [...submittedExams, ...completedExams]
                .map(id => id.toString())
                .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates
            
            // Filter out submitted exams and get the 3 most recent
            const upcomingExams = recentExams
                .filter(exam => !allSubmittedExamIds.includes(exam._id.toString()))
                .slice(0, 3);
        
            // Get recent results
            const recentResults = await Result.find({
                studentId: req.session.user._id
            })
            .populate('examId', 'title resultDisplayOption')
            .sort({ submittedAt: -1 })
            .limit(5)
            .lean();

            // Filter results based on display options - only show results that are not hidden
            const visibleResults = recentResults.filter(result => 
                result.examId.resultDisplayOption !== 'HIDE_RESULTS'
            );
        
            // Format results
            const formattedResults = visibleResults.map(result => ({
                ...result,
                examTitle: result.examId.title
            }));

            // For each department, determine student's level
            const departmentsWithLevels = await Promise.all(departments.map(async department => {
                // Find the latest result for this department
                const latestResult = await Result.findOne({
                    studentId: req.session.user._id,
                    status: { $in: ['PASS', 'FAIL'] },
                    examId: { $in: department.exams.map(exam => exam._id) }
                })
                .populate('examId', 'resultDisplayOption')
                .sort({ createdAt: -1 })
                .lean();

                let studentLevel = 'Beginner';
                if (latestResult) {
                    const percentage = latestResult.percentage;
                    if (percentage > 84) {
                        studentLevel = 'Advanced';
                    } else if (percentage > 59) {
                        studentLevel = 'Normal';
                    }
                }

                // Convert department to a plain object without virtuals
                const departmentObj = department.toObject({ virtuals: false });
                
                // Add only the necessary exam data
                departmentObj.exams = department.exams.map(exam => ({
                    _id: exam._id,
                    title: exam.title,
                    startDate: exam.startDate,
                    endDate: exam.endDate
                }));

                return {
                    ...departmentObj,
                    studentLevel
                };
            }));
        
            return res.render('index', {
                title: 'لوحة تحكم الطالب',
                user: req.session.user,
                upcomingExams,
                recentResults: formattedResults,
                departments: departmentsWithLevels
            });
        }
        
        // For teachers and admins
        let query = {};
        let submissionsQuery = {};
        
        // If teacher, only show their exams
        if (req.session.user.role === 'teacher') {
            query.createdBy = req.session.user._id;
            submissionsQuery['examId.createdBy'] = req.session.user._id;
        }

        // Get recent exams
        const recentExams = await Exam.find(query)
            .populate('questions')
            .populate('submissions')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get submissions
        const submissions = await Submission.find(submissionsQuery)
            .populate('studentId', 'firstName lastName email')
            .populate('examId', 'title totalMarks createdBy')
            .sort('-submittedAt')
            .limit(50);

        // Calculate statistics
        const stats = {
            totalExams: await Exam.countDocuments(query),
            totalQuestions: await Question.countDocuments(
                req.session.user.role === 'teacher' ? { 'examId.createdBy': req.session.user._id } : {}
            ),
            totalSubmissions: await Submission.countDocuments(submissionsQuery),
            pendingGrades: await Submission.countDocuments({
                ...submissionsQuery,
                status: { $in: ['PENDING_REVIEW', 'SUBMITTED'] }
            })
        };

        // Add total users count for admin
        if (req.session.user.role === 'admin') {
            stats.totalUsers = await User.countDocuments();
        }
        
        // Add active exams count
        stats.activeExams = await Exam.countDocuments({
            ...query,
            status: 'PUBLISHED'
        });

        // Get top 5 students for Hall of Fame
       const topStudents = await Result.aggregate([
        {
            $match: {
                status: { $in: ['PASS', 'FAIL'] }
            }
        },
        {
            $group: {
                _id: '$studentId',
                examCount: { $sum: 1 },
                totalObtainedMarks: { $sum: '$obtainedMarks' },
                totalPossibleMarks: { $sum: '$totalMarks' },
                averagePercentage: { $avg: '$percentage' }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'studentInfo'
            }
        },
        { $unwind: '$studentInfo' },
        {
            $match: {
                'studentInfo.role': 'student'
            }
        },
        {
            $project: {
                _id: 1,
                firstName: '$studentInfo.firstName',
                lastName: '$studentInfo.lastName',
                examCount: 1,
                totalObtainedMarks: 1,
                totalPossibleMarks: 1,
                averagePercentage: { $round: ['$averagePercentage', 1] },
                overallPercentage: { 
                    $round: [
                        { 
                            $multiply: [
                                { $divide: ['$totalObtainedMarks', '$totalPossibleMarks'] }, 
                                100
                            ] 
                        }, 
                        1
                    ] 
                }
            }
        },
        {
            $sort: {
                totalObtainedMarks: -1,  // main criterion: highest total obtained marks
                averagePercentage: -1,   // secondary: highest average percentage
                _id: 1                   // tiebreaker for stable results
            }
        },
        { $limit: 5 }
    ]);


        return res.render('index', {
            title: 'لوحة التحكم',
            user: req.session.user,
            recentExams,
            submissions,
            departments,
            topStudents,
            ...stats
        });
    } catch (error) {
        console.error('Error in getHome:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
}; 
