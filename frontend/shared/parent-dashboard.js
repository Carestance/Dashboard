(function () {
  const loginPath = location.protocol === 'file:' ? '../login.html' : '/login.html';
  let auth;
  try { auth = JSON.parse(sessionStorage.getItem('carestanceAuth') || 'null'); } catch { auth = null; }
  if (!auth?.token || auth.user?.role !== 'parent') {
    location.replace(loginPath);
    return;
  }

  const apiBase = location.protocol === 'file:' ? 'http://localhost:3000' : '';
  const setText = (selector, value) => document.querySelectorAll(selector).forEach((element) => { element.textContent = value ?? ''; });
  const formatList = (items, empty = 'None yet') => items?.length ? items.join(', ') : empty;

  function render(data) {
    const { child, metrics, journey, insights } = data;
    setText('.user-chip strong', child.name);
    setText('.user-chip .role', child.className);
    const page = location.pathname.split('/').pop();
    if (page === 'dashboard.html') {
      setText('.ring-value', `${metrics.overallProgress}%`);
      const ring = document.querySelector('.ring circle[stroke*="url"]');
      if (ring) ring.style.strokeDashoffset = String(326.7 * (1 - metrics.overallProgress / 100));
      const bar = document.querySelector('.bar-fill');
      if (bar) bar.style.width = `${metrics.overallProgress}%`;
      const values = document.querySelectorAll('.stat-card .value');
      if (values[0]) values[0].textContent = formatList(data.interests.map((item) => item.career_area));
      if (values[1]) values[1].textContent = formatList(data.skills.map((item) => item.skill_name));
      if (values[2]) values[2].textContent = `${metrics.tasksCompleted} / ${metrics.tasksTotal}`;
      if (values[3]) values[3].textContent = journey.stage;
      if (values[4]) values[4].textContent = `↗ ${metrics.progressThisMonth}%`;
      const journeyValues = document.querySelectorAll('.journey-row .row-value');
      [journey.currentInterest, formatList(journey.exploredCareers), data.skills[0]?.current_level || 'Starting point', journey.nextStep].forEach((value, index) => { if (journeyValues[index]) journeyValues[index].textContent = value; });
      setText('.insight-bubble span', insights.summary);
      setText('.action-text', insights.action);
    } else if (page === 'careerjourney.html') {
      const descriptions = [
        `Current interest: ${journey.currentInterest}.`,
        `${metrics.assessmentsCompleted} of ${metrics.assessmentsTotal} assessments completed.`,
        `Recommended areas: ${formatList(journey.recommendedAreas)}.`,
        journey.simulation,
        `Current skill level: ${journey.currentSkill}. Next step: ${journey.nextStep}.`,
        `Currently in the ${journey.stage} stage at ${metrics.overallProgress}% roadmap progress.`
      ];
      document.querySelectorAll('.journey-detail-card p').forEach((element, index) => { element.textContent = descriptions[index] || ''; });
    } else if (page === 'parents_insights.html') {
      setText('.action-text', insights.action);
      const insightText = [insights.summary, insights.trend, `The strongest current interest is ${journey.currentInterest}.`, `${data.achievements.length} achievement(s) earned so far.`];
      document.querySelectorAll('.insight-card p').forEach((element, index) => { element.textContent = insightText[index] || ''; });
    } else if (page === 'reports.html') {
      const reportText = [
        `${data.reports.career.interests.length} career interest record(s) and ${data.reports.career.simulations.length} simulation result(s).`,
        `Overall progress is ${metrics.overallProgress}% with ${metrics.assessmentsCompleted} of ${metrics.assessmentsTotal} assessments completed.`,
        `${metrics.weeklyTasksCompleted} of ${metrics.weeklyTasksTotal} weekly tasks completed.`,
        `${data.skills.length} skill area(s) currently being developed.`,
        `${data.reports.simulation.length} simulation result(s) available.`,
        `${data.achievements.length} achievement(s) earned.`
      ];
      document.querySelectorAll('#reports-grid .report-card p').forEach((element, index) => { element.textContent = reportText[index] || ''; });
    }
  }

  fetch(`${apiBase}/api/v1/parent/dashboard`, { headers: { authorization: `Bearer ${auth.token}` } })
    .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to load parent dashboard.'); return result.data; })
    .then(render)
    .catch((error) => { document.querySelector('.main').insertAdjacentHTML('afterbegin', `<p role="alert" style="color:#d93e82">${error.message}</p>`); });
})();