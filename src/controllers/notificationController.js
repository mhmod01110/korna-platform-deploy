const Notification = require('../models/Notification');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');

// Get all notifications for the current user
exports.getNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = { recipient: req.user._id };
        
        // Filter by status if specified
        if (req.query.status && ['UNREAD', 'READ', 'ARCHIVED'].includes(req.query.status.toUpperCase())) {
            filter.status = req.query.status.toUpperCase();
        }

        // Filter by type if specified
        if (req.query.type) {
            filter.type = req.query.type.toUpperCase();
        }

        const notifications = await Notification.find(filter)
            .populate('sender', 'firstName lastName username')
            .populate('data.examId', 'title')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const totalNotifications = await Notification.countDocuments(filter);
        const unreadCount = await Notification.getUnreadCount(req.user._id);

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({
                success: true,
                notifications,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalNotifications / limit),
                    totalNotifications,
                    limit
                },
                unreadCount
            });
        }

        res.render('notifications/index', {
            title: 'الإشعارات',
            notifications,
            unreadCount,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalNotifications / limit),
                totalNotifications,
                limit
            },
            user: req.user
        });
    } catch (error) {
        console.error('Error in getNotifications:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                error: 'Error fetching notifications'
            });
        }
        req.flash('error', 'Error fetching notifications');
        res.redirect('/dashboard');
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        await notification.markAsRead();

        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error in markAsRead:', error);
        res.status(500).json({
            success: false,
            error: 'Error marking notification as read'
        });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.markAllAsRead(req.user._id);

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error in markAllAsRead:', error);
        res.status(500).json({
            success: false,
            error: 'Error marking all notifications as read'
        });
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteNotification:', error);
        res.status(500).json({
            success: false,
            error: 'Error deleting notification'
        });
    }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await Notification.getUnreadCount(req.user._id);
        
        res.json({
            success: true,
            unreadCount
        });
    } catch (error) {
        console.error('Error in getUnreadCount:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching unread count'
        });
    }
};

// Archive notification
exports.archiveNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: req.params.id,
                recipient: req.user._id
            },
            {
                status: 'ARCHIVED'
            },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification archived successfully'
        });
    } catch (error) {
        console.error('Error in archiveNotification:', error);
        res.status(500).json({
            success: false,
            error: 'Error archiving notification'
        });
    }
};

// Helper functions for creating notifications

// Notify when exam is published
exports.notifyExamPublished = async (examId, createdBy) => {
    try {
        const exam = await Exam.findById(examId)
            .populate('allowedStudents', '_id')
            .populate('department', 'name');

        if (!exam) return;

        const recipients = exam.isPublic ? 
            await User.find({ role: 'student', isActive: true }).select('_id') :
            exam.allowedStudents;

        const notifications = recipients.map(recipient => ({
            recipient: recipient._id,
            sender: createdBy,
            type: 'EXAM_PUBLISHED',
            title: 'اختبار جديد متاح',
            message: `تم نشر اختبار جديد: ${exam.title}`,
            data: {
                examId: exam._id,
                url: `/exams/${exam._id}`
            },
            priority: 'HIGH'
        }));

        await Promise.all(notifications.map(notif => 
            Notification.createNotification(notif)
        ));
    } catch (error) {
        console.error('Error in notifyExamPublished:', error);
    }
};

// Notify when project is submitted
exports.notifyProjectSubmitted = async (submissionId) => {
    try {
        const submission = await Submission.findById(submissionId)
            .populate('examId', 'title createdBy')
            .populate('studentId', 'firstName lastName');

        if (!submission || submission.submissionType !== 'PROJECT') return;

        await Notification.createNotification({
            recipient: submission.examId.createdBy,
            sender: submission.studentId._id,
            type: 'PROJECT_SUBMITTED',
            title: 'تم تقديم مشروع جديد',
            message: `قام ${submission.studentId.firstName} ${submission.studentId.lastName} بتقديم مشروع للاختبار: ${submission.examId.title}`,
            data: {
                examId: submission.examId._id,
                submissionId: submission._id,
                url: `/exams/${submission.examId._id}/submissions/${submission._id}/grade`
            },
            priority: 'HIGH'
        });
    } catch (error) {
        console.error('Error in notifyProjectSubmitted:', error);
    }
};

// Notify when project is graded
exports.notifyProjectGraded = async (submissionId) => {
    try {
        const submission = await Submission.findById(submissionId)
            .populate('examId', 'title')
            .populate('projectSubmission.gradedBy', 'firstName lastName');

        if (!submission || submission.submissionType !== 'PROJECT') return;

        const marks = submission.projectSubmission.marksObtained;
        const totalMarks = submission.examId.projectTotalMarks || 100;
        const percentage = Math.round((marks / totalMarks) * 100);

        await Notification.createNotification({
            recipient: submission.studentId,
            sender: submission.projectSubmission.gradedBy,
            type: 'PROJECT_GRADED',
            title: 'تم تقييم مشروعك',
            message: `تم تقييم مشروعك في اختبار ${submission.examId.title}. النتيجة: ${marks}/${totalMarks} (${percentage}%)`,
            data: {
                examId: submission.examId._id,
                submissionId: submission._id,
                marks: marks,
                totalMarks: totalMarks,
                percentage: percentage,
                url: `/exams/${submission.examId._id}`
            },
            priority: 'HIGH'
        });
    } catch (error) {
        console.error('Error in notifyProjectGraded:', error);
    }
};

// Notify about approaching deadlines
exports.notifyDeadlineReminder = async () => {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);

        const examsEndingSoon = await Exam.find({
            status: 'PUBLISHED',
            endDate: { $lte: tomorrow, $gt: new Date() }
        }).populate('allowedStudents', '_id');

        for (const exam of examsEndingSoon) {
            const recipients = exam.isPublic ? 
                await User.find({ role: 'student', isActive: true }).select('_id') :
                exam.allowedStudents;

            const notifications = recipients.map(recipient => ({
                recipient: recipient._id,
                type: 'DEADLINE_REMINDER',
                title: 'تذكير: موعد انتهاء الاختبار',
                message: `ينتهي موعد اختبار "${exam.title}" غداً`,
                data: {
                    examId: exam._id,
                    url: `/exams/${exam._id}`
                },
                priority: 'URGENT'
            }));

            await Promise.all(notifications.map(notif => 
                Notification.createNotification(notif)
            ));
        }
    } catch (error) {
        console.error('Error in notifyDeadlineReminder:', error);
    }
};

module.exports = exports;