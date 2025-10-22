# Octopus: Browse by Vibe, Not by Chaos

**Octopus** is a Chrome extension built for the Google Hackathon that helps you choose the right website or content based on how you *feel*, not just what you search. Whether you're overwhelmed, confused, or unmotivated, Octopus helps you find clarity, calm, or inspiration right inside your browser.

---

## 💡 What It Does

Octopus connects with Chrome’s built-in **Gemini Nano Prompt API** to understand your emotional context and compare open tabs or websites accordingly. It can:

* 🧘 **Calm Mode:** When you feel overwhelmed, Octopus compares tabs to find the simplest, most peaceful one.
* 🔍 **Clarity Mode:** When you feel confused, it highlights the most useful, actionable tab.
* 🔥 **Spark Mode:** When you feel unmotivated, it picks the tab that’s most inspiring and energizing.

Not just that, Octopus can also **rewrite webpages** to match your chosen vibe, helping you process content in a tone that feels right for you.

---

## ⚙️ How It Works

1. You pick your current **mood** (Calm, Clarity, or Spark).
2. Octopus analyzes your open tabs using the **Gemini Nano built-in AI**.
3. It suggests the website that best aligns with your mood.
4. Optionally, it can rewrite the selected tab in your chosen emotional style.

---

## 🚀 Installation

### Step 1: Enable Gemini Nano and Prompt API

1. Open Chrome Dev or Canary and navigate to:

   ```
   chrome://flags/#optimization-guide-on-device-model
   ```
2. Set **"Enabled BypassPerfRequirement"** — this bypasses performance checks that might prevent Gemini Nano download.
3. Then go to:

   ```
   chrome://flags/#prompt-api-for-gemini-nano
   ```
4. Select **"Enabled"**
5. **Relaunch Chrome**

---

### Step 2: Install Octopus Extension

1. Clone the repository:

   ```bash
   git clone https://github.com/[your-username]/octopus
   ```
2. Open Chrome Dev or Canary.
3. Navigate to:

   ```
   chrome://extensions/
   ```
4. Enable **Developer mode** (top-right corner toggle).
5. Click **Load unpacked**.
6. Select the cloned `octopus` directory.
7. Octopus should now appear in your Chrome toolbar


---

## 🤝 Credits & Acknowledgments

This project was originally built upon the complete Chrome extension repository *Mochi*, which served as the structural foundation for Octopus.
We extensively modified, refactored, and expanded it to include vibe-based content comparison and rewriting system that powers Octopus today.

Massive thanks to *Tan Han Wei* for his open-source contribution, which made rapid development of Octopus possible.

---

## 🧭 Vision

Octopus reimagines browsing as an emotional experience, not just an informational one. It’s your **AI compass for digital clarity**, helping you:

> **Choose better. Feel lighter. Think clearly.**

---

## 🪄 Tagline

> **Octopus doesn’t just compare content, it compares vibes.**
