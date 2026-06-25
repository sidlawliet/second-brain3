# Migration Guide: Moving Second Brain to Google's Ecosystem

This guide outlines how to transfer your **Second Brain** project from Vercel/Local files into Google's native developer platforms to leverage deep integration with Gemini, Firebase, and Google Cloud.

Since **Google AI Studio** is a playground for testing prompts and generating API keys, it does not host full-stack Next.js web applications. Instead, you can use **Project IDX** (Google's cloud-based AI editor) for development, and **Firebase App Hosting** or **Google Cloud Run** for hosting.

---

## Option 1: AI-Integrated Development Environments

If Project IDX is not supported or accessible in your region, Google offers two excellent alternatives that provide the same browser-based code editing, integrated terminal, and deep Gemini Code Assist capabilities:

### Option 1A: Google Cloud Shell Editor (Free & Browser-based)
Google Cloud Shell provides a free development VM with a VS Code-based browser editor, pre-installed CLI tools (gcloud, firebase, git), and native Gemini Code Assist.

1. **Launch Cloud Shell Editor**:
   - Go to [Google Cloud Console](https://console.cloud.google.com).
   - Click the **Activate Cloud Shell** icon (terminal icon) in the top-right toolbar.
   - Once the terminal opens, click the **Open Editor** button on the toolbar.
2. **Clone your repository**:
   - In the Cloud Shell terminal pane, run:
     ```bash
     git clone https://github.com/sidlawliet/second-brain.git
     cd second-brain
     ```
3. **Enable Gemini Code Assist**:
   - In the Editor, click the **Cloud Code** or **Gemini** status bar menu (the sparkle icon at the bottom or next to the search bar).
   - Sign in with your Google Account, enable the "Gemini for Google Cloud API" in your Google Cloud Console project, and select that project in the editor dropdown.
4. **Run and Preview**:
   - In the terminal, run `npm install` and then `npm run dev`.
   - Click the **Web Preview** button (top-right of the terminal pane) and select **Preview on port 3000** to view your running app live.

---

### Option 1B: Local VS Code with Gemini Code Assist (Local IDE Integration)
If you prefer working locally on your own machine but want the same premium integrated Gemini environments:

1. **Install the Extension**:
   - Open your local VS Code editor.
   - Go to the Extensions marketplace (`Ctrl+Shift+X` on Windows).
   - Search for **"Gemini Code Assist"** (by Google Cloud) and install it.
2. **Connect to Google Cloud**:
   - Click the Gemini icon in the VS Code sidebar or the status bar at the bottom.
   - Click **Sign In** and authenticate using your Google account.
   - Select your active Google Cloud project.
3. **Enjoy Integrated AI**:
   - Use `Ctrl+I` (or `Cmd+I`) to trigger inline AI prompt editing.
   - Open the Gemini Chat pane in the sidebar to ask questions, explain code snippets, or generate features natively.

---

## Option 2: Hosting with Google Firebase App Hosting
[Firebase App Hosting](https://firebase.google.com/docs/app-hosting) is Google's modern, serverless hosting solution specifically built for SSR frameworks like Next.js (built on top of Google Cloud Run and Cloud Build).

### How to Deploy:
1. **Install Firebase CLI**:
   Ensure you have the latest Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   ```
2. **Log In and Initialize App Hosting**:
   Run the login command and initialize App Hosting in your project root:
   ```bash
   firebase login
   firebase apphosting:backends:create
   ```
3. **Configure the deployment**:
   - The CLI will prompt you to select your Google Cloud project and connect to your GitHub repository.
   - It will automatically set up a GitHub Action to deploy your app on every push.
4. **Secure your API Key using Google Cloud Secret Manager**:
   Firebase App Hosting integrates natively with Google Cloud Secret Manager to protect your API keys.
   - Go to your Google Cloud Console for the project.
   - Search for **Secret Manager** and create a secret named `GEMINI_API_KEY` containing your API Studio key.
   - Grant the App Hosting service account read access to this secret.
   - Create an `apphosting.yaml` configuration file in your project root to map this secret to your Next.js environment:
     ```yaml
     # apphosting.yaml
     headers:
       - glob: "/**"
         headers:
           - key: Strict-Transport-Security
             value: max-age=31536000; includeSubDomains

     env:
       - name: GEMINI_API_KEY
         secret: GEMINI_API_KEY
     ```
5. **Push to GitHub**:
   Commit and push `apphosting.yaml` to your repository. Firebase App Hosting will automatically pick up the build, fetch the secret at runtime, and deploy your site!

---

## Option 3: Hosting with Google Cloud Run
If you want complete control over your container configuration, you can containerize the app and deploy it on **Google Cloud Run**.

1. **Add a Dockerfile** to the project root:
   ```dockerfile
   FROM node:18-alpine AS base

   # Install dependencies only when needed
   FROM base AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci

   # Rebuild the source code only when needed
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   ENV NEXT_TELEMETRY_DISABLED=1
   RUN npm run build

   # Production image, copy all the files and run next
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV=production
   ENV NEXT_TELEMETRY_DISABLED=1

   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs

   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

   USER nextjs
   EXPOSE 3000
   ENV PORT=3000
   ENV HOSTNAME="0.0.0.0"

   CMD ["node", "server.js"]
   ```
2. Make sure you enable `output: 'standalone'` in your [next.config.ts](file:///c:/Users/siddh/OneDrive/Desktop/Hackathon/next.config.ts) file for optimized container builds.
3. Deploy to Cloud Run in one click:
   ```bash
   gcloud run deploy second-brain --source . --env-vars-file=.env.production.yaml
   ```
