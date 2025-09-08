const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
	conversationId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Conversation',
		required: true,
		index: true
	},
	senderId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	recipientId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	body: {
		type: String,
		required: true,
		trim: true
	},
	isSystem: {
		type: Boolean,
		default: false
	},
	readAt: {
		type: Date,
		default: null
	}
}, {
	timestamps: true
});

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);

