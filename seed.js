require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query } = require('../src/config/db');

const users = [
  {
    nationalId: '900000001V',
    fullName: 'Nimal Perera',
    role: 'staff',
    age: 42,
    address: 'SLBFE Head Office, Battaramulla',
    profession: 'Administrative Staff',
    affiliation: 'SLBFE',
    email: 'staff@slbfe.local',
    isVerified: true
  },
  {
    nationalId: '910000002V',
    fullName: 'Asha Fernando',
    role: 'officer',
    age: 38,
    address: 'SLBFE Regional Office, Kandy',
    profession: 'Verification Officer',
    affiliation: 'SLBFE',
    email: 'officer@slbfe.local',
    isVerified: true
  },
  {
    nationalId: '920000003V',
    fullName: 'Global Care Recruitment',
    role: 'company',
    age: 30,
    address: 'Colombo 03',
    profession: 'Recruitment Agency',
    affiliation: 'Global Care Recruitment',
    email: 'company@slbfe.local',
    isVerified: true
  },
  {
    nationalId: '930000004V',
    fullName: 'Kamal Silva',
    role: 'job_seeker',
    age: 29,
    address: 'Galle',
    currentLatitude: 6.0535,
    currentLongitude: 80.221,
    profession: 'Electrician',
    affiliation: 'Independent',
    email: 'kamal@example.com',
    isVerified: true,
    qualifications: [
      ['NVQ Level 4 Electrical', 'Technical College Galle', 2021],
      ['Workplace Safety Certificate', 'SLBFE Training Centre', 2022]
    ],
    contacts: [['Sunil Silva', 'Father', '+94771234567', 'sunil@example.com', 'Galle']]
  },
  {
    nationalId: '940000005V',
    fullName: 'Fathima Nazeer',
    role: 'job_seeker',
    age: 31,
    address: 'Kandy',
    currentLatitude: 7.2906,
    currentLongitude: 80.6337,
    profession: 'Caregiver',
    affiliation: 'Independent',
    email: 'fathima@example.com',
    isVerified: true,
    qualifications: [
      ['Caregiver Certificate', 'National Vocational Training Institute', 2020],
      ['English Language Certificate', 'British Council', 2021]
    ],
    contacts: [['Mariam Nazeer', 'Sister', '+94775556666', 'mariam@example.com', 'Kandy']]
  }
];

async function insertUser(user, passwordHash) {
  const existing = await query('SELECT id FROM Citizens WHERE national_id = @nationalId OR email = @email', {
    nationalId: user.nationalId,
    email: user.email
  });

  if (existing.recordset.length > 0) {
    return existing.recordset[0].id;
  }

  const result = await query(
    `INSERT INTO Citizens (
      national_id, full_name, role, age, address, current_latitude, current_longitude,
      profession, affiliation, email, password_hash, is_verified
    )
    OUTPUT INSERTED.id
    VALUES (
      @nationalId, @fullName, @role, @age, @address, @currentLatitude, @currentLongitude,
      @profession, @affiliation, @email, @passwordHash, @isVerified
    )`,
    {
      nationalId: user.nationalId,
      fullName: user.fullName,
      role: user.role,
      age: user.age,
      address: user.address,
      currentLatitude: user.currentLatitude || null,
      currentLongitude: user.currentLongitude || null,
      profession: user.profession,
      affiliation: user.affiliation,
      email: user.email,
      passwordHash,
      isVerified: user.isVerified
    }
  );

  return result.recordset[0].id;
}

async function seed() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  for (const user of users) {
    const citizenId = await insertUser(user, passwordHash);

    for (const q of user.qualifications || []) {
      await query(
        `IF NOT EXISTS (
          SELECT 1 FROM Qualifications WHERE citizen_id = @citizenId AND qualification_name = @name
        )
        INSERT INTO Qualifications (citizen_id, qualification_name, institution, year_completed)
        VALUES (@citizenId, @name, @institution, @yearCompleted)`,
        { citizenId, name: q[0], institution: q[1], yearCompleted: q[2] }
      );
    }

    for (const c of user.contacts || []) {
      await query(
        `IF NOT EXISTS (
          SELECT 1 FROM CitizenContacts WHERE citizen_id = @citizenId AND contact_name = @contactName
        )
        INSERT INTO CitizenContacts (citizen_id, contact_name, relationship, phone, email, address)
        VALUES (@citizenId, @contactName, @relationship, @phone, @email, @address)`,
        {
          citizenId,
          contactName: c[0],
          relationship: c[1],
          phone: c[2],
          email: c[3],
          address: c[4]
        }
      );
    }
  }

  console.log('Seed completed. All sample accounts use password: Password123!');
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
