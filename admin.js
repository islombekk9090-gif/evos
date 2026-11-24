const storageKey = 'evos-order-history-v1';
const storageBackupKey = 'evos-order-history-backup-v1';
const inventoryStorageKey = 'evos-inventory-v1';
const inventoryBackupKey = 'evos-inventory-backup-v1';
let language = localStorage.getItem('evos-admin-language') || 'uz';
let orders = [];
let inventory = [];

const translations = {
  uz: {
    login: 'Login', password: 'Parol', enter: 'Kirish',
    overview: 'Umumiy', orders: 'Buyurtmalar', logout: 'Chiqish',
    adminPanel: 'Admin paneli', orderManagement: 'Buyurtmalarni boshqarish',
    backStore: 'Do‘konga qaytish', totalOrders: 'Jami buyurtmalar',
    totalSales: 'Jami summa', todayOrders: 'Bugungi buyurtmalar',
    completed: 'Bajarilgan', orderStatistics: 'Buyurtmalar statistikasi',
    last7Days: 'So‘nggi 7 kun', orderStatus: 'Buyurtma holati',
    statusByTotal: 'Jami holatlar bo‘yicha', recentOrders: 'So‘nggi buyurtmalar',
    allOrders: 'Barcha buyurtmalar', history: 'Tarix',
    wrong: 'Login yoki parol noto‘g‘ri',
    empty: 'Hozircha buyurtmalar yo‘q.'
  },
  ru: {
    login: 'Логин', password: 'Пароль', enter: 'Войти',
    overview: 'Обзор', orders: 'Заказы', logout: 'Выйти',
    adminPanel: 'Панель администратора', orderManagement: 'Управление заказами',
    backStore: 'Вернуться в магазин', totalOrders: 'Всего заказов',
    totalSales: 'Общая сумма', todayOrders: 'Заказы за сегодня',
    completed: 'Выполнено', orderStatistics: 'Статистика заказов',
    last7Days: 'Последние 7 дней', orderStatus: 'Статус заказа',
    statusByTotal: 'По всем статусам', recentOrders: 'Последние заказы',
    allOrders: 'Все заказы', history: 'История',
    wrong: 'Неверный логин или пароль',
    empty: 'Заказов пока нет.'
  },
  en: {
    login: 'Login', password: 'Password', enter: 'Sign in',
    overview: 'Overview', orders: 'Orders', logout: 'Logout',
    adminPanel: 'Admin panel', orderManagement: 'Order management',
    backStore: 'Back to store', totalOrders: 'Total orders',
    totalSales: 'Total sales', todayOrders: 'Today\'s orders',
    completed: 'Completed', orderStatistics: 'Order statistics',
    last7Days: 'Last 7 days', orderStatus: 'Order status',
    statusByTotal: 'By total status', recentOrders: 'Recent orders',
    allOrders: 'All orders', history: 'History',
    wrong: 'Wrong login or password',
    empty: 'No orders yet.'
  }
};

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = translations[language][element.dataset.i18n] ||
      translations.uz[element.dataset.i18n] ||
      element.textContent;
  });
  document.querySelectorAll('[data-language]').forEach(button => {
    button.classList.toggle('active', button.dataset.language === language);
  });
  const select = document.querySelector('#admin-language');
  if (select) select.value = language;
  document.documentElement.lang = language;
  localStorage.setItem('evos-admin-language', language);
}

async function loadOrders() {
  try {
    const merged = new Map();
    const sources = [
      localStorage.getItem(storageKey),
      localStorage.getItem(storageBackupKey),
      sessionStorage.getItem(storageKey)
    ];
    sources.forEach(source => {
      if (!source) return;
      try {
        const saved = JSON.parse(source);
        if (Array.isArray(saved)) {
          saved.forEach(order => {
            if (order?.orderNumber) merged.set(order.orderNumber, order);
          });
        }
      } catch (error) {
        console.error('Tarix nusxalaridan biri buzilgan.', error);
      }
    });

    if (window.db) {
      const { data, error } = await window.db
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        data.forEach(order => {
          merged.set(order.order_number, {
            id: order.id,
            orderNumber: order.order_number,
            createdAt: order.created_at,
            phone: order.phone,
            address: order.address,
            subtotal: Number(order.subtotal),
            discount: Number(order.discount),
            total: Number(order.total),
            status: order.status,
            items: order.items || []
          });
        });
      } else if (error) {
        console.warn('Supabase buyurtmalarini yuklab bo‘lmadi.', error);
      }
    }

    orders = [...merged.values()].sort((first, second) =>
      new Date(second.createdAt || 0) - new Date(first.createdAt || 0)
    );
  } catch (error) {
    console.error('Buyurtmalar tarixini yuklab bo‘lmadi.', error);
    orders = [];
  }
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('uz-UZ')} so'm`;
}

async function loadInventory() {
  try {
    const merged = new Map();
    [localStorage.getItem(inventoryStorageKey), localStorage.getItem(inventoryBackupKey)]
      .forEach(source => {
        if (!source) return;
        try {
          const saved = JSON.parse(source);
          if (Array.isArray(saved)) {
            saved.forEach(product => {
              if (product?.id) merged.set(product.id, product);
            });
          }
        } catch (error) {
          console.error('Zaxira nusxalaridan biri buzilgan.', error);
        }
      });
    inventory = [...merged.values()];

    if (window.db) {
      const { data, error } = await window.db
        .from('products')
        .select('*')
        .order('name');
      if (!error && data) {
        if (data.length) {
          inventory = data.map(product => ({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            stock: Number(product.stock),
            image: product.image || ''
          }));
          localStorage.setItem(inventoryStorageKey, JSON.stringify(inventory));
          localStorage.setItem(inventoryBackupKey, JSON.stringify(inventory));
        }
      } else if (error) {
        console.warn('Supabase mahsulotlarini yuklab bo‘lmadi.', error);
      }
    }
  } catch (error) {
    console.error('Maxsulotlar bazasini yuklab bo‘lmadi.', error);
    inventory = [];
  }
}

async function saveInventory() {
  const serialized = JSON.stringify(inventory);
  localStorage.setItem(inventoryStorageKey, serialized);
  localStorage.setItem(inventoryBackupKey, serialized);
  if (window.db) {
    const rows = inventory.map(product => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      stock: Number(product.stock),
      image: product.image || ''
    }));
    const { error } = await window.db
      .from('products')
      .upsert(rows, { onConflict: 'id' });
    if (error) console.warn('Supabase mahsulotlarini saqlab bo‘lmadi.', error);
  }
  renderProductList();
}

function renderProductList() {
  loadInventory();
  const container = document.querySelector('#product-list');
  container.replaceChildren();

  if (inventory.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = translations[language].empty;
    container.append(empty);
    return;
  }

  inventory.forEach(product => {
    const row = document.createElement('article');
    row.className = 'product-row';

    const image = document.createElement('div');
    image.className = 'product-image';
    if (product.image) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name;
      image.append(img);
    } else {
      image.textContent = 'EVOS';
    }

    const details = document.createElement('div');
    details.className = 'product-details';
    const name = document.createElement('strong');
    name.textElement = product.name;
    name.textContent = product.name;
    const price = document.createElement('span');
    price.textContent = formatPrice(product.price);
    details.append(name, price);

    const controls = document.createElement('div');
    controls.className = 'product-controls';

    const decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.className = 'product-control';
    decrease.textContent = '−';
    decrease.addEventListener('click', () => {
      product.stock = Math.max(0, Number(product.stock || 0) - 1);
      saveInventory();
    });

    const stock = document.createElement('strong');
    stock.className = 'product-stock';
    stock.textContent = `${product.stock} ta`;

    const increase = document.createElement('button');
    increase.type = 'button';
    increase.className = 'product-control';
    increase.textContent = '+';
    increase.setAttribute('aria-label', `${product.name} miqdorini 1 ga oshirish`);
    increase.addEventListener('click', () => {
      product.stock = Number(product.stock || 0) + 1;
      saveInventory();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'product-remove';
    remove.textContent = 'O‘chirish';
    remove.addEventListener('click', async () => {
      inventory = inventory.filter(item => item.id !== product.id);
      if (window.db) {
        const { error } = await window.db
          .from('products')
          .delete()
          .eq('id', product.id);
        if (error) console.warn('Supabase mahsulotini o‘chirib bo‘lmadi.', error);
      }
      saveInventory();
    });

    controls.append(decrease, stock, increase, remove);
    row.append(image, details, controls);
    container.append(row);
  });
}

async function renderDashboard() {
  await loadOrders();
  const totalSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const today = new Date().toLocaleDateString('uz-UZ');
  const todayCount = orders.filter(order =>
    new Date(order.createdAt).toLocaleDateString('uz-UZ') === today
  ).length;
  const completedCount = orders.filter(order =>
    (order.status || 'Yangi') === 'Bajarildi'
  ).length;

  document.querySelector('#total-orders').textContent = orders.length;
  document.querySelector('#total-sales').textContent = formatPrice(totalSales);
  document.querySelector('#today-orders').textContent = todayCount;
  document.querySelector('#completed-orders').textContent =
    `${orders.length ? Math.round(completedCount * 100 / orders.length) : 0}%`;
  document.querySelector('#orders-count').textContent =
    `${orders.length} ta`;

  renderChart();
  renderStatusChart();
  renderOrderList(document.querySelector('#recent-orders'), orders.slice(0, 5));
  renderOrderList(document.querySelector('#all-orders'), orders);
}

function renderChart() {
  const chart = document.querySelector('#line-chart');
  const counts = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const count = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === date.getTime();
    }).length;
    counts.push({
      label: date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }),
      count
    });
  }

  document.querySelector('#week-total').textContent =
    `${counts.reduce((sum, day) => sum + day.count, 0)} ta`;
  const width = 520;
  const height = 180;
  const left = 38;
  const right = 14;
  const top = 12;
  const bottom = 30;
  const max = Math.max(4, ...counts.map(day => day.count));
  const points = counts.map((day, index) => ({
    ...day,
    x: left + index * (width - left - right) / 6,
    y: top + (height - top - bottom) - day.count / max * (height - top - bottom)
  }));
  const line = points.map(point => `${point.x},${point.y}`).join(' ');

  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Buyurtmalar grafigi">
      <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="chart-axis"/>
      <polygon points="${left},${height - bottom} ${line} ${width - right},${height - bottom}" class="chart-area"/>
      <polyline points="${line}" class="chart-line"/>
      ${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" class="chart-point"><title>${point.label}: ${point.count}</title></circle>`).join('')}
      ${points.map(point => `<text x="${point.x}" y="${height - 8}" text-anchor="middle" class="chart-label">${point.label}</text>`).join('')}
    </svg>
  `;
}

function renderStatusChart() {
  const statuses = [
    ['Yangi', '#3b82f6'],
    ['Tayyorlanmoqda', '#22c55e'],
    ['Yetkazilmoqda', '#f59e0b'],
    ['Bajarildi', '#ef4444']
  ];
  const counts = statuses.map(([name, color]) => ({
    name,
    color,
    count: orders.filter(order => (order.status || 'Yangi') === name).length
  }));
  const total = counts.reduce((sum, status) => sum + status.count, 0);
  document.querySelector('#donut-total').textContent = total;

  let angle = 0;
  const segments = counts.map(status => {
    const portion = total ? status.count * 360 / total : 0;
    const start = angle;
    angle += portion;
    return `${status.color} ${start}deg ${angle}deg`;
  });
  document.querySelector('#status-donut').style.background =
    total ? `conic-gradient(${segments.join(', ')})` : '#e5e7eb';

  const legend = document.querySelector('#donut-legend');
  legend.replaceChildren();
  counts.forEach(status => {
    const row = document.createElement('div');
    row.className = 'legend-row';
    row.innerHTML =
      `<span class="legend-dot" style="background:${status.color}"></span>
       <span>${status.name}</span>
       <strong>${total ? Math.round(status.count * 100 / total) : 0}%</strong>`;
    legend.append(row);
  });
}

function openReceipt(order) {
  document.querySelector('#receipt-number').textContent =
    order.orderNumber || 'EVOS';
  document.querySelector('#receipt-date').textContent =
    new Date(order.createdAt).toLocaleString(
      language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ'
    );
  document.querySelector('#receipt-customer').textContent =
    `${order.phone || '-'} • ${order.address || '-'}`;
  document.querySelector('#receipt-subtotal').textContent =
    formatPrice(order.subtotal || 0);
  document.querySelector('#receipt-discount').textContent =
    `−${formatPrice(order.discount || 0)}`;
  document.querySelector('#receipt-total').textContent =
    formatPrice(order.total || 0);
  document.querySelector('#receipt-discount-row').hidden = !order.discount;
  document.querySelector('#receipt-status').textContent =
    `Holat: ${order.status || 'Yangi'}`;

  const items = document.querySelector('#receipt-items');
  items.replaceChildren();
  (order.items || []).forEach(item => {
    const row = document.createElement('div');
    row.className = 'receipt-item';
    const name = document.createElement('span');
    name.textContent = `${item.name} × ${item.quantity}`;
    const sum = document.createElement('strong');
    sum.textContent = formatPrice(item.sum || item.price * item.quantity);
    row.append(name, sum);
    items.append(row);
  });

  if (!(order.items || []).length) {
    const empty = document.createElement('p');
    empty.textContent = translations[language].empty;
    items.append(empty);
  }

  document.querySelector('#receipt-modal').hidden = false;
}

function renderHistory() {
  const container = document.querySelector('#history-list');
  document.querySelector('#history-count').textContent =
    `${orders.length} ta`;
  container.replaceChildren();

  if (!orders.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = translations[language].empty;
    container.append(empty);
    return;
  }

  orders.forEach(order => {
    const card = document.createElement('article');
    card.className = 'history-card';

    const date = document.createElement('time');
    date.textContent = new Date(order.createdAt).toLocaleString(
      language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ'
    );

    const info = document.createElement('div');
    info.className = 'history-info';
    const number = document.createElement('strong');
    number.textContent = `${order.orderNumber || 'EVOS'} — ${order.status || 'Yangi'}`;
    const customer = document.createElement('span');
    customer.textContent = `${order.phone || '-'} • ${order.address || '-'}`;
    const products = document.createElement('span');
    products.textContent = (order.items || []).map(item =>
      `${item.name} × ${item.quantity}`
    ).join(', ');
    info.append(number, customer, products);

    const total = document.createElement('strong');
    total.className = 'history-total';
    total.textContent = formatPrice(order.total);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-open';
    button.textContent = 'Chekni ochish';
    button.addEventListener('click', () => openReceipt(order));

    card.append(date, info, total, button);
    container.append(card);
  });
}

function renderOrderList(container, orderList) {
  container.replaceChildren();
  if (!orderList.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = translations[language].empty;
    container.append(empty);
    return;
  }

  orderList.forEach(order => {
    const row = document.createElement('article');
    row.className = 'order-row';

    const date = document.createElement('time');
    date.textContent = new Date(order.createdAt).toLocaleString(
      language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ'
    );

    const details = document.createElement('div');
    details.className = 'order-details';
    const title = document.createElement('strong');
    title.textContent = `${order.orderNumber || 'EVOS'} — ${order.phone || '-'}`;
    const address = document.createElement('span');
    address.textContent = order.address || '-';
    const products = document.createElement('span');
    products.textContent = (order.items || []).map(item =>
      `${item.name} × ${item.quantity}`
    ).join(', ');
    details.append(title, address, products);

    const total = document.createElement('strong');
    total.className = 'order-total';
    total.textContent = formatPrice(order.total);

    const status = document.createElement('select');
    status.className = 'order-status';
    ['Yangi', 'Tayyorlanmoqda', 'Yetkazilmoqda', 'Bajarildi'].forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = (order.status || 'Yangi') === value;
      status.append(option);
    });
    status.addEventListener('change', async () => {
      order.status = status.value;
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const index = saved.findIndex(item => item.orderNumber === order.orderNumber);
      if (index >= 0) {
        saved[index].status = status.value;
        const serialized = JSON.stringify(saved);
        localStorage.setItem(storageKey, serialized);
        localStorage.setItem(storageBackupKey, serialized);
        sessionStorage.setItem(storageKey, serialized);
        if (window.db) {
          const { error } = await window.db
            .from('orders')
            .update({ status: status.value })
            .eq('order_number', order.orderNumber);
          if (error) console.warn('Buyurtma holatini Supabasega saqlab bo‘lmadi.', error);
        }
        await loadOrders();
        renderDashboard();
      }
    });

    row.append(date, details, total, status);
    container.append(row);
  });
}

document.querySelectorAll('[data-language]').forEach(button => {
  button.addEventListener('click', () => {
    language = button.dataset.language;
    window.addEventListener('storage', event => {
      if (event.key === storageKey || event.key === storageBackupKey) {
        loadOrders();
        renderDashboard();
        if (!document.querySelector('#history-section').hidden) renderHistory();
      }
      if (event.key === inventoryStorageKey || event.key === inventoryBackupKey) {
        loadInventory();
        if (!document.querySelector('#products-section').hidden) renderProductList();
      }
    });

    applyLanguage();

    if (window.db) {
      window.db
        .channel('admin-orders')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => renderDashboard()
        )
        .subscribe();

      window.db
        .channel('admin-products')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          () => {
            loadInventory().then(() => {
              if (!document.querySelector('#products-section').hidden) renderProductList();
            });
          }
        )
        .subscribe();
    }
  });
});

document.querySelector('#admin-language').addEventListener('change', event => {
  language = event.target.value;
  applyLanguage();
  renderDashboard();
});

function resetLoginForm() {
  document.querySelector('#admin-login').reset();
  document.querySelector('#login-error').textContent = '';
}

function tryLogin() {
  const login = document.querySelector('#admin-login-name').value.trim();
  const password = document.querySelector('#admin-password').value;

  if (login !== '777' || password !== '777') {
    document.querySelector('#login-error').textContent = translations[language].wrong;
    return;
  }

  document.querySelector('#login-screen').hidden = true;
  document.querySelector('#admin-app').hidden = false;
  renderDashboard();
}

document.querySelector('#admin-login').addEventListener('submit', event => {
  event.preventDefault();
  tryLogin();
});

resetLoginForm();

document.querySelectorAll('[data-admin-section]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-admin-section]').forEach(item =>
      item.classList.remove('active')
    );
    button.classList.add('active');
    const showOrders = button.dataset.adminSection === 'orders';
    const showProducts = button.dataset.adminSection === 'products';
    const showHistory = button.dataset.adminSection === 'history';
    document.querySelector('#overview-section').hidden =
      showOrders || showProducts || showHistory;
    document.querySelector('#orders-section').hidden = !showOrders;
    document.querySelector('#products-section').hidden = !showProducts;
    document.querySelector('#history-section').hidden = !showHistory;
    if (showOrders) {
      renderOrderList(document.querySelector('#all-orders'), orders);
    }
    if (showProducts) {
      renderProductList();
    }
    if (showHistory) {
      loadOrders();
      renderHistory();
    }
  });
});

document.querySelector('#receipt-close').addEventListener('click', () => {
  document.querySelector('#receipt-modal').hidden = true;
});

document.querySelector('#receipt-modal').addEventListener('click', event => {
  if (event.target === document.querySelector('#receipt-modal')) {
    document.querySelector('#receipt-modal').hidden = true;
  }
});

document.querySelector('#admin-logout').addEventListener('click', () => {
  document.querySelector('#admin-app').hidden = true;
  document.querySelector('#login-screen').hidden = false;
  resetLoginForm();
});

document.querySelector('#product-add-main').addEventListener('click', () => {
  document.querySelector('#product-form').hidden = false;
  document.querySelector('#product-name').focus();
});

document.querySelector('#product-form-cancel').addEventListener('click', () => {
  document.querySelector('#product-form').reset();
  document.querySelector('#product-form').hidden = true;
});

document.querySelector('#product-form').addEventListener('submit', event => {
  event.preventDefault();
  loadInventory();
  const product = {
    id: `evos-product-${Date.now()}`,
    name: document.querySelector('#product-name').value.trim(),
    price: Number(document.querySelector('#product-price').value),
    stock: Number(document.querySelector('#product-stock').value),
    image: document.querySelector('#product-image').value.trim()
  };
  inventory.push(product);
  saveInventory();
  event.target.reset();
  event.target.hidden = true;
});

applyLanguage();
