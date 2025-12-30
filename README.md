
# TCN Igando Crossover 2026 Attendance Portal

A premium, high-performance attendance registration system built for the TCN Igando Crossover Service. This application features real-time data synchronization, an administrative dashboard, and a secure AI-powered prophetic word generator.

## ✨ Features

- **Elegant UI/UX**: Designed with a modern lilac aesthetic, optimized for both mobile and desktop.
- **Real-time Attendance**: Live counter and data sync using Firebase Firestore.
- **Secure AI Integration**: Prophetic word generation for 2026 using Google Gemini 2.0 via a secure Vercel Edge Function proxy.
- **Admin Dashboard**: Secure portal for managing attendees, exporting CSV data, and monitoring attendance stats.
- **No-Build Architecture**: Optimized for performance using ESM modules and Import Maps.

## 🛠 Tech Stack

- **Frontend**: React (ESM), Tailwind CSS, FontAwesome.
- **Backend/Database**: Firebase Firestore.
- **Serverless**: Vercel Edge Functions (TypeScript).
- **AI**: Google Generative AI (Gemini 2.0).
- **Deployment**: Vercel.

## 🚀 Deployment Instructions

### 1. Prerequisites
- A Google AI Studio API Key (for Gemini).
- A Firebase Project with Firestore enabled.

### 2. Firebase Configuration
Update the configuration in `firebase/config.ts` with your specific Firebase credentials. Ensure Firestore rules allow read/write for the `attendance` collection.

### 3. Vercel Setup
1. Push this project to a GitHub repository.
2. Connect the repository to Vercel.
3. **Important**: Add the following Environment Variable in the Vercel Dashboard:
   - `API_KEY`: Your Gemini API Key.

## 🔒 Security

This application implements a **Backend Proxy Pattern**. The AI API Key is stored safely as a Vercel Environment Variable and is accessed only via the `api/prophetic-word.ts` edge function. This ensures that the API key is never exposed to the client-side browser or the network tab.

## 📄 License
This project is for use by TCN Igando. All rights reserved.
