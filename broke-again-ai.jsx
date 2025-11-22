import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Upload, Settings, Lightbulb, AlertCircle, Trash2, Target, Coffee, Car, Zap, Heart, ShoppingBag, Activity, FileText, Loader } from 'lucide-react';

// --- START: Local Mock/Environment Setup ---

// 1. Anthropic API Key - Replace with your actual key
// IMPORTANT: In a production environment, this key MUST be securely stored on a backend server
// and called from a dedicated API endpoint to prevent exposure.
// For local development, set this in a .env.local file: REACT_APP_ANTHROPIC_API_KEY="YOUR_API_KEY"
const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;

// 2. Mock 'window.storage' for local development using localStorage
const mockStorage = {
  get: (key) => new Promise(resolve => {
    try {
      const value = localStorage.getItem(key);
      // Return an object that matches the expected structure, or null/undefined
      resolve(value ? { value: value } : null);
    } catch (e) {
      console.error("Local storage GET error:", e);
      resolve(null);
    }
  }),
  set: (key, value) => new Promise(resolve => {
    try {
      localStorage.setItem(key, value);
      resolve();
    } catch (e) {
      console.error("Local storage SET error:", e);
      resolve();
    }
  })
};

// Use the mock if the original 'window.storage' is not available
const storage = window.storage || mockStorage;

// --- END: Local Mock/Environment Setup ---


const categoryIcons = {
  Food: Coffee,
  Transportation: Car,
  Utilities: Zap,
  Entertainment: PieChart,
  Healthcare: Heart,
  Other: ShoppingBag
};

const categoryColors = {
  Food: 'from-orange-500 to-red-500',
  Transportation: 'from-blue-500 to-cyan-500',
  Utilities: 'from-yellow-500 to-orange-500',
  Entertainment: 'from-purple-500 to-pink-500',
  Healthcare: 'from-green-500 to-emerald-500',
  Other: 'from-gray-500 to-slate-500'
};

const BudgetTracker = () => {
  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [budgetLimit, setBudgetLimit] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [forecast, setForecast] = useState(null);

  const calculateForecast = (expensesData) => {
    if (!expensesData || expensesData.length === 0) return null;

    const dailyTotals = {};
    expensesData.forEach(expense => {
      const date = new Date(expense.date).toDateString();
      dailyTotals[date] = (dailyTotals[date] || 0) + expense.amount;
    });

    const dates = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));
    
    if (dates.length < 2) {
      const totalSpent = expensesData.reduce((sum, e) => sum + e.amount, 0);
      const avgDaily = totalSpent / expensesData.length;
      return {
        dailyAverage: avgDaily,
        monthlyPrediction: avgDaily * 30,
        trend: 'stable',
        confidence: 30
      };
    }

    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    const daysBetween = Math.max(1, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    
    const dataPoints = dates.map(date => {
      const daysSinceStart = Math.floor((new Date(date) - startDate) / (1000 * 60 * 60 * 24));
      return { x: daysSinceStart, y: dailyTotals[date] };
    });

    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, p) => sum + p.x, 0);
    const sumY = dataPoints.reduce((sum, p) => sum + p.y, 0);
    const sumXX = dataPoints.reduce((sum, p) => sum + p.x * p.x, 0);

    const denominator = (n * sumXX - sumX * sumX);
    
    if (Math.abs(denominator) < 0.0001) {
      const avgDaily = sumY / n;
      return {
        dailyAverage: avgDaily,
        monthlyPrediction: avgDaily * 30,
        trend: 'stable',
        confidence: 40
      };
    }

    const totalHistoricalSpending = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
    const avgDailyHistorical = totalHistoricalSpending / daysBetween;
    let predictedDaily = avgDailyHistorical;
    
    if (n >= 3) {
      // Simple linear approximation of recent trend (slope of all points)
      const recentSlope = (dataPoints[n-1].y - dataPoints[0].y) / Math.max(1, dataPoints[n-1].x - dataPoints[0].x);
      // Small adjustment based on trend
      const trendAdjustment = recentSlope * 0.3; 
      predictedDaily = Math.max(0, avgDailyHistorical + trendAdjustment);
    }

    const monthlyPrediction = predictedDaily * 30;

    let trend = 'stable';
    if (n >= 3) {
      const firstHalfAvg = dataPoints.slice(0, Math.floor(n/2)).reduce((sum, p) => sum + p.y, 0) / Math.floor(n/2);
      const secondHalfAvg = dataPoints.slice(Math.floor(n/2)).reduce((sum, p) => sum + p.y, 0) / (n - Math.floor(n/2));
      
      if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'increasing';
      else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'decreasing';
    }

    return {
      dailyAverage: predictedDaily,
      monthlyPrediction,
      trend,
      confidence: Math.min(85, 30 + (n * 5) + (daysBetween * 2))
    };
  };

  const generateSuggestions = async (expensesData) => {
    if (!expensesData || expensesData.length === 0 || !ANTHROPIC_API_KEY) return [];
    
    setLoadingSuggestions(true);
    
    try {
      const categoryTotals = {};
      const expensesByCategory = {};
      
      expensesData.forEach(expense => {
        const cat = expense.category;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
        if (!expensesByCategory[cat]) expensesByCategory[cat] = [];
        expensesByCategory[cat].push(expense);
      });

      const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
      const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);

      const suggestionsList = [];

      for (const [category, amount] of sortedCategories) {
        const percentage = ((amount / totalSpent) * 100).toFixed(1);
        const categoryExpenses = expensesByCategory[category];
        
        const expenseDetails = categoryExpenses
          .slice(-10)
          .map(e => `- $${e.amount.toFixed(2)}: ${e.description || 'No description'}`)
          .join('\n');

        const prompt = `I'm tracking my budget and spent $${amount.toFixed(2)} (${percentage}% of my total spending) on ${category}.

Recent ${category} expenses:
${expenseDetails}

Give me ONE personalized money-saving tip based on these expenses. Be specific, practical, and mention estimated savings. Keep it to 2-3 sentences.`;

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-sonnet-3.5-20240620',
              max_tokens: 500,
              messages: [{ role: 'user', content: prompt }]
            })
          });

          if (!response.ok) {
             const errorBody = await response.json();
             console.error('API Error for suggestions:', errorBody);
             throw new Error(`API error: ${response.status}`);
          }

          const data = await response.json();
          const tip = data.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('')
            .trim();

          suggestionsList.push({
            category,
            amount,
            percentage,
            tip: tip || `Review your ${category} spending for savings opportunities.`
          });
        } catch (error) {
          console.error(`Suggestion generation error for ${category}:`, error);
          suggestionsList.push({
            category,
            amount,
            percentage,
            tip: `You spent $${amount.toFixed(2)} on ${category}. Look for ways to optimize. (Tip generation failed)`
          });
        }
      }

      setLoadingSuggestions(false);
      return suggestionsList;
    } catch (error) {
      console.error("General suggestion error:", error);
      setLoadingSuggestions(false);
      return [];
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Use the globally scoped 'storage' abstraction
        const expensesResult = await storage.get('budget-expenses');
        const budgetResult = await storage.get('budget-limit');
        
        if (expensesResult) {
          const data = JSON.parse(expensesResult.value);
          setExpenses(data);
          const forecastData = calculateForecast(data);
          setForecast(forecastData);
          // Only attempt to generate suggestions if the API key is available
          if (ANTHROPIC_API_KEY) {
            const newSuggestions = await generateSuggestions(data);
            setSuggestions(newSuggestions);
          }
        }
        
        if (budgetResult) {
          setBudgetLimit(parseFloat(budgetResult.value));
        }
      } catch (error) {
        console.log('Starting fresh or data corruption:', error);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const saveExpenses = async (newExpenses) => {
    try {
      await storage.set('budget-expenses', JSON.stringify(newExpenses));
      setExpenses(newExpenses);
      const forecastData = calculateForecast(newExpenses);
      setForecast(forecastData);
      // Only generate suggestions if we have the key
      if (ANTHROPIC_API_KEY) {
        const newSuggestions = await generateSuggestions(newExpenses);
        setSuggestions(newSuggestions);
      }
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const addExpense = async (expense) => {
    const newExpenses = [...expenses, { ...expense, id: Date.now(), date: new Date().toISOString() }];
    await saveExpenses(newExpenses);
  };

  const addMultipleExpenses = async (newExps) => {
    // Add unique IDs and current date for new expenses
    const withIds = newExps.map(exp => ({ ...exp, id: Date.now() + Math.random(), date: new Date().toISOString() }));
    await saveExpenses([...expenses, ...withIds]);
  };

  const calculateMetrics = () => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const now = new Date();
    const thisMonth = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      // Filter expenses for the current month and year
      return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    }).reduce((sum, e) => sum + e.amount, 0);
    
    const lastWeek = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return expenseDate >= weekAgo;
    }).reduce((sum, e) => sum + e.amount, 0);

    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    return { total, thisMonth, lastWeek, categoryTotals };
  };

  const metrics = calculateMetrics();
  const budgetPercentage = (metrics.thisMonth / budgetLimit) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-pink-100">
      <header className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl border border-white/30">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Broke-Again</h1>
                <p className="text-sm text-white/90">Smart Budget Tracker with Bill OCR</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['dashboard', 'add', 'bills', 'analytics', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    activeTab === tab
                      ? 'bg-white text-purple-600 shadow-lg'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && <Dashboard metrics={metrics} budgetLimit={budgetLimit} budgetPercentage={budgetPercentage} expenses={expenses} suggestions={suggestions} loadingSuggestions={loadingSuggestions} forecast={forecast} />}
        {activeTab === 'add' && <AddExpenseForm onAdd={addExpense} />}
        {activeTab === 'bills' && <BillUploadForm onAddExpenses={addMultipleExpenses} />}
        {activeTab === 'analytics' && <Analytics expenses={expenses} />}
        {activeTab === 'settings' && <Settings budgetLimit={budgetLimit} setBudgetLimit={setBudgetLimit} expenses={expenses} onClearData={() => saveExpenses([])} />}
      </div>
    </div>
  );
};

const BillUploadForm = ({ onAddExpenses }) => {
  const [uploading, setUploading] = useState(false);
  const [parsedExpenses, setParsedExpenses] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [fileError, setFileError] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!ANTHROPIC_API_KEY) {
      setFileError("Anthropic API Key is not set. Cannot process bill image.");
      return;
    }

    setUploading(true);
    setFileError(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const mimeType = file.type;
          const base64Data = event.target.result.split(',')[1];
          
          console.log('Sending image to Claude API...');
          
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-sonnet-3.5-20240620',
              max_tokens: 1500,
              messages: [{
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: mimeType, data: base64Data }
                  },
                  {
                    type: 'text',
                    text: 'Extract all items and prices from this receipt/bill image. Return ONLY valid JSON array. Each object must have: "description" (string), "amount" (number), "category" (one of: Food, Transportation, Utilities, Entertainment, Healthcare, Other). Example: [{"description":"Coffee","amount":5.50,"category":"Food"}]'
                  }
                ]
              }]
            })
          });

          if (!response.ok) {
            const errorBody = await response.json();
            console.error('API Error details:', errorBody);
            throw new Error(`API error: ${response.status} - ${errorBody.error?.message || 'Unknown Error'}`);
          }

          const data = await response.json();
          console.log('API Response:', data);
          
          const responseText = data.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');
          
          // Robust JSON cleanup (removes markdown and unnecessary text)
          const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          let extractedExpenses = [];
          try {
             extractedExpenses = JSON.parse(jsonString);
          } catch (jsonError) {
             console.error('JSON parsing failed:', jsonError);
             throw new Error('AI failed to return valid JSON. Response received: ' + responseText.substring(0, 100) + '...');
          }
          
          if (!Array.isArray(extractedExpenses)) {
             throw new Error('AI returned an object, expected an array.');
          }
          
          const validCategories = ['Food', 'Transportation', 'Utilities', 'Entertainment', 'Healthcare', 'Other'];
          const validExpenses = extractedExpenses
            // Basic validation for amount
            .filter(exp => exp.amount && typeof exp.amount === 'number' && exp.amount > 0 && exp.amount < 10000)
            .map(exp => ({
              amount: parseFloat(exp.amount),
              // Default to 'Other' if category is invalid
              category: validCategories.includes(exp.category) ? exp.category : 'Other',
              description: (exp.description || 'Item').substring(0, 50),
              date: new Date().toISOString()
            }))
            .slice(0, 20); // Limit number of entries

          console.log('Valid expenses:', validExpenses);
          
          if (validExpenses.length === 0) {
            setFileError('No valid expenses found in the image. Please try a clearer photo of the receipt.');
            setUploading(false);
            return;
          }

          setParsedExpenses(validExpenses);
          setShowPreview(true);
        } catch (error) {
          console.error('Full processing error:', error);
          setFileError('Error processing image: ' + error.message);
        }
        setUploading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      setFileError('Upload error: ' + error.message);
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    if (parsedExpenses.length > 0) {
      onAddExpenses(parsedExpenses);
      setParsedExpenses([]);
      setShowPreview(false);
      alert(`✅ Added ${parsedExpenses.length} expenses!`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-8 border-2 border-blue-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-3 rounded-xl">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Upload Receipt/Bill</h2>
        </div>
        
        {!ANTHROPIC_API_KEY && (
           <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
              <p className="font-bold">⚠️ API Key Missing</p>
              <p className="text-sm">Please set the <strong>REACT_APP_ANTHROPIC_API_KEY</strong> environment variable to enable this feature. Note: This exposes your key on the client side; use a secure backend for production.</p>
           </div>
        )}

        <div className="border-3 border-dashed border-blue-300 rounded-xl p-12 text-center bg-blue-50">
          <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading || !ANTHROPIC_API_KEY}
            className="hidden"
            id="bill-upload"
          />
          <label htmlFor="bill-upload" className="cursor-pointer">
            <p className="text-lg font-semibold text-gray-700 mb-2">
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-5 h-5 animate-spin" />
                  Processing...
                </span>
              ) : 'Click to upload bill photo'}
            </p>
            <p className="text-sm text-gray-500">JPG, PNG, GIF, WebP supported (AI processing is best with clear receipts)</p>
          </label>
        </div>

        {fileError && (
          <div className="mt-4 flex items-center p-4 bg-red-100 text-red-700 rounded-lg">
            <AlertCircle className="w-5 h-5 mr-3" />
            <p className="text-sm">{fileError}</p>
          </div>
        )}
      </div>

      {showPreview && parsedExpenses.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-xl p-8 border-2 border-green-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Extracted Expenses</h3>
          <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
            {parsedExpenses.map((exp, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 flex justify-between border border-green-200">
                <div>
                  <p className="font-semibold text-gray-800">{exp.description}</p>
                  <p className="text-sm text-gray-600">{exp.category}</p>
                </div>
                <p className="font-bold text-green-600">${exp.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleConfirm}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg"
            >
              ✅ Add All
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ metrics, budgetLimit, budgetPercentage, expenses, suggestions, loadingSuggestions, forecast }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <MetricCard title="Total" value={`$${metrics.total.toFixed(2)}`} icon={DollarSign} gradient="from-blue-500 to-blue-600" />
      <MetricCard title="This Month" value={`$${metrics.thisMonth.toFixed(2)}`} icon={Calendar} gradient="from-purple-500 to-purple-600" />
      <MetricCard title="This Week" value={`$${metrics.lastWeek.toFixed(2)}`} icon={TrendingUp} gradient="from-green-500 to-green-600" />
      <MetricCard title="Budget Left" value={`$${(budgetLimit - metrics.thisMonth).toFixed(2)}`} icon={Target} gradient="from-orange-500 to-orange-600" percentage={budgetPercentage} />
    </div>

    {forecast && (
      <div className="bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white border-2 border-white/20">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-7 h-7" />
          <h3 className="text-2xl font-bold">AI Spending Forecast</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/15 backdrop-blur-md rounded-xl p-5 border border-white/30">
            <p className="text-sm opacity-90 mb-1">Daily Average</p>
            <p className="text-3xl font-bold">${forecast.dailyAverage.toFixed(2)}</p>
          </div>
          <div className="bg-white/15 backdrop-blur-md rounded-xl p-5 border border-white/30">
            <p className="text-sm opacity-90 mb-1">30-Day Forecast</p>
            <p className="text-3xl font-bold">${forecast.monthlyPrediction.toFixed(2)}</p>
            <p className="text-xs opacity-75 mt-1">Trend: {forecast.trend}</p>
          </div>
          <div className="bg-white/15 backdrop-blur-md rounded-xl p-5 border border-white/30">
            <p className="text-sm opacity-90 mb-1">Confidence</p>
            <p className="text-3xl font-bold">{forecast.confidence.toFixed(0)}%</p>
          </div>
        </div>
      </div>
    )}

    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Monthly Budget</h3>
        <span className="text-sm text-gray-500">{budgetPercentage.toFixed(1)}%</span>
      </div>
      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
        <div className={`absolute top-0 left-0 h-full rounded-full ${budgetPercentage > 90 ? 'bg-red-500' : budgetPercentage > 75 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${Math.min(budgetPercentage, 100)}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-sm text-gray-600">
        <span>${metrics.thisMonth.toFixed(2)} spent</span>
        <span>${budgetLimit.toFixed(2)} limit</span>
      </div>
    </div>

    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Spending by Category</h3>
      <div className="space-y-3">
        {Object.entries(metrics.categoryTotals).map(([category, amount]) => {
          const Icon = categoryIcons[category];
          const percentage = (amount / metrics.total) * 100 || 0;
          return (
            <div key={category}>
              <div className="flex justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`bg-gradient-to-br ${categoryColors[category]} p-2 rounded-lg`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-gray-700">{category}</span>
                </div>
                <span className="font-semibold">${amount.toFixed(2)}</span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full">
                <div className={`h-full bg-gradient-to-r ${categoryColors[category]} rounded-full`} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>

    <div className="bg-gradient-to-br from-indigo-600 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
      <div className="flex items-center gap-3 mb-4">
        <Lightbulb className="w-7 h-7" />
        <h3 className="text-2xl font-bold">Savings Tips</h3>
      </div>
      {ANTHROPIC_API_KEY ? (
         loadingSuggestions ? (
           <div className="text-center py-8">
             <Loader className="w-5 h-5 animate-spin mx-auto mb-2" />
             <p>Analyzing patterns...</p>
           </div>
         ) : suggestions.length > 0 ? (
           <div className="grid gap-4">
             {suggestions.map((s, i) => (
               <div key={i} className="bg-white/15 backdrop-blur rounded-lg p-4 border border-white/30">
                 <p className="font-bold mb-2">{s.category} ({s.percentage}%)</p>
                 <p className="text-sm">{s.tip}</p>
               </div>
             ))}
           </div>
         ) : (
           <p>Add expenses to get personalized tips</p>
         )
      ) : (
        <div className="bg-white/10 p-4 rounded-lg border border-white/30">
           <p className="text-sm font-semibold">API Key is required to generate personalized tips.</p>
        </div>
      )}
    </div>
  </div>
);

const MetricCard = ({ title, value, icon: Icon, gradient, percentage }) => (
  <div className="bg-white rounded-2xl shadow-lg p-6">
    <div className={`bg-gradient-to-br ${gradient} p-3 rounded-xl w-fit mb-4`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
    <p className="text-2xl font-bold">{value}</p>
    {percentage !== undefined && (
      <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${gradient}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    )}
  </div>
);

const AddExpenseForm = ({ onAdd }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (amount && parseFloat(amount) > 0) {
      onAdd({ amount: parseFloat(amount), category, description, date: new Date(date).toISOString() });
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    } else {
      alert('Please enter a valid amount.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-purple-200">
        <h2 className="text-3xl font-bold text-purple-600 mb-6">Add Expense</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl">
              {['Food', 'Transportation', 'Utilities', 'Entertainment', 'Healthcare', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Starbucks latte" className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl" />
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold hover:shadow-lg">
            Add Expense
          </button>
        </form>
      </div>
    </div>
  );
};

const Analytics = ({ expenses }) => {
  if (!expenses || expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Analytics</h2>
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No expenses yet</p>
        </div>
      </div>
    );
  }

  const monthlyData = {};
  expenses.forEach(exp => {
    const date = new Date(exp.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { total: 0, count: 0 };
    monthlyData[key].total += exp.amount;
    monthlyData[key].count += 1;
  });

  const months = Object.keys(monthlyData).sort();
  const totals = months.map(m => monthlyData[m].total);
  const max = totals.length > 0 ? Math.max(...totals) : 0;
  const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-500 text-white rounded-2xl p-6">
          <h3 className="text-sm opacity-90 mb-2">Highest Month</h3>
          <p className="text-3xl font-bold">${max.toFixed(2)}</p>
        </div>
        <div className="bg-purple-500 text-white rounded-2xl p-6">
          <h3 className="text-sm opacity-90 mb-2">Average Month</h3>
          <p className="text-3xl font-bold">${avg.toFixed(2)}</p>
        </div>
        <div className="bg-green-500 text-white rounded-2xl p-6">
          <h3 className="text-sm opacity-90 mb-2">Total Expenses</h3>
          <p className="text-3xl font-bold">{expenses.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Monthly Trend</h3>
        <div className="space-y-3">
          {months.map(m => {
            const data = monthlyData[m];
            const width = (data.total / max) * 100;
            return (
              <div key={m}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{m}</span>
                  <span className="text-sm font-bold">${data.total.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Settings = ({ budgetLimit, setBudgetLimit, expenses, onClearData }) => {
  const [newLimit, setNewLimit] = useState(budgetLimit);

  const handleSave = async () => {
    await storage.set('budget-limit', newLimit.toString());
    setBudgetLimit(newLimit);
    alert('✅ Budget saved!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        <div>
          <label className="block text-sm font-semibold mb-2">Monthly Budget</label>
          <input type="number" value={newLimit} onChange={(e) => setNewLimit(parseFloat(e.target.value))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl mb-4" />
          <button onClick={handleSave} className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold">
            Save Budget
          </button>
        </div>
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-red-800 mb-3">Danger Zone</h3>
        <button onClick={() => {
            if (window.confirm('Are you sure you want to clear all budget data? This action cannot be undone.')) {
                onClearData();
                alert('🗑️ All data cleared!');
            }
        }} className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold">
          <Trash2 className="inline w-5 h-5 mr-2" />
          Clear All Data
        </button>
      </div>
    </div>
  );
};

export default BudgetTracker;