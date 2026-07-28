const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User'); // Adjust path if needed

dotenv.config({ path: '../.env' }); // Load .env from backend root

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const users = await User.findOne({username:'admin'});
    //console.log(`Found ${users.length} users.`);
    console.log(users)


        console.log(`Updating password for: ${users}`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("Expense-tracker@0809", salt);
        users.password = hashedPassword;
        await users.save();
    
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });