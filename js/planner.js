/* ==========================================================================
   Academic planner
   - tasks live in an array of objects and are re-rendered from that array
   - add, complete (toggle) and delete are plain functions wired up with
     event listeners; the list uses event delegation
   - the array is saved to localStorage so tasks survive a page refresh
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'academicPlannerTasks';
  const SEEDED_KEY = 'academicPlannerSeeded';

  /* ---------------- Elements ---------------- */
  const form = document.getElementById('taskForm');
  if (!form) return;

  const titleInput = document.getElementById('taskTitle');
  const courseInput = document.getElementById('taskCourse');
  const dueInput = document.getElementById('taskDue');
  const priorityInput = document.getElementById('taskPriority');
  const titleError = document.getElementById('taskTitleError');
  const listElement = document.getElementById('taskList');
  const countTotal = document.getElementById('countTotal');
  const countActive = document.getElementById('countActive');
  const countDone = document.getElementById('countDone');
  const progressFill = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  const filterButtons = [...document.querySelectorAll('.filter-btn')];
  const clearButton = document.getElementById('clearCompleted');

  /* ---------------- State ---------------- */
  let tasks = [];          // array of { id, title, course, due, priority, done }
  let currentFilter = 'all';

  /* ---------------- Storage ---------------- */
  function saveTasks() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (error) { /* storage unavailable */ }
  }

  function loadTasks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) return saved;
    } catch (error) { /* ignore */ }
    return null;
  }

  function sampleTasks() {
    const inDays = (days) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };
    return [
      { id: makeId(), title: 'Read lecture notes for this week', course: 'Computer Science', due: inDays(2), priority: 'medium', done: false },
      { id: makeId(), title: 'Finish programming assignment', course: 'Programming', due: inDays(5), priority: 'high', done: false },
      { id: makeId(), title: 'Set up study timetable', course: 'General', due: '', priority: 'low', done: true }
    ];
  }

  /* ---------------- Helpers ---------------- */
  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  function formatDate(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function isOverdue(task) {
    return !task.done && task.due !== '' && task.due < todayString();
  }

  function visibleTasks() {
    if (currentFilter === 'active') return tasks.filter((task) => !task.done);
    if (currentFilter === 'done') return tasks.filter((task) => task.done);
    return tasks;
  }

  /* ---------------- Core actions ---------------- */
  function addTask(details) {
    tasks.unshift({
      id: makeId(),
      title: details.title,
      course: details.course,
      due: details.due,
      priority: details.priority,
      done: false
    });
    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    task.done = !task.done;
    saveTasks();
    render();
  }

  function deleteTask(id, itemElement) {
    function remove() {
      tasks = tasks.filter((task) => task.id !== id);
      saveTasks();
      render();
    }

    // let the slide-out transition play before the row disappears
    if (itemElement && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      itemElement.classList.add('task--leaving');
      setTimeout(remove, 280);
    } else {
      remove();
    }
  }

  function clearCompleted() {
    tasks = tasks.filter((task) => !task.done);
    saveTasks();
    render();
  }

  /* ---------------- Rendering (DOM manipulation) ---------------- */
  function createTaskElement(task) {
    const item = document.createElement('li');
    item.className = 'task' + (task.done ? ' task--done' : '');
    item.dataset.id = task.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task__check';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', 'Mark "' + task.title + '" as completed');

    const content = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'task__title';
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'task__meta';

    const priority = document.createElement('span');
    priority.className = 'badge badge--' + task.priority;
    priority.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    meta.appendChild(priority);

    if (task.course) {
      const course = document.createElement('span');
      course.innerHTML = '<i class="fa-solid fa-book-open" aria-hidden="true"></i>';
      course.appendChild(document.createTextNode(task.course));
      meta.appendChild(course);
    }

    if (task.due) {
      const due = document.createElement('span');
      if (isOverdue(task)) due.className = 'is-overdue';
      due.innerHTML = '<i class="fa-regular fa-calendar" aria-hidden="true"></i>';
      due.appendChild(document.createTextNode((isOverdue(task) ? 'Overdue: ' : 'Due ') + formatDate(task.due)));
      meta.appendChild(due);
    }

    content.append(title, meta);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'task__delete';
    deleteButton.dataset.action = 'delete';
    deleteButton.setAttribute('aria-label', 'Delete "' + task.title + '"');
    deleteButton.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';

    item.append(checkbox, content, deleteButton);
    return item;
  }

  function renderEmptyState() {
    const messages = {
      all: 'No tasks yet. Add your first one using the form.',
      active: 'Nothing left to do. Nice work!',
      done: 'No completed tasks yet.'
    };
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.innerHTML = '<i class="fa-regular fa-clipboard" aria-hidden="true"></i>';
    item.appendChild(document.createTextNode(messages[currentFilter]));
    return item;
  }

  function renderCounts() {
    const total = tasks.length;
    const done = tasks.filter((task) => task.done).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    countTotal.textContent = total;
    countActive.textContent = total - done;
    countDone.textContent = done;
    progressFill.style.width = percent + '%';
    progressLabel.textContent = percent + '% complete';
    clearButton.hidden = done === 0;
  }

  function render() {
    listElement.replaceChildren();

    const toShow = visibleTasks();
    if (toShow.length === 0) {
      listElement.appendChild(renderEmptyState());
    } else {
      toShow.forEach((task) => listElement.appendChild(createTaskElement(task)));
    }

    filterButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === currentFilter));
    });

    renderCounts();
  }

  /* ---------------- Events ---------------- */
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    if (title === '') {
      titleError.textContent = 'Please enter a task before adding it.';
      titleInput.classList.add('input--invalid');
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      return;
    }

    addTask({
      title: title,
      course: courseInput.value.trim(),
      due: dueInput.value,
      priority: priorityInput.value
    });

    form.reset();
    priorityInput.value = 'medium';
    titleInput.focus();
  });

  titleInput.addEventListener('input', () => {
    titleError.textContent = '';
    titleInput.classList.remove('input--invalid');
    titleInput.removeAttribute('aria-invalid');
  });

  listElement.addEventListener('change', (event) => {
    if (!event.target.classList.contains('task__check')) return;
    toggleTask(event.target.closest('.task').dataset.id);
  });

  listElement.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-action="delete"]');
    if (!deleteButton) return;
    const item = deleteButton.closest('.task');
    deleteTask(item.dataset.id, item);
  });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      render();
    });
  });

  clearButton.addEventListener('click', clearCompleted);

  /* ---------------- Start ---------------- */
  tasks = loadTasks();
  if (tasks === null) {
    let alreadySeeded = false;
    try { alreadySeeded = localStorage.getItem(SEEDED_KEY) === '1'; } catch (error) { /* ignore */ }
    tasks = alreadySeeded ? [] : sampleTasks();
    try { localStorage.setItem(SEEDED_KEY, '1'); } catch (error) { /* ignore */ }
    saveTasks();
  }

  render();
})();
