const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User'); // Adjust path if needed

dotenv.config({ path: '../.env' }); // Load .env from backend root

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const users = await User.find({});
    console.log(`Found ${users.length} users.`);
    
    if (users.length !== 0) {
      for (const element of users) {
        // We probably don't want to change the admin's password
        if (element.role === 'admin') {
          console.log(`Skipping admin user: ${element.username}`);
          continue;
        }

        console.log(`Updating password for: ${element.username}`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(element.username, salt);
        element.password = hashedPassword;
        await element.save();
      }
    }
    
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });