const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
	studentId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		index: true
	},
	adminId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		index: true
	},
	lastMessageAt: {
		type: Date,
		default: Date.now,
		index: true
	},
	studentUnreadCount: {
		type: Number,
		default: 0
	},
	adminUnreadCount: {
		type: Number,
		default: 0
	}
}, {
	timestamps: true
});

conversationSchema.index({ studentId: 1, adminId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);

