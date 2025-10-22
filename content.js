// content.js — updated for modern Prompt API usage + fixes

let promptSession = null;
let systemPrompt = null; // global system prompt
let initializationPromise = null;

// Feature state

let simplifiedElements = []; // track simplified elements as array
let isApplying = false;

// Theme definitions
const themes = {
    default: {
        backgroundColor: '',
        textColor: '',
    },
    highContrast: {
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
    },
    highContrastAlt: {
        backgroundColor: '#000000',
        textColor: '#FFFFFF',
    },
    darkMode: {
        backgroundColor: '#121212',
        textColor: '#E0E0E0',
    },
    sepia: {
        backgroundColor: '#F5E9D5',
        textColor: '#5B4636',
    },
    lowBlueLight: {
        backgroundColor: '#FFF8E1',
        textColor: '#2E2E2E',
    },
    softPastelBlue: {
        backgroundColor: '#E3F2FD',
        textColor: '#0D47A1',
    },
    softPastelGreen: {
        backgroundColor: '#F1FFF0',
        textColor: '#00695C',
    },
    creamPaper: {
        backgroundColor: '#FFFFF0',
        textColor: '#333333',
    },
    grayScale: {
        backgroundColor: '#F5F5F5',
        textColor: '#424242',
    },
    blueLightFilter: {
        backgroundColor: '#FFF3E0',
        textColor: '#4E342E',
    },
    highContrastYellowBlack: {
        backgroundColor: '#000000',
        textColor: '#FFFF00',
    },
    highContrastBlackYellow: {
        backgroundColor: '#FFFF00',
        textColor: '#000000',
    },
};

function log(...args) { console.log('[content.js]', ...args); }
function warn(...args) { console.warn('[content.js]', ...args); }
function err(...args) { console.error('[content.js]', ...args); }

async function loadSystemPrompts() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getSystemPrompts' }, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (response && response.success) {
                resolve(response.prompts);
            } else {
                reject(new Error(response && response.error ? response.error : 'No response'));
            }
        });
    });
}

// Read user reading level / simplification preferences
async function getReadingLevel() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['simplificationLevel'], (result) => {
            resolve(result.simplificationLevel || '3');
        });
    });
}


// ---------- AI init & session handling ----------
async function createLanguageModelSession(systemPromptValue) {
    if (typeof self.LanguageModel === 'undefined') {
        throw new Error('LanguageModel API is not available in this context');
    }

    // get parameters (defaultTemperature, defaultTopK, etc.)
    const params = await self.LanguageModel.params();
    const temperature = params.defaultTemperature;
    const topK = params.defaultTopK;

    // Create session specifying both temperature & topK so the API accepts it
    const sessionOptions = {
        temperature,
        topK,
        systemPrompt: systemPromptValue
    };

    // create() can fail; let caller handle errors
    const session = await self.LanguageModel.create(sessionOptions);
    log('Created LanguageModel session', { temperature, topK });
    return session;
}

async function initAICapabilities() {
    // Single initializer to avoid race conditions
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
        log('Initializing AI capabilities...');
        if (typeof self.LanguageModel === 'undefined') {
            throw new Error('LanguageModel API not present — ensure Chrome flags & model are available');
        }

        // load system prompts from background
        const prompts = await loadSystemPrompts();
        if (!prompts) throw new Error('No system prompts returned');

        const readingLevel = await getReadingLevel();
        systemPrompt = prompts[readingLevel];

        
        

        if (!systemPrompt) throw new Error('Selected system prompt is undefined');

        // create session once and reuse
        try {
            promptSession = await createLanguageModelSession(systemPrompt);
        } catch (e) {
            // If creation failed, clear promptSession and rethrow
            promptSession = null;
            throw e;
        }

        log('AI capabilities initialized');
        return { promptSession };
    })().catch(e => {
        // reset so future attempts can retry
        initializationPromise = null;
        err('initAICapabilities failed', e);
        throw e;
    });

    return initializationPromise;
}

// Call this before any AI usage
function ensureInitialized() {
    if (!initializationPromise) {
        initializationPromise = initAICapabilities();
    }
    return initializationPromise;
}

// ---------- Prompt helper (streaming with retry/backoff) ----------
async function promptStreamToString(session, promptText, options = {}) {
    // options: { maxAttempts, timeoutMs, stopSequences }
    const maxAttempts = options.maxAttempts || 3;
    const baseDelay = 300; // ms
    const timeoutMs = options.timeoutMs || 30_000;
    const stopSequences = options.stopSequences || [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let abortController = new AbortController();
        let timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

        try {
            const stream = session.promptStreaming(promptText, { signal: abortController.signal });
            let accumulated = '';
            for await (const chunk of stream) {
                // chunk is a string piece — append
                accumulated += String(chunk);
                // check stop sequences
                for (const stop of stopSequences) {
                    if (accumulated.toLowerCase().includes(stop.toLowerCase())) {
                        abortController.abort();
                        break;
                    }
                }
            }
            clearTimeout(timeoutId);
            // trim and return
            const result = accumulated.trim();
            if (result.length > 0) return result;
            // else empty result => retry
            warn(`Empty response on attempt ${attempt}`);
        } catch (streamErr) {
            if (streamErr && streamErr.name === 'AbortError') {
                warn(`Streaming aborted (attempt ${attempt}) — ${streamErr.message || 'timeout/stop'}`);
            } else {
                warn(`Streaming error (attempt ${attempt})`, streamErr);
            }

            // If the session reports being destroyed, try to recreate it once
            if (streamErr && /destroyed/i.test(String(streamErr.message || ''))) {
                try {
                    // attempt to recreate session
                    log('Session appears destroyed — recreating session');
                    promptSession = await createLanguageModelSession(systemPrompt);
                    session = promptSession;
                } catch (recreateErr) {
                    err('Failed to recreate session', recreateErr);
                }
            }
        } finally {
            clearTimeout(timeoutId);
        }

        // exponential backoff with jitter
        const backoff = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, backoff + Math.floor(Math.random() * 100)));
    }

    throw new Error('Failed to get a non-empty streaming response after retries');
}

// ---------- DOM helpers ----------
function getElementPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) selector += '#' + element.id;
        else if (element.className) selector += '.' + Array.from(element.classList).join('.');
        path.unshift(selector);
        element = element.parentNode;
    }
    return path.join(' > ');
}

const isHeader = (el) => /^H[1-6]$/i.test(el.tagName);
const isList = (el) => ['UL','OL','DL'].includes(el.tagName);

// Estimate tokens conservatively
const estimateTokens = (text) => Math.ceil(text.split(/\s+/).length * 1.25);

// ---------- Simplify action ----------
async function extractPageText() {
    try {
      // Use main/content selectors you already used elsewhere for reliability
      const selectors = [
        'main', 'article', '.content', '.post', '#content', '#main', 'div[role="main"]',
        '.article-content', '.article-body', '.story-body', '.article-text', '.story-content',
        '[itemprop="articleBody"]', '.paid-premium-content', '.str-story-body', '.str-article-content',
        '#story-body'
      ];
      const mainContent = document.querySelector(selectors.join(', ')) || document.body;
  
      // Candidate nodes to pull
      const candidateSelectors = [
        'p', 'h1','h2','h3','h4','h5','h6', 'ul','ol','dl',
        '.article-content p', '.article-body p', '.story-body p', '.article-text p', '.story-content p',
        '[itemprop="articleBody"] p', '.article p', '.story p'
      ];
      let contentElements = Array.from((mainContent || document.body).querySelectorAll(candidateSelectors.join(', ')));
  
      // Filter out tiny / meta nodes (reuse your heuristics)
      contentElements = contentElements.filter(el => {
        const text = (el.textContent || '').trim();
        const isMeta = (el.closest('.author, .meta, .claps, .likes, .stats, .profile, .bio, header, footer, .premium-box') != null)
                      || (/^(By|Published|Updated|Written by|(\d+)\s?min read|(\d+)\s?claps)/i.test(text));
        if (isMeta) return false;
        if (!['UL','OL','DL'].includes(el.tagName) && text.length < 50 && !/^H[1-6]$/i.test(el.tagName)) return false;
        return text.length > 0;
      });
  
      // Fallback: if nothing found, use body text
      if (contentElements.length === 0) {
        const bodyText = (document.body && document.body.innerText) ? document.body.innerText.trim() : '';
        return bodyText || '';
      }
  
      // Convert lists to bullet text and join paragraphs
      const parts = contentElements.map(el => {
        if (['UL','OL','DL'].includes(el.tagName)) {
          return Array.from(el.querySelectorAll('li')).map(li => '- ' + (li.textContent || '').trim()).join('\n');
        }
        return (el.textContent || '').trim();
      });
  
      // Limit max characters to avoid sending huge blob (you can increase if needed)
      const MAX_CHARS = 150_000; // plenty, but protects against enormous pages
      let combined = parts.join('\n\n');
      if (combined.length > MAX_CHARS) {
        combined = combined.slice(0, MAX_CHARS) + '\n\n[TRUNCATED]';
      }
  
      return combined;
    } catch (e) {
      console.error('extractPageText error', e);
      return '';
    }
  }

async function handleSimplify(sendResponse) {
    // Keep sendResponse usage to this function only.
    try {
        if (isApplying) {
            sendResponse({ success: false, error: 'Already simplifying' });
            return;
        }
        isApplying = true;

        await ensureInitialized();
        if (!promptSession) {
            sendResponse({ success: false, error: 'Prompt API session not available' });
            isApplying = false;
            return;
        }

        log('Finding main content element...');
        const selectors = [
            'main', 'article', '.content', '.post', '#content', '#main', 'div[role="main"]',
            '.article-content', '.article-body', '.story-body', '.article-text', '.story-content',
            '[itemprop="articleBody"]', '.paid-premium-content', '.str-story-body', '.str-article-content',
            '#story-body'
        ];
        const mainContent = document.querySelector(selectors.join(', '));
        if (!mainContent) {
            sendResponse({ success: false, error: 'Could not find main content element' });
            isApplying = false;
            return;
        }
        log('Main content found:', { tag: mainContent.tagName, path: getElementPath(mainContent) });

        // Restore previously-simplified elements if any
        const prevEls = Array.from(mainContent.querySelectorAll('[data-original-html]'));
        prevEls.forEach(el => {
            try {
                const originalHTML = el.getAttribute('data-original-html');
                if (!originalHTML) return;
                const temp = document.createElement('div');
                temp.innerHTML = originalHTML;
                const originalNode = temp.firstChild;
                if (originalNode && el.parentNode) el.parentNode.replaceChild(originalNode, el);
            } catch (e) {
                warn('Failed to restore original element', e);
            }
        });

        // Collect candidate content elements
        const candidateSelectors = [
            'p', 'h1','h2','h3','h4','h5','h6', 'ul','ol','dl',
            '.article-content p', '.article-body p', '.story-body p', '.article-text p', '.story-content p',
            '[itemprop="articleBody"] p', '.article p', '.story p'
        ];
        let contentElements = Array.from(mainContent.querySelectorAll(candidateSelectors.join(', ')));

        contentElements = contentElements.filter(el => {
            const text = (el.textContent || '').trim();
            // skip very short nodes (likely metadata) unless headers or lists
            const isMeta = (el.closest('.author, .meta, .claps, .likes, .stats, .profile, .bio, header, footer, .premium-box') != null)
                          || (/^(By|Published|Updated|Written by|(\d+)\s?min read|(\d+)\s?claps)/i.test(text));
            if (isMeta) return false;
            if (!isList(el) && text.length < 50 && !isHeader(el)) return false;
            return text.length > 0;
        });

        if (contentElements.length === 0) {
            sendResponse({ success: false, error: 'No article paragraphs found' });
            isApplying = false;
            return;
        }
        log(`Found ${contentElements.length} elements to process`);

        // Chunking
        const MAX_TOKENS = 600; // leave room for prompt + response
        const chunks = [];
        let current = [];
        let currentTokens = 0;

        for (const el of contentElements) {
            const tokens = estimateTokens(el.textContent || '');
            if (isHeader(el) || isList(el) || (current.length > 0 && currentTokens + tokens > MAX_TOKENS)) {
                if (current.length) chunks.push(current);
                current = [el];
                currentTokens = tokens;
            } else {
                current.push(el);
                currentTokens += tokens;
            }
        }
        if (current.length) chunks.push(current);
        log(`Grouped into ${chunks.length} chunks`);

        // Process chunks sequentially
        for (const chunk of chunks) {
            // Skip header-only chunks
            if (chunk.length === 1 && isHeader(chunk[0])) continue;

            const paragraphEls = chunk.filter(el => !isHeader(el) && !isList(el));
            if (paragraphEls.length === 0) continue;

            const chunkText = paragraphEls.map(p => p.textContent.trim()).join('\n\n');

            log('Sending chunk to model', { length: chunkText.length, paragraphs: paragraphEls.length });

            // Build a small instruction plus systemPrompt is already in session
            // const userPrompt = `Rewrite the following text for a vibe preference. Keep meaning unchanged and keep paragraph breaks and add emoji:\n\n${chunkText}`;
            const userPrompt = `${systemPrompt}:\n\n${chunkText}`;


            let simplifiedText = '';
            try {
                simplifiedText = await promptStreamToString(promptSession, userPrompt, {
                    maxAttempts: 3,
                    timeoutMs: 25_000
                });
            } catch (aiErr) {
                warn('AI simplification failed for chunk — skipping chunk', aiErr);
                continue; // leave original paragraphs intact
            }

            if (!simplifiedText) {
                warn('Empty simplified text — skipping chunk');
                continue;
            }

            // Split by double newlines into paragraphs
            const simplifiedParagraphs = simplifiedText.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);

            // If mismatch in counts: try to heuristically map — simple approach: map sequentially and if mismatch cut/extend
            let targetCount = Math.min(simplifiedParagraphs.length, paragraphEls.length);
            // If simplified has fewer paragraphs, remove extra originals
            if (simplifiedParagraphs.length < paragraphEls.length) {
                for (let i = simplifiedParagraphs.length; i < paragraphEls.length; i++) {
                    try { paragraphEls[i].remove(); } catch (e) {}
                }
            }

            // Replace original paragraphs with simplified content
            for (let i = 0; i < targetCount; i++) {
                const orig = paragraphEls[i];
                const newEl = document.createElement(isList(orig) ? orig.tagName : 'p');
                // Try to parse markdown only if marked is present; else set text/html minimal escaping
                if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                    newEl.innerHTML = marked.parse(simplifiedParagraphs[i], { breaks: true, gfm: true });
                } else {
                    // basic HTML-escape and preserve line breaks
                    newEl.innerHTML = simplifiedParagraphs[i].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
                }

                // Ensure style element for simplified-text only exists once
                if (!document.getElementById('simplified-text-styles')) {
                    const s = document.createElement('style');
                    s.id = 'simplified-text-styles';
                    s.textContent = `
                        .simplified-text{padding-left:5px;padding-right:5px;margin:10px 0;line-height:1.6;font-weight:400;}
                        .simplified-text ul,.simplified-text ol{margin-left:20px;}
                        .original-text-tooltip{position:absolute;max-width:400px;background-color:rgba(0,0,0,0.85);color:white;padding:10px;border-radius:5px;font-size:14px;z-index:10000;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.3);}
                    `;
                    document.head.appendChild(s);
                }

                newEl.classList.add('simplified-text');

                // attach original html for restoration
                if (!orig.hasAttribute('data-original-html')) {
                    newEl.setAttribute('data-original-html', orig.outerHTML);
                } else {
                    newEl.setAttribute('data-original-html', orig.getAttribute('data-original-html'));
                }
                newEl.setAttribute('data-original-text', orig.textContent || '');
                // Replace in DOM
                try {
                    orig.parentNode.replaceChild(newEl, orig);
                } catch (e) {
                    warn('Replace failed', e);
                    continue;
                }

                // update simplifiedElements array
                simplifiedElements.push(newEl);


            }

            log('Chunk replaced', { simplifiedParagraphs: simplifiedParagraphs.length, replaced: targetCount });
            console.log("hi", systemPrompt ?? "systemPrompt is null/undefined");

        }

        // visual notification
        const notification = document.createElement('div');
        notification.textContent = 'Text simplified';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = '#3498db';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '10000';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);

        sendResponse({ success: true });
    } catch (e) {
        err('handleSimplify error', e);
        sendResponse({ success: false, error: String(e && e.message ? e.message : e) });
    } finally {
        isApplying = false;
    }
}



// ---------- Message listener ----------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        // existing cases...
        if (request.action === 'extractText') {
          const text = await extractPageText();
          sendResponse({ success: true, text });
          return;
        }
  
        // retain your existing switch/cases (simplify etc.)
        switch (request.action) {
          case 'simplify':
            await handleSimplify(sendResponse);
            return; // your existing logic

        case 'generateAIResponse':
            try {
                await ensureInitialized();
                if (!promptSession) throw new Error('AI session not initialized');
        
                const aiOutput = await promptStreamToString(promptSession, request.prompt, {
                    maxAttempts: 2,
                    timeoutMs: 25000
                });
        
                sendResponse({ success: true, output: aiOutput });
            } catch (err) {
                console.error('generateAIResponse error:', err);
                sendResponse({ success: false, error: err.message });
            }
            return;
        

          default:
            // unknown action
            sendResponse({ success: false, error: 'Unknown action' });
            return;
        }
      } catch (e) {
        console.error('onMessage error', e);
        sendResponse({ success: false, error: String(e && e.message ? e.message : e) });
      }
    })();
    return true; // keep channel open for async
  });


// ---------- Init on DOM ready ----------
document.addEventListener('DOMContentLoaded', () => {
    // Start initialization but don't block UI
    ensureInitialized().catch(e => warn('AI init failed (can retry later):', e));

});

