// form.js

// --- Firebase Initialization ---
// WARNING: Storing credentials directly in frontend code is INSECURE for production.
// Replace with your actual Firebase configuration.
// For production, load this config securely (e.g., from environment variables
// on your backend, or use Firebase Hosting environment config).
// DO NOT hardcode sensitive keys here in a production app.
const firebaseConfig = {
    apiKey: "AIzaSyDZa8aP9WEkrKI09ymBuv0Osjg1sfkI_vI",
  authDomain: "quantive-e5b46.firebaseapp.com",
databaseURL:"https://quantive-e5b46-default-rtdb.firebaseio.com/" , // Ensure this is correct
  projectId: "quantive-e5b46",
  storageBucket: "quantive-e5b46.firebasestorage.app",
  messagingSenderId: "621471902499",
  appId: "1:621471902499:web:b142bfedcbeb2c78e13a96",
  measurementId: "G-979PVPQMQ5" // Replace with your actual App ID
};

// Initialize Firebase (only if it hasn't been initialized already)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized (using placeholder config) for form page.");
} else {
    firebase.app(); // if already initialized, use that app
    console.log("Firebase already initialized for form page.");
}

const database = firebase.database();

// --- Get Form ID from URL ---
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('formId');

const formTitleElement = document.getElementById('form-responder-title');
const formDescriptionElement = document.getElementById('form-responder-description');
const formQuestionsArea = document.getElementById('form-questions-area');
const submitFormBtn = document.getElementById('submit-form-btn');
const submitFeedback = document.getElementById('submit-feedback');
const errorFeedback = document.getElementById('error-feedback');


// --- Load Form Structure from Firebase ---
if (formId) {
    console.log("Attempting to load form with ID:", formId); // Added logging
    const formRef = database.ref('forms/' + formId);

    formRef.once('value', (snapshot) => {
        const formStructure = snapshot.val();

        if (formStructure) {
            console.log("Form structure loaded:", formStructure); // Added logging
            formTitleElement.textContent = formStructure.title || 'Untitled Form';
            formDescriptionElement.textContent = formStructure.description || '';
            renderForm(formStructure.questions);
            submitFormBtn.disabled = false; // Enable submit button once form is loaded
        } else {
            formTitleElement.textContent = 'Form Not Found';
            formDescriptionElement.textContent = 'The requested form could not be loaded.';
            formQuestionsArea.innerHTML = '<p class="text-red-600 italic text-center">Form not found or may have been deleted.</p>';
            console.error("Form with ID", formId, "not found.");
        }
    }, (errorObject) => {
        console.error("Firebase form loading failed:", errorObject.code);
        formTitleElement.textContent = 'Error Loading Form';
        formDescriptionElement.textContent = 'There was an error loading the form.';
        formQuestionsArea.innerHTML = `<p class="text-red-600 italic text-center">Error loading form: ${errorObject.message}</p>`;
    });
} else {
    formTitleElement.textContent = 'Invalid Form Link';
    formDescriptionElement.textContent = 'No form ID was provided in the URL.';
    formQuestionsArea.innerHTML = '<p class="text-red-600 italic text-center">Please use a valid form link.</p>';
    console.error("No formId found in URL.");
}


// --- Render Form Questions ---
function renderForm(questions) {
    formQuestionsArea.innerHTML = ''; // Clear loading message

    if (!questions || questions.length === 0) {
        formQuestionsArea.innerHTML = '<p class="text-gray-600 italic text-center">This form has no questions.</p>';
        return;
    }

    questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('form-question');
        questionDiv.dataset.questionId = question.id; // Store original question ID

        const label = document.createElement('label');
        label.textContent = question.text;
        // Add required indicator if applicable (assuming 'required' key exists in question object)
        if (question.required) {
             const requiredSpan = document.createElement('span');
             requiredSpan.classList.add('text-red-500', 'ml-1');
             requiredSpan.textContent = '*';
             label.appendChild(requiredSpan);
        }
        questionDiv.appendChild(label);

        // Add input/options based on question type
        if (question.type === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Your answer';
             input.classList.add('form-input'); // Add class for styling
            questionDiv.appendChild(input);
        } else if (question.type === 'textarea') {
            const textarea = document.createElement('textarea');
            textarea.rows = 3;
            textarea.placeholder = 'Your answer';
             textarea.classList.add('form-textarea'); // Add class for styling
            questionDiv.appendChild(textarea);
        } else if (question.type === 'number') {
             const input = document.createElement('input');
            input.type = 'number';
            input.placeholder = 'Enter a number';
             input.classList.add('form-input'); // Add class for styling
            questionDiv.appendChild(input);
        } else if (question.type === 'email') {
             const input = document.createElement('input');
            input.type = 'email';
            input.placeholder = 'Your email';
             input.classList.add('form-input'); // Add class for styling
            questionDiv.appendChild(input);
        } else if (question.type === 'date') {
             const input = document.createElement('input');
            input.type = 'date';
             input.classList.add('form-input'); // Add class for styling
            questionDiv.appendChild(input);
        } else if (question.type === 'file') {
             // File inputs require special handling for storage (e.g., Firebase Storage)
             // For this example, we'll add the input but note that storage isn't implemented here.
             const input = document.createElement('input');
            input.type = 'file';
             input.classList.add('form-input'); // Add class for styling
             const note = document.createElement('p');
             note.classList.add('text-sm', 'text-gray-600', 'italic', 'mt-1');
             note.textContent = 'File uploads require backend storage setup.';
             questionDiv.appendChild(input);
             questionDiv.appendChild(note);
        }
        else if ((question.type === 'radio' || question.type === 'checkbox') && question.options && question.options.length > 0) {
            const optionsDiv = document.createElement('div');
            optionsDiv.classList.add('options');
            question.options.forEach((optionText, optionIndex) => {
                const optionLabel = document.createElement('label');
                const optionInput = document.createElement('input');
                optionInput.type = question.type; // Use radio or checkbox type
                optionInput.name = 'question-' + question.id; // Group radio buttons by question ID
                optionInput.value = optionText; // Set the value to the option text
                 optionLabel.classList.add('flex', 'items-center', 'text-gray-700', 'mb-2', 'cursor-pointer'); // Add classes for styling
                 optionInput.classList.add(`form-${question.type}`, 'mr-2'); // Add specific classes
                optionLabel.appendChild(optionInput);
                optionLabel.appendChild(document.createTextNode(optionText));
                optionsDiv.appendChild(optionLabel);
            });
             questionDiv.appendChild(optionsDiv);
        }

        formQuestionsArea.appendChild(questionDiv);
    });
}


// --- Handle Form Submission ---
submitFormBtn.addEventListener('click', function() {
    const responses = {};
    let isValid = true; // Simple validation check (you might enhance this)

    document.querySelectorAll('.form-question').forEach(questionDiv => {
        const questionId = questionDiv.dataset.questionId;
        // Find the original question object by ID to get its properties like 'required'
        // This would require having the original formStructure.questions array available here.
        // For now, we'll rely on the DOM elements and add basic checks.
        const questionLabel = questionDiv.querySelector('label').textContent.replace('*', '').trim(); // Get question text


        let answer = null;
        const inputElement = questionDiv.querySelector('input:not([type="radio"]):not([type="checkbox"]), textarea'); // Get text/number/email/date/file input

        if (inputElement) {
             if (inputElement.type === 'file') {
                  // File input value is the FileList object, not the file content or path
                  // Actual file upload requires Firebase Storage and different logic.
                  // For now, we'll just note if a file was selected or store metadata.
                 const fileInput = questionDiv.querySelector('input[type="file"]');
                 answer = fileInput.files.length > 0 ? {
                      name: fileInput.files[0].name,
                      size: fileInput.files[0].size,
                      type: fileInput.files[0].type
                      // Note: File content is NOT stored here.
                 } : null;
             } else {
                 answer = inputElement.value.trim();
             }
             // Basic required check (requires access to original question object's 'required' property)
             // if (isQuestionRequired(questionId) && !answer) {
             //     isValid = false;
             //     // Add visual feedback
             // }
        } else {
            // Handle radio and checkbox types
            const radioInput = questionDiv.querySelector('input[type="radio"]:checked');
            const checkboxInputs = questionDiv.querySelectorAll('input[type="checkbox"]:checked');

            if (radioInput) {
                answer = radioInput.value;
                // Basic required check
                // if (isQuestionRequired(questionId) && !answer) { isValid = false; }
            } else if (checkboxInputs.length > 0) {
                answer = Array.from(checkboxInputs).map(cb => cb.value); // Array of checked values
                 // Basic required check (if at least one checkbox must be checked)
                // if (isQuestionRequired(questionId) && answer.length === 0) { isValid = false; }
            }
        }

         // --- Store response using questionId as the key ---
         // Store the original question text along with the answer for easier display later
         if (questionId) {
              responses[questionId] = {
                  text: questionLabel, // Store original question text
                  answer: answer // Store the answer
              };
         } else {
             console.warn("Question element missing data-question-id:", questionDiv);
             // Fallback to storing by label if ID is missing, but warn
             if (questionLabel) {
                 responses[questionLabel] = {
                      text: questionLabel,
                      answer: answer
                 };
             }
         }
    });

    // If you implemented required checks, add an overall check here
    // if (!isValid) {
    //     alert('Please fill out all required fields.');
    //     return;
    // }

     // Check if responses object is empty (e.g., no questions or no answers)
     if (Object.keys(responses).length === 0) {
         console.warn("Attempted submission with no responses collected.");
         errorFeedback.textContent = "No responses were collected. Please ensure there are questions and attempt to answer them.";
         errorFeedback.classList.remove('hidden');
         submitFeedback.classList.add('hidden');
         return; // Stop submission if no data
     }


    const submissionData = {
        formId: formId,
        responses: responses, // Save the responses object keyed by question ID
        submittedAt: firebase.database.ServerValue.TIMESTAMP
    };

    console.log("Submitting response:", submissionData);

    // --- Save Response to Firebase ---
    const responsesRef = database.ref('responses'); // Store responses under a 'responses' node

    responsesRef.push(submissionData)
        .then(() => {
            console.log('Response submitted successfully!');
            submitFeedback.classList.remove('hidden'); // Show success message
            errorFeedback.classList.add('hidden'); // Hide error message

            // --- Update button state and clear form ---
            submitFormBtn.textContent = 'Submitted'; // Change text to Submitted
            submitFormBtn.disabled = true; // Disable submit after successful submission
            // Optional: Clear the form inputs visually
             document.querySelectorAll('.form-question input, .form-question textarea').forEach(input => {
                 if (input.type !== 'radio' && input.type !== 'checkbox' && input.type !== 'file') {
                     input.value = '';
                 } else if (input.type === 'radio' || input.type === 'checkbox') {
                     input.checked = false;
                 }
             });
             // Optional: Clear file inputs (note: value cannot be set directly for security)
             document.querySelectorAll('.form-question input[type="file"]').forEach(input => {
                 // input.value = ''; // This won't work due to security restrictions
                 // You might replace the input element or inform the user they can't clear it.
             });


        })
        .catch((error) => {
            console.error('Firebase submission error:', error);
            errorFeedback.textContent = `Error submitting form: ${error.message}`;
            errorFeedback.classList.remove('hidden'); // Show error message
            submitFeedback.classList.add('hidden'); // Hide success message
            // Keep button enabled on error so user can try again
            submitFormBtn.disabled = false;
             submitFormBtn.textContent = 'Submit Form'; // Reset text on error
        });
});