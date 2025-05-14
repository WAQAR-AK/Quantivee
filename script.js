// Firebase Configuration (ensure this is secure in production)
const firebaseConfig = {
    apiKey: "AIzaSyDZa8aP9WEkrKI09ymBuv0Osjg1sfkI_vI",
  authDomain: "quantive-e5b46.firebaseapp.com",
databaseURL:"https://quantive-e5b46-default-rtdb.firebaseio.com/" ,
  projectId: "quantive-e5b46",
  storageBucket: "quantive-e5b46.firebasestorage.app",
  messagingSenderId: "621471902499",
  appId: "1:621471902499:web:b142bfedcbeb2c78e13a96",
  measurementId: "G-979PVPQMQ5" // Replace
};

// Global Firebase service variables - will be initialized after DOM content is loaded
let database;
let auth;
let formsRef;

// --- Global State ---
let savedParameters = [];
let formQuestions = [];
let questionCounter = 0;

// Default parameters with icons
const defaultParametersConfig = [
    { name: "Educational Qualification", icon: "fa-user-graduate", color: "text-blue-500", percentage: 25 },
    { name: "Work Experience", icon: "fa-briefcase", color: "text-green-500", percentage: 25 },
    { name: "Communication Skill", icon: "fa-comments", color: "text-purple-500", percentage: 25 },
    { name: "Culture Fit", icon: "fa-users", color: "text-yellow-500", percentage: 25 }
];


// --- Utility Functions ---
function toggleModal(modalElement, show) {
    if (!modalElement) {
        // console.warn("Modal element not found for toggleModal. This might be expected if on a page without this modal.");
        return;
    }
    if (show) {
        modalElement.classList.remove('hidden');
        document.body.classList.add('body-blur');
    } else {
        modalElement.classList.add('hidden');
        const anyModalOpen = document.querySelector('.modal-overlay:not(.hidden)');
        if (!anyModalOpen) {
            document.body.classList.remove('body-blur');
        }
    }
}

// --- Parameter Selection Modal Functionality ---
function renderDefaultParameters() {
    const parameterListDiv = document.getElementById('parameter-list');
    if (!parameterListDiv) return;
    parameterListDiv.innerHTML = '';
    defaultParametersConfig.forEach(param => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'parameter-item';
        itemDiv.innerHTML = `
            <label class="flex items-center cursor-pointer w-full">
                <input type="checkbox" class="form-checkbox parameter-checkbox" data-parameter-name="${param.name}">
                <i class="fas ${param.icon} w-5 text-center ${param.color} ml-2 mr-1"></i>
                <span class="ml-2 flex-grow parameter-name-text">${param.name}</span>
            </label>
            <div class="flex items-center ml-auto shrink-0">
                <input type="number" class="parameter-percentage" value="${param.percentage}" min="0" max="100" disabled>
                <span class="ml-1 text-gray-500">%</span>
            </div>
        `;
        parameterListDiv.appendChild(itemDiv);
    });
}

function updateTotalPercentage() {
    const totalPercentageSpan = document.getElementById('total-percentage');
    const saveParametersBtn = document.getElementById('save-parameters-btn');
    if (!totalPercentageSpan || !saveParametersBtn) return;

    let total = 0;
    const parameterModal = document.getElementById('parameter-modal');
    if (!parameterModal) return;

    parameterModal.querySelectorAll('.parameter-item').forEach(item => {
        const checkbox = item.querySelector('.parameter-checkbox');
        const percentageInput = item.querySelector('.parameter-percentage');
        const percentage = parseInt(percentageInput.value) || 0;

        if (checkbox && checkbox.checked) {
            total += percentage;
            percentageInput.disabled = false;
            percentageInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
            percentageInput.classList.add('bg-white');
        } else if (checkbox && !checkbox.checked) {
            percentageInput.disabled = true;
            percentageInput.classList.add('bg-gray-100', 'cursor-not-allowed');
            percentageInput.classList.remove('bg-white');
        } else if (!checkbox) { // For custom parameters that are always "active" once added
            total += percentage;
            percentageInput.disabled = false;
        }
    });
    totalPercentageSpan.textContent = total;
    totalPercentageSpan.classList.toggle('text-red-600', total > 100);
    totalPercentageSpan.classList.toggle('text-green-600', total === 100 && total !== 0);
    totalPercentageSpan.classList.toggle('text-gray-700', total < 100 && total !== 0);
    saveParametersBtn.disabled = total > 100;
    saveParametersBtn.classList.toggle('opacity-50', total > 100);
    saveParametersBtn.classList.toggle('cursor-not-allowed', total > 100);
}

function addCustomParameterToDOM(name, percentage = 0, isChecked = true) {
    const customParameterListDiv = document.getElementById('custom-parameter-list');
    if (!customParameterListDiv) return;
    const customParamDiv = document.createElement('div');
    customParamDiv.className = 'parameter-item custom-parameter';
    customParamDiv.innerHTML = `
        <label class="flex items-center cursor-pointer w-full">
            <input type="checkbox" class="form-checkbox parameter-checkbox" data-parameter-name="${name}" ${isChecked ? 'checked' : ''}>
            <i class="fas fa-star w-5 text-center text-orange-400 ml-2 mr-1"></i>
            <span class="ml-2 flex-grow parameter-name-text">${name}</span>
        </label>
        <div class="flex items-center ml-auto shrink-0">
            <input type="number" class="parameter-percentage" value="${percentage}" min="0" max="100" ${!isChecked ? 'disabled class="bg-gray-100 cursor-not-allowed"' : 'class="bg-white"'}>
            <span class="ml-1 text-gray-500">%</span>
        </div>
        <button class="remove-custom-param-btn ml-2 text-red-500 hover:text-red-700 text-lg leading-none p-1" title="Remove parameter">&times;</button>
    `;
    customParameterListDiv.prepend(customParamDiv);

    customParamDiv.querySelector('.remove-custom-param-btn').addEventListener('click', function() {
        customParamDiv.remove();
        updateTotalPercentage();
    });
    customParamDiv.querySelector('.parameter-checkbox').addEventListener('change', updateTotalPercentage);
    customParamDiv.querySelector('.parameter-percentage').addEventListener('input', updateTotalPercentage);
    if (!isChecked) {
        const percentageInput = customParamDiv.querySelector('.parameter-percentage');
        if (percentageInput) {
            percentageInput.classList.add('bg-gray-100', 'cursor-not-allowed');
            percentageInput.classList.remove('bg-white');
        }
    }
    updateTotalPercentage();
}


// --- Form Editor Functionality ---
function renderQuestion(question, index) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'editable-question bg-white p-4 rounded-lg shadow mb-4';
    questionDiv.dataset.questionId = question.id;

    const isFirst = index === 0;
    const isLast = index === formQuestions.length - 1;

    questionDiv.innerHTML = `
        <div class="question-header flex flex-wrap items-center justify-between mb-3">
            <input type="text" class="question-text-input flex-grow p-2 border border-gray-300 rounded-md mr-3 mb-2 sm:mb-0 form-input" value="${question.text}" placeholder="Enter your question">
            <select class="question-type-select p-2 border border-gray-300 rounded-md bg-white mb-2 sm:mb-0 form-select">
                <option value="text" ${question.type === 'text' ? 'selected' : ''}>Short Text</option>
                <option value="textarea" ${question.type === 'textarea' ? 'selected' : ''}>Paragraph</option>
                <option value="number" ${question.type === 'number' ? 'selected' : ''}>Number</option>
                <option value="email" ${question.type === 'email' ? 'selected' : ''}>Email</option>
                <option value="date" ${question.type === 'date' ? 'selected' : ''}>Date</option>
                <option value="file" ${question.type === 'file' ? 'selected' : ''}>File Upload</option>
                <option value="radio" ${question.type === 'radio' ? 'selected' : ''}>Multiple Choice</option>
                <option value="checkbox" ${question.type === 'checkbox' ? 'selected' : ''}>Checkboxes</option>
            </select>
            <div class="flex items-center ml-auto sm:ml-3 question-actions">
                <button class="move-question-up-btn text-gray-500 hover:text-blue-500 p-1 ${isFirst ? 'opacity-50 cursor-not-allowed' : ''}" title="Move Up" ${isFirst ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="move-question-down-btn text-gray-500 hover:text-blue-500 p-1 ${isLast ? 'opacity-50 cursor-not-allowed' : ''}" title="Move Down" ${isLast ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="delete-btn text-red-500 hover:text-red-700 p-1 text-xl" title="Delete Question">&times;</button>
            </div>
        </div>
        <div class="options-area mt-2"></div>
        <div class="mt-3">
            <label class="inline-flex items-center cursor-pointer">
                <input type="checkbox" class="question-required-checkbox form-checkbox h-5 w-5 text-indigo-600" ${question.required ? 'checked' : ''}>
                <span class="ml-2 text-sm text-gray-700">Required</span>
            </label>
        </div>
    `;

    questionDiv.querySelector('.question-text-input').addEventListener('input', (e) => updateFormQuestion(question.id, 'text', e.target.value));
    questionDiv.querySelector('.question-type-select').addEventListener('change', (e) => {
        updateFormQuestion(question.id, 'type', e.target.value);
        updateFormQuestion(question.id, 'options', []);
        const optionsArea = questionDiv.querySelector('.options-area');
        const currentQuestion = formQuestions.find(q => q.id === question.id);
        if (optionsArea && currentQuestion) {
            renderOptionsArea(optionsArea, currentQuestion);
        }
    });
    questionDiv.querySelector('.delete-btn').addEventListener('click', () => {
        formQuestions = formQuestions.filter(q => q.id !== question.id);
        rerenderAllQuestions();
    });
    questionDiv.querySelector('.question-required-checkbox').addEventListener('change', (e) => updateFormQuestion(question.id, 'required', e.target.checked));
    questionDiv.querySelector('.move-question-up-btn').addEventListener('click', () => moveQuestion(question.id, 'up'));
    questionDiv.querySelector('.move-question-down-btn').addEventListener('click', () => moveQuestion(question.id, 'down'));

    const optionsArea = questionDiv.querySelector('.options-area');
    if (optionsArea) {
        renderOptionsArea(optionsArea, question);
    }
    return questionDiv;
}

function rerenderAllQuestions() {
    const manualQuestionsArea = document.getElementById('manual-questions-area');
    if (!manualQuestionsArea) return;
    manualQuestionsArea.innerHTML = '';
    formQuestions.forEach((q, index) => {
        const questionElement = renderQuestion(q, index);
        manualQuestionsArea.appendChild(questionElement);
    });
    updateNoQuestionsPlaceholder();
}

function moveQuestion(questionId, direction) {
    const index = formQuestions.findIndex(q => q.id === questionId);
    if (index === -1) return;
    if (direction === 'up' && index > 0) {
        [formQuestions[index - 1], formQuestions[index]] = [formQuestions[index], formQuestions[index - 1]];
    } else if (direction === 'down' && index < formQuestions.length - 1) {
        [formQuestions[index + 1], formQuestions[index]] = [formQuestions[index], formQuestions[index + 1]];
    }
    rerenderAllQuestions();
}

function updateFormQuestion(id, key, value) {
    const qIndex = formQuestions.findIndex(q => q.id === id);
    if (qIndex !== -1) {
        formQuestions[qIndex][key] = value;
    }
}

function renderOptionsArea(optionsAreaElement, question) {
    if (!optionsAreaElement) return;
    optionsAreaElement.innerHTML = '';
    if (['radio', 'checkbox'].includes(question.type)) {
        const optionsListDiv = document.createElement('div');
        optionsListDiv.className = 'options-list space-y-2';
        (question.options || []).forEach((optionText, index) => {
            renderOptionItem(optionsListDiv, question, optionText, index);
        });
        optionsAreaElement.appendChild(optionsListDiv);
        const addOptionBtnElement = document.createElement('button');
        addOptionBtnElement.className = 'add-option-btn mt-2 text-sm bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded shadow-sm';
        addOptionBtnElement.innerHTML = '<i class="fas fa-plus text-xs mr-1"></i> Add Option';
        addOptionBtnElement.addEventListener('click', () => {
            if (!question.options) question.options = [];
            question.options.push('');
            renderOptionItem(optionsListDiv, question, '', question.options.length - 1);
        });
        optionsAreaElement.appendChild(addOptionBtnElement);
    }
}

function renderOptionItem(optionsListDiv, question, optionText, optionIndex) {
    const optionItemDiv = document.createElement('div');
    optionItemDiv.className = 'option-item flex items-center';
    optionItemDiv.innerHTML = `
        <input type="text" class="option-text-input flex-grow p-1.5 border border-gray-300 rounded-md text-sm form-input" value="${optionText}" placeholder="Option ${optionIndex + 1}">
        <button class="delete-option-btn text-red-500 hover:text-red-700 ml-2 text-lg p-1 leading-none" title="Delete Option">&times;</button>
    `;
    optionsListDiv.appendChild(optionItemDiv);
    optionItemDiv.querySelector('.option-text-input').addEventListener('input', (e) => {
        question.options[optionIndex] = e.target.value;
    });
    optionItemDiv.querySelector('.delete-option-btn').addEventListener('click', () => {
        question.options.splice(optionIndex, 1);
        if (optionsListDiv.parentElement) {
            renderOptionsArea(optionsListDiv.parentElement, question);
        }
    });
}

function updateNoQuestionsPlaceholder() {
    const noQuestionsPlaceholder = document.getElementById('no-questions-placeholder');
    if (noQuestionsPlaceholder) noQuestionsPlaceholder.classList.toggle('hidden', formQuestions.length > 0);
}


function renderSuggestedQuestion(suggestion) {
    const aiSuggestedQuestionsArea = document.getElementById('ai-suggested-questions');
    const aiPlaceholder = document.getElementById('ai-placeholder');
    if (!suggestion.text || !suggestion.type || !aiSuggestedQuestionsArea) return;

    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'ai-suggested-question';
    let optionsPreviewHTML = '';
    if (suggestion.options && suggestion.options.length > 0 && (suggestion.type === 'radio' || suggestion.type === 'checkbox')) {
        optionsPreviewHTML = `<ul class="list-disc list-inside text-xs text-gray-600 mt-1 pl-4 options-preview">`;
        suggestion.options.forEach(opt => optionsPreviewHTML += `<li>${opt}</li>`);
        optionsPreviewHTML += `</ul>`;
    }
    suggestionDiv.innerHTML = `
        <div class="question-content">
            <div class="question-text">${suggestion.text}</div>
            <div class="question-type-label">Type: ${suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}</div>
            ${optionsPreviewHTML}
        </div>
        <div class="action-buttons">
            <button class="accept-btn"><i class="fas fa-check mr-1"></i>Accept</button>
            <button class="reject-btn"><i class="fas fa-times mr-1"></i>Reject</button>
        </div>
    `;
    suggestionDiv.querySelector('.accept-btn').addEventListener('click', () => {
        questionCounter++;
        const acceptedQuestion = {
            id: `qAI${Date.now()}${questionCounter}`,
            text: suggestion.text, type: suggestion.type,
            options: suggestion.options || [], required: false
        };
        formQuestions.push(acceptedQuestion);
        rerenderAllQuestions();
        suggestionDiv.remove();
        if (aiSuggestedQuestionsArea.children.length === 0 && aiPlaceholder && !aiPlaceholder.classList.contains('hidden')) {
            aiPlaceholder.textContent = 'All suggestions handled.';
        } else if (aiSuggestedQuestionsArea.children.length === 0 && aiPlaceholder) {
            aiPlaceholder.textContent = 'No AI suggestions remaining.';
            aiPlaceholder.classList.remove('hidden');
        }
    });
    suggestionDiv.querySelector('.reject-btn').addEventListener('click', () => {
        suggestionDiv.remove();
        if (aiSuggestedQuestionsArea.children.length === 0 && aiPlaceholder && !aiPlaceholder.classList.contains('hidden')) {
             aiPlaceholder.textContent = 'All suggestions handled.';
        } else if (aiSuggestedQuestionsArea.children.length === 0 && aiPlaceholder) {
            aiPlaceholder.textContent = 'No AI suggestions remaining.';
            aiPlaceholder.classList.remove('hidden');
        }
    });
    aiSuggestedQuestionsArea.appendChild(suggestionDiv);
    if(aiPlaceholder) aiPlaceholder.classList.add('hidden');
}

function buildFormPreview() {
    const previewFormTitleDiv = document.getElementById('preview-form-title');
    const previewFormDescriptionDiv = document.getElementById('preview-form-description');
    const previewFormQuestionsDiv = document.getElementById('preview-form-questions');
    const formTitleInput = document.getElementById('form-title');
    const specialInstructionsInput = document.getElementById('special-instructions');


    if(!previewFormTitleDiv || !previewFormDescriptionDiv || !previewFormQuestionsDiv || !formTitleInput || !specialInstructionsInput) return;

    previewFormTitleDiv.textContent = formTitleInput.value.trim() || 'Untitled Form';
    previewFormDescriptionDiv.textContent = specialInstructionsInput.value.trim();
    previewFormQuestionsDiv.innerHTML = '';

    if (formQuestions.length === 0) {
        previewFormQuestionsDiv.innerHTML = '<p class="text-gray-500 italic text-center">No questions added.</p>';
        return;
    }
    formQuestions.forEach((q) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'preview-question';
        let requiredIndicator = q.required ? '<span class="required-asterisk">*</span>' : '';
        let inputHTML = '';
        if (['text', 'textarea', 'number', 'email', 'date'].includes(q.type)) {
            const Tag = q.type === 'textarea' ? 'textarea' : 'input';
            inputHTML = `<${Tag} type="${q.type === 'textarea' ? '' : q.type}" class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm form-input" placeholder="Answer here" disabled></${Tag}>`;
        } else if (q.type === 'file') {
            inputHTML = `<input type="file" class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 form-input" disabled>`;
        } else if (['radio', 'checkbox'].includes(q.type) && q.options && q.options.length > 0) {
            inputHTML = '<div class="options mt-2 space-y-1">';
            q.options.forEach((opt, i) => {
                inputHTML += `<label class="flex items-center text-sm text-gray-600"><input type="${q.type}" name="preview-${q.id}" class="form-${q.type} h-4 w-4 text-indigo-600 border-gray-300 mr-2" disabled> ${opt || `Option ${i+1}`}</label>`;
            });
            inputHTML += '</div>';
        }
        questionDiv.innerHTML = `<label class="block text-sm font-medium text-gray-700 mb-1 question-title">${q.text || 'Untitled'} ${requiredIndicator}</label>${inputHTML}`;
        previewFormQuestionsDiv.appendChild(questionDiv);
    });
}


// --- Login/Signup Modal Functionality ---
function signInWithGoogle() {
    if (!auth) {
        console.error("Firebase Auth not initialized for Google Sign-In.");
        alert("Authentication service is not ready. Please try again in a moment.");
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("Signed in with Google:", user);
            // alert(`Welcome, ${user.displayName || user.email}!`); // Optional: remove alert
            const authModal = document.getElementById('auth-modal');
            if (authModal) toggleModal(authModal, false);
            updateLoginStateUI(user);
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        }).catch((error) => {
            console.error("Google Sign-In Error:", error.message, "Code:", error.code);
            alert(`Google Sign-In Error: ${error.message}`);
        });
};

const loginFormHTML = `
    <h3 class="text-xl font-bold text-gray-800 mb-6 text-center" id="auth-modal-title-text">Login</h3>
    <form id="login-form-actual">
        <div class="mb-4">
            <label for="email-login" class="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" id="email-login" name="email-login" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm form-input" required>
        </div>
        <div class="mb-6">
            <label for="password-login" class="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" id="password-login" name="password-login" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm form-input" required>
        </div>
        <button type="submit" class="w-full action-button bg-indigo-600 hover:bg-indigo-700 text-white font-bold">Login with Email</button>
    </form>
    <div class="my-4 flex items-center before:flex-1 before:border-t before:border-gray-300 before:mt-0.5 after:flex-1 after:border-t after:border-gray-300 after:mt-0.5">
        <p class="text-center font-semibold mx-4 mb-0">OR</p>
    </div>
    <button id="google-signin-btn" class="w-full action-button bg-red-500 hover:bg-red-600 text-white font-bold mb-3"><i class="fab fa-google mr-2"></i>Sign in with Google</button>
    <p class="mt-4 text-center text-sm">Don't have an account? <button id="show-signup-form-btn" class="font-medium text-indigo-600 hover:text-indigo-500">Sign up</button></p>
`;

const signupFormHTML = `
    <h3 class="text-xl font-bold text-gray-800 mb-6 text-center" id="auth-modal-title-text">Sign Up</h3>
    <form id="signup-form-actual">
        <div class="mb-4">
            <label for="email-signup" class="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" id="email-signup" name="email-signup" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm form-input" required>
        </div>
        <div class="mb-4">
            <label for="password-signup" class="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" id="password-signup" name="password-signup" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm form-input" required>
        </div>
         <div class="mb-6">
            <label for="confirm-password-signup" class="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input type="password" id="confirm-password-signup" name="confirm-password-signup" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm form-input" required>
        </div>
        <button type="submit" class="w-full action-button bg-green-500 hover:bg-green-600 text-white font-bold">Sign Up with Email</button>
    </form>
    <div class="my-4 flex items-center before:flex-1 before:border-t before:border-gray-300 before:mt-0.5 after:flex-1 after:border-t after:border-gray-300 after:mt-0.5">
        <p class="text-center font-semibold mx-4 mb-0">OR</p>
    </div>
    <button id="google-signup-btn" class="w-full action-button bg-red-500 hover:bg-red-600 text-white font-bold mb-3"><i class="fab fa-google mr-2"></i>Sign up with Google</button>
    <p class="mt-4 text-center text-sm">Already have an account? <button id="show-login-form-btn" class="font-medium text-indigo-600 hover:text-indigo-500">Login</button></p>
`;

function loadAuthForm(type) {
    const authModalBody = document.getElementById('auth-modal-body');
    const authModal = document.getElementById('auth-modal');
    if (!authModalBody || !auth) {
        console.error("Auth modal body or Firebase auth service not available.");
        // Attempt to show an error inside the modal body if it exists
        if(authModalBody) authModalBody.innerHTML = '<p class="text-red-500 text-center">Authentication service failed to load. Please refresh.</p>';
        return;
    }


    authModalBody.innerHTML = type === 'login' ? loginFormHTML : signupFormHTML;

    if (type === 'login') {
        const showSignupBtn = authModalBody.querySelector('#show-signup-form-btn');
        const loginForm = authModalBody.querySelector('#login-form-actual');
        const googleSigninBtn = authModalBody.querySelector('#google-signin-btn');

        if(showSignupBtn) showSignupBtn.addEventListener('click', () => loadAuthForm('signup'));
        if(loginForm) loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = e.target['email-login'].value;
            const password = e.target['password-login'].value;
            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    // alert('Logged in successfully!'); // Optional: remove alert
                    if (authModal) toggleModal(authModal, false);
                    updateLoginStateUI(userCredential.user);
                    // Redirect to dashboard
                    window.location.href = 'dashboard.html';
                })
                .catch(error => alert(`Login Error: ${error.message}`));
        });
        if(googleSigninBtn) googleSigninBtn.addEventListener('click', signInWithGoogle);

    } else { // signup
        const showLoginBtn = authModalBody.querySelector('#show-login-form-btn');
        const signupForm = authModalBody.querySelector('#signup-form-actual');
        const googleSignupBtn = authModalBody.querySelector('#google-signup-btn');

        if(showLoginBtn) showLoginBtn.addEventListener('click', () => loadAuthForm('login'));
        if(signupForm) signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = e.target['email-signup'].value;
            const password = e.target['password-signup'].value;
            const confirmPassword = e.target['confirm-password-signup'].value;
            if (password !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    // alert('Signed up successfully! Please check your email for verification if applicable.'); // Optional: remove alert
                    if (authModal) toggleModal(authModal, false);
                    updateLoginStateUI(userCredential.user);
                    // Redirect to dashboard
                     window.location.href = 'dashboard.html';
                })
                .catch(error => alert(`Signup Error: ${error.message}`));
        });
        if(googleSignupBtn) googleSignupBtn.addEventListener('click', signInWithGoogle); // Use same Google sign-in for signup
    }
}

function updateLoginStateUI(user) {
    const loginHeaderBtn = document.getElementById('login-header-btn');
    const signupHeaderBtn = document.getElementById('signup-header-btn');
    const userDisplay = document.getElementById('user-display');
    const myFormsLink = document.getElementById('my-forms-link');
    const logoutBtn = document.getElementById('logout-btn');

    // Debugging: Log elements to ensure they are found
    // console.log("UI Update Elements:", { loginHeaderBtn, signupHeaderBtn, userDisplay, myFormsLink, logoutBtn });


    if (user) {
        // console.log("Updating UI for logged-in user:", user.email);
        if(loginHeaderBtn) loginHeaderBtn.classList.add('hidden');
        if(signupHeaderBtn) signupHeaderBtn.classList.add('hidden');
        if(userDisplay) {
            userDisplay.textContent = user.displayName || user.email; // Show user info
            userDisplay.classList.remove('hidden');
        }
        if(myFormsLink) myFormsLink.classList.remove('hidden'); // Show "My Dashboard" link
        if (logoutBtn) {
            logoutBtn.classList.remove('hidden'); // Show logout button
            const newLogoutBtn = logoutBtn.cloneNode(true); // Clone to ensure fresh listeners
            if (logoutBtn.parentNode) {
                 logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            }
            newLogoutBtn.addEventListener('click', () => {
                if (auth) {
                    auth.signOut().then(() => {
                        // console.log('Logged out.'); // Optional: remove alert
                        updateLoginStateUI(null); // Update UI for logged out state
                        window.location.href = '/'; // Redirect to home page after logout
                    }).catch(error => console.error('Logout error', error));
                }
            });
        }
    } else {
        // console.log("Updating UI for logged-out user");
        if(loginHeaderBtn) loginHeaderBtn.classList.remove('hidden');
        if(signupHeaderBtn) signupHeaderBtn.classList.remove('hidden');
        if(userDisplay) {
             userDisplay.textContent = ''; // Clear user info
             userDisplay.classList.add('hidden');
        }
        if(myFormsLink) myFormsLink.classList.add('hidden'); // Hide "My Dashboard" link
        if (logoutBtn) logoutBtn.classList.add('hidden'); // Hide logout button
    }
}


// --- Event Listener Setup Function ---
function initializeEventListeners() {
    // Smooth Scrolling
    document.querySelectorAll('a.smooth-scroll-link[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            try {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (error) {
                console.error("Smooth scroll error:", targetId, error);
            }
        });
    });

    // Parameter Modal
    const selectParametersBtn = document.getElementById('select-parameters-btn');
    const parameterModalEl = document.getElementById('parameter-modal');
    const closeModalBtnEl = document.getElementById('close-modal-btn');
    const addCustomParameterBtn = document.getElementById('add-custom-parameter-btn');
    const saveParametersBtn = document.getElementById('save-parameters-btn');
    const customParameterListDiv = document.getElementById('custom-parameter-list');
    const parameterListDiv = document.getElementById('parameter-list');


    if (selectParametersBtn && parameterModalEl) {
        selectParametersBtn.addEventListener('click', () => {
            renderDefaultParameters(); // Render defaults first
            if (customParameterListDiv) customParameterListDiv.innerHTML = ''; // Clear custom

             // Apply saved parameters AFTER defaults are rendered
             const currentDefaultParamNames = defaultParametersConfig.map(dp => dp.name);
             savedParameters.forEach(sp => {
                 const isDefault = currentDefaultParamNames.includes(sp.name);
                 if (isDefault) {
                     if (parameterListDiv) { // Check if parameterListDiv exists
                         const defaultItemCheckbox = parameterListDiv.querySelector(`input[data-parameter-name="${sp.name}"]`);
                         const defaultItemPercentageInput = defaultItemCheckbox ? defaultItemCheckbox.closest('.parameter-item').querySelector('.parameter-percentage') : null;
                         if (defaultItemCheckbox) defaultItemCheckbox.checked = true; // Check the box
                         if (defaultItemPercentageInput) {
                              defaultItemPercentageInput.value = sp.percentage; // Set the percentage
                              // defaultItemPercentageInput.disabled = false; // Enable if checked (updateTotalPercentage handles this)
                         }
                     }
                 } else {
                     addCustomParameterToDOM(sp.name, sp.percentage, true); // Add custom param as checked
                 }
             });

            updateTotalPercentage(); // Update visuals based on loaded/checked state
            toggleModal(parameterModalEl, true);
        });
    }
    if (closeModalBtnEl && parameterModalEl) closeModalBtnEl.addEventListener('click', () => toggleModal(parameterModalEl, false));
    if (parameterModalEl) {
        parameterModalEl.addEventListener('click', (e) => {
            if (e.target === parameterModalEl) toggleModal(parameterModalEl, false);
        });
        parameterModalEl.addEventListener('input', (e) => {
            if (e.target.classList.contains('parameter-percentage')) updateTotalPercentage();
        });
        parameterModalEl.addEventListener('change', (e) => {
            if (e.target.classList.contains('parameter-checkbox')) updateTotalPercentage();
        });
    }
    if (addCustomParameterBtn) {
        addCustomParameterBtn.addEventListener('click', () => {
            const customParameterNameInput = document.getElementById('custom-parameter-name');
            if (!customParameterNameInput) return;
            const paramName = customParameterNameInput.value.trim();
            if (paramName) {
                // Check if parameter (default or custom) already exists
                const existingParams = Array.from(document.querySelectorAll('#parameter-modal .parameter-name-text'))
                                          .map(el => el.textContent.trim().toLowerCase());
                if (existingParams.includes(paramName.toLowerCase())) {
                    alert(`Parameter "${paramName}" already exists.`);
                    return;
                }
                addCustomParameterToDOM(paramName, 10, true); // Add as checked with 10% default
                customParameterNameInput.value = '';
            }
        });
    }
    if (saveParametersBtn) {
        saveParametersBtn.addEventListener('click', () => {
            const totalPercentageSpan = document.getElementById('total-percentage');
            if (!totalPercentageSpan) return;
            const total = parseInt(totalPercentageSpan.textContent);
            if (total > 100) {
                alert('Total percentage exceeds 100%. Please adjust.');
                return;
            }
            savedParameters = []; // Reset saved parameters
            const parameterModalForSave = document.getElementById('parameter-modal'); // Get it fresh
            if (parameterModalForSave) {
                parameterModalForSave.querySelectorAll('.parameter-item').forEach(item => {
                    const checkbox = item.querySelector('.parameter-checkbox');
                    const percentageInput = item.querySelector('.parameter-percentage');
                    const paramNameElement = item.querySelector('.parameter-name-text');

                     // Ensure all elements exist before accessing properties
                    if (checkbox && percentageInput && paramNameElement) {
                         const paramName = paramNameElement.textContent.trim();
                         const percentage = parseInt(percentageInput.value) || 0;
                         // Only save if the checkbox is checked AND percentage is > 0
                         if (checkbox.checked && percentage > 0) {
                             savedParameters.push({ name: paramName, percentage: percentage });
                         }
                    }
                });
            }
            console.log('Saved Parameters:', savedParameters);
            alert('AI Priorities saved!');
            if (parameterModalEl) toggleModal(parameterModalEl, false);
        });
    }

    // Form Editor
    const addQuestionBtn = document.getElementById('add-question-btn');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => {
            questionCounter++;
            const newQuestion = { id: `qManual${Date.now()}${questionCounter}`, text: '', type: 'text', options: [], required: false };
            formQuestions.push(newQuestion);
            rerenderAllQuestions();
        });
    }

    // AI Question Generation
    const generateQuestionsBtn = document.getElementById('generate-questions-btn');
    const aiSuggestedQuestionsArea = document.getElementById('ai-suggested-questions');
    const aiPlaceholder = document.getElementById('ai-placeholder');

    if (generateQuestionsBtn) {
        generateQuestionsBtn.addEventListener('click', async () => {
            const formTitleInput = document.getElementById('form-title');
            const specialInstructionsInput = document.getElementById('special-instructions');
            if (!formTitleInput || !specialInstructionsInput) return;

            const formTitle = formTitleInput.value.trim();
            const specialInstructions = specialInstructionsInput.value.trim();

            if (!formTitle) {
                alert('Please enter a form title.');
                return;
            }
            if (savedParameters.length === 0) {
                if (!confirm("No AI priorities set. Generate general questions based on title and description?")) return;
            }
            generateQuestionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
            generateQuestionsBtn.disabled = true;
            if(aiSuggestedQuestionsArea) aiSuggestedQuestionsArea.innerHTML = '';
            if(aiPlaceholder) {
                aiPlaceholder.textContent = 'AI is thinking...';
                aiPlaceholder.classList.remove('hidden', 'text-red-500');
            }
            try {
                 // Use fetch to call the backend endpoint
                const response = await fetch('/api/generate-ai-questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                     // Send necessary data to the backend
                    body: JSON.stringify({
                        title: formTitle,
                        instructions: specialInstructions,
                        parameters: savedParameters,
                         // numQuestions: 5 // Can be added if you want to specify a number
                    }),
                });

                 if (!response.ok) {
                     // Try to parse error JSON from backend, fallback to status text
                     let errorMsg = `Server error: ${response.status} ${response.statusText}`;
                     try {
                         const errorData = await response.json();
                         errorMsg = errorData.error || JSON.stringify(errorData);
                     } catch (e) { /* Ignore parsing error, use status text */ }
                     throw new Error(errorMsg);
                 }

                const generatedQuestions = await response.json();

                if(aiPlaceholder) aiPlaceholder.classList.add('hidden'); // Hide placeholder on success

                 if (generatedQuestions && Array.isArray(generatedQuestions) && generatedQuestions.length > 0) {
                    generatedQuestions.forEach(renderSuggestedQuestion);
                 } else if (generatedQuestions && generatedQuestions.error) {
                      // Handle specific error format from backend if needed
                      throw new Error(generatedQuestions.error);
                 } else {
                     if(aiPlaceholder) {
                         aiPlaceholder.textContent = 'AI returned no suggestions or an unexpected format.';
                         aiPlaceholder.classList.remove('hidden');
                     }
                 }

            } catch (error) {
                console.error('Error generating AI questions:', error);
                if(aiPlaceholder) {
                    aiPlaceholder.textContent = `Error: ${error.message}`;
                    aiPlaceholder.classList.remove('hidden');
                    aiPlaceholder.classList.add('text-red-500');
                } else {
                     // Fallback alert if placeholder doesn't exist
                     alert(`Error generating AI questions: ${error.message}`);
                }
            } finally {
                generateQuestionsBtn.innerHTML = '<i class="fas fa-magic-sparkles mr-2"></i>Generate Questions (AI)';
                generateQuestionsBtn.disabled = false;
            }
        });
    }


    // Preview Modal
    const previewFormBtn = document.getElementById('preview-form-btn');
    const previewModalEl = document.getElementById('preview-modal');
    const closePreviewModalBtnEl = document.getElementById('close-preview-modal-btn');

    if (previewFormBtn && previewModalEl) {
        previewFormBtn.addEventListener('click', () => {
            buildFormPreview();
            toggleModal(previewModalEl, true);
        });
    }
    if (closePreviewModalBtnEl && previewModalEl) closePreviewModalBtnEl.addEventListener('click', () => toggleModal(previewModalEl, false));
    if (previewModalEl) {
        previewModalEl.addEventListener('click', (e) => {
            if (e.target === previewModalEl) toggleModal(previewModalEl, false);
        });
    }

    // Publish Form
    const publishFormBtn = document.getElementById('publish-form-btn');
    if (publishFormBtn) { // Removed formsRef check, rely on initialization later
        publishFormBtn.addEventListener('click', () => {
            // Check if formsRef is initialized before publishing
             if (!formsRef) {
                 alert("Database connection not ready. Please wait a moment and try again.");
                 console.error("Attempted to publish form before formsRef was initialized.");
                 return;
             }

            const formTitleInput = document.getElementById('form-title');
            const specialInstructionsInput = document.getElementById('special-instructions');
            if (!formTitleInput || !specialInstructionsInput) return;

            const formTitle = formTitleInput.value.trim();
            if (!formTitle) {
                alert('Please enter a form title.');
                return;
            }
            if (formQuestions.length === 0) {
                alert('Please add at least one question.');
                return;
            }
            // Add user ID to form structure if user is logged in
            const userId = auth && auth.currentUser ? auth.currentUser.uid : null;

            const formStructure = {
                title: formTitle,
                description: specialInstructionsInput.value.trim(),
                questions: formQuestions,
                createdAt: firebase.database.ServerValue.TIMESTAMP, // Ensure firebase.database is available
                userId: userId // Store the user ID with the form
            };

            console.log("Publishing form structure:", formStructure); // Log before push


            formsRef.push(formStructure)
                .then((snapshot) => {
                    const formId = snapshot.key;
                    console.log("Form published with ID:", formId); // Log success
                    alert('Form published successfully!');
                    const domain = window.location.origin;
                    const respondersLinkOpenBtn = document.getElementById('responders-link-open-btn');
                    const respondersLinkCopyBtn = document.getElementById('responders-link-copy-btn');
                    const responsesLinkBtn = document.getElementById('responses-link-btn');
                    const formActionButtonsDiv = document.getElementById('form-action-buttons');
                    const publishedFormLinksDiv = document.getElementById('published-form-links');

                    if(respondersLinkOpenBtn) respondersLinkOpenBtn.href = `${domain}/form.html?formId=${formId}`;
                    if(respondersLinkCopyBtn) respondersLinkCopyBtn.dataset.linkToCopy = `${domain}/form.html?formId=${formId}`;
                    if(responsesLinkBtn) responsesLinkBtn.href = `${domain}/results.html?formId=${formId}`;
                    if(formActionButtonsDiv) formActionButtonsDiv.classList.add('hidden');
                    if(publishedFormLinksDiv) publishedFormLinksDiv.classList.remove('hidden');
                })
                .catch(error => {
                     console.error("Failed to publish form:", error); // Log error
                     alert(`Failed to publish: ${error.message}`);
                });
        });
    } else {
        // console.log("Publish button not found."); // Debugging
    }


    // Copy Link
    const respondersLinkCopyBtn = document.getElementById('responders-link-copy-btn');
    const copyFeedbackSpan = document.getElementById('copy-feedback');
    if (respondersLinkCopyBtn) {
        respondersLinkCopyBtn.addEventListener('click', function() {
            const link = this.dataset.linkToCopy;
            if (link) {
                navigator.clipboard.writeText(link).then(() => {
                    if(copyFeedbackSpan) {
                        copyFeedbackSpan.textContent = 'Link copied!';
                        copyFeedbackSpan.className = 'text-sm text-green-600 mt-2 block';
                        setTimeout(() => { copyFeedbackSpan.className = 'hidden'; }, 3000);
                    }
                }).catch(err => {
                    if(copyFeedbackSpan) {
                        copyFeedbackSpan.textContent = 'Failed to copy.';
                        copyFeedbackSpan.className = 'text-sm text-red-600 mt-2 block';
                        setTimeout(() => { copyFeedbackSpan.className = 'hidden'; }, 3000);
                    }
                    console.error('Failed to copy: ', err);
                });
            }
        });
    }
    const respondersLinkOpenBtn = document.getElementById('responders-link-open-btn');
    const responsesLinkBtn = document.getElementById('responses-link-btn');
    if (respondersLinkOpenBtn) respondersLinkOpenBtn.target = "_blank";
    if (responsesLinkBtn) responsesLinkBtn.target = "_blank";


    // Auth Modals
    const loginHeaderBtn = document.getElementById('login-header-btn'); // Use corrected ID
    const signupHeaderBtn = document.getElementById('signup-header-btn'); // Use corrected ID
    const authModalEl = document.getElementById('auth-modal');
    const closeAuthModalBtnEl = document.getElementById('close-auth-modal-btn');

    if (loginHeaderBtn && authModalEl) {
        loginHeaderBtn.addEventListener('click', () => {
             if (!auth) {
                 alert("Authentication service is not ready. Please refresh the page.");
                 return;
             }
            loadAuthForm('login'); // Load the login form content
            toggleModal(authModalEl, true); // Show the modal
        });
    } else {
         // console.log("Login header button or auth modal not found."); // Debugging
    }

    if (signupHeaderBtn && authModalEl) {
        signupHeaderBtn.addEventListener('click', () => {
             if (!auth) {
                 alert("Authentication service is not ready. Please refresh the page.");
                 return;
             }
            loadAuthForm('signup'); // Load the signup form content
            toggleModal(authModalEl, true); // Show the modal
        });
     } else {
         // console.log("Signup header button or auth modal not found."); // Debugging
     }

    if (closeAuthModalBtnEl && authModalEl) closeAuthModalBtnEl.addEventListener('click', () => toggleModal(authModalEl, false));
    if (authModalEl) {
        authModalEl.addEventListener('click', (e) => {
            if (e.target === authModalEl) toggleModal(authModalEl, false);
        });
    }

    // Initial UI updates based on auth state (will be called later in DOMContentLoaded)
    // We need auth to be initialized first
}


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded. Initializing Firebase...");
    // Initialize Firebase app
    if (!firebase.apps.length) {
        try {
             firebase.initializeApp(firebaseConfig);
             console.log("Firebase initialized successfully.");
        } catch (e) {
             console.error("Firebase initialization error:", e);
             alert("Could not initialize Firebase. Features might be limited. Please check console.");
             return; // Stop further execution if Firebase fails fundamentally
        }
    } else {
        firebase.app();
        console.log("Firebase already initialized.");
    }

    // Initialize Firebase services AFTER app initialization
    // Check if firebase.database and firebase.auth are functions before assigning
    if (typeof firebase.database === 'function') {
        database = firebase.database();
        formsRef = database.ref('forms'); // Initialize formsRef here
         console.log("Firebase Database service initialized.");
    } else {
        console.error("Firebase Database service is not available. Form publishing/loading might fail.");
    }

    if (typeof firebase.auth === 'function') {
        auth = firebase.auth();
         console.log("Firebase Auth service initialized.");

        // --- Set up Auth State Change Listener ---
        // This listener will update the UI whenever the user logs in or out
        auth.onAuthStateChanged(user => {
             console.log("Auth state changed. User:", user ? user.email : 'None');
            updateLoginStateUI(user); // Update UI based on login status
        });

    } else {
        console.error("Firebase Auth service is not available. Login/Signup buttons might not work.");
        // Optionally, disable auth-related buttons or show a persistent message to the user
        const loginBtn = document.getElementById('login-header-btn');
        const signupBtn = document.getElementById('signup-header-btn');
        if (loginBtn) loginBtn.disabled = true;
        if (signupBtn) signupBtn.disabled = true;
        // Consider adding a visual indicator (e.g., a banner) that auth is down
    }

    // Now that Firebase services *should* be initialized (or errors logged), set up event listeners
    console.log("Initializing event listeners...");
    initializeEventListeners();


    // Other initializations
    updateNoQuestionsPlaceholder(); // Ensure this runs if the element exists
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    const parameterListDiv = document.getElementById('parameter-list');
    if (parameterListDiv) { // Check if on the correct page (index.html)
        renderDefaultParameters();
        updateTotalPercentage(); // Initial calculation
    }
     console.log("Initial page setup complete.");
});