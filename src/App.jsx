import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import Papa from 'papaparse';
import Chart from 'chart.js/auto';
import './App.css';

function App() {
  const [rawData, setRawData] = useState([]);
  const [dfReturns, setDfReturns] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [totalReturn, setTotalReturn] = useState(0);

  useEffect(() => {
    fetch('/esg_score.csv')
      .then(response => response.text())
      .then(text => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => setRawData(results.data)
        });
      });

    fetch('/predicted_returns_converted.csv')
      .then(response => response.text())
      .then(text => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => setDfReturns(results.data)
        });
      });
  }, []);

  const handleInputChange = (e) => {
    const keyword = e.target.value;
    setSearchText(keyword);

    if (!keyword) {
      setSuggestions([]);
      return;
    }

    const filtered = rawData.filter(
      item =>
        item['公司代碼']?.includes(keyword) ||
        item['簡稱']?.includes(keyword)
    );

    const uniqueSuggestions = [];
    const seenCodes = new Set();

    filtered.forEach(item => {
      const code = item['公司代碼'];
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        uniqueSuggestions.push(item);
      }
    });

    setSuggestions(uniqueSuggestions.slice(0, 10));
  };

  const handleSelectSuggestion = (item) => {
    const code = item['公司代碼'];
    const stockList = rawData.filter(i => i['公司代碼'] === code);

    if (
      selectedStocks.length >= 5 ||
      selectedStocks.some(s => s[0]['公司代碼'] === code)
    ) return;

    const updatedStocks = [...selectedStocks, stockList];
    const count = updatedStocks.length;
    const updatedAllocations = Array(count).fill(Math.floor(100 / count));
    const remainder = 100 - updatedAllocations.reduce((a, b) => a + b, 0);
    updatedAllocations[count - 1] += remainder;

    setSelectedStocks(updatedStocks.slice(0, 5));
    setAllocations(updatedAllocations.slice(0, 5));
    setSearchText('');
    setSuggestions([]);

    setTimeout(() => calculateTotalReturn(updatedStocks, updatedAllocations), 0);
  };

  const handleSearch = () => {
    if (!searchText || selectedStocks.length >= 5) return;
    const item = suggestions[0];
    if (item) handleSelectSuggestion(item);
  };

  const handleAllocationChange = (index, value) => {
    const updated = [...allocations];
    updated[index] = parseInt(value) || 0;
    setAllocations(updated);
    setTimeout(() => calculateTotalReturn(selectedStocks, updated), 0);
  };

  const handleRemoveStock = (indexToRemove) => {
    const newStocks = selectedStocks.filter((_, i) => i !== indexToRemove);
    const newAllocations = allocations.filter((_, i) => i !== indexToRemove);
    setSelectedStocks(newStocks);
    setAllocations(newAllocations);
    setTimeout(() => calculateTotalReturn(newStocks, newAllocations), 0);
  };

  const calculateTotalReturn = (stocks = selectedStocks, weights = allocations) => {
    if (!dfReturns || dfReturns.length === 0 || stocks.length === 0) return;

    let total = 0;
    stocks.forEach((stockList, index) => {
      const code = stockList[0]['公司代碼'];
      const match = dfReturns.find(item => item.Company?.toString() === code);
      if (match) {
        const weight = weights[index] / 100;
        total += weight * parseFloat(match.Predicted_Next_Return_Pct);
      }
    });

    setTotalReturn(total);
  };

  const generateChartData = () => {
    const labelsSet = new Set();
    selectedStocks.forEach(stockList =>
      stockList.forEach(item => labelsSet.add(item['TESG評等季度']))
    );
    const labels = Array.from(labelsSet).sort();

    const datasets = selectedStocks.map((stockList, index) => {
      const stockMap = {};
      stockList.forEach(item => {
        stockMap[item['TESG評等季度']] = parseFloat(item['TESG分數']);
      });

      const data = labels.map(label => stockMap[label] || null);

      return {
        label: `${stockList[0]['簡稱']} (${stockList[0]['公司代碼']})`,
        data,
        borderWidth: 2,
        fill: false,
        borderColor: `hsl(${index * 72}, 70%, 50%)`,
        backgroundColor: `hsl(${index * 72}, 70%, 50%)`,
      };
    });

    return { labels, datasets };
  };

  return (
    <div className="App">
      {/* 左邊欄 */}
      <div className="left-panel">
        <h1>TESG 資料視覺化儀表板</h1>

        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="輸入公司代碼或名稱"
            value={searchText}
            onChange={handleInputChange}
          />
          <button onClick={handleSearch}>搜尋</button>

          {suggestions.length > 0 && (
            <ul style={{
              listStyle: 'none',
              margin: 0,
              padding: '0',
              background: 'white',
              border: '1px solid #ccc',
              position: 'absolute',
              width: '100%',
              zIndex: 10,
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {suggestions.map((item, index) => (
                <li key={index} style={{ padding: '6px', cursor: 'pointer' }}
                    onClick={() => handleSelectSuggestion(item)}>
                  {item['簡稱']} ({item['公司代碼']})
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedStocks.length > 0 && (
          <div>
            <h3>已選擇的股票（最多 5 支）：</h3>
            {selectedStocks.map((stockList, index) => (
              <div key={index} style={{ marginBottom: '10px' }}>
                <strong>{stockList[0]['簡稱']} ({stockList[0]['公司代碼']})</strong>
                <br />
                分配比例 (%): 
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={allocations[index]}
                  onChange={(e) => handleAllocationChange(index, e.target.value)}
                />
                <button onClick={() => handleRemoveStock(index)} style={{ marginLeft: '10px', color: 'red' }}>
                  ❌ 移除
                </button>
              </div>
            ))}
            <p>
              總分配比例：{allocations.reduce((a, b) => a + b, 0)}%
              {allocations.reduce((a, b) => a + b, 0) !== 100 && (
                <span style={{ color: 'red' }}>（需為 100%）</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* 右邊圖表欄 */}
      <div className="right-panel">
        {selectedStocks.length > 0 && (
          <div>
            <Line data={generateChartData()} />
          </div>
        )}
      </div>

      {/* 右下角總報酬率 */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '30px',
        background: '#f0f0f0',
        padding: '10px 15px',
        borderRadius: '10px',
        boxShadow: '0 0 10px rgba(0,0,0,0.2)'
      }}>
        <strong>總預測報酬率：</strong> {(totalReturn * 100).toFixed(2)}%
      </div>
    </div>
  );
}

export default App;
