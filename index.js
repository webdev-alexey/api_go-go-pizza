import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'node:fs/promises';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/img', express.static('img'));

const loadData = async () => {
  const data = await readFile('db.json');
  return JSON.parse(data);
};

app.get('/api/products', async (req, res) => {
  const data = await loadData();
  const { toppings } = req.query;

  const selectedToppings = toppings ? toppings.split(',') : [];

  const filteredProducts =
    selectedToppings.length > 0
      ? data.pizzas.filter(product =>
          selectedToppings.every(topping =>
            Object.values(product.toppings).some(toppingList =>
              toppingList.includes(topping),
            ),
          ),
        )
      : data.pizzas;

  const productsWithImages = filteredProducts.map(product => {
    const images = product.img.map(img => `https://${req.get('host')}/${img}`);

    //const images = product.img.map(img => `${req.protocol}://${req.get('host')}/${img}`);
    const { img, ...productWithoutImg } = product;
    return { ...productWithoutImg, images };
  });

  res.json(productsWithImages);
});

app.get('/api/products/:id', async (req, res) => {
  const data = await loadData();
  const product = data.pizzas.find(item => item.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Проверяем, существует ли поле img
  if (!product.img) {
    return res.status(404).json({ error: 'Images not found for this product' });
  }

  // Преобразуем относительные пути изображений в полные адреса
  const images = product.img.map(
    img => `${req.protocol}://${req.get('host')}/${img}`,
  );
  // Удаляем поле img из объекта пиццы
  delete product.img;
  // Создаем новый объект пиццы с добавленным полем images и без поля img
  const productWithImages = { ...product, images };

  res.json(productWithImages);
});

app.get('/api/toppings', async (req, res) => {
  const data = await loadData();
  const allToppings = data.toppings;
  res.json(allToppings);
});

app.post('/api/orders', async (req, res) => {
  const { name, phone, address, paymentMethod, pizzas } = req.body;

  if (
    !name ||
    !phone ||
    !address ||
    !paymentMethod ||
    !pizzas ||
    !Array.isArray(pizzas)
  ) {
    return res
      .status(400)
      .json({ error: 'Missing required data in the request' });
  }

  let orders = [];
  try {
    const ordersData = await readFile('orders.json');
    orders = JSON.parse(ordersData);
  } catch (error) {
    console.error('Error reading orders:', error);
  }

  const orderId = Date.now();

  const newOrder = {
    id: orderId,
    name,
    phone,
    address,
    paymentMethod,
    pizzas,
  };

  orders.push(newOrder);

  try {
    await writeFile('orders.json', JSON.stringify(orders, null, 2));
    res.status(201).json({ message: 'Order created successfully', orderId });
  } catch (error) {
    console.error('Error writing orders:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
