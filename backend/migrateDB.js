const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense-tracker';
const CLOUD_URI = 'mongodb+srv://mahantesh:mahantesh%400809@cluster0.f9stchy.mongodb.net/expense-tracker?retryWrites=true&w=majority';

// Import all models
const User = require('./models/User');
const Expense = require('./models/Expense');
const ExpenseRequest = require('./models/ExpenseRequest');
const Settlement = require('./models/Settlement');
const Notification = require('./models/Notification');

async function migrate() {
  console.log('Connecting to LOCAL database...');
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
  console.log('Connected to local database.');

  console.log('Connecting to CLOUD database...');
  const cloudConn = await mongoose.createConnection(CLOUD_URI).asPromise();
  console.log('Connected to cloud database.');

  try {
    const collections = [
      { name: 'User', modelLocal: localConn.model('User', User.schema), modelCloud: cloudConn.model('User', User.schema) },
      { name: 'Expense', modelLocal: localConn.model('Expense', Expense.schema), modelCloud: cloudConn.model('Expense', Expense.schema) },
      { name: 'ExpenseRequest', modelLocal: localConn.model('ExpenseRequest', ExpenseRequest.schema), modelCloud: cloudConn.model('ExpenseRequest', ExpenseRequest.schema) },
      { name: 'Settlement', modelLocal: localConn.model('Settlement', Settlement.schema), modelCloud: cloudConn.model('Settlement', Settlement.schema) },
      { name: 'Notification', modelLocal: localConn.model('Notification', Notification.schema), modelCloud: cloudConn.model('Notification', Notification.schema) },
    ];

    for (const col of collections) {
      console.log(`\nMigrating collection: ${col.name}...`);
      const docs = await col.modelLocal.find({}).lean();
      console.log(`Found ${docs.length} documents in local ${col.name}.`);

      if (docs.length > 0) {
        // Clear existing docs in cloud just in case to prevent dupes if run multiple times
        await col.modelCloud.deleteMany({});
        console.log(`Cleared existing cloud ${col.name} documents.`);
        
        await col.modelCloud.insertMany(docs);
        console.log(`Successfully inserted ${docs.length} documents into cloud ${col.name}.`);
      }
    }

    console.log('\n✅ MIGRATION COMPLETE!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await localConn.close();
    await cloudConn.close();
    process.exit(0);
  }
}

migrate();
