/**
 * Breadcrumb Helper Utility
 * Generates breadcrumb navigation based on the current path
 */

const breadcrumbConfig = {
    '/': { name: 'الرئيسية', parent: null },
    '/exams': { name: 'الاختبارات', parent: '/' },
    '/exams/create': { name: 'إنشاء اختبار', parent: '/exams' },
    '/exams/my-exams': { name: 'اختباراتي', parent: '/exams' },
    '/questions': { name: 'بنك الأسئلة', parent: '/' },
    '/questions/create': { name: 'إنشاء سؤال', parent: '/questions' },
    '/questions/select-types': { name: 'اختيار نوع السؤال', parent: '/questions' },
    '/departments': { name: 'الدروس', parent: '/' },
    '/departments/create': { name: 'إنشاء درس', parent: '/departments' },
    '/profile': { name: 'الملف الشخصي', parent: '/' },
    '/auth/login': { name: 'تسجيل الدخول', parent: '/' },
    '/auth/register': { name: 'إنشاء حساب', parent: '/' },
    '/auth/forgot-password': { name: 'نسيت كلمة المرور', parent: '/auth/login' },
    '/admin/users': { name: 'إدارة المستخدمين', parent: '/' },
    '/admin/reports': { name: 'التقارير', parent: '/' },
    '/results-survey': { name: 'مسح النتائج', parent: '/' },
    '/static/about': { name: 'عن النظام', parent: '/' },
    '/static/contact': { name: 'اتصل بنا', parent: '/' },
    '/static/privacy-policy': { name: 'سياسة الخصوصية', parent: '/' },
    '/static/terms-of-service': { name: 'شروط الخدمة', parent: '/' }
};

/**
 * Generate breadcrumb trail for a given path
 * @param {string} currentPath - The current page path
 * @param {Object} options - Additional options like title, exam data, etc.
 * @returns {Array} Array of breadcrumb items
 */
function generateBreadcrumb(currentPath, options = {}) {
    const breadcrumb = [];
    
    // Always start with home
    breadcrumb.push({ name: 'الرئيسية', url: currentPath === '/' ? null : '/' });
    
    // Handle specific routes
    if (currentPath === '/') {
        // Home page - only show home
        return breadcrumb;
    }
    
    // Exams section
    else if (currentPath.startsWith('/exams')) {
        if (currentPath !== '/exams') {
            breadcrumb.push({ name: 'الاختبارات', url: '/exams' });
        }
        
        if (currentPath === '/exams') {
            breadcrumb.push({ name: 'الاختبارات', url: null });
        } else if (currentPath === '/exams/create') {
            breadcrumb.push({ name: 'إنشاء اختبار', url: null });
        } else if (currentPath === '/exams/my-exams') {
            breadcrumb.push({ name: 'اختباراتي', url: null });
        } else if (currentPath.includes('/edit')) {
            breadcrumb.push({ name: 'تعديل الاختبار', url: null });
        } else if (currentPath.includes('/attempt')) {
            breadcrumb.push({ name: 'أداء الاختبار', url: null });
        } else if (currentPath.includes('/results')) {
            breadcrumb.push({ name: 'نتائج الاختبار', url: null });
        } else if (currentPath.includes('/submissions')) {
            breadcrumb.push({ name: 'المشاريع المرسلة', url: null });
        } else {
            breadcrumb.push({ name: options.examTitle || 'تفاصيل الاختبار', url: null });
        }
    }
    
    // Questions section
    else if (currentPath.startsWith('/questions')) {
        if (currentPath !== '/questions') {
            breadcrumb.push({ name: 'بنك الأسئلة', url: '/questions' });
        }
        
        if (currentPath === '/questions') {
            breadcrumb.push({ name: 'بنك الأسئلة', url: null });
        } else if (currentPath === '/questions/create') {
            breadcrumb.push({ name: 'إنشاء سؤال', url: null });
        } else if (currentPath === '/questions/select-types') {
            breadcrumb.push({ name: 'اختيار نوع السؤال', url: null });
        } else if (currentPath.includes('/edit')) {
            breadcrumb.push({ name: 'تعديل السؤال', url: null });
        } else {
            breadcrumb.push({ name: options.questionTitle || 'تفاصيل السؤال', url: null });
        }
    }
    
    // Departments section
    else if (currentPath.startsWith('/departments')) {
        if (currentPath !== '/departments') {
            breadcrumb.push({ name: 'الدروس', url: '/departments' });
        }
        
        if (currentPath === '/departments') {
            breadcrumb.push({ name: 'الدروس', url: null });
        } else if (currentPath === '/departments/create') {
            breadcrumb.push({ name: 'إنشاء درس', url: null });
        } else if (currentPath.includes('/edit')) {
            breadcrumb.push({ name: 'تعديل الدرس', url: null });
        } else if (currentPath.includes('/exams')) {
            breadcrumb.push({ name: 'اختبارات الدرس', url: null });
        } else if (currentPath.includes('/materials')) {
            breadcrumb.push({ name: 'مواد الدرس', url: null });
        } else {
            breadcrumb.push({ name: options.departmentTitle || 'تفاصيل الدرس', url: null });
        }
    }
    
    // Admin sections
    else if (currentPath.startsWith('/admin/users')) {
        if (currentPath !== '/admin/users') {
            breadcrumb.push({ name: 'إدارة المستخدمين', url: '/admin/users' });
        }
        
        if (currentPath === '/admin/users') {
            breadcrumb.push({ name: 'إدارة المستخدمين', url: null });
        } else if (currentPath.includes('/students/')) {
            breadcrumb.push({ name: 'تقدم الطالب', url: null });
        }
    }
    
    else if (currentPath.startsWith('/admin/reports')) {
        breadcrumb.push({ name: 'التقارير', url: null });
    }
    
    // Other pages
    else if (currentPath === '/profile') {
        breadcrumb.push({ name: 'الملف الشخصي', url: null });
    }
    else if (currentPath === '/auth/login') {
        breadcrumb.push({ name: 'تسجيل الدخول', url: null });
    }
    else if (currentPath === '/auth/register') {
        breadcrumb.push({ name: 'إنشاء حساب', url: null });
    }
    else if (currentPath === '/auth/forgot-password') {
        breadcrumb.push({ name: 'تسجيل الدخول', url: '/auth/login' });
        breadcrumb.push({ name: 'نسيت كلمة المرور', url: null });
    }
    else if (currentPath === '/results-survey') {
        breadcrumb.push({ name: 'مسح النتائج', url: null });
    }
    else if (currentPath.startsWith('/static/')) {
        if (currentPath === '/static/about') {
            breadcrumb.push({ name: 'عن النظام', url: null });
        } else if (currentPath === '/static/contact') {
            breadcrumb.push({ name: 'اتصل بنا', url: null });
        } else if (currentPath === '/static/privacy-policy') {
            breadcrumb.push({ name: 'سياسة الخصوصية', url: null });
        } else if (currentPath === '/static/terms-of-service') {
            breadcrumb.push({ name: 'شروط الخدمة', url: null });
        }
    }
    
    return breadcrumb;
}

/**
 * Middleware to add breadcrumb to response locals
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function breadcrumbMiddleware(req, res, next) {
    const breadcrumb = generateBreadcrumb(req.path, {
        examTitle: res.locals.examTitle,
        questionTitle: res.locals.questionTitle,
        departmentTitle: res.locals.departmentTitle
    });
    
    res.locals.breadcrumb = breadcrumb;
    next();
}

module.exports = {
    generateBreadcrumb,
    breadcrumbMiddleware,
    breadcrumbConfig
}; 