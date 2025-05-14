// results.js

// Firebase Configuration (ensure this is secure in production)
const firebaseConfig = {
    apiKey: "AIzaSyDZa8aP9WEkrKI09ymBuv0Osjg1sfkI_vI",
  authDomain: "quantive-e5b46.firebaseapp.com",
    databaseURL: "https://quantive-e5b46-default-rtdb.firebaseio.com/", // Ensure this is correct
  projectId: "quantive-e5b46",
  storageBucket: "quantive-e5b46.firebasestorage.app",
  messagingSenderId: "621471902499",
  appId: "1:621471902499:web:b142bfedcbeb2c78e13a96",
  measurementId: "G-979PVPQMQ5" // Replace
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized for results page.");
} else {
    firebase.app();
    console.log("Firebase already initialized for results page.");
}
const database = firebase.database();

// --- Global Cache for Data ---
let allResponsesData = null; // Cache responses
let formStructureData = null; // Cache form structure (questions, parameters)
let isLoadingData = false; // Flag to prevent multiple concurrent loads

// --- Get Form ID from URL ---
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('formId');

// --- DOM Elements ---
const resultsFormTitleElement = document.getElementById('results-form-title');
const resultsFormDescriptionElement = document.getElementById('results-form-description');
const responsesListElement = document.getElementById('responses-list');
const noResponsesPlaceholder = document.getElementById('no-responses-placeholder');
const exportCsvLink = document.getElementById('export-csv-link');
const exportExcelLink = document.getElementById('export-excel-link');
const exportPdfLink = document.getElementById('export-pdf-link');
const comparatorBtn = document.getElementById('comparator-btn');


// --- Load Form Title and Initial Responses View ---
function loadInitialData() {
    if (!formId) {
        if(resultsFormTitleElement) resultsFormTitleElement.textContent = 'Invalid Link';
        if(resultsFormDescriptionElement) resultsFormDescriptionElement.textContent = 'No form ID was provided in the URL.';
        if(responsesListElement) responsesListElement.innerHTML = '<p class="text-red-600 italic text-center p-4">Please use a valid results link.</p>';
        if(noResponsesPlaceholder) noResponsesPlaceholder.classList.add('hidden');
        console.error("Results page: No formId found in URL.");
        // Disable comparator button if no formId
        if(comparatorBtn) comparatorBtn.disabled = true;
        return;
    }

    isLoadingData = true;
    console.log("Results page: Loading data for form ID:", formId);

    const formRef = database.ref('forms/' + formId);
    const responsesRef = database.ref('responses').orderByChild('formId').equalTo(formId);

    // Fetch form structure (title, description, questions, parameters)
    formRef.once('value', (snapshot) => {
        formStructureData = snapshot.val(); // Cache form structure
        if (formStructureData) {
            if(resultsFormTitleElement) resultsFormTitleElement.textContent = `Responses for: ${formStructureData.title || 'Untitled Form'}`;
            if(resultsFormDescriptionElement) resultsFormDescriptionElement.textContent = formStructureData.description || 'No description provided for this form.';
             // Check if form has questions before enabling comparator
            if(comparatorBtn) {
                 if(formStructureData.questions && formStructureData.questions.length > 0) {
                     comparatorBtn.disabled = false;
                 } else {
                     comparatorBtn.disabled = true;
                     comparatorBtn.title = "Add questions to the form to use the comparator.";
                 }
            }

        } else {
            if(resultsFormTitleElement) resultsFormTitleElement.textContent = 'Form Not Found';
            if(resultsFormDescriptionElement) resultsFormDescriptionElement.textContent = 'Could not load form details.';
            console.error("Results page: Form with ID", formId, "not found.");
             // Disable comparator button if form not found
            if(comparatorBtn) comparatorBtn.disabled = true;
        }
    }, (errorObject) => {
         console.error("Results page: Firebase form details loading failed:", errorObject.code);
         if(resultsFormTitleElement) resultsFormTitleElement.textContent = 'Error Loading Form Details';
         // Disable comparator button on error
         if(comparatorBtn) comparatorBtn.disabled = true;
    });

    // Fetch and render responses (real-time updates)
    responsesRef.on('value', (snapshot) => {
        allResponsesData = snapshot.val(); // Cache responses
        if(responsesListElement) responsesListElement.innerHTML = ''; // Clear loading/previous

        if (allResponsesData && Object.keys(allResponsesData).length > 0) {
            console.log("Results page: Responses loaded/updated:", allResponsesData);
            if(noResponsesPlaceholder) noResponsesPlaceholder.classList.add('hidden');

             // Ensure form structure is loaded before rendering responses that need question text
             if (formStructureData && formStructureData.questions) {
                 renderAllResponses(allResponsesData, formStructureData.questions);
             } else {
                 // If form structure hasn't loaded yet, wait or fetch it again (simple refetch shown here)
                 formRef.once('value').then(formSnapshot => {
                     formStructureData = formSnapshot.val();
                     const questions = formStructureData?.questions || [];
                     renderAllResponses(allResponsesData, questions);
                 }).catch(error => {
                     console.error("Error refetching form questions for responses:", error);
                      renderAllResponses(allResponsesData, []); // Render with IDs if fetch fails
                 });
             }

        } else {
            console.log("Results page: No responses found for form ID:", formId);
            if(noResponsesPlaceholder) noResponsesPlaceholder.classList.remove('hidden');
            allResponsesData = null; // Clear cache if no responses
        }
        isLoadingData = false;
    }, (errorObject) => {
        console.error("Results page: Firebase responses loading failed:", errorObject.code);
        if(responsesListElement) responsesListElement.innerHTML = `<p class="text-red-600 italic text-center p-4">Error loading responses: ${errorObject.message}</p>`;
        if(noResponsesPlaceholder) noResponsesPlaceholder.classList.add('hidden');
        isLoadingData = false;
        allResponsesData = null; // Clear cache on error
    });
}

// --- Render All Responses ---
function renderAllResponses(responsesData, formQuestions) {
     if (!responsesListElement) return;
     responsesListElement.innerHTML = ''; // Clear again before rendering loop

     const questionMap = formQuestions.reduce((map, q) => {
        map[q.id] = q.text; // Map question ID to text
        return map;
    }, {});

     Object.keys(responsesData).forEach((responseId, index) => {
        const response = responsesData[responseId];
        renderSingleResponse(response, responseId, index + 1, questionMap);
    });
}


// --- Render a Single Response ---
function renderSingleResponse(response, responseId, responseNumber, questionMap) {
    if(!responsesListElement) return;

    const responseItemDiv = document.createElement('div');
    responseItemDiv.className = 'response-item'; // Class from style.css or tailwind
    responseItemDiv.id = `response-item-${responseId}`; // Add ID for easier access

    const submittedTime = response.submittedAt ? new Date(response.submittedAt).toLocaleString() : 'Unknown Time';
    // Use respondent name if available, fallback to number
    // Assuming 'name' is the ID of the name question. Adjust if necessary.
    const respondentName = response.responses?.['name']?.answer || `Response #${responseNumber}`;

    let responseContentHTML = `<h4 class="response-timestamp">${respondentName} (Submitted: ${submittedTime})</h4>`;

    const candidateResponses = response.responses || {};
    const qaPairs = []; // Store Q&A pairs for analysis payload

    // Iterate through responses keyed by question ID
    Object.keys(candidateResponses).forEach(questionId => {
        // Skip the name field itself if we used it in the header
        // You might adjust this if the name question has a different ID
        if (questionId === 'name') return;

        const responseData = candidateResponses[questionId]; // { text: "...", answer: "..." } or just { answer: "..."}
        // Use text from map if available, fallback to stored text (if any), then ID
        const questionText = questionMap[questionId] || responseData.text || `Question ${questionId}`;
        const answer = responseData.answer;
        const displayAnswer = Array.isArray(answer) ? answer.join(', ') : (answer || "<em>Not answered</em>");

        responseContentHTML += `<p class="response-qa"><strong>${questionText}:</strong> ${displayAnswer}</p>`;
        // Only include non-empty answers in qaPairs for AI analysis
         if (answer && (!Array.isArray(answer) || answer.length > 0)) {
             qaPairs.push({ question: questionText, answer: answer }); // Store for AI
         }
    });


    if (qaPairs.length === 0 && !candidateResponses['name']) { // Adjust condition if name wasn't the only field
        responseContentHTML += '<p class="response-qa"><em>No answers were provided in this submission (besides potentially name).</em></p>';
    }

    // Add "Analyze with AI" section
    responseContentHTML += `
        <div class="ai-analysis-section mt-4 border-t pt-4">
            <h5><i class="fas fa-brain mr-2"></i>Analyze with AI (Beta)</h5>
            <textarea id="ai-instructions-${responseId}" class="form-textarea text-sm" rows="2" placeholder="Enter instructions or criteria for AI analysis (e.g., 'Identify key positive sentiments', 'Flag responses mentioning budget under $500')."></textarea>
            <button class="action-button analyze-btn bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1 px-2 mt-2" data-response-id="${responseId}">
                <i class="fas fa-paper-plane mr-1"></i>Submit for Analysis
            </button>
             <div id="ai-analysis-result-${responseId}" class="ai-analysis-result mt-4 pt-4 border-t border-dashed border-gray-300 hidden">
                <h5 class="text-sm font-semibold text-indigo-600 mb-2">AI Analysis:</h5>
                <div class="analysis-content"></div>
                <p class="error-message text-red-500 text-xs mt-2 hidden"></p>
             </div>
        </div>
    `;

    responseItemDiv.innerHTML = responseContentHTML;
    responsesListElement.appendChild(responseItemDiv);

    // Add event listener to the newly created analyze button
    const analyzeButton = responseItemDiv.querySelector(`.analyze-btn[data-response-id="${responseId}"]`);
    if (analyzeButton) {
        analyzeButton.addEventListener('click', () => handleAiAnalysis(responseId, qaPairs));
    }
}

// --- Prepare Data for Export/Comparison ---
function prepareStructuredData() {
    if (!allResponsesData || !formStructureData || !formStructureData.questions) {
        console.error("Data not ready for structuring.");
        return { questions: [], responses: [], parameters: [] }; // Return empty structure
    }

    const questions = [...formStructureData.questions]; // Clone questions array
    const parameters = formStructureData.parameters || []; // Get parameters
    const structuredResponses = [];

    Object.keys(allResponsesData).forEach((responseId) => {
        const rawResponse = allResponsesData[responseId];
         // Try to get respondent name from a common question ID like 'name'
        const respondentIdentifier = rawResponse.responses?.['name']?.answer || `Response ${structuredResponses.length + 1}`;

        const candidateData = {
            responseId: responseId,
            identifier: respondentIdentifier,
            submittedAt: rawResponse.submittedAt ? new Date(rawResponse.submittedAt).toISOString() : null,
            answers: {}, // Use question ID as key
            // Include AI analysis results if they were previously saved with the response
            // (This would require backend/Firebase structure changes to save analysis results)
            // For now, we'll assume analysis is done on demand.
            aiScores: rawResponse.aiScores || {}, // Placeholder if saved
            aiRecommendation: rawResponse.aiRecommendation || null // Placeholder if saved
        };

        questions.forEach(q => {
            const answerData = rawResponse.responses?.[q.id];
            let answerValue = answerData?.answer ?? ''; // Default to empty string if no answer
            // Format array answers
            if (Array.isArray(answerValue)) {
                answerValue = answerValue.join('; '); // Use semicolon for multi-select in CSV
            }
            candidateData.answers[q.id] = answerValue;
        });
        structuredResponses.push(candidateData);
    });

    // Sort questions based on their original order in formStructureData.questions
    // (Assuming they are already in order)

    // Sort responses by submission time (optional, newest first)
    structuredResponses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));


    return {
        questions: questions.map(q => ({ id: q.id, text: q.text })), // Extract only id and text
        responses: structuredResponses, // Contains responseId, submittedAt, identifier, answers object, aiScores, aiRecommendation
        parameters: parameters // Saved parameters
    };
}


// --- Export Functions ---

function exportToCsv(filename = 'form_responses.csv') {
    const { questions, responses, parameters } = prepareStructuredData();

    if (questions.length === 0 || responses.length === 0) {
        alert("No data available to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";

    // Header Row: Submitted At, Candidate Name, Question Text 1, ..., Question Text N, Parameter 1 Score, ..., Parameter M Score, Recommendation
    const headers = ["Submitted At", "Candidate Name", ...questions.map(q => `"${q.text.replace(/"/g, '""')}"`)];
     parameters.forEach(p => headers.push(`"${p.name} Score"`));
     headers.push('"Recommendation"'); // Add Recommendation header

    csvContent += headers.join(",") + "\r\n";

    // Data Rows
    responses.forEach(response => {
        const row = [
            response.submittedAt ? `"${new Date(response.submittedAt).toLocaleString()}"` : "", // Format date/time
             `"${String(response.identifier).replace(/"/g, '""')}"` // Candidate Name
        ];
        questions.forEach(q => {
            const answer = response.answers[q.id] || '';
             // Escape quotes within the answer and wrap the whole answer in quotes
            const formattedAnswer = `"${String(answer).replace(/"/g, '""')}"`;
            row.push(formattedAnswer);
        });
         // Add AI Scores to the row
         parameters.forEach(p => {
             const score = response.aiScores?.[p.name] ?? '-'; // Use cached score or '-'
             row.push(`"${score}"`);
         });
         // Add Recommendation to the row
         const recommendation = response.aiRecommendation ?? '-';
         row.push(`"${String(recommendation).replace(/"/g, '""')}"`);


        csvContent += row.join(",") + "\r\n";
    });

    // Create and trigger download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}

function exportToExcel() {
    // Placeholder: Requires SheetJS/xlsx library
    alert("Excel export requires an additional library (SheetJS/xlsx). Implementation needed.");
    console.log("Attempted Excel export. Requires SheetJS/xlsx library.");
    /*
    // --- Example using SheetJS (if library is included) ---
    const { questions, responses, parameters } = prepareStructuredData();
    if (questions.length === 0 || responses.length === 0) {
        alert("No data available to export."); return;
    }

    // Prepare data in SheetJS format
    const ws_data = [
        ["Submitted At", "Candidate Name", ...questions.map(q => q.text), ...parameters.map(p => `${p.name} Score`), "Recommendation"] // Header row
    ];
    responses.forEach(response => {
        const row = [response.submittedAt ? new Date(response.submittedAt) : null, response.identifier]; // Dates should ideally be Date objects for Excel
        questions.forEach(q => {
            row.push(response.answers[q.id] || '');
        });
         parameters.forEach(p => {
             row.push(response.aiScores?.[p.name] ?? '-');
         });
         row.push(response.aiRecommendation ?? '-');
        ws_data.push(row);
    });

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");

    // Trigger download
    XLSX.writeFile(wb, "form_responses.xlsx");
    */
}

function exportToPdf() {
    // Placeholder: Requires jsPDF and potentially jsPDF-AutoTable library
    alert("PDF export requires an additional library (jsPDF). Implementation needed.");
     console.log("Attempted PDF export. Requires jsPDF and jsPDF-AutoTable libraries.");
    /*
    // --- Example using jsPDF and jsPDF-AutoTable (if libraries is included) ---
     const { questions, responses, parameters } = prepareStructuredData();
    if (questions.length === 0 || responses.length === 0) {
        alert("No data available to export."); return;
    }
    const { jsPDF } = window.jspdf; // Assuming jsPDF is loaded globally
    if (!jsPDF || !jsPDF.autoTable) {
         alert("jsPDF or jsPDF-AutoTable library not loaded.");
         return;
     }
    const doc = new jsPDF({ orientation: 'landscape' }); // Landscape might be better for tables

    const head = [["Submitted At", "Candidate Name", ...questions.map(q => q.text), ...parameters.map(p => `${p.name} Score`), "Recommendation"]];
    const body = responses.map(response => {
         const row = [
             response.submittedAt ? new Date(response.submittedAt).toLocaleString() : "",
             String(response.identifier || '')
         ];
         questions.forEach(q => {
             row.push(String(response.answers[q.id] || '')); // Ensure strings
         });
         parameters.forEach(p => {
             row.push(String(response.aiScores?.[p.name] ?? '-'));
         });
         row.push(String(response.aiRecommendation ?? '-'));
         return row;
     });

     doc.autoTable({
         head: head,
         body: body,
         startY: 15, // Start table below margin
         headStyles: { fillColor: [22, 160, 133] }, // Example header style
         theme: 'grid', // 'striped', 'grid', 'plain'
         styles: { fontSize: 8, cellPadding: 2 }, // Adjust styling
         columnStyles: {
             0: { cellWidth: 25 }, // Submitted At
             1: { cellWidth: 30 }  // Candidate Name
             // Add more column styles if needed based on question/parameter count
         }
     });

     doc.text(`Form Responses: ${resultsFormTitleElement?.textContent.replace('Responses for: ','') || 'Responses'}`, 14, 10);
     doc.save('form_responses.pdf');
     */
}

// --- Comparator Function ---
function openComparator() {
    if (!formId) {
        alert("Cannot open comparator without a form ID.");
        return;
    }
     if (comparatorBtn && comparatorBtn.disabled) {
         alert("Comparator is not available for this form (no questions added).");
         return;
     }
    const comparatorUrl = `/comparator.html?formId=${formId}`;
    window.open(comparatorUrl, '_blank'); // Open in new tab
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    if (exportCsvLink) {
        exportCsvLink.addEventListener('click', (e) => {
            e.preventDefault();
            exportToCsv();
        });
    }
    if (exportExcelLink) {
        exportExcelLink.addEventListener('click', (e) => {
            e.preventDefault();
            exportToExcel(); // Call placeholder
        });
    }
     if (exportPdfLink) {
         exportPdfLink.addEventListener('click', (e) => {
             e.preventDefault();
             exportToPdf(); // Call placeholder
         });
     }
     if (comparatorBtn) {
         comparatorBtn.addEventListener('click', (e) => {
             e.preventDefault();
             openComparator();
         });
         // Initial state handled in loadInitialData
     }
     // Note: Analyze button listeners are added dynamically in renderSingleResponse
}


// --- AI Analysis Logic (Existing - Kept As Is) ---
async function handleAiAnalysis(responseId, qaPairs) {
    const instructionsTextarea = document.getElementById(`ai-instructions-${responseId}`);
    const analyzeButton = document.querySelector(`.analyze-btn[data-response-id="${responseId}"]`);
    const analysisResultDiv = document.getElementById(`ai-analysis-result-${responseId}`);
    const analysisContentDiv = analysisResultDiv.querySelector('.analysis-content');
    const errorMessagePara = analysisResultDiv.querySelector('.error-message');

    if (!instructionsTextarea || !analyzeButton || !analysisResultDiv || !analysisContentDiv || !errorMessagePara) {
        console.error("Could not find necessary elements for analysis:", responseId);
        return;
    }

    const instructions = instructionsTextarea.value;
     // Use cached form title and parameters if available, otherwise fetch or use placeholder
    const formTitle = formStructureData?.title || 'Unknown Job Title';
    const parameters = formStructureData?.parameters || []; // Use saved parameters

    const resumeContentPlaceholder = 'No resume provided.'; // Assuming no resume upload for now

    const payload = {
        jobTitle: formTitle,
        parameters: parameters, // Pass saved parameters to the single analysis
        aiCriteria: instructions,
        candidateResponses: qaPairs,
        resumeContent: resumeContentPlaceholder
    };

    console.log("Sending data for AI analysis:", payload);

    analyzeButton.disabled = true;
    const originalButtonText = analyzeButton.innerHTML;
    analyzeButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Analyzing...';
    analysisResultDiv.classList.add('hidden');
    analysisContentDiv.innerHTML = '';
    errorMessagePara.textContent = '';
    errorMessagePara.classList.add('hidden');

    try {
        const response = await fetch('/api/analyze-candidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            console.error('Backend API Error:', response.status, errorDetail);
            throw new Error(`Analysis failed: ${response.statusText} - ${errorDetail}`);
        }

        const analysisResult = await response.json();
        console.log('AI Analysis Result:', analysisResult);
        displayAnalysisResult(analysisContentDiv, analysisResult);
        analysisResultDiv.classList.remove('hidden');

    } catch (error) {
        console.error('Error during AI analysis:', error);
        errorMessagePara.textContent = `Analysis Error: ${error.message}`;
        analysisResultDiv.classList.remove('hidden');
        errorMessagePara.classList.remove('hidden');
    } finally {
        analyzeButton.disabled = false;
        analyzeButton.innerHTML = originalButtonText;
    }
}

// Function to display the AI analysis result in a given container
function displayAnalysisResult(containerElement, analysis) {
    if (!containerElement || !analysis) return;
    containerElement.innerHTML = ''; // Clear previous content

    // Recommendation (Traffic Light)
    let recommendationClass = '';
    let recommendationText = analysis.recommendation || 'Unknown';
    if (recommendationText.toLowerCase() === 'fit') recommendationClass = 'fit';
    else if (recommendationText.toLowerCase() === 'maybe') recommendationClass = 'maybe';
    else if (recommendationText.toLowerCase() === 'not fit') recommendationClass = 'not-fit';
    else recommendationClass = ''; // Default styling

    containerElement.innerHTML += `<div class="recommendation-box ${recommendationClass}">Final Recommendation: ${recommendationText}</div>`;

    // Summary
    if (analysis.summary) containerElement.innerHTML += `<div class="mb-4"><h6 class="text-md font-semibold text-gray-800 mb-2"><i class="fas fa-clipboard-check mr-2"></i>Summary</h6><p class="text-gray-700 text-sm">${analysis.summary}</p></div>`;

    // Scores
    if (analysis.scores && Object.keys(analysis.scores).length > 0) {
        let scoresHtml = '<div class="mb-4"><h6 class="text-md font-semibold text-gray-800 mb-2"><i class="fas fa-star-half-alt mr-2"></i>Scores</h6><ul class="list-disc list-inside text-sm text-gray-700 space-y-1">';
        for (const scoreKey in analysis.scores) scoresHtml += `<li><strong>${scoreKey}:</strong> ${analysis.scores[scoreKey]}/10</li>`;
        scoresHtml += '</ul></div>';
        containerElement.innerHTML += scoresHtml;
    }

    // Strengths
    if (analysis.strengths && analysis.strengths.length > 0) {
        let strengthsHtml = '<div class="mb-4"><h6 class="text-md font-semibold text-gray-800 mb-2"><i class="fas fa-thumbs-up mr-2 text-green-600"></i>Strengths</h6><ul class="list-disc list-inside text-sm text-gray-700 space-y-1">';
        analysis.strengths.forEach(strength => strengthsHtml += `<li>${strength}</li>`);
        strengthsHtml += '</ul></div>';
        containerElement.innerHTML += strengthsHtml;
    }

    // Weaknesses
    if (analysis.weaknesses && analysis.weaknesses.length > 0) {
        let weaknessesHtml = '<div class="mb-4"><h6 class="text-md font-semibold text-gray-800 mb-2"><i class="fas fa-thumbs-down mr-2 text-orange-600"></i>Weaknesses</h6><ul class="list-disc list-inside text-sm text-gray-700 space-y-1">';
        analysis.weaknesses.forEach(weakness => weaknessesHtml += `<li>${weakness}</li>`);
        weaknessesHtml += '</ul></div>';
        containerElement.innerHTML += weaknessesHtml;
    }

     // Red Flags
    if (analysis.red_flags && analysis.red_flags.length > 0) {
        let redFlagsHtml = '<div class="red-flags-box"><h6 class="text-md font-semibold mb-2"><i class="fas fa-flag mr-2"></i>Red Flags</h6><ul class="list-disc list-inside text-sm space-y-1">';
        analysis.red_flags.forEach(flag => redFlagsHtml += `<li>${flag}</li>`);
        redFlagsHtml += '</ul></div>';
        containerElement.innerHTML += redFlagsHtml;
    }
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadInitialData(); // Load title, description, and initial responses display
    setupEventListeners(); // Setup export and comparator listeners
});
