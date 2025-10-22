function initializePopup() {
    // Restore selected simplification level and font settings
    chrome.storage.sync.get(['simplificationLevel', 'optimizeFor', 'fontEnabled'], function(result) {
        const level = result.simplificationLevel || '3'; // Default to '3' for "Mid"
        const button = document.querySelector(`.simplification-button[data-level="${level}"]`);
        if (button) {
            document.querySelectorAll('.simplification-button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
        }
        
        // Restore optimize for selection
        document.getElementById('optimizeSelector').value = result.optimizeFor || 'general';
        
    });

}





// Get references to the button and its elements
const simplifyButton = document.getElementById('simplifyText');
const simplifyButtonText = document.getElementById('simplifyButtonText');
const loader = document.getElementById('simplifyloader');

// Button click handler
simplifyButton.addEventListener('click', function() {
    // Disable the button
    simplifyButton.disabled = true;

    // Update the button text and show loader
    simplifyButtonText.textContent = 'Applying Vibe...';
    loader.style.display = 'inline-block';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && /^https?:/.test(tabs[0].url)) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "simplify"}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error("Could not send simplify message:", chrome.runtime.lastError.message);

                    // Re-enable the button and reset text and loader
                    simplifyButton.disabled = false;
                    simplifyButtonText.textContent = 'Apply';
                    loader.style.display = 'none';
                } else {
                    if(response && response.success) {
                        // Simplification succeeded
                        simplifyButtonText.textContent = 'Done!';
                    } else {
                        // Handle error
                        simplifyButtonText.textContent = 'Error!';
                        console.error("Simplification failed:", response.error);
                    }

                    // Hide the loader
                    loader.style.display = 'none';

                    // After a delay, reset the button
                    setTimeout(function() {
                        simplifyButton.disabled = false;
                        simplifyButtonText.textContent = 'Apply';
                    }, 2000);
                }
            });
        } else {
            console.warn("Active tab is not a valid web page.");

            // Re-enable the button and reset text and loader
            simplifyButton.disabled = false;
            simplifyButtonText.textContent = 'Apply';
            loader.style.display = 'none';
        }
    });
});

// Function to generate simplification buttons based on config
function generateSimplificationButtons() {
    const buttonRow = document.getElementById('simplificationButtonRow');
    if (!buttonRow) {
        console.error('Simplification button row element not found');
        return;
    }
    
    buttonRow.innerHTML = ''; // Clear existing buttons

    const labels = ['Calm', 'Clarity', 'Spark'];
    const dataLevels = ['1', '2', '3'];

    // Fetch stored simplification level
    chrome.storage.sync.get('simplificationLevel', (result) => {
        const savedLevel = result.simplificationLevel || '2'; // default to '2' if none stored

        labels.forEach((label, index) => {
            const button = document.createElement('button');
            button.classList.add('simplification-button');
            button.setAttribute('data-level', dataLevels[index]);
            button.textContent = label;

            // Highlight saved level
            if (dataLevels[index] === savedLevel) {
                button.classList.add('selected');
            }

            button.addEventListener('click', function() {
                document.querySelectorAll('.simplification-button')
                    .forEach(btn => btn.classList.remove('selected'));
                this.classList.add('selected');
                chrome.storage.sync.set({ simplificationLevel: this.getAttribute('data-level') }, () => {
                    console.log('Saved simplificationLevel:', this.getAttribute('data-level'));
                });
            });

            buttonRow.appendChild(button);
        });
    });
}


document.addEventListener('DOMContentLoaded', function() {
    generateSimplificationButtons();
    document.getElementById('mainContent').style.display = 'block';
    initializePopup();

    // Add help icon click handler
    const helpIcon = document.querySelector('.help-icon');
    const simplificationGuide = document.getElementById('simplificationGuide');
    
    helpIcon.addEventListener('click', function() {
        simplificationGuide.classList.toggle('expanded');
        const expanded = simplificationGuide.classList.contains('expanded');
        helpIcon.setAttribute('aria-expanded', expanded.toString());
    });




    // Handle optimize for dropdown changes and help icon
    document.getElementById('optimizeSelector').addEventListener('change', function(e) {
        chrome.storage.sync.set({ optimizeFor: e.target.value });
    });

    const helpIconOptimize = document.getElementById('helpIconOptimize');
    const optimizeGuide = document.getElementById('optimizeGuide');
    
    if (helpIconOptimize && optimizeGuide) {
        helpIconOptimize.addEventListener('click', function() {
            optimizeGuide.classList.toggle('expanded');
            const expanded = optimizeGuide.classList.contains('expanded');
            helpIconOptimize.setAttribute('aria-expanded', expanded.toString());
        });
    }
  });


  document.addEventListener('DOMContentLoaded', () => {
    // -------------------- UI Elements --------------------
    const optimizeSelector = document.getElementById('optimizeSelector');
    const tabSelectInfo = document.getElementById('tabSelectInfo');
    const compareBtn = document.getElementById('compareText');
    const compareLoader = document.getElementById('compareLoader');
    const compareButtonText = document.getElementById('compareButtonText');
    const compareResult = document.getElementById('compareResult');
    const compareResultContainer = document.getElementById('compareResultContainer');

    // -------------------- State --------------------
    let selectedTabIds = [];

    // -------------------- Helpers --------------------
    function setCompareBusy(isBusy) {
        if (isBusy) {
            compareLoader.style.display = 'inline-block';
            compareBtn.classList.add('busy');
            compareButtonText.textContent = 'Comparing…';
        } else {
            compareLoader.style.display = 'none';
            compareBtn.classList.remove('busy');
            compareButtonText.textContent = 'Compare';
        }
    }

    function updateTabInfoText() {
        tabSelectInfo.textContent = `Selected ${selectedTabIds.length} tab(s).`;
    }

    // Send message to tab to extract content
    function askTabForText(tabId) {
        return new Promise((resolve) => {
            try {
                chrome.tabs.sendMessage(tabId, { action: 'extractText' }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response || { success: false, error: 'No response' });
                    }
                });
            } catch (e) {
                resolve({ success: false, error: String(e) });
            }
        });
    }

    // Fallback using scripting.executeScript
    async function execScriptExtract(tabId) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    try {
                        const selectors = [
                            'main','article','.content','.post','#content','#main','div[role="main"]',
                            '.article-content','.article-body','.story-body','.article-text','.story-content',
                            '[itemprop="articleBody"]','.paid-premium-content','.str-story-body','.str-article-content',
                            '#story-body'
                        ];
                        const main = document.querySelector(selectors.join(',')) || document.body;
                        const candidateSelectors = ['p','h1','h2','h3','h4','h5','h6','li'];
                        const elements = Array.from(main.querySelectorAll(candidateSelectors.join(',')));
                        if (elements.length === 0) return (document.body && document.body.innerText) ? document.body.innerText.slice(0,150000) : '';
                        const parts = elements.map(el => (el.textContent || '').trim()).filter(Boolean);
                        let joined = parts.join('\n\n');
                        if (joined.length > 150000) joined = joined.slice(0,150000) + '\n\n[TRUNCATED]';
                        return joined;
                    } catch {
                        return '';
                    }
                }
            });
            if (Array.isArray(results) && results.length > 0) {
                return { success: true, text: results[0].result || '' };
            } else {
                return { success: false, error: 'executeScript returned empty' };
            }
        } catch (err) {
            return { success: false, error: String(err) };
        }
    }


    // async function simulateAiResponseWithInput(aiInput, websites) {
    //     // Combine website texts into a single prompt
    //     const combinedText = Object.entries(websites)
    //         .map(([key, value]) => `${key}:\n${value}`)
    //         .join('\n\n');
    
    //     // Build a prompt for the AI model
    //     const prompt = `You are analyzing content from multiple websites. Here is the extracted text:\n\n${combinedText}\n\nPlease compare which is easy to read based on it.`;
    
    //     // Send this to content.js via runtime message
    //     const response = await new Promise((resolve) => {
    //         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    //             if (!tabs[0]) return resolve({ success: false, error: 'No active tab' });
    //             chrome.tabs.sendMessage(
    //                 tabs[0].id,
    //                 { action: 'generateAIResponse', prompt },
    //                 (resp) => resolve(resp)
    //             );
    //         });
    //     });
    
    //     // Handle AI output or errors
    //     if (response && response.success) {
    //         return `<p><strong>Here 👇:</strong></p><pre style="white-space:pre-wrap;max-height:300px;overflow:auto">${response.output}</pre>`;
    //     } else {
    //         return `<p><strong>Error:</strong> ${response?.error || 'Unknown error'}</p>`;
    //     }
    // }




    async function simulateAiResponseWithInput(aiInput, websites) {
    // 1) read saved simplification level from storage
    const simplificationLevel = await new Promise((resolve) => {
        chrome.storage.sync.get('simplificationLevel', (res) => {
            resolve(res && res.simplificationLevel ? res.simplificationLevel : '2'); // default '2' (Clarity/Mid)
        });
    });

    // 2) map level to an instruction string you want the AI to follow
    const levelInstructions = {
        '1': 'Compare the given website content through the Calm lens. Focus on how relaxed, simple, and soothing it feels to read — considering tone, layout, and clarity. In 1–2 sentences, explain why {name of that website} website best supports calmness or reduces overwhelm for the user than anther website.',
        
        '2': 'Compare the given website content through the Clarity lens. Evaluate how clearly it communicates ideas, stays organized, and provides useful takeaways without fluff. In 1–2 sentences, justify why {name of that website} website offers better clarity and balanced understanding for the user than anther website.',
        
        '3': 'Compare the given website content through the Spark lens. Focus on how motivating, energizing, and creatively engaging it feels — does it inspire curiosity or action? In 1–2 sentences, explain why {name of that website} website best ignites interest or motivation for the user than anther website.'
    };
    


    const instruction = levelInstructions[simplificationLevel] || levelInstructions['2'];

    // 3) Combine website texts into a single prompt
    const combinedText = Object.entries(websites)
        .map(([key, value]) => `${key}:\n${value}`)
        .join('\n\n');

    // 4) Build the prompt including the selected simplification instruction
    const prompt = `Instruction: ${instruction}\n\nHere is the extracted text:\n\n${combinedText}`;

    // 5) Send prompt to content.js via runtime message (unchanged)
    const response = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return resolve({ success: false, error: 'No active tab' });
            chrome.tabs.sendMessage(
                tabs[0].id,
                { action: 'generateAIResponse', prompt },
                (resp) => resolve(resp)
            );
        });
    });

    // 6) Handle AI output or errors
    if (response && response.success) {
        return `<p><strong>Here 👇:</strong></p><pre style="white-space:pre-wrap;max-height:300px;overflow:auto">${response.output}</pre>`;
    } else {
        return `<p><strong>Error:</strong> ${response?.error || 'Unknown error'}</p>`;
    }
}

    


    // -------------------- Tab Selector --------------------
    async function populateTabs() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        optimizeSelector.innerHTML = '';

        tabs.forEach(tab => {
            const label = document.createElement("label");
            label.className = "tab-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "tabSelect";
            checkbox.value = tab.id;

            // Handle selection state
            checkbox.addEventListener('change', () => {
                const tabId = Number(checkbox.value);
                if (checkbox.checked) {
                    if (!selectedTabIds.includes(tabId)) selectedTabIds.push(tabId);
                } else {
                    selectedTabIds = selectedTabIds.filter(id => id !== tabId);
                }

                // Enforce max 3 selections
                if (selectedTabIds.length >= 3) {
                    Array.from(optimizeSelector.querySelectorAll('input[type="checkbox"]'))
                        .forEach(cb => { if (!cb.checked) cb.disabled = true; });
                } else {
                    Array.from(optimizeSelector.querySelectorAll('input[type="checkbox"]'))
                        .forEach(cb => cb.disabled = false);
                }

                updateTabInfoText();
            });

            const card = document.createElement("div");
            card.className = "tab-card";

            const favicon = document.createElement("span");
            favicon.className = "tab-favicon";
            const img = document.createElement("img");
            img.src = tab.favIconUrl || "chrome://favicon/";
            favicon.appendChild(img);

            const title = document.createElement("span");
            title.className = "tab-title";
            title.textContent = tab.title || "Untitled Tab";

            card.appendChild(favicon);
            card.appendChild(title);

            label.appendChild(checkbox);
            label.appendChild(card);
            optimizeSelector.appendChild(label);
        });

        updateTabInfoText();
    }

    // -------------------- Compare Button --------------------
    // compareBtn.addEventListener('click', async (e) => {
    //     e.preventDefault();
    //     setCompareBusy(true);

    //     try {
    //         if (selectedTabIds.length < 2 || selectedTabIds.length > 3) {
    //             alert('Please select at least 2 and at most 3 tabs to compare.');
    //             setCompareBusy(false);
    //             return;
    //         }

    //         const websiteTexts = [];
    //         for (let i = 0; i < selectedTabIds.length; i++) {
    //             const tabId = selectedTabIds[i];
    //             let response = await askTabForText(tabId);

    //             if (!response || response.success === false) {
    //                 const fallback = await execScriptExtract(tabId);
    //                 if (fallback && fallback.success) response = fallback;
    //             }

    //             const text = (response && response.success && response.text) ? response.text : '';
    //             websiteTexts.push(text);
    //         }

    //         const websites = {};
    //         websiteTexts.forEach((t, idx) => {
    //             websites[`website${idx+1}`] = t || '';
    //         });

    //         const aiInput = websiteTexts.map((t, idx) => {
    //             return `=== [website${idx+1}] (tabId: ${selectedTabIds[idx]}) ===\n${t}\n`;
    //         }).join('\n\n---\n\n');

    //         compareResult.innerHTML = `<p><strong>Collected ${websiteTexts.length} pages. Preparing comparison...</strong></p>`;
    //         compareResultContainer.classList.remove('hidden');

    //         const aiHtml = await simulateAiResponseWithInput(aiInput, websites);
    //         compareResult.innerHTML = aiHtml;
    //         compareResultContainer.classList.remove('hidden');

    //     } catch (err) {
    //         console.error('Compare flow failed', err);
    //         compareResult.innerHTML = '<p>Failed to collect texts from tabs. See console for details.</p>';
    //         compareResultContainer.classList.remove('hidden');
    //     } finally {
    //         setCompareBusy(false);
    //     }
    // });

    compareBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        setCompareBusy(true);
    
        try {
            if (selectedTabIds.length < 2 || selectedTabIds.length > 3) {
                alert('Please select at least 2 and at most 3 tabs to compare.');
                setCompareBusy(false);
                return;
            }
    
            const websiteTexts = [];
            const websites = {}; // we'll store tabTitle -> content
            const tabNames = {}; // optional: store tab info by id
    
            for (let i = 0; i < selectedTabIds.length; i++) {
                const tabId = selectedTabIds[i];
    
                // ✅ Get tab info (title + URL)
                const [tab] = await chrome.tabs.query({ active: false, windowId: chrome.windows.WINDOW_ID_CURRENT });
                // Alternative if you know the tabId:
                // const tab = await chrome.tabs.get(tabId);
    
                let response = await askTabForText(tabId);
    
                if (!response || response.success === false) {
                    const fallback = await execScriptExtract(tabId);
                    if (fallback && fallback.success) response = fallback;
                }
    
                const text = (response && response.success && response.text) ? response.text : '';
    
                // ✅ Use actual tab title (or fallback to URL or generic name)
                const tabLabel = (tab?.title?.length > 60 ? tab.title.slice(0, 60) + '…' : tab.title) || tab.url;

                websiteTexts.push({ title: tabLabel, text });
                websites[tabLabel] = text;
                tabNames[`website${i + 1}`] = tabLabel; // optional mapping
            }
    
            // Build the AI input with readable tab names
            const aiInput = websiteTexts
                .map(({ title, text }, idx) => `=== [${title}] (tabId: ${selectedTabIds[idx]}) ===\n${text}\n`)
                .join('\n\n---\n\n');
    
            compareResult.innerHTML = `<p><strong>Collected ${websiteTexts.length} pages. Preparing comparison...</strong></p>`;
            compareResultContainer.classList.remove('hidden');
    
            const aiHtml = await simulateAiResponseWithInput(aiInput, websites);
            compareResult.innerHTML = aiHtml;
            compareResultContainer.classList.remove('hidden');
    
        } catch (err) {
            console.error('Compare flow failed', err);
            compareResult.innerHTML = '<p>Failed to collect texts from tabs. See console for details.</p>';
            compareResultContainer.classList.remove('hidden');
        } finally {
            setCompareBusy(false);
        }
    });
    

    // -------------------- Initialize --------------------
    populateTabs();
});
