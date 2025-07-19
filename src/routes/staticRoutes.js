const express = require('express');
const router = express.Router();

// About page route
router.get('/about', (req, res) => {
    res.render('static/about', {
        title: 'عن النظام',
        user: req.session.user
    });
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('static/contact', {
        title: 'تواصل معنا'
    });
});

// Privacy Policy page
router.get('/privacy-policy', (req, res) => {
    res.render('static/privacy-policy', {
        title: 'سياسية الخصوصية'
    });
});

// Terms of Service page
router.get('/terms-of-service', (req, res) => {
    res.render('static/terms-of-service', {
        title: 'شروط الخدمة'
    });
});

module.exports = router; 