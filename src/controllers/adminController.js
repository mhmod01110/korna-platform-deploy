const User = require('../models/User');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const Department = require('../models/Department');
const Submission = require('../models/Submission');
const AppError = require('../utils/AppError');
const { generateStudentResultsPDF } = require('../utils/pdfExporter');
const { generateStudentResultsExcel } = require('../utils/excelExporter');

// Admin Dashboard
exports.getDashboard = async (req, res, next) => {
    try {
        // Get system statistics
        const stats = {
            totalUsers: await User.countDocuments(),
            totalExams: await Exam.countDocuments(),
            totalResults: await Result.countDocuments(),
            totalDepartments: await Department.countDocuments(),
            pendingGrades: await Submission.countDocuments({ status: { $ne: 'GRADED' } })
        };

        // Get recent users
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5);

        // Get recent exams
        const recentExams = await Exam.find()
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('admin/dashboard', {
            title: 'لوحة تحكم الأدمن',
            stats,
            recentUsers,
            recentExams
        });
    } catch (error) {
        next(error);
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// User Management
exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Build search conditions
        let searchConditions = {};
        if (search) {
            searchConditions = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phoneNumber: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Get students with exam stats and pagination
        const studentsAggregate = [
            { $match: { role: 'student', ...searchConditions } },
            {
                $lookup: {
                    from: 'departments',
                    localField: 'departmentId',
                    foreignField: '_id',
                    as: 'department'
                }
            },
            {
                $lookup: {
                    from: 'results',
                    localField: '_id',
                    foreignField: 'studentId',
                    as: 'results'
                }
            },
            {
                $addFields: {
                    department: { $arrayElemAt: ['$department', 0] },
                    examCount: { $size: '$results' },
                    averageScore: {
                        $cond: {
                            if: { $gt: [{ $size: '$results' }, 0] },
                            then: { $avg: '$results.score' },
                            else: null
                        }
                    }
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const students = await User.aggregate(studentsAggregate);

        // Get total count for students pagination
        const totalStudents = await User.countDocuments({ role: 'student', ...searchConditions });

        // Get staff members with populated departments and pagination
        const staffQuery = { role: { $in: ['teacher', 'admin'] }, ...searchConditions };
        const staff = await User.find(staffQuery)
            .populate('departmentId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count for staff pagination
        const totalStaff = await User.countDocuments(staffQuery);

        // Map the populated departmentId to department for consistency with the view
        const mappedStaff = staff.map(member => ({
            ...member,
            department: member.departmentId
        }));

        // Get departments for the add staff form
        const departments = await Department.find().lean();

        // Calculate pagination info
        const totalUsers = totalStudents + totalStaff;
        const totalPages = Math.ceil(totalUsers / limit);

        res.render('admin/users', {
            title: 'إدارة المستخدمين',
            students,
            staff: mappedStaff,
            departments,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            },
            search
        });
    } catch (error) {
        console.error('Error in getUsers:', error);
        req.flash('error', 'Error loading users');
        res.redirect('/');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getCreateUser = (req, res) => {
    res.render('admin/users/create', {
        title: 'إنشاء مستخدم جديد'
    });
};

exports.postCreateUser = async (req, res) => {
    try {
        const { firstName, lastName, email, password, role } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already registered');
            return res.redirect('/admin/users/create');
        }

        // Create user
        const user = new User({
            firstName,
            lastName,
            email,
            password,
            role
        });

        await user.save();
        req.flash('success', 'User created successfully');
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Create user error:', error);
        req.flash('error', error.message || 'Error creating user');
        res.redirect('/admin/users/create');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getEditUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/users');
        }

        res.render('admin/users/edit', {
            title: 'تعديل المستخدم',
            user
        });
    } catch (error) {
        console.error('Get edit user error:', error);
        req.flash('error', 'Error loading user');
        res.redirect('/admin/users');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.postEditUser = async (req, res) => {
    try {
        const { firstName, lastName, email, role, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/users');
        }

        // Update user
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
        user.role = role;
        if (password) {
            user.password = password;
        }

        await user.save();
        req.flash('success', 'User updated successfully');
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Edit user error:', error);
        req.flash('error', error.message || 'Error updating user');
        res.redirect(`/admin/users/${req.params.id}/edit`);
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'student') {
            // Delete associated results
            await Result.deleteMany({ studentId: user._id });
        } else {
            // For teachers, reassign or delete their exams
            await Exam.updateMany(
                { createdBy: user._id },
                { $set: { createdBy: req.user._id } }
            );
        }

        await user.remove();
        res.json({ success: true });
    } catch (error) {
        console.error('Error in deleteUser:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Department Management
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.find().sort({ name: 1 });
        res.render('admin/departments', {
            title: 'إدارة الدروس',
            departments
        });
    } catch (error) {
        console.error('Get departments error:', error);
        req.flash('error', 'Error loading departments');
        res.redirect('/admin');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.createDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;
        const department = new Department({ name, description });
        await department.save();
        req.flash('success', 'Department created successfully');
        res.redirect('/admin/departments');
    } catch (error) {
        console.error('Create department error:', error);
        req.flash('error', error.message || 'Error creating department');
        res.redirect('/admin/departments');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;
        await Department.findByIdAndUpdate(req.params.id, { name, description });
        req.flash('success', 'Department updated successfully');
        res.redirect('/admin/departments');
    } catch (error) {
        console.error('Update department error:', error);
        req.flash('error', 'Error updating department');
        res.redirect('/admin/departments');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        await Department.findByIdAndDelete(req.params.id);
        req.flash('success', 'Department deleted successfully');
        res.redirect('/admin/departments');
    } catch (error) {
        console.error('Delete department error:', error);
        req.flash('error', 'Error deleting department');
        res.redirect('/admin/departments');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// System Settings
exports.getSettings = async (req, res) => {
    try {
        // Get current settings
        const settings = {
            allowRegistration: true, // Example setting
            defaultUserRole: 'student',
            maxFileSize: 5 * 1024 * 1024, // 5MB
            allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf']
        };

        res.render('admin/settings', {
            title: 'إعدادات الاختبار',
            settings
        });
    } catch (error) {
        console.error('Get settings error:', error);
        req.flash('error', 'Error loading settings');
        res.redirect('/admin');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        // Update settings
        const { allowRegistration, defaultUserRole, maxFileSize, allowedFileTypes } = req.body;
        
        // Save settings (implement your settings storage logic)
        
        req.flash('success', 'Settings updated successfully');
        res.redirect('/admin/settings');
    } catch (error) {
        console.error('Update settings error:', error);
        req.flash('error', 'Error updating settings');
        res.redirect('/admin/settings');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Reports
exports.getExamReports = async (req, res) => {
    try {
        const examStats = await Exam.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.render('admin/reports/exams', {
            title: 'تقارير الاختبار',
            examStats
        });
    } catch (error) {
        console.error('Exam reports error:', error);
        req.flash('error', 'Error loading exam reports');
        res.redirect('/admin');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getUserReports = async (req, res) => {
    try {
        const userStats = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.render('admin/reports/users', {
            title: 'تقارير الطلاب',
            userStats
        });
    } catch (error) {
        console.error('User reports error:', error);
        req.flash('error', 'Error loading user reports');
        res.redirect('/admin');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getPerformanceReports = async (req, res) => {
    try {
        // Get all active departments
        const departments = await Department.find({ isActive: true }).sort('name');

        // Get results for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Get all results grouped by department and date
        const results = await Result.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $lookup: {
                    from: 'exams',
                    localField: 'examId',
                    foreignField: '_id',
                    as: 'exam'
                }
            },
            {
                $unwind: '$exam'
            },
            {
                $lookup: {
                    from: 'departments',
                    localField: 'exam.department',
                    foreignField: '_id',
                    as: 'department'
                }
            },
            {
                $unwind: '$department'
            },
            {
                $group: {
                    _id: {
                        departmentId: '$department._id',
                        departmentName: '$department.name',
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' }
                    },
                    averageScore: { $avg: '$percentage' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1
                }
            }
        ]);

        // Process results into a format suitable for Chart.js
        const performanceData = {
            labels: [],
            datasets: []
        };

        // Create a map of department colors
        const departmentColors = departments.reduce((acc, dept, index) => {
            // Generate different colors for each department
            const hue = (360 / departments.length) * index;
            acc[dept._id.toString()] = `hsl(${hue}, 70%, 50%)`;
            return acc;
        }, {});

        // Get unique months for labels
        const months = [...new Set(results.map(r => `${r._id.year}-${r._id.month.toString().padStart(2, '0')}`))];
        performanceData.labels = months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        // Group results by department
        const departmentData = {};
        results.forEach(result => {
            const deptId = result._id.departmentId.toString();
            if (!departmentData[deptId]) {
                departmentData[deptId] = {
                    label: result._id.departmentName,
                    data: new Array(months.length).fill(null),
                    borderColor: departmentColors[deptId],
                    tension: 0.1
                };
            }
            const monthIndex = months.indexOf(`${result._id.year}-${result._id.month.toString().padStart(2, '0')}`);
            if (monthIndex !== -1) {
                departmentData[deptId].data[monthIndex] = result.averageScore;
            }
        });

        performanceData.datasets = Object.values(departmentData);

        // Calculate overall statistics
        const overallStats = await Result.aggregate([
            {
                $group: {
                    _id: null,
                    averageScore: { $avg: '$percentage' },
                    highestScore: { $max: '$percentage' },
                    lowestScore: { $min: '$percentage' },
                    totalExams: { $sum: 1 }
                }
            }
        ]);

        res.render('admin/reports/performance', {
            title: 'تقارير الاداء',
            performanceData: JSON.stringify(performanceData),
            stats: overallStats[0] || {
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0,
                totalExams: 0
            }
        });
    } catch (error) {
        console.error('Performance reports error:', error);
        req.flash('error', 'Error loading performance reports');
        res.redirect('/admin');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// General Reports Dashboard
exports.getReports = async (req, res) => {
    try {
        // Get basic statistics for the reports dashboard
        const [examStats, userStats, recentResults] = await Promise.all([
            Exam.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),
            User.aggregate([
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 }
                    }
                }
            ]),
            Result.find()
                .populate('examId', 'title')
                .populate('studentId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .limit(5)
        ]);

        // Get overall system statistics
        const overallStats = await Result.aggregate([
            {
                $group: {
                    _id: null,
                    averageScore: { $avg: '$percentage' },
                    totalExams: { $sum: 1 },
                    passedExams: { $sum: { $cond: [{ $eq: ['$status', 'PASS'] }, 1, 0] } }
                }
            }
        ]);

        const stats = overallStats[0] || {
            averageScore: 0,
            totalExams: 0,
            passedExams: 0
        };

        res.render('admin/reports/index', {
            title: 'لوحة تحكم التقارير',
            examStats,
            userStats,
            recentResults,
            stats
        });
    } catch (error) {
        console.error('Reports dashboard error:', error);
        req.flash('error', 'Error loading reports dashboard');
        res.redirect('/admin');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get student progress page
exports.getStudentProgress = async (req, res) => {
    try {
        const studentId = req.params.id;

        // Get student details with department
        const student = await User.findById(studentId)
            .populate('departmentId', 'name');

        if (!student) {
            req.flash('error', 'Student not found');
            return res.redirect('/admin/users');
        }

        // Get exam history with details
        const examHistory = await Result.find({ studentId })
            .populate('examId', 'title passingMarks')
            .sort({ createdAt: -1 })
            .lean();

        // Calculate statistics
        const stats = {
            totalExams: examHistory.length,
            averageScore: examHistory.length > 0 ? 
                examHistory.reduce((sum, result) => sum + result.percentage, 0) / examHistory.length : 
                0,
            passedExams: examHistory.filter(result => result.status === 'PASS').length,
            failedExams: examHistory.filter(result => result.status === 'FAIL').length
        };

        // Prepare performance data for chart
        const performanceData = examHistory
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .map(result => ({
                date: result.createdAt,
                score: result.percentage
            }));

        res.render('admin/student-progress', {
            title: `تقدم الطالب - ${student.firstName} ${student.lastName}`,
            student,
            stats,
            examHistory,
            performanceData
        });
    } catch (error) {
        console.error('Error in getStudentProgress:', error);
        req.flash('error', 'Error loading student progress');
        res.redirect('/admin/users');
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Add new staff member
exports.postAddStaff = async (req, res, next) => {
    try {
        const { firstName, lastName, email, role, departmentId } = req.body;

        // Check if user exists first
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new AppError('A user with this email already exists', 400);
        }

        // Create new user
        const user = await User.create({
            firstName,
            lastName,
            email,
            role,
            departmentId: departmentId || null,
            password: 'changeme123' // Temporary password
        });

        // TODO: Send email to user with temporary password

        req.flash('success', 'Staff member added successfully');
        res.redirect('/admin/users');
    } catch (error) {
        next(error);
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Toggle user status
exports.postToggleUserStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            throw new AppError('User not found', 404);
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Export student progress as PDF
exports.getExportPDF = async (req, res, next) => {
    try {
        const studentId = req.params.id;
        
        // Get student results with populated exam details
        const results = await Result.find({ studentId })
            .populate('examId', 'title type duration')
            .populate('studentId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        if (!results || results.length === 0) {
            throw new AppError('No results found for this student', 404);
        }

        // Prepare data for PDF generation
        const student = results[0].studentId;
        const totalExams = results.length;
        const averagePercentage = results.reduce((sum, r) => sum + r.percentage, 0) / totalExams;
        const passedExams = results.filter(r => r.status === 'PASS').length;

        const data = {
            student,
            results,
            summary: {
                totalExams,
                averagePercentage,
                passedExams
            }
        };

        // Generate PDF
        const doc = generateStudentResultsPDF(data);
        
        // Set response headers
        const filename = `student_results_${studentId}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Pipe to response
        doc.pipe(res);
        doc.end();

    } catch (error) {
        next(error);
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Export student progress as Excel
exports.getExportExcel = async (req, res, next) => {
    try {
        const studentId = req.params.id;
        
        // Get student results with populated exam details
        const results = await Result.find({ studentId })
            .populate('examId', 'title type duration')
            .populate('studentId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        if (!results || results.length === 0) {
            throw new AppError('No results found for this student', 404);
        }

        // Prepare data for Excel generation
        const student = results[0].studentId;
        const totalExams = results.length;
        const averagePercentage = results.reduce((sum, r) => sum + r.percentage, 0) / totalExams;
        const passedExams = results.filter(r => r.status === 'PASS').length;

        const data = {
            student,
            results,
            summary: {
                totalExams,
                averagePercentage,
                passedExams
            }
        };

        // Generate Excel workbook
        const workbook = await generateStudentResultsExcel(data);
        
        // Set response headers
        const filename = `student_results_${studentId}_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        next(error);
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Export all users to Excel
exports.exportUsersExcel = async (req, res, next) => {
    try {
        const Excel = require('exceljs');
        
        // Get all users with their departments
        const allUsers = await User.find()
            .populate('departmentId', 'name')
            .sort({ role: 1, createdAt: -1 })
            .lean();

        // Create workbook and worksheet
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        // Add headers
        worksheet.addRow([
            'الاسم الأول',
            'الاسم الأخير',
            'البريد الإلكتروني',
            'رقم الهاتف',
            'رقم هاتف ولي الأمر',
            'الدور',
            'القسم',
            'الحالة',
            'تاريخ التسجيل'
        ]);

        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '366092' }
        };

        // Add user data
        allUsers.forEach(user => {
            const roleArabic = user.role === 'admin' ? 'أدمن' : 
                              user.role === 'teacher' ? 'معلم' : 'طالب';
            const statusArabic = user.isActive ? 'نشط' : 'غير نشط';
            const departmentName = user.departmentId ? user.departmentId.name : 'غير محدد';

            worksheet.addRow([
                user.firstName,
                user.lastName,
                user.email,
                user.phoneNumber || 'غير مدخل',
                user.parentPhoneNumber || 'غير مدخل',
                roleArabic,
                departmentName,
                statusArabic,
                new Date(user.createdAt).toLocaleDateString('ar-EG')
            ]);
        });

        // Auto-fit columns
        worksheet.columns.forEach((column, index) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(maxLength + 2, 30);
        });

        // Add borders to all cells
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Set response headers
        const filename = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        next(error);
    }
};

// API: Get pending grading submissions
exports.getPendingGrading = async (req, res, next) => {
    try {
        const submissions = await Submission.find({ 
            status: { $ne: 'GRADED' } 
        })
        .populate('studentId', 'firstName lastName email')
        .populate('examId', 'title type')
        .sort({ submittedAt: -1 })
        .limit(50); // Limit to recent 50 submissions

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}; 