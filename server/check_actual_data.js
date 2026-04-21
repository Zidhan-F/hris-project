const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkActualData() {
  const dockerUri = 'mongodb://localhost:27018/EMS';
  console.log('Connecting to Docker MongoDB at:', dockerUri);
  try {
    await mongoose.connect(dockerUri);
    const db = mongoose.connection.db;
    const settingsColl = db.collection('settings');
    const allSettings = await settingsColl.find({}).toArray();
    console.log('All Settings in DB:', JSON.stringify(allSettings, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  await mongoose.connection.close();
}

checkActualData();
