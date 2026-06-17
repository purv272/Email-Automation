import mongoose, { initDatabase, Template, Buyer, Setting } from './database.js';

const seed = async () => {
  console.log('Seeding trial database with sample outreach data...');
  
  try {
    // Connect to database
    await initDatabase();

    // 1. Insert sample template
    const templateName = 'Ve Veyron - Spice Wholesalers Outreach';
    const templateSubject = 'Explore Spice Sourcing Opportunities - Ve Veyron Exports';
    const templateBody = `Dear {{Company_Name}} Team,

I hope you are doing well.

We are Ve Veyron Exports, an Indian spice exporter specializing in high-quality spices.

We supply:
- Turmeric Powder
- Chilli Powder
- Cumin Powder
- Coriander Powder
- Onion Powder
- Garlic Powder

We would like to explore business opportunities with your company.

Please let us know your requirements.

Regards,
Ugam
Ve Veyron Exports`;

    // Clear existing templates if any
    await Template.deleteMany({ name: templateName });

    const templateResult = await Template.create({
      name: templateName,
      subject: templateSubject,
      body: templateBody,
      created_at: new Date().toISOString()
    });
    console.log(`Sample template seeded. ID: ${templateResult._id}`);

    // Set as default follow-up templates placeholders in settings
    await Setting.findOneAndUpdate(
      { key: 'followup_1_template_id' },
      { value: templateResult._id.toString() },
      { upsert: true }
    );
    await Setting.findOneAndUpdate(
      { key: 'followup_2_template_id' },
      { value: templateResult._id.toString() },
      { upsert: true }
    );
    console.log('Follow-up templates configured in settings.');

    // 2. Insert sample buyers
    const buyers = [
      { company_name: 'ABC Foods', email: 'buyer@abcfoods.com', country: 'United States', product_interest: 'Turmeric Powder, Cumin Powder' },
      { company_name: 'XYZ Trading', email: 'info@xyztrading.com', country: 'Germany', product_interest: 'Chilli Powder, Garlic Powder' },
      { company_name: 'Global Spices Ltd', email: 'purchase@globalspices.com', country: 'United Kingdom', product_interest: 'Coriander Powder, Onion Powder' }
    ];

    for (const b of buyers) {
      try {
        // Clear existing duplicate
        await Buyer.deleteMany({ email: b.email });
        
        await Buyer.create({
          company_name: b.company_name,
          email: b.email,
          country: b.country,
          website: `www.${b.company_name.toLowerCase().replace(/\s+/g, '')}.com`,
          product_interest: b.product_interest,
          status: 'Imported',
          followup_status: 'None'
        });
        console.log(`Sample buyer seeded: ${b.company_name}`);
      } catch (err) {
        console.log(`Error seeding buyer ${b.company_name}:`, err.message);
      }
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding trial data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

seed();
