const form = document.getElementById('transaction-form');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const transactionList = document.getElementById('transaction-list');
const totalIncomeElement = document.getElementById('total-income');
const totalExpenseElement = document.getElementById('total-expense');
const netBalanceElement = document.getElementById('net-balance');

// Data
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

// Initialization
function init() {
    transactionList.innerHTML = '';
    transactions.forEach(addTransactionDOM);
    updateValues();
}

// Add Transaction
function addTransaction(e) {
    e.preventDefault();

    const type = document.querySelector('input[name="type"]:checked').value;
    const description = descriptionInput.value;
    const amount = +amountInput.value;

    if (description.trim() === '' || amount === 0) {
        alert('Lütfen geçerli bir açıklama ve tutar giriniz.');
        return;
    }

    const transaction = {
        id: generateID(),
        description,
        amount, // Store absolute value
        type,
        date: new Date().toLocaleDateString('tr-TR')
    };

    transactions.push(transaction);
    addTransactionDOM(transaction);
    updateValues();
    updateLocalStorage();

    descriptionInput.value = '';
    amountInput.value = '';
}

// Generate Random ID
function generateID() {
    return Math.floor(Math.random() * 100000000);
}

// Add Transaction to DOM
function addTransactionDOM(transaction) {
    const isIncome = transaction.type === 'income';
    const sign = isIncome ? '+' : '-';
    const itemClass = isIncome ? 'income' : 'expense';
    
    const item = document.createElement('li');
    item.classList.add('transaction-item', itemClass);

    item.innerHTML = `
        <div class="info">
            <h4>${transaction.description}</h4>
            <span class="date">${transaction.date}</span>
        </div>
        <div class="amount-action">
            <span class="amount">${sign}₺${formatMoney(transaction.amount)}</span>
            <button class="delete-btn" onclick="removeTransaction(${transaction.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    transactionList.prepend(item); // Add to top
    
    // Check if empty state message needs to be removed
    const emptyMsg = document.querySelector('.empty-state');
    if (emptyMsg) emptyMsg.remove();
}

// Update Balance, Income and Expense
function updateValues() {
    const amounts = transactions.map(transaction => 
        transaction.type === 'income' ? transaction.amount : -transaction.amount
    );

    const total = amounts.reduce((acc, item) => (acc += item), 0).toFixed(2);
    
    const income = transactions
        .filter(item => item.type === 'income')
        .reduce((acc, item) => (acc += item.amount), 0)
        .toFixed(2);

    const expense = transactions
        .filter(item => item.type === 'expense')
        .reduce((acc, item) => (acc += item.amount), 0)
        .toFixed(2);

    netBalanceElement.innerText = `₺${formatMoney(total)}`;
    totalIncomeElement.innerText = `₺${formatMoney(income)}`;
    totalExpenseElement.innerText = `₺${formatMoney(expense)}`;

    // Show empty state if no transactions
    if (transactions.length === 0) {
        transactionList.innerHTML = '<li class="empty-state">Henüz bir işlem yok.</li>';
    }
}

// Remove Transaction
function removeTransaction(id) {
    transactions = transactions.filter(transaction => transaction.id !== id);
    updateLocalStorage();
    init();
}

// Updated Local Storage
function updateLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// Format Money
function formatMoney(amount) {
    return Number(amount).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Event Listeners
form.addEventListener('submit', addTransaction);

// Start App
init();
