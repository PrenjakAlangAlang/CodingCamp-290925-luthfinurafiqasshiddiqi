// app.js - ToDo List
'use strict';

const form = document.getElementById('todo-form');
const taskInput = document.getElementById('todo-input');
const dateInput = document.getElementById('date-input');
const taskError = document.getElementById('task-error');
const dateError = document.getElementById('date-error');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const filterSelect = document.getElementById('filter-select');
const searchInput = document.getElementById('search-input');
const clearAllBtn = document.getElementById('clear-all');

// Stats elements
const totalTasksEl = document.getElementById('total-tasks');
const pendingTasksEl = document.getElementById('pending-tasks');
const completedTasksEl = document.getElementById('completed-tasks');

// Modal elements
const modal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

const STORAGE_KEY = 'cc_todos_v2';

// state
let todos = loadTodos();
let currentAction = null;
let currentTodoId = null;

// ---------- Helpers ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2,8);
}

function saveTodos(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function loadTodos(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return [];
  try {
    return JSON.parse(raw);
  } catch(e){
    console.warn('Failed parsing todos', e);
    return [];
  }
}

function formatDateISO(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (d.toDateString() === today.toDateString()) {
    return 'Hari ini';
  } else if (d.toDateString() === tomorrow.toDateString()) {
    return 'Besok';
  }
  
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function isToday(isoDate){
  const d = new Date(isoDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}

function isOverdue(isoDate){
  const d = new Date(isoDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < now;
}

function getPriority(date){
  const taskDate = new Date(date);
  const today = new Date();
  const diffTime = taskDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'high'; // Overdue
  if (diffDays === 0) return 'high'; // Today
  if (diffDays <= 2) return 'medium'; // Next 2 days
  return 'low'; // More than 2 days
}

function updateStats(){
  const total = todos.length;
  const completed = todos.filter(t => t.done).length;
  const pending = total - completed;
  
  totalTasksEl.textContent = total;
  completedTasksEl.textContent = completed;
  pendingTasksEl.textContent = pending;
}

// ---------- Modal ----------
function showModal(title, message, confirmCallback){
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  currentAction = confirmCallback;
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideModal(){
  modal.classList.remove('active');
  document.body.style.overflow = '';
  currentAction = null;
  currentTodoId = null;
}

modalCancel.addEventListener('click', hideModal);
modalConfirm.addEventListener('click', function(){
  if(currentAction) {
    currentAction();
  }
  hideModal();
});

modal.addEventListener('click', function(e){
  if(e.target === modal) {
    hideModal();
  }
});

// ---------- Rendering ----------
function render(){
  const filter = filterSelect.value;
  const q = searchInput.value.trim().toLowerCase();

  const filtered = todos.filter(t => {
    if(filter === 'pending' && t.done) return false;
    if(filter === 'completed' && !t.done) return false;
    if(filter === 'today' && !isToday(t.date)) return false;
    if(q){
      return (t.text || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Clear list
  todoList.innerHTML = '';

  // Show/hide empty state
  if(filtered.length === 0){
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
  }

  // Sort: incomplete first, then by date (earlier first), then by creation date
  filtered.sort((a,b) => {
    if(a.done !== b.done) return a.done ? 1 : -1;
    
    const dateA = a.date ? new Date(a.date) : new Date('9999-12-31');
    const dateB = b.date ? new Date(b.date) : new Date('9999-12-31');
    
    if(dateA.getTime() !== dateB.getTime()) {
      return dateA - dateB;
    }
    
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Render todos
  for(const t of filtered){
    const li = document.createElement('li');
    li.className = 'todo-item' + (t.done ? ' completed' : '');
    li.dataset.id = t.id;

    // Checkbox
    const checkbox = document.createElement('div');
    checkbox.className = 'todo-checkbox' + (t.done ? ' checked' : '');
    checkbox.setAttribute('aria-label', `Tandai ${t.text} selesai`);
    checkbox.addEventListener('click', () => toggleDone(t.id));

    // Content
    const content = document.createElement('div');
    content.className = 'todo-content';
    
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = t.text;
    
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    
    const date = document.createElement('div');
    date.className = 'task-date';
    
    const dateIcon = document.createElement('i');
    dateIcon.className = 'fas fa-calendar';
    date.appendChild(dateIcon);
    
    const dateText = document.createElement('span');
    dateText.textContent = t.date ? formatDateISO(t.date) : 'Tanggal tidak ditentukan';
    date.appendChild(dateText);
    
    const priority = document.createElement('div');
    priority.className = `priority ${getPriority(t.date)}`;
    
    if (isOverdue(t.date) && !t.done) {
      priority.textContent = 'Terlambat';
    } else {
      const priorityText = {
        'high': 'Tinggi',
        'medium': 'Sedang', 
        'low': 'Rendah'
      };
      priority.textContent = priorityText[getPriority(t.date)];
    }
    
    meta.appendChild(date);
    if (t.date && !t.done) {
      meta.appendChild(priority);
    }
    
    content.appendChild(title);
    content.appendChild(meta);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.addEventListener('click', () => startEdit(t.id));
    
    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete';
    delBtn.title = 'Hapus';
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.addEventListener('click', () => confirmDelete(t.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(checkbox);
    li.appendChild(content);
    li.appendChild(actions);

    todoList.appendChild(li);
  }
  
  updateStats();
}

// ---------- Actions ----------
function addTodo(text, date){
  const trimmed = text.trim();
  if(!trimmed){
    taskError.textContent = 'Tugas tidak boleh kosong.';
    taskInput.focus();
    return false;
  }
  if(!date){
    dateError.textContent = 'Tanggal harus diisi.';
    dateInput.focus();
    return false;
  }
  
  // Reset errors
  taskError.textContent = '';
  dateError.textContent = '';

  const item = {
    id: uid(),
    text: trimmed,
    date,
    done: false,
    createdAt: new Date().toISOString()
  };
  todos.push(item);
  saveTodos();
  render();
  
  // Show success feedback
  showTemporaryMessage('Tugas berhasil ditambahkan!', 'success');
  return true;
}

function confirmDelete(id){
  const todo = todos.find(t => t.id === id);
  if(!todo) return;
  
  currentTodoId = id;
  showModal(
    'Hapus Tugas', 
    `Apakah Anda yakin ingin menghapus tugas "${todo.text}"?`,
    () => deleteTodo(id)
  );
}

function deleteTodo(id){
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  render();
  showTemporaryMessage('Tugas berhasil dihapus!', 'success');
}

function toggleDone(id){
  const t = todos.find(x => x.id === id);
  if(!t) return;
  t.done = !t.done;
  saveTodos();
  render();
  
  const message = t.done ? 'Tugas diselesaikan!' : 'Tugas ditandai belum selesai';
  showTemporaryMessage(message, 'success');
}

function clearAll(){
  if(todos.length === 0) {
    showTemporaryMessage('Tidak ada tugas untuk dihapus', 'info');
    return;
  }
  
  showModal(
    'Hapus Semua Tugas', 
    `Apakah Anda yakin ingin menghapus semua ${todos.length} tugas? Tindakan ini tidak dapat dibatalkan.`,
    () => {
      todos = [];
      saveTodos();
      render();
      showTemporaryMessage('Semua tugas berhasil dihapus!', 'success');
    }
  );
}

function startEdit(id){
  const t = todos.find(x => x.id === id);
  if(!t) return;
  
  // Prefill form
  taskInput.value = t.text;
  dateInput.value = t.date;
  
  // Remove the old item, user can re-add as edited
  todos = todos.filter(x => x.id !== id);
  saveTodos();
  render();
  
  // Focus on task input
  taskInput.focus();
  
  showTemporaryMessage('Sekarang edit tugas Anda', 'info');
}

// ---------- UI Feedback ----------
function showTemporaryMessage(message, type = 'info') {
  // Remove existing message if any
  const existingMsg = document.querySelector('.temp-message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  const msgEl = document.createElement('div');
  msgEl.className = `temp-message temp-message-${type}`;
  msgEl.textContent = message;
  msgEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};
    color: white;
    padding: 12px 20px;
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: 1001;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(msgEl);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (msgEl.parentNode) {
      msgEl.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => msgEl.remove(), 300);
    }
  }, 3000);
}

function clearErrors(){
  taskError.textContent = '';
  dateError.textContent = '';
}

// ---------- Events ----------
form.addEventListener('submit', function(e){
  e.preventDefault();
  clearErrors();
  const ok = addTodo(taskInput.value, dateInput.value);
  if(ok){
    form.reset();
    taskInput.focus();
  }
});

filterSelect.addEventListener('change', render);
searchInput.addEventListener('input', render);
clearAllBtn.addEventListener('click', clearAll);

// Set minimum date to today
const today = new Date().toISOString().split('T')[0];
dateInput.min = today;

// Add fadeOut animation for temporary messages
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100px); }
  }
`;
document.head.appendChild(style);

// Initial render
render();