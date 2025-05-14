// comparator.js

// Firebase Configuration (same as results.js)
// IMPORTANT: In a real application, Firebase config should be loaded securely,
// not hardcoded in client-side JavaScript.
const firebaseConfig = {
    apiKey: "AIzaSyDZa8aP9WEkrKI09ymBuv0Osjg1sfkI_vI",
    authDomain: "quantive-e5b46.firebaseapp.com",
    databaseURL: "https://quantive-e5b46-default-rtdb.firebaseio.com/", // Ensure this is correct
    projectId: "quantive-e5b46",
    storageBucket: "quantive-e5b46.firebasestorage.app",
    messagingSenderId: "621471902499",
    appId: "1:621471902499:web:b142bfedcbeb2c78e13a96",
    measurementId: "G-979PVPQMQ5"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized for comparator page.");
} else {
    firebase.app();
    console.log("Firebase already initialized for comparator page.");
}
const database = firebase.database();

// --- Global Cache ---
// Store structured data where each item is a candidate response with answers mapped by question ID
let comparisonData = null; // { questions: [], responses: [], parameters: [] }
let formParameters = []; // Parameters saved with the form (from index.html)
let aiComparisonResults = null; // Store the raw AI comparison results for charts

// --- Get Form ID from URL ---
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('formId');

// --- DOM Elements ---
const formTitleElement = document.getElementById('comparator-form-title');

// Raw Responses Table Elements
const rawTableStatusDiv = document.getElementById('raw-table-status');
const rawResponsesTable = document.getElementById('raw-responses-table');
const rawTableHeaderRow = document.getElementById('raw-table-header-row');
const rawTableBody = document.getElementById('raw-table-body');
const exportRawCsvBtn = document.getElementById('export-raw-csv-btn'); // New export button for raw table

// AI Analysis Controls Elements
const aiInstructionsTextarea = document.getElementById('ai-comparator-instructions');
const analyzeBtn = document.getElementById('analyze-with-ai-btn');
const aiComparisonErrorMessagePara = document.getElementById('ai-comparison-error-message');

// AI Comparison Results Table Elements
const aiComparisonResultsSection = document.getElementById('ai-comparison-results-section');
const aiTableStatusDiv = document.getElementById('ai-table-status');
const aiComparisonTable = document.getElementById('ai-comparison-table');
const aiTableHeaderRow = document.getElementById('ai-table-header-row');
const aiTableBody = document.getElementById('ai-table-body');
const exportAiCsvBtn = document.getElementById('export-ai-csv-btn'); // New export button for AI table

// AI Comparison Analysis Result (Summary Text and Charts) Elements
const aiComparisonOutputDiv = document.getElementById('ai-comparison-output');
const aiComparisonResultContentDiv = document.getElementById('ai-comparison-result-content');
const chartsContainer = document.getElementById('charts-container');
const recommendationPieChartDiv = document.getElementById('recommendation-pie-chart');
const parameterHorizontalBarChartDiv = document.getElementById('parameter-horizontal-bar-chart');
const candidateStackedBarChartDiv = document.getElementById('candidate-stacked-bar-chart');
const parameterDivergingBarChartDiv = document.getElementById('parameter-diverging-bar-chart');


// AI Summary Modal Elements
const aiSummaryModal = document.getElementById('ai-summary-modal');
const summaryCandidateNameSpan = document.getElementById('summary-candidate-name');
const aiSummaryContentDiv = document.getElementById('ai-summary-content');
const summaryAnalysisContentDiv = aiSummaryContentDiv ? aiSummaryContentDiv.querySelector('.analysis-content') : null;
const summaryErrorMessagePara = aiSummaryContentDiv ? aiSummaryContentDiv.querySelector('.error-message') : null;


// --- Load Form and Response Data ---
async function loadComparisonData() {
    if (!formId) {
        updateStatus(rawTableStatusDiv, "Error: No Form ID provided in the URL.", true);
        if (formTitleElement) formTitleElement.textContent = "Error: Invalid Link";
        rawResponsesTable.classList.add('hidden');
        if (exportRawCsvBtn) exportRawCsvBtn.classList.add('hidden');
        return;
    }

    updateStatus(rawTableStatusDiv, "Loading form structure and responses...");
    const formRef = database.ref('forms/' + formId);
    const responsesRef = database.ref('responses').orderByChild('formId').equalTo(formId);

    try {
        const formSnapshot = await formRef.once('value');
        const formStructure = formSnapshot.val();

        if (!formStructure || !formStructure.questions) {
            updateStatus(rawTableStatusDiv, `Error: Form structure or questions not found for ID: ${formId}`, true);
            if (formTitleElement) formTitleElement.textContent = "Error: Form Not Found";
            rawResponsesTable.classList.add('hidden');
            if (exportRawCsvBtn) exportRawCsvBtn.classList.add('hidden');
            // Disable AI analysis if no questions
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
                analyzeBtn.title = "Cannot analyze without form questions.";
            }
            return;
        }

        // Cache form parameters if available
        formParameters = formStructure.parameters || [];
        console.log("Form Parameters loaded:", formParameters);


        if (formTitleElement) formTitleElement.textContent = `Comparing Responses for: ${formStructure.title || 'Untitled Form'}`;
        // updateStatus("Loading responses..."); // Status updated above

        const responsesSnapshot = await responsesRef.once('value');
        const allResponsesData = responsesSnapshot.val();

        if (!allResponsesData || Object.keys(allResponsesData).length === 0) {
            updateStatus(rawTableStatusDiv, "No responses found for this form.", false);
            rawResponsesTable.classList.add('hidden'); // Ensure table is hidden
            if (exportRawCsvBtn) exportRawCsvBtn.classList.add('hidden');
             // Disable AI analysis if no responses
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
                analyzeBtn.title = "Cannot analyze without responses.";
            }
            return; // Don't proceed to structure data
        }

        // Structure data with candidates as rows
        const questions = [...formStructure.questions];
        const structuredResponses = []; // Array of candidate objects

        Object.keys(allResponsesData).forEach((responseId) => {
            const rawResponse = allResponsesData[responseId];
            // Try to get respondent name from a common question ID like 'name'
            const respondentIdentifier = rawResponse.responses?.['name']?.answer || `Response ${structuredResponses.length + 1}`;

            const candidateData = {
                responseId: responseId,
                identifier: respondentIdentifier, // Use name or fallback
                submittedAt: rawResponse.submittedAt ? new Date(rawResponse.submittedAt).toISOString() : null,
                answers: {}, // Use question ID as key for answers
                // Placeholders for AI analysis results (will be populated after analysis)
                aiScores: rawResponse.aiScores || {}, // Keep potential cached scores if any
                aiRecommendation: rawResponse.aiRecommendation || null, // Keep potential cached recommendation
                 aiFitScore: null, // Will be calculated after analysis
                 aiConfidence: null, // Placeholder
                 aiStrengths: rawResponse.aiStrengths || [], // Keep potential cached strengths
                 aiWeaknesses: rawResponse.weaknesses || [] // Keep potential cached weaknesses
            };

            questions.forEach(q => {
                const answerData = rawResponse.responses?.[q.id];
                let answerValue = answerData?.answer ?? '';
                if (Array.isArray(answerValue)) {
                    answerValue = answerValue.join(', '); // Join with comma for display in table
                }
                candidateData.answers[q.id] = answerValue;
            });
            structuredResponses.push(candidateData);
        });

        // Sort responses by submission time (optional, newest first)
        structuredResponses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        comparisonData = {
            questions: questions, // Keep full question objects for text/type
            responses: structuredResponses, // Array of candidate data
            parameters: formParameters // Saved parameters from the form
        };

        console.log("Comparison Data Ready:", comparisonData);
        updateStatus(rawTableStatusDiv, "", false); // Clear status message for raw table
        renderRawResponsesTable(); // Render the initial raw responses table
        if (exportRawCsvBtn) exportRawCsvBtn.classList.remove('hidden');


         // Enable AI analysis button if data is loaded
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.title = ""; // Clear potential tooltip
        }

         // If AI analysis results are already cached in responses, render the AI table and charts immediately
         const hasCachedAIResults = comparisonData.responses.some(res => Object.keys(res.aiScores).length > 0 || res.aiRecommendation !== null);
         if (hasCachedAIResults) {
             console.log("Cached AI analysis results found. Rendering AI table and charts.");
              // Recalculate aiFitScore for cached results if needed
              comparisonData.responses.forEach(candidate => {
                 const scores = candidate.aiScores || {};
                 const scoreKeys = Object.keys(scores);
                 let fitScore = null;
                 if (scoreKeys.length > 0) {
                      const validScores = scoreKeys.map(key => scores[key]).filter(score => typeof score === 'number' && !isNaN(score));
                      if (validScores.length > 0) {
                          const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
                          fitScore = average.toFixed(1); // Display average rounded to 1 decimal place
                      }
                 }
                 candidate.aiFitScore = fitScore;
                 candidate.aiConfidence = 'N/A'; // Placeholder
             });

             renderAIComparisonTable();
             // Need the raw AI comparison results structure for charts, not just the cached data in responses
             // If backend doesn't provide a way to retrieve cached *raw* AI results, charts might not render correctly.
             // Assuming for now that `aiComparisonResults` would be populated from cache if available.
             // Since the backend doesn't seem to cache the *raw* analysis output, we'll skip chart rendering on initial load with cache.
             // Charts will only render after a fresh analysis.
              // renderCharts(comparisonData.responses, comparisonData.parameters); // This would try to use the modified comparisonData, not the raw AI output
              if (aiComparisonOutputDiv) aiComparisonOutputDiv.classList.remove('hidden'); // Show the section even with just cached table data
         }


    } catch (error) {
        console.error("Error loading comparison data:", error);
        updateStatus(rawTableStatusDiv, `Error loading data: ${error.message}`, true);
        if (formTitleElement) formTitleElement.textContent = "Error Loading Data";
        rawResponsesTable.classList.add('hidden');
        if (exportRawCsvBtn) exportRawCsvBtn.classList.add('hidden');
         // Disable AI analysis on error
         if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.title = "Error loading data prevented analysis.";
         }
    }
}

// --- Update Status Message for a Specific Table ---
function updateStatus(statusDivElement, message, isError = false) {
    if (!statusDivElement) return;
    if (message) {
        statusDivElement.innerHTML = message;
        statusDivElement.classList.remove('hidden');
        statusDivElement.classList.toggle('error', isError);
        // Hide the associated table when status is shown
        if (statusDivElement === rawTableStatusDiv && rawResponsesTable) rawResponsesTable.classList.add('hidden');
        if (statusDivElement === aiTableStatusDiv && aiComparisonTable) aiComparisonTable.classList.add('hidden');
    } else {
        statusDivElement.classList.add('hidden'); // Hide status when no message
         // Show the associated table when status is hidden (unless it's the AI table before analysis)
        if (statusDivElement === rawTableStatusDiv && rawResponsesTable) rawResponsesTable.classList.remove('hidden');
        // AI table is shown only after analysis is complete
    }
}

// --- Render Raw Responses Table ---
function renderRawResponsesTable() {
    if (!comparisonData || !rawResponsesTable || !rawTableHeaderRow || !rawTableBody) {
        console.error("Cannot render raw table: Data or DOM elements missing.");
        updateStatus(rawTableStatusDiv, "Error rendering raw table.", true);
        return;
    }

    const { questions, responses } = comparisonData;

    // Clear previous table content
    rawTableHeaderRow.innerHTML = '';
    rawTableBody.innerHTML = '';

    if (responses.length === 0) {
        updateStatus(rawTableStatusDiv, "No responses found for this form.", false);
        rawResponsesTable.classList.add('hidden');
         if (exportRawCsvBtn) exportRawCsvBtn.classList.add('hidden');
        return;
    }

    // --- Build Header Row for Raw Table ---
    const rawHeaders = ['Candidate', 'Submitted At'];
    // Add headers for each question text
    questions.forEach(q => rawHeaders.push(q.text));

    rawHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        rawTableHeaderRow.appendChild(th);
    });

    // --- Build Body Rows for Raw Table ---
    responses.forEach(candidate => {
        const tr = document.createElement('tr');
        tr.dataset.responseId = candidate.responseId; // Add data attribute

        // Candidate Identifier Cell
        const tdIdentifier = document.createElement('td');
        tdIdentifier.textContent = candidate.identifier;
        tr.appendChild(tdIdentifier);

        // Submitted At Cell
        const tdSubmitted = document.createElement('td');
        tdSubmitted.textContent = candidate.submittedAt ? new Date(candidate.submittedAt).toLocaleString() : 'N/A';
        tr.appendChild(tdSubmitted);

        // Cells for each question's answer
        questions.forEach(q => {
            const td = document.createElement('td');
            const answer = candidate.answers[q.id] || '';
            td.textContent = answer;
            td.title = answer; // Add tooltip for long answers
            tr.appendChild(td);
        });

        rawTableBody.appendChild(tr);
    });

    rawResponsesTable.classList.remove('hidden'); // Show the raw table
    if (exportRawCsvBtn) exportRawCsvBtn.classList.remove('hidden');
}


// --- Render AI Comparison Table ---
function renderAIComparisonTable() {
     // This function is called AFTER AI analysis is complete and results are added to comparisonData.responses

    if (!comparisonData || !aiComparisonTable || !aiTableHeaderRow || !aiTableBody) {
        console.error("Cannot render AI comparison table: Data or DOM elements missing.");
        updateStatus(aiTableStatusDiv, "Error rendering AI comparison table.", true);
        return;
    }

    const { responses, parameters } = comparisonData; // Use responses which now have AI results

    // Clear previous table content
    aiTableHeaderRow.innerHTML = '';
    aiTableBody.innerHTML = '';

     // Filter responses to only include those that have been analyzed
     let analyzedResponses = responses.filter(res => Object.keys(res.aiScores).length > 0 || res.aiRecommendation !== null);

     // --- Sort the analyzed responses by AI Fit Score (descending) ---
     analyzedResponses.sort((a, b) => {
         const scoreA = a.aiFitScore !== null ? parseFloat(a.aiFitScore) : -Infinity; // Treat null/invalid as lowest
         const scoreB = b.aiFitScore !== null ? parseFloat(b.aiFitScore) : -Infinity; // Treat null/invalid as lowest
         return scoreB - scoreA; // Sort descending
     });


     if (analyzedResponses.length === 0) {
        updateStatus(aiTableStatusDiv, "No AI analysis results found.", false);
         aiComparisonResultsSection.classList.remove('hidden'); // Show the section even if empty
        aiComparisonTable.classList.add('hidden');
        if (exportAiCsvBtn) exportAiCsvBtn.classList.add('hidden');
        return;
    }

    // --- Build Header Row for AI Table ---
    // Headers: Candidate, Submitted At, Parameter Scores, AI Fit Score, Confidence Level, Strength Highlights, Weakness Highlights, Recommendation, Action
    const aiHeaders = [
        'Candidate',
        'Submitted At',
        'Parameter Scores',
        'AI Fit Score', // New Header
        'Confidence Level', // New Header
        'Strength Highlights', // New Header
        'Weakness Highlights', // New Header
        'Recommendation',
        'Action'
    ];

    aiHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        aiTableHeaderRow.appendChild(th);
    });

    // --- Build Body Rows for AI Table ---
    analyzedResponses.forEach(candidate => {
        const tr = document.createElement('tr');
        tr.dataset.responseId = candidate.responseId; // Add data attribute for easy lookup

        // Candidate Identifier Cell
        const tdIdentifier = document.createElement('td');
        tdIdentifier.textContent = candidate.identifier;
        tr.appendChild(tdIdentifier);

        // Submitted At Cell
        const tdSubmitted = document.createElement('td');
        tdSubmitted.textContent = candidate.submittedAt ? new Date(candidate.submittedAt).toLocaleString() : 'N/A';
        tr.appendChild(tdSubmitted);

        // Cell for Parameter Scores (Combined)
        const tdScores = document.createElement('td');
        let scoresHtml = '';
        const scores = candidate.aiScores || {};
        const scoreKeys = Object.keys(scores);

        if (scoreKeys.length > 0) {
             scoresHtml = scoreKeys.map(scoreKey => {
                 const score = scores[scoreKey] ?? '-';
                 return `<strong>${scoreKey}:</strong> ${score}/10`;
             }).join('<br>'); // Join with break tags for readability
        } else {
             scoresHtml = '-';
        }
        tdScores.innerHTML = scoresHtml; // Use innerHTML because we are adding HTML breaks
        tr.appendChild(tdScores);

        // Cell for AI Fit Score (Average of Parameter Scores)
        const tdFitScore = document.createElement('td');
        tdFitScore.textContent = candidate.aiFitScore ?? '-'; // Use the pre-calculated score
        tdFitScore.style.textAlign = 'center';
        tr.appendChild(tdFitScore);

        // Cell for Confidence Level (Placeholder)
        const tdConfidence = document.createElement('td');
        tdConfidence.textContent = candidate.aiConfidence ?? 'N/A'; // Use the pre-calculated or default
        tdConfidence.style.textAlign = 'center';
        tr.appendChild(tdConfidence);

        // Cell for Strength Highlights
        const tdStrengths = document.createElement('td');
        const strengths = candidate.aiStrengths || [];
        if (strengths.length > 0) {
             // Display first 3 strengths, joined by comma
             tdStrengths.textContent = strengths.slice(0, 3).join(', ') + (strengths.length > 3 ? '...' : '');
             tdStrengths.title = strengths.join('\n'); // Full list on hover
        } else {
             tdStrengths.textContent = '-';
        }
        tr.appendChild(tdStrengths);

        // Cell for Weakness Highlights
        const tdWeaknesses = document.createElement('td');
        const weaknesses = candidate.aiWeaknesses || [];
         if (weaknesses.length > 0) {
             // Display first 3 weaknesses, joined by comma
             tdWeaknesses.textContent = weaknesses.slice(0, 3).join(', ') + (weaknesses.length > 3 ? '...' : '');
             tdWeaknesses.title = weaknesses.join('\n'); // Full list on hover
         } else {
             tdWeaknesses.textContent = '-';
         }
        tr.appendChild(tdWeaknesses);


        // Cell for AI Recommendation
        const tdRecommendation = document.createElement('td');
        const recommendation = candidate.aiRecommendation ?? '-'; // Use cached or '-'
        tdRecommendation.textContent = recommendation;
        tdRecommendation.style.textAlign = 'center'; // Center recommendation
        // Add styling based on recommendation
        tdRecommendation.style.backgroundColor = ''; // Clear previous background
        if (recommendation.toLowerCase() === 'fit') tdRecommendation.style.backgroundColor = '#d1fae5'; // green-100
        else if (recommendation.toLowerCase() === 'maybe') tdRecommendation.style.backgroundColor = '#fffbeb'; // yellow-100
        else if (recommendation.toLowerCase() === 'not fit') tdRecommendation.style.backgroundColor = '#fee2e2'; // red-100
        tr.appendChild(tdRecommendation);


        // Cell for Action Button ("View AI Summary")
        const tdAction = document.createElement('td');
        const viewSummaryBtn = document.createElement('button');
        viewSummaryBtn.textContent = 'View Details';
        viewSummaryBtn.classList.add('action-button', 'bg-blue-500', 'hover:bg-blue-600', 'text-white', 'text-xs', 'py-1', 'px-2');
        viewSummaryBtn.dataset.responseId = candidate.responseId; // Link button to response ID
        viewSummaryBtn.addEventListener('click', handleViewSummary);
        tdAction.appendChild(viewSummaryBtn);
        tdAction.style.textAlign = 'center'; // Center button
        tr.appendChild(tdAction);

        aiTableBody.appendChild(tr);
    });

     aiComparisonResultsSection.classList.remove('hidden'); // Show the section containing the AI table
    aiComparisonTable.classList.remove('hidden'); // Show the AI table
    updateStatus(aiTableStatusDiv, "", false); // Clear AI table status message
    if (exportAiCsvBtn) exportAiCsvBtn.classList.remove('hidden');

}


// --- Handle AI Comparison Analysis Button Click ---
async function handleComparatorAIAnalysis() {
    if (!comparisonData || comparisonData.responses.length === 0) {
        alert("No response data loaded to analyze.");
        return;
    }
    if (!aiInstructionsTextarea) return;

    const instructions = aiInstructionsTextarea.value;
    const formTitle = formTitleElement?.textContent.replace('Comparing Responses for: ', '').trim() || 'Unknown Form';

    // Show loading state
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Analyzing...';
    aiComparisonErrorMessagePara.classList.add('hidden');
     // Clear and hide previous AI table results and summary while analyzing
     aiTableBody.innerHTML = '';
     aiComparisonTable.classList.add('hidden');
     aiComparisonResultsSection.classList.add('hidden'); // Hide the AI table section
     // aiComparisonOutputDiv.classList.add('hidden'); // Keep this visible to show loading state
     aiComparisonResultContentDiv.innerHTML = '<p class="text-gray-500 italic text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Generating summary and charts...</p>'; // Loading message for summary area
     // Clear charts
     if (chartsContainer) chartsContainer.innerHTML = ''; // Clear all charts

     updateStatus(aiTableStatusDiv, "Running AI analysis...", false); // Show status for AI table area
     if (aiComparisonOutputDiv) aiComparisonOutputDiv.classList.remove('hidden');


    // Prepare payload for the backend comparison endpoint
    const payload = {
        jobTitle: formTitle,
        aiCriteria: instructions,
        parameters: comparisonData.parameters, // Send the saved parameters
        // Send structured candidate responses suitable for the backend
        candidates: comparisonData.responses.map(candidate => ({
            responseId: candidate.responseId,
            identifier: candidate.identifier,
            answers: Object.keys(candidate.answers).map(qId => ({
                questionId: qId,
                questionText: comparisonData.questions.find(q => q.id === qId)?.text || `Question ${qId}`, // Include question text
                answer: candidate.answers[qId]
            }))
        }))
    };

    console.log("Sending data for AI comparison analysis:", payload);

    try {
        const response = await fetch('/api/compare-candidates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            console.error('Backend API Error (Comparison):', response.status, errorDetail);
            throw new Error(`Comparison analysis failed: ${response.statusText} - ${errorDetail}`);
        }

        aiComparisonResults = await response.json(); // Store the raw results
        console.log('AI Comparison Results (Raw from Backend):', aiComparisonResults); // Log raw results

        // Update the cached comparisonData.responses with AI results
        if (aiComparisonResults && Array.isArray(aiComparisonResults)) {
             let formattedSummaryHtml = '';
            aiComparisonResults.forEach(result => {
                 // Find the corresponding candidate in the cached data
                const candidateData = comparisonData.responses.find(res => res.responseId === result.responseId);
                if (candidateData) {
                     candidateData.aiScores = result.scores || {};
                     candidateData.aiRecommendation = result.recommendation || null;
                     // Store strengths and weaknesses from the comparative analysis result
                     candidateData.aiStrengths = result.strengths || []; // Assuming backend returns this in comparative analysis
                     candidateData.aiWeaknesses = result.weaknesses || []; // Assuming backend returns this in comparative analysis

                     // Calculate AI Fit Score (Average of scores)
                     const scores = candidateData.aiScores || {}; // Use updated scores
                     const scoreKeys = Object.keys(scores);
                     let fitScore = null;
                     if (scoreKeys.length > 0) {
                         const validScores = scoreKeys.map(key => scores[key]).filter(score => typeof score === 'number' && !isNaN(score));
                         if (validScores.length > 0) {
                             const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
                             fitScore = average.toFixed(1); // Display average rounded to 1 decimal place
                         }
                     }
                     candidateData.aiFitScore = fitScore;
                     candidateData.aiConfidence = 'N/A'; // Placeholder as AI doesn't provide this
                }

                // Format the brief summary for the output div
                 let recommendationClass = '';
                 if (result.recommendation?.toLowerCase() === 'fit') recommendationClass = 'fit';
                 else if (result.recommendation?.toLowerCase() === 'maybe') recommendationClass = 'maybe';
                 else if (result.recommendation?.toLowerCase() === 'not fit') recommendationClass = 'not-fit';

                 formattedSummaryHtml += `
                    <div class="ai-comparison-summary-item">
                        <h4><i class="fas fa-user-circle"></i>${result.identifier || 'Candidate'}</h4>
                        <p>Recommendation: <span class="recommendation ${recommendationClass}">${result.recommendation || '-'}</span></p>
                        <p>AI Fit Score: <strong>${candidateData?.aiFitScore ?? '-'}</strong></p>
                        <p>Confidence Level: <strong>${candidateData?.aiConfidence ?? '-'}</strong></p>
                        <p>Scores:</p>
                        <ul class="scores-list">
                            ${Object.keys(result.scores || {}).map(scoreKey => `<li><strong>${scoreKey}:</strong> ${result.scores[scoreKey]}/10</li>`).join('')}
                            ${Object.keys(result.scores || {}).length === 0 ? '<li>No scores provided.</li>' : ''}
                        </ul>
                         <p>Strength Highlights: ${candidateData?.aiStrengths.slice(0, 3).join(', ') + (candidateData?.aiStrengths.length > 3 ? '...' : '') || '-'}</p>
                         <p>Weakness Highlights: ${candidateData?.aiWeaknesses.slice(0, 3).join(', ') + (candidateData?.aiWeaknesses.length > 3 ? '...' : '') || '-'}</p>

                    </div>
                 `;
            });
             aiComparisonResultContentDiv.innerHTML = formattedSummaryHtml;

             // Now render the AI comparison table using the updated cache
             renderAIComparisonTable();

             // Render Charts using the raw AI comparison results and loaded parameters
             renderCharts(aiComparisonResults, comparisonData.parameters);


             // Show the summary section
             // aiComparisonOutputDiv.classList.remove('hidden'); // Already shown with loading

        } else {
             aiComparisonResultContentDiv.innerHTML = '<p class="text-gray-500 italic">AI analysis returned an unexpected format.</p>';
             console.warn("AI comparison analysis returned unexpected data:", aiComparisonResults);
             updateStatus(aiTableStatusDiv, "AI analysis returned unexpected data format.", true);
             if (chartsContainer) chartsContainer.innerHTML = ''; // Clear charts on unexpected format
        }


    } catch (error) {
        console.error('Error during AI comparison analysis:', error);
        aiComparisonErrorMessagePara.textContent = `Analysis Error: ${error.message}`;
        aiComparisonErrorMessagePara.classList.remove('hidden');
        aiComparisonResultContentDiv.innerHTML = ''; // Clear content on error
        if (chartsContainer) chartsContainer.innerHTML = '<p class="text-red-500 italic text-center">Error rendering charts due to analysis failure.</p>'; // Show chart error
        // aiComparisonOutputDiv.classList.remove('hidden'); // Already shown
        updateStatus(aiTableStatusDiv, `AI analysis failed: ${error.message}`, true); // Show error in AI table area
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Analyze with AI';
    }
}

// --- Handle View AI Summary Button Click ---
async function handleViewSummary(event) {
    const button = event.target.closest('.action-button'); // Use closest to handle icon clicks
    const responseId = button?.dataset.responseId;

    if (!responseId || !comparisonData || !comparisonData.responses) {
        console.error("Cannot view summary: responseId missing or data not loaded.");
        return;
    }

    const candidateData = comparisonData.responses.find(res => res.responseId === responseId);

    if (!candidateData) {
        console.error("Candidate data not found for responseId:", responseId);
        alert("Could not find candidate data for summary.");
        return;
    }

    // Prepare Q&A pairs for the single-candidate analysis endpoint
    const qaPairs = Object.keys(candidateData.answers).map(qId => ({
        question: comparisonData.questions.find(q => q.id === qId)?.text || `Question ${qId}`,
        answer: candidateData.answers[qId]
    }));

    const formTitle = formTitleElement?.textContent.replace('Comparing Responses for: ', '').trim() || 'Unknown Job Title';
    const instructions = aiInstructionsTextarea.value; // Use the current instructions from the comparison page
    const parameters = comparisonData.parameters; // Use the saved parameters

    const resumeContentPlaceholder = 'No resume provided.'; // Placeholder

    const payload = {
        jobTitle: formTitle,
        parameters: parameters,
        aiCriteria: instructions, // Pass the comparison instructions here
        candidateResponses: qaPairs,
        resumeContent: resumeContentPlaceholder
    };

    console.log("Sending data for single AI analysis (for summary):", payload);

    // Show loading state in the modal
    if (aiSummaryModal && summaryCandidateNameSpan && summaryAnalysisContentDiv && summaryErrorMessagePara) {
        summaryCandidateNameSpan.textContent = candidateData.identifier;
        summaryAnalysisContentDiv.innerHTML = '<p class="text-gray-500 italic text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Generating summary...</p>';
        summaryErrorMessagePara.classList.add('hidden');
        aiSummaryModal.classList.remove('hidden');
        document.body.classList.add('body-blur');
    } else {
         console.error("AI Summary Modal elements not found.");
         alert("Error displaying summary modal.");
         return;
    }


    try {
        // Call the backend endpoint '/api/analyze-candidate'
        const response = await fetch('/api/analyze-candidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            console.error('Backend API Error (Single Analysis):', response.status, errorDetail);
            throw new Error(`Analysis failed: ${response.statusText} - ${errorDetail}`);
        }

        const analysisResult = await response.json();
        console.log('Single AI Analysis Result:', analysisResult);

        // Display the result in the modal
        if (summaryAnalysisContentDiv) {
             displayAnalysisResult(summaryAnalysisContentDiv, analysisResult);
             if (summaryErrorMessagePara) summaryErrorMessagePara.classList.add('hidden'); // Hide error on success
        }


    } catch (error) {
        console.error('Error during single AI analysis:', error);
        if (summaryAnalysisContentDiv && summaryErrorMessagePara) {
             summaryAnalysisContentDiv.innerHTML = ''; // Clear loading/previous content
             summaryErrorMessagePara.textContent = `Analysis Error: ${error.message}`;
             summaryErrorMessagePara.classList.remove('hidden');
        }
    }
}

// Function to display the AI analysis result in a given container (reused from results.js)
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


// --- Chart Rendering Functions (using D3.js) ---

function renderCharts(analysisResults, parameters) {
    console.log("Attempting to render charts...");
    console.log("Analysis Results for Charts:", analysisResults);
    console.log("Parameters for Charts:", parameters);

    // Use the raw AI comparison results structure for charting
    if (!chartsContainer || !analysisResults || analysisResults.length === 0) {
        console.warn("Cannot render charts: Data or container missing or empty.");
        if (chartsContainer) chartsContainer.innerHTML = '<p class="text-gray-500 italic text-center">No data available to render charts.</p>';
        // Ensure charts container is not hidden if it exists
         if (chartsContainer) chartsContainer.classList.remove('hidden');
        return;
    }

    // Clear previous charts
    chartsContainer.innerHTML = '';

    // Add chart containers back
    // These divs are now always present in the HTML, but we re-add them here
    // to ensure they are empty before rendering.
    chartsContainer.innerHTML = `
        <div id="recommendation-pie-chart" class="chart-container">
            <h3>Recommendation Distribution</h3>
            <svg></svg>
        </div>
        <div id="parameter-horizontal-bar-chart" class="chart-container">
             <h3>Average Parameter Scores Across Candidates</h3>
            <svg></svg>
        </div>
         <div id="candidate-stacked-bar-chart" class="chart-container">
             <h3>Parameter Score Distribution per Candidate</h3>
             <svg></svg>
         </div>
          <div id="parameter-diverging-bar-chart" class="chart-container">
             <h3>Parameter Performance Relative to Average</h3>
             <svg></svg>
         </div>
    `;

    // Ensure the charts container itself is visible (redundant due to HTML change, but safe)
     chartsContainer.classList.remove('hidden');

    // Filter out candidates with no scores/recommendations for charting data
    const chartData = analysisResults.filter(d => Object.keys(d.scores || {}).length > 0 || d.recommendation);

    console.log("Filtered Chart Data (with scores or recommendation):", chartData);

     if (chartData.length === 0) {
         chartsContainer.innerHTML = '<p class="text-gray-500 italic text-center">No AI analysis results with scores or recommendations to render charts.</p>';
         console.warn("No filtered chart data available.");
         return;
     }

    // Render Pie Chart (only needs recommendation data)
    console.log("Rendering Recommendation Pie Chart...");
    renderRecommendationPieChart(chartData);

    // Filter data specifically for bar charts (requires scores)
    const barChartData = chartData.filter(d => Object.keys(d.scores || {}).length > 0);
    console.log("Filtered Bar Chart Data (with scores):", barChartData);

    // Determine parameter names to use for bar charts
    let chartParameters = parameters && parameters.length > 0 ? parameters.map(p => p.name) : [];

    // If form parameters are missing or empty, extract keys from the first candidate's scores
    if (chartParameters.length === 0 && barChartData.length > 0) {
         chartParameters = Object.keys(barChartData[0].scores || {});
         console.log("Using score keys from AI results as chart parameters:", chartParameters);
    } else if (chartParameters.length > 0 && barChartData.length > 0) {
        console.log("Using form parameters for charts:", chartParameters);
        // Optional: Filter form parameters to only include those present in AI scores if needed
        // chartParameters = chartParameters.filter(pName => barChartData.some(d => d.scores?.[pName] !== undefined));
        // console.log("Filtered form parameters based on available scores:", chartParameters);
    }


    // Check if there are parameters (either from form or extracted) and data with scores before rendering bar charts
    if (chartParameters.length > 0 && barChartData.length > 0) {
        console.log("Rendering Parameter Horizontal Bar Chart...");
        renderParameterHorizontalBarChart(barChartData, chartParameters); // Pass extracted/filtered names

        console.log("Rendering Candidate Stacked Bar Chart...");
        renderCandidateStackedBarChart(barChartData, chartParameters); // Pass extracted/filtered names

        console.log("Rendering Parameter Diverging Bar Chart...");
        renderParameterDivergingBarChart(barChartData, chartParameters); // Pass extracted/filtered names
    } else {
        console.warn("Skipping bar chart rendering: Not enough parameters (from form or scores) or data with scores.");
        // Optionally add messages to the specific chart containers indicating why they are not shown
         if (document.getElementById('parameter-horizontal-bar-chart')) document.getElementById('parameter-horizontal-bar-chart').innerHTML += '<p class="text-gray-500 italic text-center text-sm mt-2">Not enough data or parameters for this chart.</p>';
         if (document.getElementById('candidate-stacked-bar-chart')) document.getElementById('candidate-stacked-bar-chart').innerHTML += '<p class="text-gray-500 italic text-center text-sm mt-2">Not enough data or parameters for this chart.</p>';
         if (document.getElementById('parameter-diverging-bar-chart')) document.getElementById('parameter-diverging-bar-chart').innerHTML += '<p class="text-gray-500 italic text-center text-sm mt-2">Not enough data or parameters for this chart.</p>';
    }
}

function renderRecommendationPieChart(data) {
    console.log("Data for Pie Chart:", data);
    const container = d3.select("#recommendation-pie-chart svg");
    if (container.empty()) {
        console.error("Pie chart SVG container not found.");
        return;
    }

    const width = 400, height = 400, radius = Math.min(width, height) / 2 - 20;

    // Clear previous chart
    container.selectAll("*").remove();

    const svg = container
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // Compute the counts for each recommendation
    const recommendationCounts = d3.rollup(data, v => v.length, d => d.recommendation || 'Unknown');
    const pieData = Array.from(recommendationCounts, ([key, value]) => ({ recommendation: key, count: value }));

    console.log("Pie Chart Data:", pieData);

    if (pieData.length === 0) {
         console.warn("No data for pie chart.");
         d3.select("#recommendation-pie-chart").select("svg").remove(); // Remove empty SVG
         d3.select("#recommendation-pie-chart").append("p").classed("text-gray-500 italic text-center text-sm mt-2", true).text("No recommendation data for this chart.");
         return;
    }


    const pie = d3.pie().value(d => d.count)(pieData);

    const arc = d3.arc().innerRadius(0).outerRadius(radius);

    const color = d3.scaleOrdinal(d3.schemeCategory10); // Or define custom colors

    svg.selectAll('arc')
        .data(pie)
        .enter()
        .append('g')
        .attr('class', 'arc')
        .append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.recommendation))
        .attr("stroke", "white")
        .style("stroke-width", "2px");

    // Add text labels
    svg.selectAll('text')
        .data(pie)
        .enter()
        .append('text')
        .text(d => `${d.data.recommendation} (${d.data.count})`)
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .style("text-anchor", "middle")
        .style("font-size", 12)
        .style("fill", "white")
        .style("pointer-events", "none"); // Prevent text from blocking mouse events

    // Ensure the chart container is visible (redundant due to HTML change, but safe)
     d3.select("#recommendation-pie-chart").classed('hidden', false);
     console.log("Recommendation Pie Chart rendered.");
}

function renderParameterHorizontalBarChart(data, parameterNames) { // Accepts parameter names array
    console.log("Data for Parameter Horizontal Bar Chart:", data);
    console.log("Parameter Names for Horizontal Bar Chart:", parameterNames);

    const container = d3.select("#parameter-horizontal-bar-chart svg");
     if (container.empty()) {
         console.error("Parameter horizontal bar chart SVG container not found.");
         return;
     }

     if (!parameterNames || parameterNames.length === 0 || !data || data.length === 0) {
         console.warn("Not enough data or parameters for parameter horizontal bar chart.");
         container.select("svg").remove(); // Remove empty SVG
         d3.select("#parameter-horizontal-bar-chart").append("p").classed("text-gray-500 italic text-center text-sm mt-2", true).text("Not enough data or parameters for this chart.");
         return;
     }


    const margin = { top: 20, right: 30, bottom: 40, left: 120 },
        width = 600 - margin.left - margin.right,
        height = (parameterNames.length * 40); // Adjust height based on number of parameters

     // Clear previous chart
    container.selectAll("*").remove();

    const svg = container
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate average scores per parameter name
    const parameterAverages = parameterNames.map(paramName => {
        const scores = data.map(d => d.scores?.[paramName]).filter(s => typeof s === 'number' && !isNaN(s));
        const average = scores.length > 0 ? d3.mean(scores) : 0;
        return { name: paramName, average: average };
    });

    // Filter out parameters with no valid scores
    const validParameterAverages = parameterAverages.filter(p => p.average > 0);
    console.log("Valid Parameter Averages:", validParameterAverages);

    if (validParameterAverages.length === 0) {
        console.warn("No valid parameter averages to display in horizontal bar chart.");
         container.select("svg").remove(); // Remove empty SVG
         d3.select("#parameter-horizontal-bar-chart").append("p").classed("text-gray-500 italic text-center text-sm mt-2", true).text("No valid score data for this chart.");
         return;
    }

    // Sort by average score
    validParameterAverages.sort((a, b) => b.average - a.average);

     // Update height based on valid parameters
     const updatedHeight = (validParameterAverages.length * 40) - margin.top - margin.bottom;
     svg.attr("height", updatedHeight + margin.top + margin.bottom);


    const y = d3.scaleBand()
        .range([updatedHeight, 0])
        .domain(validParameterAverages.map(d => d.name))
        .padding(0.1);

    const x = d3.scaleLinear()
        .domain([0, 10]) // Scores are 1-10
        .range([0, width]);

    svg.append("g")
        .call(d3.axisLeft(y));

    svg.append("g")
        .attr("transform", `translate(0,${updatedHeight})`)
        .call(d3.axisBottom(x));

    svg.selectAll(".bar")
        .data(validParameterAverages)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d.name))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", d => x(d.average))
        .attr("fill", "#4f46e5"); // Indigo-600

    // Add labels
     svg.selectAll(".label")
        .data(validParameterAverages)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => x(d.average) + 5) // Position slightly to the right of the bar
        .attr("y", d => y(d.name) + y.bandwidth() / 2)
        .attr("dy", ".35em") // Vertically center
        .text(d => d.average.toFixed(1))
        .style("font-size", 10);

     // Ensure the chart container is visible (redundant due to HTML change, but safe)
    d3.select("#parameter-horizontal-bar-chart").classed('hidden', false);
    console.log("Parameter Horizontal Bar Chart rendered.");
}

function renderCandidateStackedBarChart(data, parameterNames) { // Accepts parameter names array
    console.log("Data for Candidate Stacked Bar Chart:", data);
    console.log("Parameter Names for Candidate Stacked Bar Chart:", parameterNames);
    const container = d3.select("#candidate-stacked-bar-chart svg");
     if (container.empty()) {
         console.error("Candidate stacked bar chart SVG container not found.");
         return;
     }

     if (!parameterNames || parameterNames.length === 0 || !data || data.length === 0) {
         console.warn("Not enough data or parameters for candidate stacked bar chart.");
         container.select("svg").remove(); // Remove empty SVG
         d3.select("#candidate-stacked-bar-chart").append("p").classed("text-gray-500 italic text-center text-sm mt-2", true).text("Not enough data or parameters for this chart.");
         return;
     }


    const margin = { top: 20, right: 30, bottom: 40, left: 120 },
        width = 600 - margin.left - margin.right,
        height = (data.length * 40); // Adjust height based on number of candidates

     // Clear previous chart
    container.selectAll("*").remove();

    const svg = container
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data for stacking: array of objects, each object is a candidate, keys are parameter names + identifier
    const stackedData = data.map(d => {
        const obj = { identifier: d.identifier };
        parameterNames.forEach(pName => { // Use parameter names from the array
            // Use 0 for missing or non-numeric scores in stack
            obj[pName] = (typeof d.scores?.[pName] === 'number' && !isNaN(d.scores?.[pName])) ? d.scores?.[pName] : 0;
        });
        return obj;
    });

    const keys = parameterNames; // Use the provided parameter names as keys for stacking

     // Filter out keys that have no data across all candidates
     const validKeys = keys.filter(key => stackedData.some(d => d[key] > 0));
     console.log("Valid Keys for Stacked Chart:", validKeys);

     if (validKeys.length === 0) {
         console.warn("No valid scores across all candidates for stacked bar chart.");
         container.select("svg").remove(); // Remove empty SVG
         d3.select("#candidate-stacked-bar-chart").append("p").classed("text-gray-500 italic text-center text-sm mt-2", true).text("No valid score data across candidates for this chart.");
         return;
     }


    const stack = d3.stack().keys(validKeys); // Use valid keys for stacking
    const series = stack(stackedData);

     // Update height based on number of candidates
     const updatedHeight = (data.length * 40) - margin.top - margin.bottom;
     svg.attr("height", updatedHeight + margin.top + margin.bottom);

    const x = d3.scaleLinear()
        .domain([0, d3.max(series, d => d3.max(d, d => d[1]))]) // Max total score across all candidates
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(stackedData.map(d => d.identifier))
        .range([updatedHeight, 0])
        .padding(0.1);

    const color = d3.scaleOrdinal(d3.schemeCategory10); // Color scale for parameters

    svg.append("g")
        .call(d3.axisLeft(y));

    svg.append("g")
        .attr("transform", `translate(0,${updatedHeight})`)
        .call(d3.axisBottom(x));

    svg.selectAll(".series")
        .data(series)
        .enter()
        .append("g")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(d.data.identifier))
        .attr("height", y.bandwidth())
        .attr("width", d => x(d[1]) - x(d[0]));

    // Add a simple legend (optional)
    const legend = svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "end")
        .selectAll("g")
        .data(validKeys.slice().reverse()) // Reverse keys to match stack order
        .enter()
        .append("g")
        .attr("transform", (d, i) => `translate(0,${i * 20})`);

    legend.append("rect")
        .attr("x", width - 19)
        .attr("width", 19)
        .attr("height", 19)
        .attr("fill", color);

    legend.append("text")
        .attr("x", width - 24)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .text(d => d);

     // Ensure the chart container is visible (redundant due to HTML change, but safe)
    d3.select("#candidate-stacked-bar-chart").classed('hidden', false);
    console.log("Candidate Stacked Bar Chart rendered.");
}

function renderParameterDivergingBarChart(data, parameterNames) { // Accepts parameter names array
     console.log("Data for Parameter Diverging Bar Chart:", data);
     console.log("Parameter Names for Diverging Bar Chart:", parameterNames);
     const container = d3.select("#parameter-diverging-bar-chart svg");
     if (container.empty()) {
         console.error("Parameter diverging bar chart SVG container not found.");
         return;
     }

     if (!parameterNames || parameterNames.length === 0 || !data || data.length === 0) {
         console.warn("Not enough data or parameters for parameter diverging bar chart.");
         container.select("svg").remove(); // Remove empty SVG
         d3.select("#parameter-diverging-bar-chart").append("p").classed("text-gray-500 italic text-center text-sm mt-2", true).text("Not enough data or parameters for this chart.");
         return;
     }


     const margin = { top: 20, right: 30, bottom: 40, left: 120 },
        width = 600 - margin.left - margin.right;
        // Height will be calculated based on filtered data


     // Flatten data: one entry per candidate-parameter combination, only include if score is valid
    const flatData = [];
    data.forEach(candidate => {
        parameterNames.forEach(paramName => { // Use parameter names from the array
            const score = candidate.scores?.[paramName];
             // Only include if score is a valid number
            if (typeof score === 'number' && !isNaN(score)) {
                 flatData.push({
                     candidate: candidate.identifier,
                     parameter: paramName, // Use the parameter name
                     score: +score // Ensure score is a number
                 });
             }
        });
    });

    console.log("Flattened Data for Diverging Chart:", flatData);

     if (flatData.length === 0) {
         console.warn("No valid score data points for diverging bar chart.");
         container.select("svg").remove(); // Remove empty SVG
         d3.select("#parameter-diverging-bar-chart").append("p").classed("text-gray-500 italic text-center text-sm mt-2", true).text("No valid score data points for this chart.");
         return;
     }


    // Calculate average score across all candidates for each parameter
    const parameterAverages = d3.rollup(flatData, v => d3.mean(v, d => d.score), d => d.parameter);
     console.log("Parameter Averages for Diverging Chart:", parameterAverages);


    // Calculate the deviation from the average for each data point
    flatData.forEach(d => {
        const average = parameterAverages.get(d.parameter) || 0;
        d.deviation = d.score - average;
    });

    // Sort by parameter, then by deviation
    flatData.sort((a, b) => {
        if (a.parameter !== b.parameter) return d3.ascending(a.parameter, b.parameter);
        return d3.ascending(a.deviation, b.deviation);
    });

     // Calculate height based on the number of data points
     const updatedHeight = (flatData.length * 20) - margin.top - margin.bottom; // 20px per bar approx

    const svg = container
        .attr("width", width + margin.left + margin.right)
        .attr("height", updatedHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);


    const y = d3.scaleBand()
        .range([updatedHeight, 0])
        .domain(flatData.map(d => `${d.candidate} - ${d.parameter}`)) // Unique domain for each bar
        .padding(0.1);

     // Find the maximum absolute deviation to center the scale
    const maxDeviation = d3.max(flatData, d => Math.abs(d.deviation));

    const x = d3.scaleLinear()
        .domain([-maxDeviation, maxDeviation]) // Centered domain
        .range([0, width]);

    const color = d3.scaleOrdinal(['#ef4444', '#22c55e']); // Red for below average, Green for above average

    svg.append("g")
        .call(d3.axisLeft(y));

    // Add a vertical line at the zero point (average)
    svg.append("line")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y1", 0)
        .attr("y2", updatedHeight)
        .attr("stroke", "#9ca3af") // Gray-400
        .attr("stroke-dasharray", "4");

    svg.selectAll(".bar")
        .data(flatData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("y", d => y(`${d.candidate} - ${d.parameter}`))
        .attr("height", y.bandwidth())
        .attr("x", d => x(Math.min(0, d.deviation))) // Start from 0 or deviation
        .attr("width", d => Math.abs(x(d.deviation) - x(0))) // Width is absolute deviation
        .attr("fill", d => color(d.deviation > 0 ? 1 : 0)); // Color based on deviation

     // Add labels (optional, can get crowded)
     // svg.selectAll(".label")
     //    .data(flatData)
     //    .enter()
     //    .append("text")
     //    .attr("class", "label")
     //    .attr("x", d => x(d.deviation) + (d.deviation > 0 ? 5 : -5)) // Position based on deviation direction
     //    .attr("y", d => y(`${d.candidate} - ${d.parameter}`) + y.bandwidth() / 2)
     //    .attr("dy", ".35em")
     //    .style("text-anchor", d => d.deviation > 0 ? "start" : "end")
     //    .text(d => d.deviation.toFixed(1))
     //    .style("font-size", 8);

     // Ensure the chart container is visible (redundant due to HTML change, but safe)
    d3.select("#parameter-diverging-bar-chart").classed('hidden', false);
    console.log("Parameter Diverging Bar Chart rendered.");
}


// --- Export to CSV ---
function exportToCsv(tableType, filename) {
    if (!comparisonData || !comparisonData.responses || comparisonData.responses.length === 0) {
        alert("No data available to export.");
        return;
    }

    const { questions, responses, parameters } = comparisonData;
    let csvContent = "data:text/csv;charset=utf-8,";
    let headers = [];
    let dataRows = [];

    if (tableType === 'raw') {
        // Raw Table Headers: Candidate, Submitted At, Question Text 1, ...
        headers = ["\"Candidate\"", "\"Submitted At\"", ...questions.map(q => `"${q.text.replace(/"/g, '""')}"`)];

        // Raw Table Data Rows
        dataRows = responses.map(candidate => {
            const row = [
                `"${String(candidate.identifier).replace(/"/g, '""')}"`, // Candidate Name
                candidate.submittedAt ? `"${new Date(candidate.submittedAt).toLocaleString()}"` : "" // Submitted At
            ];
            questions.forEach(q => {
                const answer = candidate.answers[q.id] || '';
                 // Escape quotes within the answer, handle newlines, and wrap in quotes
                const formattedAnswer = `"${String(answer).replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
                row.push(formattedAnswer);
            });
            return row;
        });

        if (!filename) filename = 'raw_responses.csv';

    } else if (tableType === 'ai') {
         // Filter responses to only include those that have been analyzed
        const analyzedResponses = responses.filter(res => Object.keys(res.aiScores).length > 0 || res.aiRecommendation !== null);

        if (analyzedResponses.length === 0) {
            alert("No AI analysis results to export. Please run the analysis first.");
            return;
        }

        // AI Table Headers: Candidate, Submitted At, Parameter Scores, AI Fit Score, Confidence Level, Strength Highlights, Weakness Highlights, Recommendation, View Details
        headers = [
            "\"Candidate\"",
            "\"Submitted At\"",
            "\"Parameter Scores\"", // Combined scores
            "\"AI Fit Score\"", // New Header
            "\"Confidence Level\"", // New Header
            "\"Strength Highlights\"", // New Header
            "\"Weakness Highlights\"", // New Header
            "\"Recommendation\"",
            "\"View Details Available\"" // Action column
        ];

        // AI Table Data Rows
        dataRows = analyzedResponses.map(candidate => {
            const row = [
                `"${String(candidate.identifier).replace(/"/g, '""')}"`, // Candidate Name
                candidate.submittedAt ? `"${new Date(candidate.submittedAt).toLocaleString()}"` : "" // Submitted At
            ];
             // Combined Parameter Scores cell
             let scoresText = '';
             const scores = candidate.aiScores || {};
             const scoreKeys = Object.keys(scores);

             if (scoreKeys.length > 0) {
                  scoresText = scoreKeys.map(scoreKey => {
                      const score = scores[scoreKey] ?? '-';
                      return `${scoreKey}: ${score}/10`;
                  }).join('; '); // Use semicolon to separate scores in CSV cell
             } else {
                  scoresText = '-';
             }
             // Escape quotes within the scores string and wrap in quotes
             row.push(`"${String(scoresText).replace(/"/g, '""')}"`);

             // AI Fit Score
             row.push(`"${candidate.aiFitScore ?? '-'}"`);

             // Confidence Level
             row.push(`"${candidate.aiConfidence ?? '-'}"`);

             // Strength Highlights (join with semicolon for CSV)
             const strengthsText = (candidate.aiStrengths || []).join('; ');
             row.push(`"${String(strengthsText).replace(/"/g, '""')}"`);

             // Weakness Highlights (join with semicolon for CSV)
             const weaknessesText = (candidate.aiWeaknesses || []).join('; ');
             row.push(`"${String(weaknessesText).replace(/"/g, '""')}"`);

            const recommendation = candidate.aiRecommendation ?? '-';
            row.push(`"${String(recommendation).replace(/"/g, '""')}"`);

            row.push('"View Details Available"'); // Action column
            return row;
        });

         if (!filename) filename = 'ai_comparison_results.csv';
    } else {
        console.error("Invalid table type specified for export:", tableType);
        return;
    }


    csvContent += headers.join(",") + "\r\n";
    dataRows.forEach(row => {
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


// --- Initial Load and Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadComparisonData(); // Load data and render the raw responses table

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', handleComparatorAIAnalysis);
    }

    // Add listeners for the two export buttons
    if (exportRawCsvBtn) {
        exportRawCsvBtn.addEventListener('click', () => exportToCsv('raw'));
    }
     if (exportAiCsvBtn) {
        exportAiCsvBtn.addEventListener('click', () => exportToCsv('ai'));
    }

    // Note: View Details button listeners are added dynamically in renderAIComparisonTable
});
