export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  content: string;
};

export const posts: BlogPost[] = [
  {
    slug: "welcome-to-lootrunners",
    title: "Welcome to Lootrunners",
    date: "2026-04-09",
    summary: "Introducing Lootrunners — an AI-powered retro OS that generates apps on the fly.",
    content: `
## What is Lootrunners?

Lootrunners is a retro operating system experience powered by AI. Describe any application you want, and it gets generated on the fly — right inside a Windows 98-style desktop.

### How it works

1. Click **Start > Run**
2. Describe the app you want (e.g. "paint app", "calculator", "todo list")
3. The AI generates a fully functional HTML/CSS/JS application
4. It opens in a draggable, resizable window on your desktop

### Fix & Iterate

Found a bug? Click the **?** button on any generated app to chat with the AI developer. Describe what's wrong, and it'll fix the code and update the app live.

### Built with

- Next.js 16 + React 19
- Anthropic Claude API
- 98.css for the retro aesthetic
- Deployed with Docker + Traefik

Stay tuned for more updates.
    `,
  },
  {
    slug: "ai-app-generation",
    title: "How AI App Generation Works",
    date: "2026-04-10",
    summary: "A look under the hood at how Lootrunners generates applications from text descriptions.",
    content: `
## From Description to Application

When you type a description into the Run dialog, here's what happens:

### 1. Prompt Construction

Your description is wrapped in a system prompt that tells Claude to generate a complete HTML application styled with 98.css. The prompt includes rules about responsive design, overflow handling, and the OS API.

### 2. Streaming Generation

The response streams directly into an iframe. You see the app build itself in real-time as the HTML arrives — no waiting for the full response.

### 3. Code Capture

Once the stream completes, the generated HTML is captured and cached. Next time you open the same app, it loads instantly from the cache.

### 4. Iteration

The **?** button opens a chat window where the AI has full context of your app's source code. Ask for changes, report bugs, or request new features — the app updates live.

### What can you build?

Anything that runs in a browser:

- Games (chess, snake, tetris)
- Productivity tools (calculators, timers, todo lists)
- Creative tools (paint apps, music makers)
- Data tools (charts, converters)

The only limit is your imagination.
    `,
  },
];

export const sortedPosts = [...posts].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);
