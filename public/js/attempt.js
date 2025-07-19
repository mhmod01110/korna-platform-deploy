document.addEventListener('DOMContentLoaded', function() {
    const examForm = document.getElementById('examForm');
    const submitButton = document.getElementById('submitButton');
    const globalWarning = document.getElementById('globalWarning');
    const questionInputs = document.querySelectorAll('.question-input');
    const warningMessages = document.querySelectorAll('.unanswered-warning');
    const timerElement = document.getElementById('timer');
    
    let isValidating = false;
    let isTimeExpired = false; // Flag to track if time has expired

    // Get attempt data from window object set by EJS template
    const attemptId = window.attemptData ? window.attemptData.id : 'unknown';
    const endTime = window.attemptData ? new Date(parseInt(window.attemptData.endTime)).getTime() : Date.now();
    
    let timerInterval = null;

    function updateTimer() {
        const currentTime = new Date().getTime();
        const timeLeft = Math.floor((endTime - currentTime) / 1000); // Convert to seconds

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (timerElement) {
                timerElement.innerHTML = "00:00:00";
                timerElement.style.color = 'red';
            }
            disableAllInputs();
            
            // Set flag to indicate time has expired
            isTimeExpired = true;
            
            // Add hidden field to indicate time expiry
            const timeExpiredField = document.createElement('input');
            timeExpiredField.type = 'hidden';
            timeExpiredField.name = 'timeExpired';
            timeExpiredField.value = 'true';
            examForm.appendChild(timeExpiredField);
            
            // Clear auto-save data
            questionInputs.forEach(input => {
                localStorage.removeItem(`exam_${attemptId}_${input.name}`);
            });
            
            console.log('Time expired - submitting form directly');
            
            // Prevent multiple submissions if already submitted
            if (examForm.dataset.submitted === 'true') {
                console.log('Form already submitted, skipping');
                return;
            }
            
            // Mark form as submitted
            examForm.dataset.submitted = 'true';
            
            // Temporarily re-enable inputs to ensure they're included in form data
            const disabledInputs = [];
            questionInputs.forEach(input => {
                if (input.disabled) {
                    input.disabled = false;
                    disabledInputs.push(input);
                }
            });
            
            // Create a FormData object to ensure all form data is captured
            const formData = new FormData(examForm);
            
            // Re-disable inputs after collecting form data
            disabledInputs.forEach(input => {
                input.disabled = true;
            });
            
            // Add the timeExpired flag (only if not already present)
            if (!formData.has('timeExpired')) {
                formData.append('timeExpired', 'true');
            }
            
            // Debug: Log form submission
            console.log('Time expired - submitting form with answers');
            
            // Submit using fetch to ensure proper data transmission
            fetch(examForm.action, {
                method: 'POST',
                body: formData
            }).then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    window.location.reload();
                }
            }).catch(error => {
                console.error('Error submitting form:', error);
                // Fallback to regular form submission
                examForm.submit();
            });
            return;
        }

        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;

        // Warning colors and messages
        if (hours === 0) {
            if (minutes === 0) {
                if (timerElement) {
                    timerElement.style.color = '#dc3545'; // red color
                    if (seconds < 10) {
                        timerElement.style.fontWeight = 'bold';
                    }
                }
                if (seconds === 30) {
                    alert('Warning: Only 30 seconds remaining!');
                }
            } else if (minutes === 1) {
                if (timerElement) {
                    timerElement.style.color = '#ffc107'; // yellow color
                }
                if (seconds === 0) {
                    alert('Warning: Only 1 minute remaining!');
                }
            } else if (minutes === 5 && seconds === 0) {
                if (timerElement) {
                    timerElement.style.color = '#fd7e14'; // orange color
                }
                alert('Warning: 5 minutes remaining! Please complete your answers.');
            }
        }

        // Format time with leading zeros
        const formattedTime = 
            (hours < 10 ? "0" + hours : hours) + ":" +
            (minutes < 10 ? "0" + minutes : minutes) + ":" + 
            (seconds < 10 ? "0" + seconds : seconds);

        if (timerElement) {
            timerElement.innerHTML = formattedTime;
        }
    }

    function disableAllInputs() {
        questionInputs.forEach(input => {
            input.disabled = true;
        });
        if (submitButton) {
            submitButton.disabled = true;
        }
    }

    // Start the timer immediately
    updateTimer(); // Initial call
    timerInterval = setInterval(updateTimer, 1000);

    // Cleanup interval when page is unloaded
    window.addEventListener('beforeunload', function() {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
    });

    function isQuestionAnswered(input) {
        if (input.type === 'radio') {
            const name = input.name;
            const radioGroup = document.querySelectorAll(`input[name="${name}"]`);
            return Array.from(radioGroup).some(radio => radio.checked);
        } else if (input.tagName.toLowerCase() === 'textarea') {
            return input.value.trim().length > 0;
        }
        return false;
    }

    function highlightUnansweredQuestions() {
        const processedQuestions = new Set();
        let hasUnanswered = false;
        let firstUnanswered = null;

        questionInputs.forEach(input => {
            const questionIndex = input.dataset.questionIndex;
            const name = input.name;

            if (!processedQuestions.has(name)) {
                processedQuestions.add(name);
                
                const isAnswered = isQuestionAnswered(input);
                const warningElement = warningMessages[questionIndex];
                const questionCard = document.getElementById(`question-card-${questionIndex}`);
                
                if (!isAnswered) {
                    hasUnanswered = true;
                    if (!firstUnanswered) {
                        firstUnanswered = questionCard;
                    }
                    
                    if (warningElement) {
                        warningElement.classList.remove('d-none');
                    }
                    if (questionCard) {
                        questionCard.classList.add('question-unanswered');
                        questionCard.classList.add('warning-shake');
                        
                        setTimeout(() => {
                            questionCard.classList.remove('warning-shake');
                        }, 1000);
                    }
                } else {
                    if (warningElement) {
                        warningElement.classList.add('d-none');
                    }
                    if (questionCard) {
                        questionCard.classList.remove('question-unanswered');
                    }
                }
            }
        });

        if (hasUnanswered) {
            if (globalWarning) {
                globalWarning.classList.remove('d-none');
                globalWarning.classList.add('warning-shake');
                setTimeout(() => {
                    globalWarning.classList.remove('warning-shake');
                }, 1000);
            }
            
            if (firstUnanswered) {
                firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            if (globalWarning) {
                globalWarning.classList.add('d-none');
            }
        }
        
        if (submitButton) {
            submitButton.disabled = hasUnanswered;
        }
        return !hasUnanswered;
    }

    // Make functions globally available
    window.highlightUnansweredQuestions = highlightUnansweredQuestions;

    function validateForm(event) {
        if (event) {
            event.preventDefault();
        }
        
        // If time has expired, bypass validation and submit directly
        if (isTimeExpired) {
            console.log('Time expired - submitting without validation');
            // Clear auto-save data
            questionInputs.forEach(input => {
                localStorage.removeItem(`exam_${attemptId}_${input.name}`);
            });
            return true; // Allow submission
        }
        
        if (isValidating) {
            return false;
        }
        
        isValidating = true;
        const isValid = highlightUnansweredQuestions();
        
        if (isValid) {
            if (event) {
                const confirmSubmit = confirm('Are you sure you want to submit your exam?');
                if (confirmSubmit) {
                    questionInputs.forEach(input => {
                        localStorage.removeItem(`exam_${attemptId}_${input.name}`);
                    });
                    // Actually submit the form
                    examForm.dataset.submitted = 'true';
                    if (submitButton) {
                        submitButton.disabled = true;
                        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                    }
                    examForm.submit();
                    return false; // Prevent double submission
                } else {
                    isValidating = false;
                    return false; // Prevent submission
                }
            }
            return true; // Allow submission
        }
        
        isValidating = false;
        return false; // Prevent submission
    }

    // Make validateForm globally available
    window.validateForm = validateForm;

    // Auto-save functionality
    questionInputs.forEach(input => {
        const savedValue = localStorage.getItem(`exam_${attemptId}_${input.name}`);
        if (savedValue) {
            if (input.type === 'radio') {
                if (input.value === savedValue) {
                    input.checked = true;
                }
            } else {
                input.value = savedValue;
            }
        }

        input.addEventListener('change', function() {
            localStorage.setItem(`exam_${attemptId}_${input.name}`, input.value);
            highlightUnansweredQuestions();
        });

        if (input.tagName.toLowerCase() === 'textarea') {
            input.addEventListener('input', function() {
                localStorage.setItem(`exam_${attemptId}_${input.name}`, input.value);
                highlightUnansweredQuestions();
            });
        }
    });

    // Add form submission event listener
    examForm.addEventListener('submit', function(event) {
        // Prevent multiple submissions
        if (examForm.dataset.submitted === 'true') {
            event.preventDefault();
            return false;
        }
        
        const shouldSubmit = validateForm(event);
        if (shouldSubmit) {
            // Mark form as submitted to prevent multiple submissions
            examForm.dataset.submitted = 'true';
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            }
        } else {
            event.preventDefault();
            return false;
        }
    });
});