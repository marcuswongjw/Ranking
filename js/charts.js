// Analysis and statistics charts logic
// Automatically extracted from index.html

function renderCharts() {
  try {
    if (typeof Chart === 'undefined') {
      const containerIds = ['distChart', 'scatterChart', 'clubChart', 'yearChart', 'dominanceChart'];
      containerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement) {
          el.parentElement.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:11px;font-family:var(--mono);text-align:center;padding:10px;">
            <div>⚠️ Chart.js offline</div>
            <div style="font-size:9px;margin-top:4px;">Cannot load CDN library. Check internet connection.</div>
          </div>`;
        }
      });
      return;
    }
    if (!SAILORS.length) return;
    const sq = computeSquads(SAILORS);

    // 1. Avg, Min, Max score by squad
    const squadScores = { 'Nat A': [], 'Nat B': [], 'DS': [], 'None': [] };
    SAILORS.forEach(s => {
      const squad = EXCLUDED.has(s.name) ? 'None' : (sq.get(s.name) || 'None');
      squadScores[squad].push(s.score);
    });
    const distData = Object.keys(squadScores).map(k => {
      const vals = squadScores[k];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const min = vals.length ? Math.min(...vals) : 0;
      const max = vals.length ? Math.max(...vals) : 0;
      return { 
        squad: k, 
        avg: Math.round(avg * 10) / 10, 
        min: min, 
        max: max, 
        count: vals.length 
      };
    });

    if (chartObjs.dist) chartObjs.dist.destroy();
    chartObjs.dist = new Chart(document.getElementById('distChart'), {
      type: 'bar',
      data: {
        labels: distData.map(d => d.squad),
        datasets: [
          {
            label: 'Best Score',
            data: distData.map(d => d.min),
            backgroundColor: '#a3c9b0'
          },
          {
            label: 'Avg Score',
            data: distData.map(d => d.avg),
            backgroundColor: '#2d4a8a'
          },
          {
            label: 'Worst Score',
            data: distData.map(d => d.max),
            backgroundColor: '#f0b07a'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(e, elements) {
          if (!elements || elements.length === 0) return;
          const index = elements[0].index;
          const datasetIndex = elements[0].datasetIndex;
          const clickedLabel = this.data.labels[index];
          const datasetLabel = this.data.datasets[datasetIndex].label;
          handleChartClick('distChart', clickedLabel, datasetLabel);
        },
        scales: { 
          y: { 
            beginAtZero: true,
            title: { display: true, text: 'Points (lower is better)' }
          } 
        }
      }
    });

    // 2. Rank vs Score Scatter
    const scatterData = SAILORS.map(s => ({ x: s.cur, y: s.score }));
    if (chartObjs.scatter) chartObjs.scatter.destroy();
    chartObjs.scatter = new Chart(document.getElementById('scatterChart'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Sailors',
          data: scatterData,
          backgroundColor: '#2d4a8a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Current Rank' } },
          y: { title: { display: true, text: 'Points Score' } }
        }
      }
    });

    // 3. Club Distribution Pie
    const clubs = {};
    SAILORS.forEach(s => { if (s.club) clubs[s.club] = (clubs[s.club] || 0) + 1; });
    const clubLabels = Object.keys(clubs).sort((a, b) => clubs[b] - clubs[a]).slice(0, 7);
    const clubValues = clubLabels.map(l => clubs[l]);

    if (chartObjs.club) chartObjs.club.destroy();
    chartObjs.club = new Chart(document.getElementById('clubChart'), {
      type: 'pie',
      data: {
        labels: clubLabels,
        datasets: [{
          data: clubValues,
          backgroundColor: ['#1a472a', '#2d4a8a', '#7a3500', '#b8b3aa', '#dedad2', '#e8e5de', '#faf9f6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

    // 4. Birth Year Distribution grouped by Gender (Boys vs Girls)
    const years = {};
    SAILORS.forEach(s => { 
      if (s.born) {
        if (!years[s.born]) years[s.born] = { M: 0, F: 0 };
        years[s.born][s.g]++;
      }
    });
    const yearLabels = Object.keys(years).sort();
    const boysValues = yearLabels.map(l => years[l].M);
    const girlsValues = yearLabels.map(l => years[l].F);

    if (chartObjs.year) chartObjs.year.destroy();
    chartObjs.year = new Chart(document.getElementById('yearChart'), {
      type: 'bar',
      data: {
        labels: yearLabels,
        datasets: [
          {
            label: 'Boys (M)',
            data: boysValues,
            backgroundColor: '#3b82f6'
          },
          {
            label: 'Girls (F)',
            data: girlsValues,
            backgroundColor: '#ec4899'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(e, elements) {
          if (!elements || elements.length === 0) return;
          const index = elements[0].index;
          const datasetIndex = elements[0].datasetIndex;
          const clickedLabel = this.data.labels[index];
          const datasetLabel = this.data.datasets[datasetIndex].label;
          handleChartClick('yearChart', clickedLabel, datasetLabel);
        },
        scales: { 
          x: { stacked: false },
          y: { beginAtZero: true, ticks: { stepSize: 1 } } 
        }
      }
    });

    // 5. Club Dominance - delegated to separate function for filtering
    renderDominanceChart();
  } catch (err) {
    console.error("Error rendering charts:", err);
  }
}

function filterDominanceChart(squad, btn) {
  dominanceFilter = squad;
  document.querySelectorAll('.dominance-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDominanceChart();
}
