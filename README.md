# Broke-Again
Smart AI powered Budget and Expense Tracker
💰 Broke-Again: Smart Budget Tracker with AI OCR

Broke-Again is a modern, single-page React application designed to help users track their monthly spending, stay within budget, and gain proactive financial insights. Its standout feature is the integration of the Anthropic Claude 3.5 Sonnet model for both:

Receipt/Bill OCR (Optical Character Recognition): Upload a picture of a receipt, and the AI will automatically parse item descriptions, amounts, and categorize them, saving manual entry time.

Personalized Savings Tips: Based on your spending history and highest-cost categories, the AI provides specific, actionable advice to help you cut costs.

✨ Features

Dashboard: Real-time metrics for total spending, monthly spending, and remaining budget.

AI-Powered OCR: Upload images of receipts to automatically log expenses (requires Anthropic API Key).

Intelligent Suggestions: Receives personalized savings tips from the Claude model based on spending patterns.

Local Persistence: Uses browser's localStorage for data persistence (or window.storage in specific environments).

Responsive UI: Built with React and styled using Tailwind CSS for a great experience on any device.

🛠️ Technology Stack

Frontend: React (Functional Components & Hooks)

Styling: Tailwind CSS

Icons: Lucide React

AI Backend: Anthropic Claude 3.5 Sonnet (for OCR and suggestions)

Data Storage: Browser's localStorage (mocking the Canvas environment's storage API).

🚀 Installation & Setup

Prerequisites

You need to have Node.js and npm (or yarn/pnpm) installed. This project assumes you are running it within a standard React environment (e.g., created with Vite or Create React App).

Step 1: Clone the Repository

git clone YOUR_REPOSITORY_URL
cd broke-again-budget-tracker


Step 2: Install Dependencies

The project relies on lucide-react for icons and standard React tooling.

npm install lucide-react
# If you haven't already, ensure Tailwind CSS is configured in your project.


Step 3: Configure the Anthropic API Key (Crucial for AI Features)

The AI features (Receipt OCR and Suggestions) require an Anthropic API Key. For security, this key must be set as an environment variable.

Create a file named .env.local in the root directory of your project (e.g., in the same folder as package.json).

Add your API key to this file:

REACT_APP_ANTHROPIC_API_KEY="sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"


NOTE ON SECURITY: This method exposes your API key to the client's browser. For a production deployment, it is strongly recommended to proxy all API calls through a secure serverless function or dedicated backend to protect your key.

Step 4: Add the Code

Ensure the provided BudgetTracker.jsx code is placed in your project's src/ directory (e.g., src/BudgetTracker.jsx) and is being rendered by your main App component.

▶️ Running the Application

Use the standard command for your React setup to start the development server:

npm start
# or
npm run dev 


The application should now be accessible in your browser, typically at http://localhost:3000.

⚙️ Usage

Dashboard: View current spending metrics and AI-generated financial forecasts and tips.

Add Expense: Manually input expense details, category, and amount.

Bills (AI OCR): Click "Click to upload bill photo" and select a clear image of a receipt. The AI will parse the items, and you can confirm before adding them to your expenses.

Settings: Adjust your monthly budget limit or clear all saved data from the browser.
