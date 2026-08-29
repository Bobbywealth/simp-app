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

// Real portrait URLs — randomuser.me serves 100 deterministic faces per gender
const portraitUrl = (gender: 'women' | 'men', idx: number) =>
  `https://randomuser.me/api/portraits/${gender}/${idx}.jpg`;

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
    portraitIdxs: [44, 65, 33],
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
    portraitIdxs: [47, 25, 88],
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
    isPremium: true,
    portraitGender: 'women',
    portraitIdxs: [11, 90, 60],
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
    portraitIdxs: [5, 23, 79],
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
    portraitIdxs: [68, 14, 95],
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
    portraitIdxs: [37, 56, 80],
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
    portraitIdxs: [76, 39, 81],
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
    portraitIdxs: [33, 51, 84],
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
    portraitIdxs: [26, 49, 71],
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
    portraitIdxs: [2, 17, 91],
    prompts: [
      { question: 'My most prized possession', answer: 'A Rothko print I bought at an estate sale for forty dollars.' },
      { question: 'I geek out over', answer: 'Curatorial copy, deep dives on emerging artists, and very clean lines.' },
      { question: 'You should know', answer: 'I will absolutely pick the wine. Trust me.' },
    ],
    interests: ['art', 'wine', 'museums', 'architecture'],
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
