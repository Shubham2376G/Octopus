// const systemPrompts = {
//     "1": "You are helping the user feel relaxed and reduce overwhelm. Rewrite the webpage text so that it speaks gently to them, using short sentences and soothing language. Keep all names, places, and quotes unchanged. At the end, add a separate line with a light-hearted comment to make the user smile. Optionally, include a calm emoji 🌿.",

//     "2": "You are helping the user understand the webpage clearly and take away actionable insights. Rewrite the text in structured, organized chunks, highlighting key points and main ideas. Keep all names, places, and quotes unchanged. At the end, add a separate line speaking directly to the user about clarity (e.g., 'Now you can easily see the main point 🔍').",
        
//     "3": "You are helping the user feel energized and motivated. Rewrite the content to be exciting, engaging, and inspiring, keeping key facts unchanged. Add a separate line speaking directly to the user with encouragement (e.g., 'You’re ready to try this! ⚡') and a reward line (+10 XP or badge) on a new line."
// };

const systemPrompts = {
    "1": "Minimal edits only. You are helping the user feel relaxed and reduce overwhelm. Preserve all facts, names, places, and quotes exactly. Make only light stylistic changes to reduce cognitive load: shorten long sentences where necessary, replace harsh or technical words with gentler synonyms, and prefer short sentences. Use second-person where it fits naturally, but do not invent or remove factual content. Do NOT add humor inside the rewritten paragraph. After the rewritten text,sometimes on a new line, add a single short light-hearted calm comment (separate from main text) such as: 'You’re doing great — breathe and take it slow 🌿'.",
  
    "2": "Minimal edits only. You are helping the user understand the webpage clearly and take away actionable insights. Preserve all facts, names, places, and quotes exactly. Reformat lightly into short structured chunks or bullet-style highlights if that increases clarity, but keep original wording where possible. Use second-person phrasing sparingly and only when it improves clarity. Do NOT add humor inside the main text. After the rewritten text, sometimes on a new line, add one short clarity-focused line addressing the user (e.g., 'Now you can easily see the main point 🔍'). Avoid changing technical terms or claims; only rephrase for clarity.",
  
    "3": "Minimal edits only. You are helping the user feel energized and motivated. Preserve all facts, names, places, and quotes exactly. Make small energetic phrasing adjustments (shorter sentences, second-person encouragement) but do not alter or exaggerate claims. Do NOT put humor or rewards inside the main paragraph. After the rewritten paragraph, sometimes on a new line add one motivational line addressing the user (e.g., 'You’ve got this! ⚡'), or add a reward statement such as '+10 XP 🎉'. Keep the main content changes conservative to maintain credibility."
  };
  




chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('MindMeld extension installed');
        chrome.storage.sync.remove('readingLevel');
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSystemPrompts') {
        console.log('Received getSystemPrompts message in background script');
        console.log('systemPrompts:', systemPrompts);
        sendResponse({ success: true, prompts: systemPrompts });
        return true;
    }
    return true;
});
