const cron = require('node-cron');
const { notifyDeadlineReminder } = require('../controllers/notificationController');
const Notification = require('../models/Notification');

// Clean up expired notifications every day at midnight
const cleanupExpiredNotifications = cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Running cleanup of expired notifications...');
        
        const result = await Notification.deleteMany({
            expiresAt: { $lte: new Date() }
        });
        
        console.log(`Cleaned up ${result.deletedCount} expired notifications`);
    } catch (error) {
        console.error('Error cleaning up expired notifications:', error);
    }
}, {
    scheduled: false // Don't start automatically
});

// Send deadline reminders every day at 9 AM
const sendDeadlineReminders = cron.schedule('0 9 * * *', async () => {
    try {
        console.log('Sending deadline reminders...');
        await notifyDeadlineReminder();
        console.log('Deadline reminders sent successfully');
    } catch (error) {
        console.error('Error sending deadline reminders:', error);
    }
}, {
    scheduled: false // Don't start automatically
});

// Archive old read notifications every week on Sunday at 2 AM
const archiveOldNotifications = cron.schedule('0 2 * * 0', async () => {
    try {
        console.log('Archiving old read notifications...');
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const result = await Notification.updateMany({
            status: 'read',
            readAt: { $lte: thirtyDaysAgo }
        }, {
            status: 'ARCHIVED'
        });
        
        console.log(`Archived ${result.modifiedCount} old notifications`);
    } catch (error) {
        console.error('Error archiving old notifications:', error);
    }
}, {
    scheduled: false // Don't start automatically
});

// Function to start all cron jobs
function startCronJobs() {
    console.log('Starting notification cron jobs...');
    
    cleanupExpiredNotifications.start();
    sendDeadlineReminders.start();
    archiveOldNotifications.start();
    
    console.log('Notification cron jobs started successfully');
}

// Function to stop all cron jobs
function stopCronJobs() {
    console.log('Stopping notification cron jobs...');
    
    cleanupExpiredNotifications.stop();
    sendDeadlineReminders.stop();
    archiveOldNotifications.stop();
    
    console.log('Notification cron jobs stopped');
}

module.exports = {
    startCronJobs,
    stopCronJobs,
    cleanupExpiredNotifications,
    sendDeadlineReminders,
    archiveOldNotifications
};