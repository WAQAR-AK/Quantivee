// dashboard.js

// Firebase Configuration (Same as other files)
const firebaseConfig = {
    apiKey: "AIzaSyDZa8aP9WEkrKI09ymBuv0Osjg1sfkI_vI",
  authDomain: "quantive-e5b46.firebaseapp.com",
databaseURL:"https://quantive-e5b46-default-rtdb.firebaseio.com/" ,
  projectId: "quantive-e5b46",
  storageBucket: "quantive-e5b46.firebasestorage.app",
  messagingSenderId: "621471902499",
  appId: "1:621471902499:web:b142bfedcbeb2c78e13a96",
  measurementId: "G-979PVPQMQ5"
};

// Initialize Firebase
if (!firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized for dashboard.");
    } catch (e) {
        console.error("Firebase initialization error:", e);
        alert("Could not initialize Firebase. Dashboard may not function correctly.");
        // Potentially redirect or show a persistent error
    }
} else {
    firebase.app();
    console.log("Firebase already initialized for dashboard.");
}

const auth = firebase.auth();
const database = firebase.database();

// --- DOM Elements ---
const profileButton = document.getElementById('profile-button');
const profilePicture = document.getElementById('profile-picture');
const profileDropdown = document.getElementById('profile-dropdown');
const dropdownUserName = document.getElementById('dropdown-user-name');
const dropdownUserEmail = document.getElementById('dropdown-user-email');
const dropdownLogoutLink = document.getElementById('dropdown-logout-link');
const headerLogoutButton = document.getElementById('dashboard-logout-btn'); // The yellow button
const formsListDiv = document.getElementById('user-forms-list');
const formsPlaceholder = document.getElementById('forms-placeholder');
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const contentSections = document.querySelectorAll('.content-section');

// --- Global Variables ---
let currentUser = null; // Store the current user object

// --- Auth State Check ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in.
        currentUser = user; // Store user globally
        console.log("Dashboard: User logged in - ", user.email);
        updateUserProfile(user);
        loadUserForms(user.uid);
        setupUIEventListeners(); // Setup listeners that depend on user being logged in

    } else {
        // No user is signed in. Redirect to login page (index.html).
        currentUser = null;
        console.log("Dashboard: No user logged in. Redirecting to /");
        window.location.href = '/'; // Redirect to home page
    }
});

// --- Update User Profile Information in UI ---
function updateUserProfile(user) {
    if (!user) return;

    // Update profile picture
    if (profilePicture) {
        profilePicture.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=E2E8F0&color=A0AEC0&size=40`; // Use API for fallback
        profilePicture.alt = user.displayName || user.email || 'User Profile';
    }

    // Update dropdown info
    if (dropdownUserName) {
        dropdownUserName.textContent = user.displayName || 'User';
    }
    if (dropdownUserEmail) {
        dropdownUserEmail.textContent = user.email || 'No email provided';
    }
}

// --- Setup UI Event Listeners ---
function setupUIEventListeners() {
    // Profile Dropdown Toggle
    if (profileButton && profileDropdown) {
        profileButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from closing immediately
            profileDropdown.classList.toggle('hidden');
        });

        // Close dropdown if clicking outside
        document.addEventListener('click', (event) => {
            if (!profileDropdown.classList.contains('hidden') && !profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
                profileDropdown.classList.add('hidden');
            }
        });
    } else {
        console.warn("Profile button or dropdown element not found.");
    }

    // Logout Buttons (both header and dropdown)
    const handleLogout = () => {
        if (!auth) {
            console.error("Firebase Auth not initialized for logout.");
            return;
        }
        auth.signOut().then(() => {
            console.log('User signed out.');
            // Redirect is handled by the onAuthStateChanged listener
        }).catch((error) => {
            console.error('Sign out error', error);
            alert(`Error signing out: ${error.message}`);
        });
    };

    if (headerLogoutButton) {
        headerLogoutButton.addEventListener('click', handleLogout);
    } else {
        console.warn("Header logout button not found.");
    }
    if (dropdownLogoutLink) {
        dropdownLogoutLink.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            handleLogout();
        });
    } else {
        console.warn("Dropdown logout link not found.");
    }

    // Sidebar Navigation
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default anchor jump

            const sectionToShow = link.dataset.section;
            if (!sectionToShow) return;

            // Update active link style
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show the correct content section
            contentSections.forEach(section => {
                if (section.id === `content-${sectionToShow}`) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            });

             // Close profile dropdown if open
            if (profileDropdown && !profileDropdown.classList.contains('hidden')) {
                profileDropdown.classList.add('hidden');
            }
        });
    });
}


// --- Load User Forms ---
function loadUserForms(userId) {
    if (!userId) {
        console.error("Cannot load forms without userId.");
        formsPlaceholder.innerHTML = '<p class="text-red-500">Could not identify user to load forms.</p>';
        formsPlaceholder.classList.remove('hidden');
        return;
    }
    if (!database) {
         console.error("Database service not available.");
         formsPlaceholder.innerHTML = '<p class="text-red-500">Database connection error.</p>';
         formsPlaceholder.classList.remove('hidden');
         return;
    }

    console.log("Loading forms for user:", userId);
    const userFormsRef = database.ref('forms').orderByChild('userId').equalTo(userId);

    // Use .on() for real-time updates
    userFormsRef.on('value', (snapshot) => {
        const formsData = snapshot.val();
        const formsContainer = document.getElementById('user-forms-list'); // Get container fresh each time

        if (!formsContainer) {
            console.error("Forms list container not found in DOM.");
            return;
        }

        // Clear existing list items only
        const existingItems = formsContainer.querySelectorAll('.form-list-item');
        existingItems.forEach(item => item.remove());

        if (formsData && Object.keys(formsData).length > 0) {
            console.log("Forms data received:", formsData);
            formsPlaceholder.classList.add('hidden'); // Hide loading/placeholder

            // Sort forms by creation date (newest first) - assuming createdAt exists
            const sortedFormIds = Object.keys(formsData).sort((a, b) => {
                const timeA = formsData[a]?.createdAt || 0;
                const timeB = formsData[b]?.createdAt || 0;
                return timeB - timeA; // Descending order
            });

            sortedFormIds.forEach(formId => {
                const formData = formsData[formId];
                 if (formData) { // Ensure formData exists
                    renderFormListItem(formId, formData, formsContainer); // Pass container
                 } else {
                    console.warn(`Form data for ID ${formId} is null or undefined.`);
                 }
            });
        } else {
            console.log("No forms found for this user.");
            formsPlaceholder.innerHTML = '<p class="text-center"><i class="fas fa-folder-open text-3xl text-gray-400 mb-3"></i><br>You haven\'t created any forms yet.</p>';
            formsPlaceholder.classList.remove('hidden'); // Show "No forms" message
        }
    }, (error) => {
        console.error("Error loading user forms:", error);
        formsPlaceholder.innerHTML = `<p class="text-red-500 text-center">Error loading forms: ${error.message}</p>`;
        formsPlaceholder.classList.remove('hidden'); // Show error
    });
}

// --- Render a single form item in the list ---
function renderFormListItem(formId, formData, container) {
    if (!container) {
        console.error("Form list container not provided for rendering item.");
        return;
    }
    const domain = window.location.origin;
    const responderUrl = `${domain}/form.html?formId=${formId}`;
    const resultsUrl = `${domain}/results.html?formId=${formId}`;
    const createdAt = formData.createdAt ? new Date(formData.createdAt).toLocaleDateString() : 'N/A';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'form-list-item';
    itemDiv.id = `form-item-${formId}`; // Add unique ID

    itemDiv.innerHTML = `
        <div class="flex-grow mr-4">
            <span class="form-title block font-semibold text-indigo-700 hover:text-indigo-900">${formData.title || 'Untitled Form'}</span>
            <span class="text-xs text-gray-500 block">Created: ${createdAt} | ID: ${formId}</span>
        </div>
        <div class="form-actions">
             <button class="copy-link-btn" data-link="${responderUrl}" title="Copy Responder Link">
                <i class="fas fa-copy"></i>
            </button>
            <a href="${responderUrl}" target="_blank" class="open-form-link" title="Open Form">
                <i class="fas fa-external-link-alt"></i>
            </a>
            <a href="${resultsUrl}" target="_blank" class="view-responses-link" title="View Responses">
                <i class="fas fa-chart-bar"></i>
            </a>
             <span class="copy-feedback-inline text-green-600 hidden ml-2">Copied!</span>
             <span class="copy-feedback-inline text-red-600 hidden ml-2">Error!</span>
             </div>
    `;

     // Add event listener for the copy button within this item
     const copyBtn = itemDiv.querySelector('.copy-link-btn');
     const successFeedback = itemDiv.querySelector('.copy-feedback-inline.text-green-600');
     const errorFeedback = itemDiv.querySelector('.copy-feedback-inline.text-red-600');

     if (copyBtn && successFeedback && errorFeedback) {
         copyBtn.addEventListener('click', function() {
             const linkToCopy = this.dataset.link;
             // Hide feedback before attempting copy
             successFeedback.classList.add('hidden');
             errorFeedback.classList.add('hidden');

             navigator.clipboard.writeText(linkToCopy).then(() => {
                 successFeedback.classList.remove('hidden');
                 setTimeout(() => { successFeedback.classList.add('hidden'); }, 2000);
             }).catch(err => {
                 console.error('Failed to copy link:', err);
                 errorFeedback.classList.remove('hidden');
                 setTimeout(() => { errorFeedback.classList.add('hidden'); }, 3000); // Show error longer
             });
         });
     } else {
         console.warn("Could not find copy button or feedback spans for form item:", formId);
     }

    container.appendChild(itemDiv); // Append to the passed container
}

// --- Initial call to setup listeners that don't depend on login state ---
// (e.g., if there were any theme toggles, etc.)
// setupUIEventListeners(); // Moved inside onAuthStateChanged to ensure user context
