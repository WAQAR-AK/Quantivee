// server.js
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fetch = require('node-fetch'); // Make sure you have node-fetch@2 installed (npm install node-fetch@2)

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json()); // Parse incoming JSON requests

// --- API Routes ---
// Define API routes BEFORE static file serving to avoid conflicts

// API to generate AI questions (existing)
app.post('/api/generate-ai-questions', async (req, res) => {
    const { title, instructions, parameters,} = req.body; // Default to 8 as per prompt
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Received request for /api/generate-ai-questions');

    if (!apiKey) {
        console.error('Gemini API key is missing from .env file.');
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    if (!title) {
        return res.status(400).json({ error: 'Form title is required.' });
    }

    // Construct the prompt for Gemini API
  let detailedPrompt = `You are an AI assistant of HR helping to create form Questions, these questions will be filled by the candidates.
Generate diverse and relevant questions for a form. give at least 8 questions unless not specified by the user. Do not repeat the Questions
Must Ask for the name of the Candidate. Prioritize the question generation based on the following distribution:
- Approximately 10% of questions based on the Form Title.
- Approximately 40% of questions based on the Special Instructions/Description.(keep in mind those questions w.r.t the parametrs)
- Approximately 55% of questions based on the provided Parameters(these are basically the values of the commpany which is hiring).

Form Title: "${title}"
`;
if (instructions) {
        detailedPrompt += `Special Instructions/Description: "${instructions}"\n`;
    }

    if (parameters && parameters.length > 0) {
        detailedPrompt += "For the 55% parameter-based questions, distribute them further based on these weighted parameters (the percentage indicates the desired proportion *within* the 55% parameter portion):\n";
        parameters.forEach(param => {
            detailedPrompt += `- ${param.name}: ${param.percentage}%\n`;
        });
        detailedPrompt += "For example, if 'Educational Qualification' is 50% of the parameters, approximately half of the 55% parameter-based questions should relate to educational qualifications.\n";
    } else {
        // If no parameters are provided, adjust the weighting slightly
        detailedPrompt = `You are an AI assistant of HR helping to create survey forms.
Generate diverse and relevant questions for a form.
Prioritize the question generation based on the following distribution:
- Approximately 20% of questions based on the Form Title.
- Approximately 80% of questions based on the Special Instructions/Description.

Form Title: "${title}"
`;
         if (instructions) {
            detailedPrompt += `Special Instructions/Description: "${instructions}"\n`;
        }
        detailedPrompt += "No specific parameters were provided, focus on the title and description.\n";
    }

    detailedPrompt += `
For each question, provide:
1.  "text": The question itself (string).
2.  "type": The type of input expected. Choose from: "text", "textarea", "number", "email", "date", "radio", "checkbox".
3.  "options": An array of 3-4 string options IF the type is "radio" or "checkbox". For other types, this key should be omitted or be an empty array.

do not return the same questions or questions that could have the same answers.give at least 8 questions unless not specified by the user. Return ONLY a valid JSON array of question objects in the format specified below. Do not include any other text, titles, explanations, or markdown formatting like \`\`\`json ... \`\`\` outside of the JSON array itself.
Must Ask for the name of the Candidate. Example of the exact expected output format:
[
  {
    "text": "What is your overall satisfaction with the product?",
    "type": "radio",
    "options": ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"]
  },
  {
    "text": "Please provide any additional comments or suggestions.",
    "type": "textarea"
  }
]

Ensure the generated JSON is well-formed and adheres strictly to this structure.
`;

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    try {
        console.log("Sending request for question generation to Gemini API with model gemini-1.5-flash...");
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: detailedPrompt
                    }]
                }],
            }),
        });

        const responseBody = await geminiResponse.json();
        console.log("Raw Gemini API Response (Question Gen):", responseBody);

        if (!geminiResponse.ok) {
            const errorDetail = responseBody.error ? responseBody.error.message : JSON.stringify(responseBody);
            console.error('Gemini API Error (Question Gen):', geminiResponse.status, errorDetail);
            if (responseBody.promptFeedback && responseBody.promptFeedback.safetyRatings) {
                 console.error('Safety Ratings:', responseBody.promptFeedback.safetyRatings);
            }
            throw new Error(`Gemini API request failed with status ${geminiResponse.status}: ${errorDetail}`);
        }

        const questionsText = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!questionsText) {
             console.error('Gemini response did not contain expected text part:', responseBody);
            if (responseBody.promptFeedback && responseBody.promptFeedback.safetyRatings) {
                 const blockedReason = responseBody.promptFeedback.blockReason;
                 const safetyRatings = responseBody.promptFeedback.safetyRatings;
                 let safetyFeedback = `Content generation blocked. Reason: ${blockedReason || 'Unknown'}. Safety ratings: `;
                 safetyRatings.forEach(rating => {
                    safetyFeedback += `${rating.category}: ${rating.probability}; `;
                 });
                 console.error('Safety Feedback:', safetyFeedback);
                 return res.status(500).json({ error: `AI response blocked or incomplete. ${safetyFeedback}` });
            }

             return res.status(500).json({ error: 'AI response missing expected content.' });
        }

        let cleanedQuestionsText = questionsText.replace(/^```json\s*|```$/g, '') .replace(/`/g, '') .trim();

        try {
            const generatedQuestions = JSON.parse(cleanedQuestionsText);
            console.log("Parsed Questions for Frontend:", generatedQuestions);
            res.json(generatedQuestions);
        } catch (parseError) {
            console.error('Error parsing extracted JSON string from Gemini:', parseError);
            console.error('Problematic JSON string extracted:', cleanedQuestionsText);
            res.status(500).json({ error: 'Failed to parse AI response content. The extracted text was not valid JSON.' });
        }

    } catch (error) {
        console.error('Error calling Gemini API or processing response (Question Gen):', error.message);
        res.status(500).json({ error: `An error occurred while generating questions: ${error.message}` });
    }
});

// --- Existing API route for Single Candidate Analysis (used by View Details) ---
app.post('/api/analyze-candidate', async (req, res) => {
    const { jobTitle, parameters, aiCriteria, candidateResponses, resumeContent } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Received request for /api/analyze-candidate (Single)');

    if (!apiKey) {
        console.error('Gemini API key is missing from .env file.');
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    // Basic validation
    if (!candidateResponses) {
        return res.status(400).json({ error: 'Candidate responses are required for analysis.' });
    }

    // Format candidate responses for the prompt
    let formattedResponses = "";
    if (candidateResponses && candidateResponses.length > 0) {
        candidateResponses.forEach((qa, index) => {
            const answer = Array.isArray(qa.answer) ? qa.answer.join(', ') : (qa.answer || "Not answered");
            formattedResponses += `Q${index + 1}: ${qa.question}\nA${index + 1}: ${answer}\n`;
        });
    } else {
        formattedResponses = '[No form responses provided]\n';
    }


    // Construct the prompt for Gemini API
    const analysisPrompt = `You are a highly skilled AI talent evaluator working for a recruitment platform. Your task is to assess the overall fit of a job candidate based on their form responses. You must be logical, fair, and detailed in your analysis.
judge the candidate w.r.t the only questions asked. Do not drive the results based on the information that is not in the question.
Use the following information:

**Job Title**: ${jobTitle || 'Unknown Job Title'}

**AI Instructions/Criteria for Ai Analysis**:
${aiCriteria || '[No specific instructions provided by editor]'}

**Candidate's Form Responses**:
${formattedResponses}

**Parameters to Evaluate**: ${parameters && parameters.length > 0 ? parameters.map(p => p.name).join(', ') : '[No specific parameters provided]'}
---

Please do the following:
 Do not drive the results based on the information that is not in the question.
1. Evaluate the candidate based on the provided 'Parameters to Evaluate' and assign a score between 1 and 10 for each. Be specific and refer to evidence from the answers. If parameters were not provided, score general areas like "Qualifications", "Experience", "Communication", "Relevant Skills".
2. Provide detailed **Strengths** and **Weaknesses** based on the candidate’s responses .
3. Identify any **Red Flags** such as:
    - Overused vague claims without evidence
    - Missing required skills or experience mentioned in criteria
    - Gaps, exaggerations, or professionalism concerns based *only* on the provided responses.
4. Provide a **Summary** of your evaluation.
5. Make a final recommendation from these three options based on the overall assessment and criteria:
    - **Fit** (meets or exceeds expectations)
    - **Maybe** (partially meets expectations or needs clarification)
    - **Not Fit** (does not meet role requirements)

---

**Format your response in JSON as follows:**

\`\`\`json
{
  "scores": {
    "Parameter 1 Name": Score (1-10),
    "Parameter 2 Name": Score (1-10)
    // ... scores for all listed parameters or general areas
  },
  "strengths": [
    "Strength 1 based on response to QX.",
    "Strength 2 based on overall impression."
  ],
  "weaknesses": [
    "Weakness 1 based on response to QY.",
    "Weakness 2 related to missing information."
  ],
  "red_flags": [
    "Identified red flag based on answer Z."
  ],
  "summary": "Overall summary of the candidate's fit based on the analysis.",
  "recommendation": "Fit" | "Maybe" | "Not Fit"
}
\`\`\`
Ensure the generated JSON is well-formed and adheres strictly to this structure.
`;

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    try {
        console.log("Sending request for single candidate analysis to Gemini API with model gemini-1.5-flash...");
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: analysisPrompt
                    }]
                }],
                 generationConfig: {
                    responseMimeType: "application/json"
                 }
            }),
        });

        const responseBody = await geminiResponse.json();
        console.log("Raw Gemini API Response (Single Analysis):", responseBody);

        if (!geminiResponse.ok) {
             const errorDetail = responseBody.error ? responseBody.error.message : JSON.stringify(responseBody);
            console.error('Gemini API Error (Single Analysis):', geminiResponse.status, errorDetail);
            if (responseBody.promptFeedback && responseBody.promptFeedback.safetyRatings) {
                 console.error('Safety Ratings:', responseBody.promptFeedback.safetyRatings);
            }
            throw new Error(`Gemini API request failed with status ${geminiResponse.status}: ${errorDetail}. Check console for details.`);
        }

        // --- CORRECTED: Extract text content before parsing JSON ---
        const analysisText = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!analysisText) {
             console.error('Gemini response did not contain expected text part for analysis:', responseBody);
             // Attempt to provide feedback from safety ratings if no text is returned
             if (responseBody.promptFeedback && responseBody.promptFeedback.safetyRatings) {
                 const blockedReason = responseBody.promptFeedback.blockReason;
                 const safetyRatings = responseBody.promptFeedback.safetyRatings;
                 let safetyFeedback = `Content generation blocked. Reason: ${blockedReason || 'Unknown'}. Safety ratings: `;
                 safetyRatings.forEach(rating => {
                    safetyFeedback += `${rating.category}: ${rating.probability}; `;
                 });
                 console.error('Safety Feedback:', safetyFeedback);
                 return res.status(500).json({ error: `AI analysis response blocked or incomplete. ${safetyFeedback}` });
            }

             return res.status(500).json({ error: 'AI response missing expected content for analysis.' });
        }

        // Clean up potential markdown code blocks
        let cleanedAnalysisText = analysisText.replace(/^```json\s*|```$/g, '') .replace(/`/g, '') .trim();

        try {
            // --- Parse the extracted and cleaned text as JSON ---
            const analysisResult = JSON.parse(cleanedAnalysisText);
            console.log("Parsed Analysis Result:", analysisResult);

            // Basic check if the result looks like the expected JSON structure
            if (analysisResult && typeof analysisResult === 'object' && analysisResult.scores && analysisResult.recommendation) {
                 res.json(analysisResult); // Send the parsed JSON to the frontend
            } else {
                 console.error("Parsed analysis result does not match expected structure:", analysisResult);
                 res.status(500).json({ error: 'AI analysis response was not in the expected JSON format or structure.' });
            }

        } catch (parseError) {
            console.error('Error parsing extracted JSON string from Gemini (Analysis):', parseError);
            console.error('Problematic JSON string extracted:', cleanedAnalysisText);
            res.status(500).json({ error: 'Failed to parse AI analysis response content. The extracted text was not valid JSON.' });
        }

    } catch (error) {
        console.error('Error calling Gemini API or processing response (Single Analysis):', error.message);
        res.status(500).json({ error: `An error occurred during analysis: ${error.message}` });
    }
});


// --- NEW API route for Comparative Candidate Analysis ---
app.post('/api/compare-candidates', async (req, res) => {
    const { jobTitle, aiCriteria, parameters, candidates } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Received request for /api/compare-candidates (Comparative)');

    if (!apiKey) {
        console.error('Gemini API key is missing from .env file.');
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: 'Candidate data is required for comparison analysis.' });
    }

    // Format candidate data for the prompt
    let formattedCandidatesData = "";
    candidates.forEach((candidate, index) => {
        formattedCandidatesData += `--- Candidate ${index + 1} (ID: ${candidate.responseId}, Name: ${candidate.identifier}) ---\n`;
        if (candidate.answers && Array.isArray(candidate.answers)) {
             candidate.answers.forEach((qa, qIndex) => {
                 const answer = Array.isArray(qa.answer) ? qa.answer.join(', ') : (qa.answer || "Not answered");
                 formattedCandidatesData += `Q${qIndex + 1} (${qa.questionText}): ${answer}\n`;
             });
        } else {
             formattedCandidatesData += '[No form responses provided for this candidate]\n';
        }

        formattedCandidatesData += '\n'; // Add a blank line between candidates
    });


    // Construct the prompt for Gemini API
    const comparisonPrompt = `You are a highly skilled AI talent evaluator specializing in comparing multiple candidates for a specific role based on their form responses. Your goal is to provide a structured evaluation for each candidate relative to the others and the specified criteria.

**Job Title**: ${jobTitle || 'Unknown Job Title'}

**Overall AI Instructions/Criteria for Comparison**:
${aiCriteria || '[No specific instructions provided by editor]'}

**Candidates and Their Form Responses**:
${formattedCandidatesData}

**Parameters to Evaluate for Each Candidate**: ${parameters && parameters.length > 0 ? parameters.map(p => p.name).join(', ') : '[No specific parameters provided]'}
---

Please evaluate EACH candidate individually based on the provided responses and the overall criteria. For each candidate, provide:

1.  **Scores**: Assign a score between 1 and 10 for each of the 'Parameters to Evaluate'. Be specific and refer to evidence from the answers. If parameters were not provided, score general areas like "Qualifications", "Experience", "Communication", "Relevant Skills". Base scores *only* on the provided responses and criteria.
2.  **Recommendation**: Provide a final recommendation for this specific candidate from these three options: "Fit", "Maybe", or "Not Fit". This should reflect their suitability based on the responses and criteria.
3.  **Strengths**: List 3-5 key strengths derived *only* from their responses.
4.  **Weaknesses**: List 3-5 key weaknesses derived *only* from their responses.
5.  **Identifier**: Include the 'identifier' (Name or Response #) provided for the candidate.
6.  **ResponseId**: Include the original 'responseId' for the candidate.

---

**Format your response as a JSON array of objects, where each object represents one candidate's evaluation.** Do NOT include any overall comparison summary or text outside the JSON array. Do NOT include Red Flags or a general summary in this comparative output (those are for the individual summary).

Example of the exact expected output format (an array of candidate evaluation objects):
\`\`\`json
[
  {
    "responseId": "someFirebaseId1",
    "identifier": "Candidate A",
    "scores": {
      "Technical Skills": 7,
      "Domain Experience": 8,
      "Communication Skill": 9
    },
    "recommendation": "Fit",
    "strengths": ["Strong technical background mentioned in Q2", "Clear communication in Q5"],
    "weaknesses": ["Limited experience in area X based on Q3", "Vague answer to Q4"]
  },
  {
    "responseId": "someFirebaseId2",
    "identifier": "Candidate B",
    "scores": {
      "Technical Skills": 5,
      "Domain Experience": 6,
      "Communication Skill": 7
    },
    "recommendation": "Maybe",
    "strengths": ["Enthusiastic about the role in Q1"],
    "weaknesses": ["Scores below average in technical skills", "Did not provide specifics in Q6"]
  }
]
\`\`\`
Ensure the generated JSON array is well-formed and adheres strictly to this structure.
`;

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    try {
        console.log("Sending request for comparative analysis to Gemini API with model gemini-1.5-flash...");
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: comparisonPrompt
                    }]
                }],
                 generationConfig: {
                    responseMimeType: "application/json"
                 }
            }),
        });

        const responseBody = await geminiResponse.json();
        console.log("Raw Gemini API Response (Comparative Analysis):", responseBody);

        if (!geminiResponse.ok) {
             const errorDetail = responseBody.error ? responseBody.error.message : JSON.stringify(responseBody);
            console.error('Gemini API Error (Comparative Analysis):', geminiResponse.status, errorDetail);
            if (responseBody.promptFeedback && responseBody.promptFeedback.safetyRatings) {
                 console.error('Safety Ratings:', responseBody.promptFeedback.safetyRatings);
            }
            throw new Error(`Gemini API request failed with status ${geminiResponse.status}: ${errorDetail}. Check console for details.`);
        }

        // Extract text content before parsing JSON
        const analysisText = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!analysisText) {
             console.error('Gemini response did not contain expected text part for comparative analysis:', responseBody);
             if (responseBody.promptFeedback && responseBody.promptFeedback.safetyRatings) {
                 const blockedReason = responseBody.promptFeedback.blockReason;
                 const safetyRatings = responseBody.promptFeedback.safetyRatings;
                 let safetyFeedback = `Content generation blocked. Reason: ${blockedReason || 'Unknown'}. Safety ratings: `;
                 safetyRatings.forEach(rating => {
                    safetyFeedback += `${rating.category}: ${rating.probability}; `;
                 });
                 console.error('Safety Feedback:', safetyFeedback);
                 return res.status(500).json({ error: `AI comparison response blocked or incomplete. ${safetyFeedback}` });
            }
             return res.status(500).json({ error: 'AI response missing expected content for comparative analysis.' });
        }

        // Clean up potential markdown code blocks
        let cleanedAnalysisText = analysisText.replace(/^```json\s*|```$/g, '') .replace(/`/g, '') .trim();

        try {
            // Parse the extracted and cleaned text as JSON (expecting an array)
            const comparisonResults = JSON.parse(cleanedAnalysisText);
            console.log("Parsed Comparative Analysis Result:", comparisonResults);

            // Basic check if the result looks like the expected JSON array structure
            if (Array.isArray(comparisonResults) && comparisonResults.every(item => item.responseId && item.scores && item.recommendation && Array.isArray(item.strengths) && Array.isArray(item.weaknesses))) {
                 res.json(comparisonResults); // Send the parsed JSON array to the frontend
            } else {
                 console.error("Parsed comparative analysis result does not match expected array structure:", comparisonResults);
                 res.status(500).json({ error: 'AI comparison response was not in the expected JSON array format or structure.' });
            }

        } catch (parseError) {
            console.error('Error parsing extracted JSON string from Gemini (Comparative Analysis):', parseError);
            console.error('Problematic JSON string extracted:', cleanedAnalysisText);
            res.status(500).json({ error: 'Failed to parse AI comparative analysis response content. The extracted text was not valid JSON.' });
        }

    } catch (error) {
        console.error('Error calling Gemini API or processing response (Comparative Analysis):', error.message);
        res.status(500).json({ error: `An error occurred during comparative analysis: ${error.message}` });
    }
});


// --- Static Files Serving ---
// Serve static files from the root directory AFTER API routes are defined
app.use(express.static(path.join(__dirname, '')));

// Basic root route to serve the main HTML file (should be caught by express.static if index.html exists)
// However, explicitly defining it can be a fallback or for clarity.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- Start the server ---
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Access frontend at http://localhost:${port}/ or your Glitch URL`);
    if (!process.env.GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY is not set in the .env file. AI features will not work.');
    }
});
