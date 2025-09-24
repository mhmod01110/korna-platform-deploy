const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "Recipient is required"]
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: {
            values: [
                'EXAM_PUBLISHED',
                'EXAM_GRADED', 
                'PROJECT_SUBMITTED',
                'PROJECT_GRADED',
                'SUBMISSION_RECEIVED',
                'DEADLINE_REMINDER',
                'SYSTEM_ANNOUNCEMENT',
                'GRADE_UPDATED',
                'FEEDBACK_RECEIVED'
            ],
            message: "{VALUE} is not a valid notification type"
        },
        required: [true, "Notification type is required"]
    },
    title: {
        type: String,
        required: [true, "Notification title is required"],
        trim: true,
        maxlength: [200, "Title cannot exceed 200 characters"]
    },
    message: {
        type: String,
        required: [true, "Notification message is required"],
        trim: true,
        maxlength: [1000, "Message cannot exceed 1000 characters"]
    },
    data: {
        // Additional data specific to notification type
        examId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Exam'
        },
        submissionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Submission'
        },
        resultId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Result'
        },
        marks: Number,
        url: String, // Link to relevant page
        metadata: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        enum: {
            values: ['UNREAD', 'READ', 'ARCHIVED'],
            message: "{VALUE} is not a valid notification status"
        },
        default: 'UNREAD'
    },
    priority: {
        type: String,
        enum: {
            values: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
            message: "{VALUE} is not a valid priority level"
        },
        default: 'NORMAL'
    },
    readAt: {
        type: Date
    },
    scheduledFor: {
        type: Date // For scheduled notifications
    },
    expiresAt: {
        type: Date // For notifications that should auto-expire
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for checking if notification is recent (within last 24 hours)
notificationSchema.virtual('isRecent').get(function() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > oneDayAgo;
});

// Virtual for human-readable time
notificationSchema.virtual('timeAgo').get(function() {
    const now = new Date();
    const diff = now - this.createdAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
});

// Index for better query performance
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });

// Middleware to mark as read when accessing
notificationSchema.methods.markAsRead = function() {
    if (this.status === 'UNREAD') {
        this.status = 'READ';
        this.readAt = new Date();
        return this.save();
    }
    return Promise.resolve(this);
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(notificationData) {
    try {
        const notification = new this(notificationData);
        await notification.save();
        
        // Emit real-time notification if socket.io is available
        if (global.io) {
            global.io.to(`user_${notification.recipient}`).emit('notification', {
                id: notification._id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                priority: notification.priority,
                createdAt: notification.createdAt,
                data: notification.data
            });
        }
        
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = function(userId) {
    return this.countDocuments({ 
        recipient: userId, 
        status: 'UNREAD',
        $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
        ]
    });
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = function(userId) {
    return this.updateMany(
        { recipient: userId, status: 'UNREAD' },
        { 
            status: 'READ', 
            readAt: new Date() 
        }
    );
};

// Remove expired notifications
notificationSchema.pre('find', function() {
    this.where({
        $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
        ]
    });
});

module.exports = mongoose.model('Notification', notificationSchema);