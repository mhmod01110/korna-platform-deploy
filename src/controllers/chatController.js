const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

exports.getChatEntry = async (req, res, next) => {
	try {
		if (req.user.role === 'admin' || req.user.role === 'teacher') {
			return res.redirect('/chat/admin');
		}
		return res.redirect('/chat/with-admin');
	} catch (error) {
		next(error);
	}
};

exports.getAdminInbox = async (req, res, next) => {
	try {
		const conversations = await Conversation.find({ adminId: req.user._id })
			.populate('studentId', 'firstName lastName email')
			.sort({ lastMessageAt: -1 });

		return res.render('chat/adminInbox', {
			title: 'Chat Inbox',
			conversations
		});
	} catch (error) {
		next(error);
	}
};

exports.getStudentChat = async (req, res, next) => {
	try {
		// Pick the first admin user as the assigned admin
		const adminUser = await User.findOne({ role: { $in: ['admin', 'teacher'] } }).select('_id firstName lastName');
		if (!adminUser) {
			req.flash('error', 'No admin available to chat with.');
			return res.redirect('/dashboard');
		}

		let conversation = await Conversation.findOne({ studentId: req.user._id, adminId: adminUser._id });
		if (!conversation) {
			conversation = await Conversation.create({ studentId: req.user._id, adminId: adminUser._id });
		}

		return res.render('chat/conversation', {
			title: 'Chat with Admin',
			conversation,
			peerUser: adminUser
		});
	} catch (error) {
		next(error);
	}
};

exports.getAdminChatWithStudent = async (req, res, next) => {
	try {
		const studentId = req.params.studentId;
		const student = await User.findById(studentId).select('_id firstName lastName');
		if (!student) {
			req.flash('error', 'Student not found');
			return res.redirect('/chat/admin');
		}
		let conversation = await Conversation.findOne({ studentId, adminId: req.user._id });
		if (!conversation) {
			conversation = await Conversation.create({ studentId, adminId: req.user._id });
		}
		return res.render('chat/conversation', {
			title: `Chat with ${student.firstName} ${student.lastName}`,
			conversation,
			peerUser: student
		});
	} catch (error) {
		next(error);
	}
};

exports.listConversations = async (req, res, next) => {
	try {
		if (!(req.user.role === 'admin' || req.user.role === 'teacher')) {
			return res.status(403).json({ message: 'Forbidden' });
		}
		const conversations = await Conversation.find({ adminId: req.user._id })
			.populate('studentId', 'firstName lastName email')
			.sort({ lastMessageAt: -1 });
		return res.json({ conversations });
	} catch (error) {
		next(error);
	}
};

exports.listMessages = async (req, res, next) => {
	try {
		const { conversationId, since } = req.query;
		const conversation = await Conversation.findById(conversationId);
		if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

		// Authorization: only participants
		const isParticipant = [conversation.studentId.toString(), conversation.adminId.toString()].includes(req.user._id.toString());
		if (!isParticipant) return res.status(403).json({ message: 'Forbidden' });

		const query = { conversationId };
		if (since) {
			query.createdAt = { $gt: new Date(since) };
		}
		const messages = await Message.find(query).sort({ createdAt: 1 });
		return res.json({ messages, now: new Date().toISOString() });
	} catch (error) {
		next(error);
	}
};

exports.sendMessage = async (req, res, next) => {
	try {
		const { conversationId, body } = req.body;
		const conversation = await Conversation.findById(conversationId);
		if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

		const isParticipant = [conversation.studentId.toString(), conversation.adminId.toString()].includes(req.user._id.toString());
		if (!isParticipant) return res.status(403).json({ message: 'Forbidden' });

		const recipientId = req.user._id.toString() === conversation.studentId.toString() ? conversation.adminId : conversation.studentId;

		const message = await Message.create({
			conversationId,
			senderId: req.user._id,
			recipientId,
			body
		});

		conversation.lastMessageAt = new Date();
		if (recipientId.toString() === conversation.studentId.toString()) {
			conversation.studentUnreadCount += 1;
		} else {
			conversation.adminUnreadCount += 1;
		}
		await conversation.save();

		return res.status(201).json({ message });
	} catch (error) {
		next(error);
	}
};

exports.markRead = async (req, res, next) => {
	try {
		const { conversationId } = req.body;
		const conversation = await Conversation.findById(conversationId);
		if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

		const isParticipant = [conversation.studentId.toString(), conversation.adminId.toString()].includes(req.user._id.toString());
		if (!isParticipant) return res.status(403).json({ message: 'Forbidden' });

		await Message.updateMany({ conversationId, recipientId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
		if (req.user._id.toString() === conversation.studentId.toString()) {
			conversation.studentUnreadCount = 0;
		} else {
			conversation.adminUnreadCount = 0;
		}
		await conversation.save();
		return res.json({ success: true });
	} catch (error) {
		next(error);
	}
};

// Return total unread messages for the current user
exports.getUnreadCount = async (req, res, next) => {
    try {
        // Determine role perspective
        let match = {};
        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            match = { adminId: req.user._id };
            const conversations = await Conversation.find(match).select('adminUnreadCount');
            const total = conversations.reduce((sum, c) => sum + (c.adminUnreadCount || 0), 0);
            return res.json({ unread: total });
        } else {
            match = { studentId: req.user._id };
            const conversations = await Conversation.find(match).select('studentUnreadCount');
            const total = conversations.reduce((sum, c) => sum + (c.studentUnreadCount || 0), 0);
            return res.json({ unread: total });
        }
    } catch (error) {
        next(error);
    }
};

