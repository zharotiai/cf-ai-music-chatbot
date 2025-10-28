# 🎵 AI Music Chatbot deployed on Cloudflare

An **AI-powered music recommender app** built on **Cloudflare’s developer platform**.  
It allows users to chat naturally with an AI to get personalized music recommendations, powered by LLM reasoning and Cloudflare’s global infrastructure.

---

## 🚀 Features

- **Conversational Music Recommendations**  
  Chat with an AI assistant to discover songs, artists, and playlists that match your mood or preferences.  

- **LLM Intelligence**  
  Uses **Llama 3.3** running on **Cloudflare Workers AI** for natural language understanding and generation.  

- **Persistent Memory**  
  Stores recent chat context and user preferences using **Durable Objects**, enabling more personalized interactions over time.  

- **Seamless User Interface**  
  A lightweight chat interface built with **Cloudflare Pages** for real-time interaction and instant responses.  

- **Workflow Coordination**  
  Integrates **Cloudflare Workflows** to manage the pipeline between user input, LLM inference, and recommendation logic.

---

## 🧠 How It Works

1. The user opens the chat interface on the deployed Cloudflare Pages site.  
2. User messages are sent to a **Cloudflare Worker**, which coordinates the conversation flow.  
3. The **Worker** calls **Workers AI** (Llama 3.3) to process the user’s input and generate a music recommendation or response.  
4. A **Durable Object** maintains session memory, storing past preferences and recent chats for contextual awareness.  
5. The response is displayed in the chat UI in real time.

---

## 💡 Tech Stack

- **Cloudflare Workers AI** – LLM inference (Llama 3.3)  
- **Cloudflare Workflows** – Task orchestration  
- **Cloudflare Durable Objects** – Persistent state and memory  
- **Cloudflare Pages** – Frontend hosting and real-time chat interface  

---

## 🧭 Usage

Visit the deployed app:  
👉 [cf-ai-music-chatbot.zharotiai.workers.dev](https://cf-ai-music-chatbot.zharotiai.workers.dev/)

Type a message like:  
> “Recommend me a chill playlist for studying.”  

or  
> “What songs are similar to Daft Punk’s *Get Lucky*?”  

The chatbot will analyze your request, remember your preferences, and return tailored music suggestions.

---

## 🛠️ Local Development

To run locally:
```bash
npm install
npm run dev
