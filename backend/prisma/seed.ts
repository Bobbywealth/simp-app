/**
 * Seed script — populates the live database with 10 realistic test profiles
 * (with deterministic portrait URLs + Hinge-style prompts) so the swipe deck
 * has content.
 *
 * Run via: `npm run prisma:seed`
 *
 * The script is idempotent — it wipes all existing seeded profiles (matched by
 * email) before re-inserting. Existing auth users/profiles from manual signup
 * are left untouched.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// High-resolution editorial portraits served from the frontend's canonical public assets.
const portraitUrl = (gender: 'women' | 'men', idx: number) =>
  `https://mysimp.com/editorial/profiles/${gender}-${String(idx).padStart(2, '0')}.jpg`;

type SeedProfile = {
  email: string;
  displayName: string;
  bio: string;
  birthDate: Date;
  gender: 'WOMAN' | 'MAN' | 'NONBINARY';
  lookingFor: 'WOMEN' | 'MEN' | 'EVERYONE';
  city: string;
  occupation: string;
  heightCm: number;
  isVerified?: boolean;
  portraitGender: 'women' | 'men';
  portraitIdxs: number[];
  prompts: { question: string; answer: string }[];
  interests: string[];
};

const profiles: SeedProfile[] = [
  {
    email: 'maya@simp-seed.demo',
    displayName: 'Maya',
    bio: 'Photographer chasing light across the city. Sunday markets, late-night diners, and very good coffee.',
    birthDate: new Date('1999-04-12'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Brooklyn, NY',
    occupation: 'Photographer',
    heightCm: 168,
    isVerified: true,
    portraitGender: 'women',
    portraitIdxs: [1, 4, 7],
    prompts: [
      { question: 'The way to win me over is', answer: 'A reservation somewhere you cannot pronounce — and a backup plan you actually checked.' },
      { question: 'I geek out over', answer: 'Golden hour, second-press zines, and the perfect espresso-to-milk ratio.' },
      { question: 'A perfect Sunday looks like', answer: 'Slow brunch, a long walk, and a record on the turntable by sundown.' },
    ],
    interests: ['photography', 'coffee', 'art', 'travel', 'film'],
  },
  {
    email: 'jordan@simp-seed.demo',
    displayName: 'Jordan',
    bio: 'Architect. I build things and I cook. Not necessarily in that order.',
    birthDate: new Date('1997-09-03'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Manhattan, NY',
    occupation: 'Architect',
    heightCm: 174,
    isVerified: true,
    portraitGender: 'women',
    portraitIdxs: [2, 5, 1],
    prompts: [
      { question: 'You should message me if', answer: 'You have a strong opinion about whether cilantro is a sin or a gift.' },
      { question: 'My most controversial take', answer: 'Cereal is a perfectly acceptable dinner — and I will die on that hill.' },
      { question: 'I am looking for', answer: 'Someone who plans the trip and lets me pick the restaurant.' },
    ],
    interests: ['architecture', 'cooking', 'travel', 'wine'],
  },
  {
    email: 'sophia@simp-seed.demo',
    displayName: 'Sophia',
    bio: 'Marketing director by day, heat-seeker by night. Looking for someone who can keep up.',
    birthDate: new Date('1995-11-21'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Jersey City, NJ',
    occupation: 'Marketing Director',
    heightCm: 170,
    isVerified: true,
    portraitGender: 'women',
    portraitIdxs: [3, 6, 2],
    prompts: [
      { question: 'Together we could', answer: 'Take a pottery class and laugh at the disasters we make.' },
      { question: 'Do not bother if', answer: 'You have never read a book you did not finish.' },
      { question: 'My greenest flag', answer: 'I will always order the weirdest thing on the menu first.' },
    ],
    interests: ['fitness', 'travel', 'wine', 'entrepreneurship'],
  },
  {
    email: 'camille@simp-seed.demo',
    displayName: 'Camille',
    bio: 'Fashion buyer. Dressed by the job, dressed up by choice. Black is my love language.',
    birthDate: new Date('2000-02-14'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Hoboken, NJ',
    occupation: 'Fashion Buyer',
    heightCm: 165,
    portraitGender: 'women',
    portraitIdxs: [4, 7, 3],
    prompts: [
      { question: 'The way to my heart', answer: 'Show up on time, dressed intentionally, with a plan you did not say out loud yet.' },
      { question: 'I want someone who', answer: "Knows the difference between a spritz and a bellini, and isn't afraid to correct me." },
    ],
    interests: ['fashion', 'travel', 'cocktails', 'art'],
  },
  {
    email: 'zara@simp-seed.demo',
    displayName: 'Zara',
    bio: 'Chef. I will cook you dinner. That is the entire pitch.',
    birthDate: new Date('1994-06-30'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Brooklyn, NY',
    occupation: 'Head Chef',
    heightCm: 172,
    isVerified: true,
    portraitGender: 'women',
    portraitIdxs: [5, 1, 4],
    prompts: [
      { question: 'My love language', answer: 'A spotless kitchen and a meal I did not have to order.' },
      { question: 'First date I would plan', answer: 'A walk through the farmers market, then back to mine to see what looked good.' },
      { question: 'I am convinced', answer: 'Hot sauce fixes almost everything, including bad first dates.' },
    ],
    interests: ['cooking', 'farmers-markets', 'wine', 'travel'],
  },
  {
    email: 'naomi@simp-seed.demo',
    displayName: 'Naomi',
    bio: 'Grad student in literature. I will read in public and you should bring a coffee.',
    birthDate: new Date('2001-12-08'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Manhattan, NY',
    occupation: 'PhD Student',
    heightCm: 163,
    portraitGender: 'women',
    portraitIdxs: [6, 2, 5],
    prompts: [
      { question: 'A shower thought I had', answer: 'If we are all just stories telling stories, would you be my epilogue?' },
      { question: 'I want to read more', answer: 'Anything you cannot stop quoting. I will borrow it and probably dog-ear it.' },
    ],
    interests: ['reading', 'writing', 'coffee', 'museums'],
  },
  {
    email: 'aria@simp-seed.demo',
    displayName: 'Aria',
    bio: 'Pilates instructor. Core strength and emotional availability — both are non-negotiable.',
    birthDate: new Date('1996-08-17'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Astoria, NY',
    occupation: 'Pilates Instructor',
    heightCm: 169,
    isVerified: true,
    portraitGender: 'women',
    portraitIdxs: [7, 3, 6],
    prompts: [
      { question: 'I will fall for you if', answer: 'You can laugh at yourself and mean it.' },
      { question: 'My weekend ritual', answer: 'Long reformer class, green juice, then absolutely nothing else.' },
    ],
    interests: ['fitness', 'wellness', 'coffee', 'travel'],
  },
  {
    email: 'kenji@simp-seed.demo',
    displayName: 'Kenji',
    bio: 'Software engineer. I write code, I lift heavy, I cook for everybody. Looking for someone who tells me to slow down.',
    birthDate: new Date('1993-03-25'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Brooklyn, NY',
    occupation: 'Senior Software Engineer',
    heightCm: 182,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [1, 4, 7],
    prompts: [
      { question: 'My weakness is', answer: 'Anyone who can name three of their favorite dishes without thinking.' },
      { question: 'I am looking for', answer: 'A reason to put the laptop down before midnight.' },
      { question: 'Together we could', answer: 'Cook our way through one cookbook a month and judge the photos.' },
    ],
    interests: ['coding', 'fitness', 'cooking', 'jazz'],
  },
  {
    email: 'priya@simp-seed.demo',
    displayName: 'Priya',
    bio: 'Resident physician. Long hours, dry humor, an illegal amount of coffee. Bring me a snack and I will marry you.',
    birthDate: new Date('1998-10-04'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Manhattan, NY',
    occupation: 'Resident Physician',
    heightCm: 167,
    isVerified: true,
    portraitGender: 'women',
    portraitIdxs: [2, 5, 1],
    prompts: [
      { question: 'My love language', answer: 'Snacks that show up without announcement.' },
      { question: 'I will outlast you at', answer: '24-hour diners, jazz clubs, and very long walks.' },
    ],
    interests: ['medicine', 'coffee', 'jazz', 'reading'],
  },
  {
    email: 'lena@simp-seed.demo',
    displayName: 'Lena',
    bio: 'Gallery owner. I look at art for a living and I still go to museums on weekends. Send me your favorite artist.',
    birthDate: new Date('1992-07-19'),
    gender: 'WOMAN',
    lookingFor: 'MEN',
    city: 'Brooklyn, NY',
    occupation: 'Gallery Owner',
    heightCm: 175,
    isVerified: true,
    portraitGender: 'women',
    portraitIdxs: [3, 6, 2],
    prompts: [
      { question: 'My most prized possession', answer: 'A Rothko print I bought at an estate sale for forty dollars.' },
      { question: 'I geek out over', answer: 'Curatorial copy, deep dives on emerging artists, and very clean lines.' },
      { question: 'You should know', answer: 'I will absolutely pick the wine. Trust me.' },
    ],
    interests: ['art', 'wine', 'museums', 'architecture'],
  },
  {
    email: 'marcus@simp-seed.demo',
    displayName: 'Marcus',
    bio: 'Chef at a small Brooklyn bistro. I will feed you well and steal your fries. Looking for someone who eats with enthusiasm.',
    birthDate: new Date('1991-06-12'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Brooklyn, NY',
    occupation: 'Executive Chef',
    heightCm: 185,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [2, 5, 3],
    prompts: [
      { question: 'I will cook for you if', answer: 'You bring the wine and don\u2019t ask for well-done steak.' },
      { question: 'My simple pleasures', answer: 'Farmers markets at 7am and the first coffee of the day.' },
    ],
    interests: ['cooking', 'wine', 'travel', 'jazz'],
  },
  {
    email: 'daniel@simp-seed.demo',
    displayName: 'Daniel',
    bio: 'Architect who still gets excited about good light in a room. Rock climbing on weekends, terrible at karaoke.',
    birthDate: new Date('1994-02-08'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Manhattan, NY',
    occupation: 'Architect',
    heightCm: 180,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [3, 6, 1],
    prompts: [
      { question: 'Together we could', answer: 'Redesign your apartment and then argue about the couch.' },
      { question: 'I geek out on', answer: 'Brutalist buildings and finding the best bagel within a 10 block radius.' },
    ],
    interests: ['architecture', 'fitness', 'art', 'travel'],
  },
  {
    email: 'ethan@simp-seed.demo',
    displayName: 'Ethan',
    bio: 'Product designer by day, amateur DJ by night. I take my coffee seriously and my playlists more seriously.',
    birthDate: new Date('1996-09-30'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Williamsburg, NY',
    occupation: 'Product Designer',
    heightCm: 178,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [4, 7, 2],
    prompts: [
      { question: 'My love language', answer: 'A perfectly curated playlist for exactly your mood.' },
      { question: 'I will fall for you if', answer: 'You have strong opinions about vinyl vs. streaming.' },
    ],
    interests: ['music', 'coffee', 'coding', 'art'],
  },
  {
    email: 'noah@simp-seed.demo',
    displayName: 'Noah',
    bio: 'ER doctor. I have seen it all and somehow still believe in romance. Ask me about my dog, not my job.',
    birthDate: new Date('1990-11-22'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Astoria, NY',
    occupation: 'Emergency Physician',
    heightCm: 183,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [5, 1, 4],
    prompts: [
      { question: 'You should know', answer: 'My dog is the real catch here, I am just his ride.' },
      { question: 'I will outlast you at', answer: 'Trivia night, every single time.' },
    ],
    interests: ['medicine', 'fitness', 'reading', 'travel'],
  },
  {
    email: 'omar@simp-seed.demo',
    displayName: 'Omar',
    bio: 'Photographer chasing golden hour across five boroughs. Will absolutely take a better photo of you than your last profile pic.',
    birthDate: new Date('1995-04-17'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Long Island City, NY',
    occupation: 'Photographer',
    heightCm: 176,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [6, 2, 5],
    prompts: [
      { question: 'My weekend ritual', answer: 'Chasing sunrise light with a camera and too much coffee.' },
      { question: 'I will fall for you if', answer: 'You can hold a pose without asking \u201cis this good?\u201d every ten seconds.' },
    ],
    interests: ['art', 'travel', 'coffee', 'museums'],
  },
  {
    email: 'liam@simp-seed.demo',
    displayName: 'Liam',
    bio: 'Finance by trade, standup comedy by hobby. My jokes are better than my spreadsheets, allegedly.',
    birthDate: new Date('1992-12-05'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Manhattan, NY',
    occupation: 'Investment Analyst',
    heightCm: 179,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [7, 3, 6],
    prompts: [
      { question: 'My weakness is', answer: 'A good pun, delivered with total confidence.' },
      { question: 'Together we could', answer: 'Heckle each other at open mic night, lovingly.' },
    ],
    interests: ['comedy', 'wine', 'fitness', 'jazz'],
  },
  {
    email: 'tariq@simp-seed.demo',
    displayName: 'Tariq',
    bio: 'High school teacher who coaches soccer on the side. I believe in showing up early and leaving late.',
    birthDate: new Date('1993-08-14'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Bushwick, NY',
    occupation: 'Teacher',
    heightCm: 181,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [1, 5, 3],
    prompts: [
      { question: 'I am looking for', answer: 'Someone who is kind to waiters and terrible at board games, like me.' },
      { question: 'My simple pleasures', answer: 'Sunday soccer, a good playlist, and my mom\u2019s cooking.' },
    ],
    interests: ['fitness', 'travel', 'reading', 'cooking'],
  },
  {
    email: 'gabriel@simp-seed.demo',
    displayName: 'Gabriel',
    bio: 'Startup founder, third company, finally profitable. I work hard, hike harder, and always have snacks in my bag.',
    birthDate: new Date('1989-01-27'),
    gender: 'MAN',
    lookingFor: 'WOMEN',
    city: 'Brooklyn, NY',
    occupation: 'Founder & CEO',
    heightCm: 184,
    isVerified: true,
    portraitGender: 'men',
    portraitIdxs: [2, 6, 4],
    prompts: [
      { question: 'My most prized possession', answer: 'A dented espresso pot from my first apartment. Sentimental, apparently.' },
      { question: 'You should know', answer: 'I will 100% talk about my startup too much on the first date. Stop me.' },
    ],
    interests: ['entrepreneurship', 'fitness', 'coffee', 'travel'],
  },
];

async function main() {
  console.log('Seeding SIMP test profiles...');

  const passwordHash = await bcrypt.hash('Demo123!', 10);

  for (const p of profiles) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { emailVerified: true },
      create: { email: p.email, passwordHash, emailVerified: true },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        displayName: p.displayName,
        bio: p.bio,
        birthDate: p.birthDate,
        gender: p.gender,
        lookingFor: p.lookingFor,
        city: p.city,
        occupation: p.occupation,
        heightCm: p.heightCm,
        isVerified: p.isVerified ?? false,
      },
      create: {
        userId: user.id,
        displayName: p.displayName,
        bio: p.bio,
        birthDate: p.birthDate,
        gender: p.gender,
        lookingFor: p.lookingFor,
        city: p.city,
        occupation: p.occupation,
        heightCm: p.heightCm,
        isVerified: p.isVerified ?? false,
      },
    });

    await prisma.photo.deleteMany({ where: { userId: user.id } });
    for (let i = 0; i < p.portraitIdxs.length; i++) {
      await prisma.photo.create({
        data: {
          userId: user.id,
          url: portraitUrl(p.portraitGender, p.portraitIdxs[i]),
          position: i,
        },
      });
    }

    await prisma.prompt.deleteMany({ where: { userId: user.id } });
    for (let i = 0; i < p.prompts.length; i++) {
      await prisma.prompt.create({
        data: {
          userId: user.id,
          question: p.prompts[i].question,
          answer: p.prompts[i].answer,
          position: i,
        },
      });
    }

    await prisma.userInterest.deleteMany({ where: { userId: user.id } });
    for (const slug of p.interests) {
      const label = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const interest = await prisma.interest.upsert({
        where: { slug },
        create: { slug, label },
        update: {},
      });
      await prisma.userInterest.create({
        data: { userId: user.id, interestId: interest.id },
      });
    }

    console.log(`  seeded ${p.displayName} (${p.email})`);
  }

  console.log(`\nDone. Seeded ${profiles.length} profiles.`);
  console.log('Demo password (all): Demo123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
